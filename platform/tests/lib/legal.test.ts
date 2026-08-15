import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "8f8f8f8f-8f8f-4f8f-8f8f-8f8f8f8f8f8f";
const USER = "8f8f8f8f-8f8f-4f8f-8f8f-8f8f8f8f8f01";

const mockedUser = {
  user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en" },
};

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => mockedUser),
}));

import { auth } from "@/auth";
import { advanceAlerte, getAlerte, resumeAlerte, startAlerte } from "@/lib/alerte";
import { recordCompletion } from "@/lib/completion";
import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import {
  addConvention,
  addDaysIso,
  addMonthsClamped,
  equityCheck,
  escalateOverdue,
  generateArticle715Report,
  generateDeadlines,
  generateRapportSpecial,
  generateTitresAttestation,
  listConventions,
  listDeadlines,
  listFaits,
  markDeadlineDone,
  revealFait,
  setShareCapital,
} from "@/lib/legal";
import { generateAuditReport } from "@/lib/report";
import { importTrialBalance } from "@/lib/tb";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let saClient: string;
let saEngagement: string;
let sarlEngagement: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

async function docIsZip(documentId: string): Promise<boolean> {
  const result = await admin.query<{ content: Buffer }>(
    "SELECT content FROM document_version WHERE document_id = $1 ORDER BY version_no DESC LIMIT 1",
    [documentId],
  );
  return result.rows[0].content.subarray(0, 2).toString("latin1") === "PK";
}

