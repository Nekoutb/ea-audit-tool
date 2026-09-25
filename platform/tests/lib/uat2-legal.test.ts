// UAT run 2 regressions for the OHADA legal module:
// B21 — statutory documents state the engagement's own period end, and the
//       C5.7 attestation is gated on the C5.7 paper and states date + figures;
// B22 — the C5.8 conclusion follows the live equity figures.
import JSZip from "jszip";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "8e8e8e8e-8e8e-4e8e-8e8e-8e8e8e8e8e8e";
const USER = "8e8e8e8e-8e8e-4e8e-8e8e-8e8e8e8e8e01";

const mockedUser = {
  user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en" },
};

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => mockedUser),
}));

import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import {
  equityCheck,
  equityConclusionOf,
  equityStatus,
  generateArticle715Report,
  generateRapportSpecial,
  generateTitresAttestation,
  listDeadlines,
  setShareCapital,
} from "@/lib/legal";
import { importTrialBalance } from "@/lib/tb";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let juneEngagement: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

async function docText(documentId: string): Promise<string> {
  const result = await admin.query<{ content: Buffer }>(
    "SELECT content FROM document_version WHERE document_id = $1 ORDER BY version_no DESC LIMIT 1",
    [documentId],
  );
  const zip = await JSZip.loadAsync(result.rows[0].content);
  const xml = await zip.file("word/document.xml")!.async("string");
  return xml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
}

const HEADERS = "Compte;Libellé;Mouvement débit;Mouvement crédit";
const tb = (rows: string[]): Buffer => Buffer.from([HEADERS, ...rows].join("\n"), "utf8");
// capital 10M, loss 8M → equity 2M (< half of 10M)
const LOSS_TB = tb(["101000;Capital;0;10000000", "521000;Banque;2000000;0", "661000;Salaires;12000000;0", "701000;Ventes;0;4000000"]);
// capital 10M, loss 1M → equity 9M (> half of 10M)
const HEALTHY_TB = tb(["101000;Capital;0;10000000", "521000;Banque;9000000;0", "661000;Salaires;5000000;0", "701000;Ventes;0;4000000"]);

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'UAT2 Legal Firm', 'uat2-legal-test')", [TENANT]);
  await admin.query(
    "INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'uat2-legal@test.local', 'UAT2 Legal Tester', 'x')",
    [USER],
  );
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Juin SA', 'SA') RETURNING id",
    [TENANT],
  );
  juneEngagement = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2026, periodEnd: "2026-06-30" });
}, 30_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("B21 statutory documents state the real period end", () => {
  it("rapport spécial and art. 715 report read 'Exercice clos le 30 juin 2026'", async () => {
    for (const documentId of [await generateRapportSpecial(juneEngagement), await generateArticle715Report(juneEngagement)]) {
      const text = await docText(documentId);
      expect(text).toContain("Exercice clos le 30 juin 2026");
      expect(text).not.toContain("31 décembre");
    }
  });

  it("refuses the C5.7 attestation without an inspection date, a count, or the C5.7 conclusions", async () => {
    await expect(generateTitresAttestation(juneEngagement, { securitiesCount: 1000 })).rejects.toThrow(
      "titres-inspection-date-required",
    );
    await expect(generateTitresAttestation(juneEngagement, { inspectionDate: "2026-09-15" })).rejects.toThrow(
      "titres-count-required",
    );
    await expect(
      generateTitresAttestation(juneEngagement, { inspectionDate: "2026-09-15", securitiesCount: 1000 }),
    ).rejects.toThrow("titres-work-incomplete");
    // register kept but not agreed: still refused
    await admin.query(
      `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value)
       VALUES ($1, $2, 'wp:C5.7', 'q_kept', '"yes"'), ($1, $2, 'wp:C5.7', 'q_agrees', '"no"')`,
      [TENANT, juneEngagement],
    );
    await expect(
      generateTitresAttestation(juneEngagement, { inspectionDate: "2026-09-15", securitiesCount: 1000 }),
    ).rejects.toThrow("titres-work-incomplete");
  });

  it("issues the attestation with the period end, inspection date and register figures once C5.7 agrees", async () => {
    await admin.query(
      "UPDATE form_response SET value = '\"yes\"' WHERE engagement_id = $1 AND code = 'wp:C5.7' AND field_key = 'q_agrees'",
      [juneEngagement],
    );
    const text = await docText(
      await generateTitresAttestation(juneEngagement, { inspectionDate: "2026-09-15", securitiesCount: 1000 }),
    );
    expect(text).toContain("Exercice clos le 30 juin 2026");
    expect(text).not.toContain("31 décembre");
    expect(text).toContain("15 septembre 2026");
    expect(text).toMatch(/1\s000 titres inscrits/);
  });
});

describe("B22 the C5.8 conclusion never contradicts the figures", () => {
  it("pure mapping from live figures and the EGM row", () => {
    const f = (breach: boolean) => ({ breach, hasTb: true, halfCapital: 5_000_000 });
    expect(equityConclusionOf(f(true), { done: false })).toBe("breach");
    expect(equityConclusionOf(f(true), null)).toBe("unchecked-breach");
    expect(equityConclusionOf(f(false), { done: false })).toBe("stale");
    expect(equityConclusionOf(f(false), { done: true })).toBe("ok");
    expect(equityConclusionOf(f(false), null)).toBe("ok");
    expect(equityConclusionOf({ breach: false, hasTb: false, halfCapital: 5_000_000 }, null)).toBe("none");
    expect(equityConclusionOf({ breach: false, hasTb: true, halfCapital: null }, null)).toBe("none");
  });

  it("asks for the check again after a TB import changes the outcome", async () => {
    const egmRow = async () => (await listDeadlines(juneEngagement)).find((d) => d.key === "egm_equity") ?? null;

    expect((await importTrialBalance(juneEngagement, "loss.csv", LOSS_TB)).summary.status).toBe("valid");
    await setShareCapital(juneEngagement, 10_000_000);
    expect(equityConclusionOf(await equityStatus(juneEngagement), await egmRow())).toBe("unchecked-breach");
    expect((await equityCheck(juneEngagement)).breach).toBe(true);
    expect(equityConclusionOf(await equityStatus(juneEngagement), await egmRow())).toBe("breach");

    // equity 9M now, but the check has not been re-run: not "breach", not "ok"
    expect((await importTrialBalance(juneEngagement, "healthy.csv", HEALTHY_TB)).summary.status).toBe("valid");
    const healthy = await equityStatus(juneEngagement);
    expect(healthy.equity).toBe(9_000_000);
    expect(equityConclusionOf(healthy, await egmRow())).toBe("stale");
    await equityCheck(juneEngagement);
    expect(equityConclusionOf(await equityStatus(juneEngagement), await egmRow())).toBe("ok");

    // back to the loss TB without re-running: the figures show the breach, never "above half"
    expect((await importTrialBalance(juneEngagement, "loss2.csv", LOSS_TB)).summary.status).toBe("valid");
    const loss = await equityStatus(juneEngagement);
    expect(loss.equity).toBe(2_000_000);
    expect(equityConclusionOf(loss, await egmRow())).toBe("unchecked-breach");
  });
});
