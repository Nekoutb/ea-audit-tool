import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c7c";
const USER = "7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c01";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en" },
  })),
}));

import {
  archiveEngagement,
  assemblyDeadline,
  completionGates,
  CompletionGateError,
  getCompletionRecord,
  getConclusionState,
  issueReport,
  recordCompletion,
  rollforward,
} from "@/lib/completion";
import { closePool } from "@/lib/db";
import { checkoutDocument, generateDocument, signDocument } from "@/lib/documents";
import { createEngagement } from "@/lib/engagements";
import { computeBilan, computeCr } from "@/lib/fs-tieout";
import { generateLetter } from "@/lib/letters";
import { approveMateriality, createMaterialityVersion } from "@/lib/materiality";
import { decideOpinion, generateAuditReport } from "@/lib/report";
import { paperFor, savePaper } from "@/lib/working-papers";
import { requiredKeys } from "@/lib/papers/types";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let engagementId: string;

async function removeFixture(): Promise<void> {
  // Dropping the tenant cascades into completion_record, and the archive
  // manifest there is immutable by trigger (20260820000011). Teardown disables
  // the trigger rather than the guard being relaxed to suit the tests — a
  // superuser may do this, the application role may not, which is the point.
  await admin.query("ALTER TABLE completion_record DISABLE TRIGGER trg_manifest_immutable");
  try {
    await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  } finally {
    await admin.query("ALTER TABLE completion_record ENABLE TRIGGER trg_manifest_immutable");
  }
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

/** Prefix-matching closings stub over a synthetic account map. */
function closingsOf(accounts: Record<string, number>) {
  return {
    get(prefixes: string[], exclude: string[] = []): number {
      let total = 0;
      for (const [account, closing] of Object.entries(accounts)) {
        if (exclude.some((prefix) => account.startsWith(prefix))) continue;
        if (prefixes.some((prefix) => account.startsWith(prefix))) total += closing;
      }
      return total;
    },
  };
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Concl Firm', 'concl-test')", [TENANT]);
  await admin.query(
    "INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'concl@test.local', 'Concl Tester', 'x')",
    [USER],
  );
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Concl SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
  await admin.query("UPDATE engagement SET phase = 'execution' WHERE id = $1", [engagementId]);
  const version = await createMaterialityVersion(engagementId, {
    benchmark: "revenue", benchmarkAmount: 200_000_000, percentage: 1,
    justification: "Test.", performancePct: 75, trivialPct: 5,
  });
  await approveMateriality(engagementId, version);
}, 30_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("7.4/7.5 FS tie-out math (Appendix B.3)", () => {
  // Balanced synthetic TB: sales 10M (credit), purchases 4M, personnel 2M,
  // receivables 12M, bank 2M, capital 10M (credit). Résultat = 4M.
  const closings = closingsOf({
    "701100": -10_000_000,
    "601100": 4_000_000,
    "661100": 2_000_000,
    "411100": 12_000_000,
    "521100": 2_000_000,
    "101100": -10_000_000,
  });

  it("computes the SIG cascade line-by-line", () => {
    const cr = computeCr(closings);
    const byRef = new Map(cr.lines.map((line) => [line.ref, line.amount]));
    expect(byRef.get("TA")).toBe(10_000_000); // ventes de marchandises
    expect(byRef.get("XA")).toBe(6_000_000); // marge commerciale
    expect(byRef.get("XB")).toBe(10_000_000); // chiffre d'affaires
    expect(byRef.get("XC")).toBe(6_000_000); // valeur ajoutée
    expect(byRef.get("XD")).toBe(4_000_000); // EBE after 2M personnel
    expect(byRef.get("XI")).toBe(4_000_000); // résultat net
    expect(cr.result).toBe(4_000_000);
  });

  it("verifies bilan equilibrium against the CR result", () => {
    const cr = computeCr(closings);
    const bilan = computeBilan(closings, cr.result);
    expect(bilan.checks.find((check) => check.key === "tb_balanced")?.ok).toBe(true);
    expect(bilan.checks.find((check) => check.key === "bilan_equilibrium")?.ok).toBe(true);
    expect(bilan.lines.find((line) => line.ref === "CP")?.amount).toBe(10_000_000);
  });

  it("flags a one-sided TB as unbalanced", () => {
    const broken = closingsOf({ "701100": -10_000_000, "411100": 12_000_000 });
    const cr = computeCr(broken);
    const bilan = computeBilan(broken, cr.result);
    expect(bilan.checks.find((check) => check.key === "tb_balanced")?.ok).toBe(false);
  });
});

describe("7.9 opinion decision tree (ISA 700/705/570)", () => {
  it("maps misstatement/limitation × pervasiveness to the four opinions", () => {
    const base = { materialMisstatement: false, pervasive: false, scopeLimitation: false, goingConcernUncertainty: false };
    expect(decideOpinion(base).opinion).toBe("unmodified");
    expect(decideOpinion({ ...base, materialMisstatement: true }).opinion).toBe("qualified");
    expect(decideOpinion({ ...base, materialMisstatement: true, pervasive: true }).opinion).toBe("adverse");
    expect(decideOpinion({ ...base, scopeLimitation: true }).opinion).toBe("qualified");
    expect(decideOpinion({ ...base, scopeLimitation: true, pervasive: true }).opinion).toBe("disclaimer");
    expect(decideOpinion({ ...base, goingConcernUncertainty: true })).toEqual({
      opinion: "unmodified",
      goingConcernParagraph: true,
    });
  });
});

describe("7.1/7.10 completion gates block issuance", () => {
  it("refuses to issue while gates fail, naming the failed gates", async () => {
    await expect(issueReport(engagementId, "unmodified", "2026-03-31")).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof CompletionGateError &&
        error.failed.includes("risks_concluded") &&
        error.failed.includes("partner_conclusion") &&
        error.failed.includes("rep_letters_generated"),
    );
  });

  it("issues once every gate passes, then refuses a second issuance", async () => {
    await admin.query("UPDATE risk SET status = 'concluded' WHERE engagement_id = $1", [engagementId]);
    await recordCompletion(engagementId, "final_analytical_review", { lines: [] });
    await recordCompletion(engagementId, "fs_tieout", { checks: [] });
    await recordCompletion(engagementId, "disclosure_checklist", { notesRange: "1-36" });
    await recordCompletion(engagementId, "subsequent_events", { reviewedTo: "2026-03-31" });
    await recordCompletion(engagementId, "points_forward", { points: "Review new IT system next year." });
    await recordCompletion(engagementId, "partner_conclusion", { independenceReconfirmed: true });
    await generateLetter(engagementId, "rep_affirmation", "fr");
    await generateLetter(engagementId, "rep_complementary", "fr");

    const gates = await completionGates(engagementId);
    expect(gates.every((gate) => gate.ok)).toBe(true);

    await issueReport(engagementId, "unmodified", "2026-03-31");
    const state = await getConclusionState(engagementId);
    expect(state.reportDate).toBe("2026-03-31");
    expect(state.opinion).toBe("unmodified");

    await expect(issueReport(engagementId, "unmodified", "2026-04-01")).rejects.toThrow("already-issued");
  });

  it("computes the 60-day assembly deadline", () => {
    expect(assemblyDeadline("2026-03-31")).toBe("2026-05-30");
  });
});