const HEADERS = "Compte;Libellé;Mouvement débit;Mouvement crédit";

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Legal Firm', 'legal-test')", [TENANT]);
  await admin.query(
    "INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'legal@test.local', 'Legal Tester', 'x')",
    [USER],
  );
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);

  const sa = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form, mandate_type, mandate_start_year) VALUES ($1, 'Legal SA', 'SA', 'ago', 2024) RETURNING id",
    [TENANT],
  );
  saClient = sa.rows[0].id;
  const sarl = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Legal SARL', 'SARL') RETURNING id",
    [TENANT],
  );
  saEngagement = await createEngagement({ clientId: saClient, fiscalYear: 2025, periodEnd: "2025-12-31" });
  sarlEngagement = await createEngagement({ clientId: sarl.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
  await admin.query("UPDATE engagement SET agm_date = '2026-06-15' WHERE id = $1", [saEngagement]);
  await admin.query(
    "INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role) VALUES ($1, $2, $3, 'partner')",
    [TENANT, saEngagement, USER],
  );
}, 30_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("statutory date arithmetic", () => {
  it("clamps month-end overflow (Dec 31 + 4 months = Apr 30)", () => {
    expect(addMonthsClamped("2025-12-31", 4)).toBe("2026-04-30");
    expect(addMonthsClamped("2025-12-31", 6)).toBe("2026-06-30");
    expect(addMonthsClamped("2025-01-15", 1)).toBe("2025-02-15");
    expect(addDaysIso("2026-06-15", -45)).toBe("2026-05-01");
  });
});

describe("8.1 C5.2 deadlines calendar", () => {
  it("generates the statutory deadlines from period-end / AGM / mandate", async () => {
    const deadlines = await generateDeadlines(saEngagement);
    const byKey = new Map(deadlines.map((deadline) => [deadline.key, deadline]));
    expect(byKey.get("fs_arrete")?.dueDate).toBe("2026-04-30"); // AUDCIF art. 23
    expect(byKey.get("continuing_conventions_notice")?.dueDate).toBe("2026-01-31");
    expect(byKey.get("ago")?.dueDate).toBe("2026-06-30"); // art. 72
    expect(byKey.get("docs_to_cac")?.dueDate).toBe("2026-05-01"); // AGM − 45d
    expect(byKey.get("rapport_special_deposit")?.dueDate).toBe("2026-05-31"); // art. 442
    expect(byKey.get("mandate_expiry")?.dueDate).toBe("2029-12-31"); // AGO mandate: 6 FY from 2024
  });

  it("marks a deadline done and escalates overdue items to the partner", async () => {
    await markDeadlineDone(saEngagement, "continuing_conventions_notice");
    const after = await listDeadlines(saEngagement);
    expect(after.find((deadline) => deadline.key === "continuing_conventions_notice")?.done).toBe(true);

    await admin.query(
      "UPDATE statutory_deadline SET due_date = CURRENT_DATE - 10 WHERE engagement_id = $1 AND key = 'fs_arrete'",
      [saEngagement],
    );
    const overdueCount = await escalateOverdue(saEngagement);
    expect(overdueCount).toBeGreaterThan(0);
    const notified = await admin.query(
      "SELECT 1 FROM notification WHERE user_id = $1 AND kind = 'deadline-overdue'",
      [USER],
    );
    expect(notified.rows.length).toBeGreaterThan(0);
  });
});

describe("8.2/8.3 C5.3 conventions + rapport spécial", () => {
  it("flags an SA convention without board authorization (art. 447)", async () => {
    await addConvention(saEngagement, {
      parties: "Legal SA / Immo SCI",
      interested: "M. Dupont",
      capacity: "director",
      nature: "Bail commercial du siège",
      terms: "Loyer annuel 24 000 000 FCFA",
      amountsPeriod: 24_000_000,
      continuing: true,
    });
    await addConvention(saEngagement, {
      parties: "Legal SA / Conseil SARL",
      interested: "Mme Ndiaye",
      capacity: "shareholder10",
      nature: "Prestations de conseil",
      boardAuthRef: "CA du 2025-03-10",
    });
    const { legalForm, conventions } = await listConventions(saEngagement);
    expect(legalForm).toBe("SA");
    expect(conventions.find((c) => c.nature.includes("Bail"))?.unauthorized).toBe(true);
    expect(conventions.find((c) => c.nature.includes("conseil"))?.unauthorized).toBe(false);
  });

  it("no authorization needed outside the SA form", async () => {
    await addConvention(sarlEngagement, {
      parties: "Legal SARL / Gérant",
      interested: "Le gérant",
      capacity: "gerant",
      nature: "Avance en compte courant",
    });
    const { conventions } = await listConventions(sarlEngagement);
    expect(conventions[0].unauthorized).toBe(false);
  });

  it("builds the rapport spécial from the register as a docx under C5.3", async () => {
    const documentId = await generateRapportSpecial(saEngagement);
    expect(await docIsZip(documentId)).toBe(true);
    const doc = await admin.query<{ kind: string; code: string }>(
      `SELECT d.kind, fi.code FROM document d JOIN file_item fi ON fi.id = d.file_item_id WHERE d.id = $1`,
      [documentId],
    );
    expect(doc.rows[0]).toEqual({ kind: "report", code: "C5.3" });
  });
});

describe("8.4 C5.4 article 715 report", () => {
  it("pulls C1.1 adjustments and C5.1 points from live engagement data", async () => {
    await admin.query(
      `INSERT INTO misstatement (tenant_id, engagement_id, description, amount, mtype)
       VALUES ($1, $2, 'Provision clients sous-évaluée', 5000000, 'judgmental')`,
      [TENANT, saEngagement],
    );
    await admin.query(
      `INSERT INTO finding (tenant_id, engagement_id, route, title, detail)
       VALUES ($1, $2, 'c1', 'Séparation des tâches trésorerie', 'Un seul signataire')`,
      [TENANT, saEngagement],
    );
    const documentId = await generateArticle715Report(saEngagement);
    expect(await docIsZip(documentId)).toBe(true);
    const doc = await admin.query<{ code: string }>(
      "SELECT fi.code FROM document d JOIN file_item fi ON fi.id = d.file_item_id WHERE d.id = $1",
      [documentId],
    );
    expect(doc.rows[0].code).toBe("C5.4");
  });
});

describe("8.5 C5.5 procédure d'alerte", () => {
  it("walks the non-SA flow: request → reply → court → rapport → AG → closed", async () => {
    await startAlerte(sarlEngagement, "Trésorerie insuffisante pour 3 mois d'exploitation.");
    let state = await getAlerte(sarlEngagement);
    expect(state?.variant).toBe("non_sa");
    expect(state?.stage).toBe("request_sent");
    expect(state?.stageDeadline).toBe(addDaysIso(new Date().toISOString().slice(0, 10), 15)); // art. 150

    await expect(startAlerte(sarlEngagement, "again")).rejects.toThrow("alerte-open");
    await expect(advanceAlerte(state!.id, "rapport_special", "skip")).rejects.toThrow("invalid-transition");

    await advanceAlerte(state!.id, "reply_recorded", "Réponse insuffisante du gérant.");
    await advanceAlerte(state!.id, "court_informed", "Juridiction informée de la réponse.");
    await advanceAlerte(state!.id, "rapport_special", "Continuité toujours compromise.");
    state = await getAlerte(sarlEngagement);
    expect(state?.stage).toBe("rapport_special");
    expect(state?.stageDeadline).toBe(addDaysIso(new Date().toISOString().slice(0, 10), 8)); // art. 152

    await advanceAlerte(state!.id, "ag_communicated", "Rapport communiqué aux associés.");
    await advanceAlerte(state!.id, "closed", "Juridiction informée des résultats.");
    state = await getAlerte(sarlEngagement);
    expect(state?.stage).toBe("closed");
    expect(state?.events.length).toBeGreaterThanOrEqual(6);

    // Letters were filed under C5.5 along the way.
    const letters = await admin.query(
      `SELECT 1 FROM document d JOIN file_item fi ON fi.id = d.file_item_id
        WHERE fi.engagement_id = $1 AND fi.code = 'C5.5'`,
      [sarlEngagement],
    );
    expect(letters.rows.length).toBeGreaterThanOrEqual(3);
  });

  it("SA variant: satisfactory reply discontinues; resumable within 6 months", async () => {
    await startAlerte(saEngagement, "Pertes récurrentes.");
    let state = await getAlerte(saEngagement);
    expect(state?.variant).toBe("sa");
    await advanceAlerte(state!.id, "reply_recorded", "Plan de refinancement crédible.", { satisfactory: true });
    state = await getAlerte(saEngagement);
    expect(state?.discontinued).toBe(true);
    expect(state?.resumableUntil).toBeTruthy();

    await resumeAlerte(state!.id, "Le refinancement a échoué.");
    state = await getAlerte(saEngagement);
    expect(state?.discontinued).toBe(false);
    expect(state?.stage).toBe("request_sent");
    // SA path goes through the board.
    await advanceAlerte(state!.id, "reply_recorded", "Pas de réponse satisfaisante.");
    await advanceAlerte(state!.id, "board_invited", "Conseil invité à délibérer.");
    state = await getAlerte(saEngagement);
    expect(state?.stage).toBe("board_invited");
    expect(state?.stageDeadline).toBe(addDaysIso(new Date().toISOString().slice(0, 10), 15)); // art. 154
  });
});

describe("8.6 C5.6 faits délictueux (partner-only)", () => {
  it("reveals to the ministère public and logs confidentially", async () => {
    const documentId = await revealFait(saEngagement, "Détournement présumé de recettes en espèces.");
    expect(await docIsZip(documentId)).toBe(true);
    const faits = await listFaits(saEngagement);
    expect(faits.length).toBe(1);
    expect(faits[0].documentId).toBe(documentId);
  });

  it("refuses non-partner access", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: USER, tenantId: TENANT, role: "senior", locale: "en" },
    } as never);
    await expect(listFaits(saEngagement)).rejects.toThrow("forbidden");
  });
});

