import ExcelJS from "exceljs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The workbook-per-side export end to end: a ledger with lines on both sides
// of the statements, a threshold set on S3.1 for one account, an approved
// materiality — and the income-statement workbook comes out with one tab per
// index that has lines, the S3.1 threshold on the tab that has one, TE on the
// others, and the empty indexes named on the cover.

const TENANT = "7d7d7d7d-7d7d-4d7d-8d7d-7d7d7d7d7d01";
const USER = "7d7d7d7d-7d7d-4d7d-8d7d-7d7d7d7d7d02";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "partner", locale: "en", clientId: null },
  })),
}));

import { saveIndexThreshold } from "@/lib/cra";
import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { exportTodWorkbook, indexesOfSide, todSideView } from "@/lib/tod-export";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'ToD Firm', 'tod-export-test')", [TENANT]);
  await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'tod@export.local', 'Sampler', 'x')", [USER]);
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'partner')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'ToD SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });

  // approved materiality: TE 3 000 000
  await admin.query(
    `INSERT INTO materiality (tenant_id, engagement_id, version_no, benchmark, benchmark_amount, percentage, justification,
                              performance_pct, trivial_pct, overall, performance, trivial, status, approved_by, approved_at, created_by)
     VALUES ($1, $2, 1, 'revenue', 400000000, 1, 'test', 75, 5, 4000000, 3000000, 200000, 'approved', $3, now(), $3)`,
    [TENANT, engagementId, USER],
  );

  // a ledger: revenue (701 → UA), purchases (601 → VA1), receivables (411 → E)
  const d = await admin.query<{ id: string }>(
    `INSERT INTO sub_ledger_dataset (tenant_id, engagement_id, kind, timing, name, source_filename, source_sha256, row_count, mapping, created_by)
     VALUES ($1, $2, 'journal_entries', 'pre_audit', 'gl', 'gl-test.xlsx', 'x', 0, $3, $4) RETURNING id`,
    [TENANT, engagementId, JSON.stringify({ account: "Compte", jeNumber: "Pièce", jeDescription: "Libellé", journalDate: "Date", amount: "Montant" }), USER],
  );
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i <= 40; i += 1) rows.push({ Compte: "701100", Pièce: `V${i}`, Libellé: `Sale ${i}`, Date: "2025-06-30", Montant: -250_000 * i });
  for (let i = 1; i <= 12; i += 1) rows.push({ Compte: "601100", Pièce: `A${i}`, Libellé: `Purchase ${i}`, Date: "2025-05-15", Montant: 400_000 * i });
  for (let i = 1; i <= 5; i += 1) rows.push({ Compte: "411100", Pièce: `V${i}`, Libellé: `Sale ${i}`, Date: "2025-06-30", Montant: 250_000 * i });
  for (let i = 0; i < rows.length; i += 1) {
    await admin.query("INSERT INTO sub_ledger_row (tenant_id, dataset_id, row_no, data, amount) VALUES ($1, $2, $3, $4, $5)", [TENANT, d.rows[0].id, i + 1, JSON.stringify(rows[i]), rows[i].Montant]);
  }

  // a key-item threshold set on S3.1 for revenue only
  await saveIndexThreshold(engagementId, "UA", 6_000_000);
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("indexesOfSide", () => {
  it("splits the lead indexes between the balance sheet and the income statement", () => {
    const bs = indexesOfSide("bs").map((d) => d.code);
    const is = indexesOfSide("is").map((d) => d.code);
    expect(bs).toContain("E");
    expect(bs).toContain("T");
    expect(is).toContain("UA");
    expect(is).toContain("VA1");
    expect(is).toContain("O4");
    expect(bs.filter((c) => is.includes(c))).toEqual([]);
  });
});

describe("the income-statement workbook", () => {
  it("has one tab per index with lines, the S3.1 threshold where set, TE elsewhere, and names the empty indexes", async () => {
    const view = await todSideView(engagementId, { side: "is", assurance: "little", locale: "en", startFraction: 0.5 });
    expect(typeof view).not.toBe("string");
    if (typeof view === "string" || view === null) throw new Error("no view");
    expect(view.te).toBe(3_000_000);
    expect(view.ledgerFilename).toBe("gl-test.xlsx");
    expect(view.sheets.map((s) => s.indexCode).sort()).toEqual(["UA", "VA1"]);
    const ua = view.sheets.find((s) => s.indexCode === "UA")!;
    expect(ua.plan.threshold).toBe(6_000_000);
    expect(ua.thresholdFromS31).toBe(true);
    expect(ua.plan.populationCount).toBe(40);
    // 6 000 000 … 10 000 000: lines 24…40 are key items
    expect(ua.plan.keyItems.length).toBe(17);
    const va = view.sheets.find((s) => s.indexCode === "VA1")!;
    expect(va.plan.threshold).toBe(3_000_000);
    expect(va.thresholdFromS31).toBe(false);
    expect(va.craFromS31).toBe(false);
    expect(va.cra).toBe("moderate");
    expect(view.emptyIndexes.map((e) => e.indexCode)).toContain("VB");
    expect(view.emptyIndexes.map((e) => e.indexCode)).not.toContain("UA");
    // the receivables lines are balance-sheet lines and stay out of this side
    expect(view.sheets.some((s) => s.indexCode === "E")).toBe(false);

    const file = await exportTodWorkbook(engagementId, { side: "is", locale: "en", startFraction: 0.5 });
    if (typeof file === "string" || file === null) throw new Error("no file");
    expect(file.filename).toMatch(/^Tests-of-details-income-statement-ToD_SA-2025\.xlsx$/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.content as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Cover", "UA Revenue", "VA1 Purchases"]);
  });

  it("says what stops it when nothing is there", async () => {
    await admin.query("UPDATE materiality SET status = 'draft' WHERE engagement_id = $1", [engagementId]);
    expect(await todSideView(engagementId, { side: "bs" })).toBe("no-materiality");
    await admin.query("UPDATE materiality SET status = 'approved' WHERE engagement_id = $1", [engagementId]);
  });
});
