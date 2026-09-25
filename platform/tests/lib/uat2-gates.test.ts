// UAT run 2 (batch hB) — phase gates, completion gates and sign-off rules that
// deadlocked a file: each rule applies only where its task exists for the
// engagement's complexity and triggers.
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "7d2d2d2d-7d2d-4d2d-8d2d-7d2d2d2d2d2d";
const USER = "7d2d2d2d-7d2d-4d2d-8d2d-7d2d2d2d2d01";
const EQR = "7d2d2d2d-7d2d-4d2d-8d2d-7d2d2d2d2d02";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en" },
  })),
}));

import { completionGates } from "@/lib/completion";
import { closePool } from "@/lib/db";
import { saveDsp } from "@/lib/design-procedures";
import { generateDocument, signDocument, WALKTHROUGH_KEYS } from "@/lib/documents";
import { createEngagement } from "@/lib/engagements";
import { saveForm } from "@/lib/forms";
import { phaseStillOpen, planningCloseGates } from "@/lib/gates";
import { planningRas } from "@/lib/planning-ras";
import { assignTeamMember } from "@/lib/team";
import { paperFor, savePaper } from "@/lib/working-papers";
import { requiredKeys } from "@/lib/papers/types";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let clientId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1::uuid[])", [[USER, EQR]]);
}

async function item(engagementId: string, code: string): Promise<{ id: string; conditional: boolean } | null> {
  const r = await admin.query<{ id: string; conditional: boolean }>(
    "SELECT id, conditional FROM file_item WHERE engagement_id = $1 AND code = $2",
    [engagementId, code],
  );
  return r.rows[0] ?? null;
}

async function completePaper(engagementId: string, code: string): Promise<void> {
  await savePaper(
    engagementId,
    code,
    Object.fromEntries(
      requiredKeys(paperFor(code)).map((k) => [k, k.startsWith("q_") || k.startsWith("c_") ? "yes" : "Done — see file."]),
    ),
  );
}

// one engagement per client and fiscal year: every fixture takes the next year
let year = 2000;

async function engagement(complexity: "very_simple" | "non_complex" | "complex", firstAudit = false): Promise<string> {
  year += 1;
  return createEngagement({
    clientId,
    fiscalYear: year,
    periodEnd: `${year}-12-31`,
    complexity,
    complexityAnswers: firstAudit ? { firstAudit: true } : {},
  });
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'UAT2 Gates Firm', 'uat2-gates-test')", [TENANT]);
  await admin.query(
    `INSERT INTO app_user (id, email, name, password_hash) VALUES
       ($1, 'uat2gates@test.local', 'Gates Tester', 'x'), ($2, 'uat2eqr@test.local', 'Quality Reviewer', 'x')`,
    [USER, EQR],
  );
  await admin.query(
    "INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $3, 'firm_admin'), ($2, $3, 'eqr_reviewer')",
    [USER, EQR, TENANT],
  );
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'UAT2 Gates SA', 'SA') RETURNING id",
    [TENANT],
  );
  clientId = client.rows[0].id;
}, 30_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("B06 — completion papers are signable before the report", () => {
  it("opens conclusion-bucket papers from execution, except the post-report C6.x", () => {
    expect(phaseStillOpen("conclusion", "execution", "C4.2")).toBeNull();
    expect(phaseStillOpen("conclusion", "execution", "C4.1")).toBeNull();
    expect(phaseStillOpen("conclusion", "execution", "C6.2")).toBe("execution-open");
    expect(phaseStillOpen("conclusion", "planning", "C4.1")).toBe("planning-open");
    expect(phaseStillOpen("execution", "planning", "E4.1")).toBe("planning-open");
  });

  it("signs C4.3 in execution (the report needs it), refuses C6.2", async () => {
    const id = await engagement("very_simple");
    await admin.query("UPDATE engagement SET phase = 'execution' WHERE id = $1", [id]);
    await completePaper(id, "C4.3");
    const c43 = await generateDocument((await item(id, "C4.3"))!.id, "en");
    await expect(signDocument(c43, "preparer")).resolves.toBe("preparer");
    const c62 = await generateDocument((await item(id, "C6.2"))!.id, "en");
    await expect(signDocument(c62, "preparer")).rejects.toThrow("execution-open");
  });
});