describe("8.7 C5.7 attestation + C5.8 equity monitoring", () => {
  it("generates the titres nominatifs attestation under C5.7", async () => {
    const documentId = await generateTitresAttestation(saEngagement);
    expect(await docIsZip(documentId)).toBe(true);
  });

  it("raises the EGM workflow when equity < half of share capital", async () => {
    // Equity 10M capital − 8M loss = 2M < half of 10M capital.
    const result = await importTrialBalance(
      saEngagement,
      "tb.csv",
      Buffer.from(
        [
          HEADERS,
          "101000;Capital;0;10000000",
          "521000;Banque;2000000;0",
          "661000;Salaires;12000000;0",
          "701000;Ventes;0;4000000",
        ].join("\n"),
        "utf8",
      ),
    );
    expect(result.summary.status).toBe("valid");
    await setShareCapital(saEngagement, 10_000_000);
    const check = await equityCheck(saEngagement);
    expect(check.equity).toBe(2_000_000);
    expect(check.halfCapital).toBe(5_000_000);
    expect(check.breach).toBe(true);
    const deadlines = await listDeadlines(saEngagement);
    expect(deadlines.some((deadline) => deadline.key === "egm_equity")).toBe(true);
    const notified = await admin.query(
      "SELECT 1 FROM notification WHERE user_id = $1 AND kind = 'equity-breach'",
      [USER],
    );
    expect(notified.rows.length).toBeGreaterThan(0);
  });
});

describe("8.8 C5.9 co-CAC joint report", () => {
  it("issues the joint report with the art. 719 disagreement disclosure", async () => {
    await admin.query("UPDATE client SET co_cac = true WHERE id = $1", [saClient]);
    await recordCompletion(saEngagement, "f8_worksplit", { text: "Cycles A-C cabinet 1; D-F cabinet 2.", confirmed: true });
    await recordCompletion(saEngagement, "f8_disagreement", {
      text: "Divergence sur la provision clients — position de chaque commissaire exposée.",
    });
    const documentId = await generateAuditReport({
      engagementId: saEngagement,
      opinion: "qualified",
      basisText: "Provision clients insuffisante.",
      goingConcernParagraph: true,
      reportDate: "2026-05-30",
    });
    expect(await docIsZip(documentId)).toBe(true);
    const note = await admin.query<{ note: string }>(
      "SELECT note FROM document_version WHERE document_id = $1",
      [documentId],
    );
    expect(note.rows[0].note).toBe("report:qualified");
  });
});