describe("7.10 OHADA statutory report", () => {
  it("files the FR report under C2.1 as kind='report' (docx)", async () => {
    const documentId = await generateAuditReport({
      engagementId,
      opinion: "unmodified",
      goingConcernParagraph: false,
      reportDate: "2026-03-31",
    });
    const doc = await admin.query<{ kind: string; title: string }>(
      "SELECT kind, title FROM document WHERE id = $1",
      [documentId],
    );
    expect(doc.rows[0].kind).toBe("report");
    expect(doc.rows[0].title).toContain("Rapport CAC");
    const content = await admin.query<{ content: Buffer }>(
      "SELECT content FROM document_version WHERE document_id = $1",
      [documentId],
    );
    expect(content.rows[0].content.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});

describe("7.11/7.12 archive immutability + rollforward", () => {
  it("archives with a manifest, then blocks any document mutation", async () => {
    // the ISA 230 archive gates demand the C6.2 assembly checklist AND the
    // C4.1 review & approval summary concluded
    for (const code of ["C6.2", "C4.1"]) {
      await savePaper(
        engagementId,
        code,
        Object.fromEntries(
          requiredKeys(paperFor(code)).map((k) => [k, k.startsWith("q_") || k.startsWith("c_") ? "yes" : "Done."]),
        ),
      );
    }
    // ...and, since the gates became file-item based (finding C5), every task
    // that holds work must hold a paper that is prepared AND reviewed. C6.2 and
    // C4.1 now hold saved working-paper values, so each owes a signed document.
    // (The rep letters and the statutory report are deliverables, not papers —
    // they answer their own gates.)
    for (const code of ["C6.2", "C4.1"]) {
      const item = await admin.query<{ id: string }>(
        "SELECT id FROM file_item WHERE engagement_id = $1 AND code = $2",
        [engagementId, code],
      );
      const documentId = await generateDocument(item.rows[0].id, "en");
      await signDocument(documentId, "preparer");
      await signDocument(documentId, "partner");
    }

    await archiveEngagement(engagementId);
    const state = await getConclusionState(engagementId);
    expect(state.archivedAt).not.toBeNull();
    const manifest = await getCompletionRecord(engagementId, "archive_manifest");
    expect(manifest).not.toBeNull();
    expect(Array.isArray(manifest?.risks)).toBe(true);

    const doc = await admin.query<{ id: string }>(
      "SELECT id FROM document WHERE engagement_id = $1 LIMIT 1",
      [engagementId],
    );
    await expect(checkoutDocument(doc.rows[0].id)).rejects.toThrow("archived");
    await expect(archiveEngagement(engagementId)).rejects.toThrow("already-archived");
  });

  it("rolls forward to N+1 carrying the C6.1 points", async () => {
    await expect(rollforward(engagementId, 2025)).rejects.toThrow("invalid-year");
    const newId = await rollforward(engagementId, 2026);
    const engagement = await admin.query<{ fiscal_year: number; period_end: string }>(
      "SELECT fiscal_year, to_char(period_end, 'YYYY-MM-DD') AS period_end FROM engagement WHERE id = $1",
      [newId],
    );
    expect(engagement.rows[0].fiscal_year).toBe(2026);
    expect(engagement.rows[0].period_end).toBe("2026-12-31");
    const carried = await getCompletionRecord(newId, "points_from_prior");
    expect(String(carried?.points)).toContain("IT system");
  });
});
