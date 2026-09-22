import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The unique JE identifier: a ledger whose entries are only identified by
// journal + voucher number together is projected with that pair as the entry
// number, so every entry-level analysis reads real entries. Without it the JE
// number column stands, as before.

const TENANT = "5e5e5e5e-5e5e-4e5e-8e5e-5e5e5e5e5e01";
const USER = "5e5e5e5e-5e5e-4e5e-8e5e-5e5e5e5e5e02";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
  })),
}));

import { encodeJeKey, jeIdentity, jeKeyColumns, JE_KEY } from "@/lib/dataset-mapping";
import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { buildProjection, validatePopulation } from "@/lib/gl-line";
import { weekdayAnalysis } from "@/lib/gl-insights";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

const ROWS = [
  { "C.j": "JPS", "N° pièce": "37", Date: "2025-01-14", "N° de compte": "411100", Débit: "2601851", Crédit: "", Libellé: "Fact 1" },
  { "C.j": "JPS", "N° pièce": "37", Date: "2025-01-14", "N° de compte": "706100", Débit: "", Crédit: "2601851", Libellé: "Fact 1" },
  { "C.j": "JPS", "N° pièce": "38", Date: "2025-01-15", "N° de compte": "411100", Débit: "1000", Crédit: "", Libellé: "Fact 2" },
  { "C.j": "JPS", "N° pièce": "38", Date: "2025-01-15", "N° de compte": "706100", Débit: "", Crédit: "1000", Libellé: "Fact 2" },
  // the same voucher number in another journal is a different entry
  { "C.j": "JOD", "N° pièce": "37", Date: "2025-01-31", "N° de compte": "681300", Débit: "500", Crédit: "", Libellé: "Dot" },
  { "C.j": "JOD", "N° pièce": "37", Date: "2025-01-31", "N° de compte": "281300", Débit: "", Crédit: "500", Libellé: "Dot" },
];

async function dataset(mapping: Record<string, string>): Promise<string> {
  const d = await admin.query<{ id: string }>(
    `INSERT INTO sub_ledger_dataset (tenant_id, engagement_id, kind, timing, name, source_filename, source_sha256, row_count, mapping, created_by)
     VALUES ($1, $2, 'journal_entries', 'pre_audit', 'gl', 'gl.xlsx', 'x', $3, $4, $5) RETURNING id`,
    [TENANT, engagementId, ROWS.length, JSON.stringify(mapping), USER],
  );
  const id = d.rows[0].id;
  for (let i = 0; i < ROWS.length; i += 1) {
    await admin.query("INSERT INTO sub_ledger_row (tenant_id, dataset_id, row_no, data) VALUES ($1, $2, $3, $4)", [TENANT, id, i + 1, JSON.stringify(ROWS[i])]);
  }
  return id;
}

const BASE = { account: "N° de compte", jeDescription: "Libellé", journalDate: "Date", debit: "Débit", credit: "Crédit", journalCode: "C.j" };

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'JE Key Firm', 'je-key-test')", [TENANT]);
  await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'jekey@risk.local', 'Keyer', 'x')", [USER]);
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'JE Key SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("the unique JE identifier", () => {
  it("round-trips through the stored mapping", () => {
    const encoded = encodeJeKey(["C.j", "N° pièce", "C.j", " "]);
    expect(jeKeyColumns({ [JE_KEY]: encoded })).toEqual(["C.j", "N° pièce"]);
    expect(jeKeyColumns({})).toEqual([]);
    expect(jeIdentity({ "C.j": "JPS", "N° pièce": 37 }, ["C.j", "N° pièce"], null, (v) => (v == null ? null : String(v)))).toBe("JPS · 37");
    expect(jeIdentity({ "C.j": "", "N° pièce": "" }, ["C.j", "N° pièce"], null, (v) => (v ? String(v) : null))).toBeNull();
  });

  it("projects journal + voucher as the entry, so the same voucher in two journals is two entries", async () => {
    const id = await dataset({ ...BASE, [JE_KEY]: encodeJeKey(["C.j", "N° pièce"]) });
    const built = await buildProjection(engagementId, id);
    expect(built.lines).toBe(6);
    expect(built.rejected).toBe(0);
    const r = await admin.query<{ je_number: string; n: string }>(
      "SELECT je_number, count(*)::text AS n FROM gl_line WHERE dataset_id = $1 GROUP BY 1 ORDER BY 1",
      [id],
    );
    expect(r.rows.map((x) => [x.je_number, Number(x.n)])).toEqual([["JOD · 37", 2], ["JPS · 37", 2], ["JPS · 38", 2]]);
    const checks = await validatePopulation(engagementId, id);
    expect(checks.checks.find((c) => c.key === "mandatory-mapped")?.status).toBe("passed");
    expect(checks.checks.find((c) => c.key === "je-distinguishes")?.status).toBe("passed");
    // the raw-row insights read the same identity
    const weekday = await weekdayAnalysis(engagementId);
    expect(weekday?.rows.reduce((n, r) => n + r.journals, 0)).toBe(3);
  });

  it("falls back to the JE number column when no identifier is mapped", async () => {
    const id = await dataset({ ...BASE, jeNumber: "N° pièce" });
    await buildProjection(engagementId, id);
    const r = await admin.query<{ n: string }>("SELECT count(DISTINCT je_number)::text AS n FROM gl_line WHERE dataset_id = $1", [id]);
    expect(Number(r.rows[0].n)).toBe(2);
  });

  it("refuses a ledger with neither", async () => {
    const id = await dataset({ ...BASE });
    await expect(buildProjection(engagementId, id)).rejects.toThrow("mapping-incomplete");
  });
});