describe("B09/B14/B07 — planning close on a very simple file", () => {
  let id: string;
  beforeAll(async () => {
    id = await engagement("very_simple");
    await admin.query("UPDATE engagement SET phase = 'planning' WHERE id = $1", [id]);
  });

  it("does not demand a partner sign-off on P2.2 the file does not hold", async () => {
    expect(await item(id, "P2.2")).toBeNull();
    const keys = (await planningCloseGates(id)).map((g) => g.key);
    expect(keys).not.toContain("p22_partner_signed");
    expect(keys).toEqual(expect.arrayContaining(["p52_partner_signed", "s31_partner_signed", "p72_partner_signed"]));
  });

  it("does not count tasks absent from the file as unready deliverables on P7.2", async () => {
    const ras = await planningRas(id);
    expect(ras.tasks["P4.2"].status).toBe("absent");
    expect(ras.tasks["P2.2"].status).toBe("absent");
    // a7 (S2.1/S2.2) and a8 (P2.2) rest only on tasks a very simple file does
    // not hold; the eight other lines rest on untouched tasks it does hold.
    expect(ras.unreadyA).toBe(8);
  });

  it("reads the P7.2 approval from the summary's partner signature, not a chip", async () => {
    await admin.query(
      `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value)
       VALUES ($1, $2, 'wp:P7.2', 'sig_partner', to_jsonb('Partner|2026-01-15 10:00'::text))`,
      [TENANT, id],
    );
    // a partner signature standing over unanswered confirmations is no approval
    const gate = (await planningCloseGates(id)).find((g) => g.key === "p72_partner_signed");
    expect(gate?.ok).toBe(false);
    const p72 = await generateDocument((await item(id, "P7.2"))!.id, "en");
    await signDocument(p72, "preparer");
    await expect(signDocument(p72, "partner")).rejects.toThrow("ras-not-approved");
  });
});

describe("B19 — the predecessor task on an initial audit of a very simple entity", () => {
  it("creates P1.2 from the nature-of-entity first-audit answer", async () => {
    const id = await engagement("very_simple", true);
    expect(await item(id, "P1.2")).toEqual(expect.objectContaining({ conditional: false }));
  });

  it("creates P1.2 when P1.1 concludes a new engagement", async () => {
    const id = await engagement("very_simple");
    expect(await item(id, "P1.2")).toBeNull();
    await saveForm(id, "P1.1", { engagement_type: "new" });
    expect(await item(id, "P1.2")).toEqual(expect.objectContaining({ conditional: false }));
  });
});

describe("B13 — the EQR paper follows the EQR, not the tier", () => {
  it("adds C4.2 when a quality reviewer joins a non-complex file", async () => {
    const id = await engagement("non_complex");
    expect(await item(id, "C4.2")).toBeNull();
    await assignTeamMember(id, EQR, "eqr_reviewer");
    expect(await item(id, "C4.2")).toEqual(expect.objectContaining({ conditional: false }));
    expect((await completionGates(id)).find((g) => g.key === "eqr_complete")?.ok).toBe(false);
  });

  it("adds C4.2 when P1.5 concludes an EQR is required", async () => {
    const id = await engagement("very_simple");
    await savePaper(id, "P1.5", { q_eqr: "yes" });
    expect(await item(id, "C4.2")).toEqual(expect.objectContaining({ conditional: false }));
  });
});

describe("B20 — a designed account gets its E4 paper", () => {
  it("adds E4.12 when P3 procedures are designed in S5.5 on a non-complex file", async () => {
    const id = await engagement("non_complex");
    expect(await item(id, "E4.12")).toBeNull();
    await saveDsp(id, "P3", "sel_E", "[]");
    expect(await item(id, "E4.12")).toBeNull();
    await saveDsp(id, "P3", "sel_E", "[0]");
    expect(await item(id, "E4.12")).toEqual(expect.objectContaining({ conditional: false }));
  });
});

describe("B08 — embed-only papers are judged on their board", () => {
  let id: string;
  let scotId: string;
  beforeAll(async () => {
    id = await engagement("non_complex");
    await admin.query("UPDATE engagement SET phase = 'planning' WHERE id = $1", [id]);
    const scot = await admin.query<{ id: string }>(
      "INSERT INTO scot (tenant_id, engagement_id, name) VALUES ($1, $2, 'Purchases') RETURNING id",
      [TENANT, id],
    );
    scotId = scot.rows[0].id;
  });

  it("S1.2: refuses while a SCOT has no WCGW, signs once it has one", async () => {
    const doc = await generateDocument((await item(id, "S1.2"))!.id, "en");
    await expect(signDocument(doc, "preparer")).rejects.toThrow("wcgw-missing");
    await admin.query(
      "INSERT INTO wcgw (tenant_id, scot_id, description, assertions) VALUES ($1, $2, 'Unrecorded invoices', ARRAY['C'])",
      [TENANT, scotId],
    );
    await expect(signDocument(doc, "preparer")).resolves.toBe("preparer");
  });

  it("S1.3: refuses a partial walkthrough, signs a complete one", async () => {
    const doc = await generateDocument((await item(id, "S1.3"))!.id, "en");
    await expect(signDocument(doc, "preparer")).rejects.toThrow("walkthrough-incomplete");
    for (const key of WALKTHROUGH_KEYS) {
      await admin.query(
        `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value)
         VALUES ($1, $2, $3, $4, to_jsonb('yes'::text))`,
        [TENANT, id, `wt:${scotId}`, key],
      );
    }
    await expect(signDocument(doc, "preparer")).resolves.toBe("preparer");
  });
});
