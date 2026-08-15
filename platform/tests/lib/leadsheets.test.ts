import ExcelJS from "exceljs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const USER = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en" },
  })),
}));

import { analyticalReview } from "@/lib/analytics";
import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { generateLeadSchedule, resolveSection, sectionBalances } from "@/lib/leadsheets";
import { approveMateriality, createMaterialityVersion } from "@/lib/materiality";
import { createDataset, detectAmountColumn, listDatasets, parseTabularFile } from "@/lib/subledgers";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let clientId: string;
let currentEngagement: string;
let priorEngagement: string;
let e100ItemId: string;

// account_code -> [opening_debit, opening_credit, debit, credit]
type TbFixture = Record<string, [number, number, number, number]>;

const CURRENT_TB: TbFixture = {
  "411000": [0, 0, 80_000_000, 0], // AR (41 -> E4.1)
  "701000": [0, 0, 0, 150_000_000], // revenue (70 -> E4.1), closing -150M
  "601000": [0, 0, 30_000_000, 0], // purchases (60 -> E4.2)
  "661000": [0, 0, 20_000_000, 0], // payroll prefix 66
  "999999": [0, 0, 5_000_000, 0], // no grouping rule -> unmapped
};

const PRIOR_TB: TbFixture = {
  "411000": [0, 0, 50_000_000, 0],
  "701000": [0, 0, 0, 70_000_000],
  "601000": [0, 0, 20_000_000, 0],
  "661000": [0, 0, 15_000_000, 0],
};

async function seedTb(engagementId: string, fixture: TbFixture, periodEnd: string): Promise<void> {
  const tb = await admin.query<{ id: string }>(
    `INSERT INTO trial_balance (tenant_id, client_id, engagement_id, period_end, current_version_no)
     VALUES ($1, $2, $3, $4, 1) RETURNING id`,
    [TENANT, clientId, engagementId, periodEnd],
  );
  const version = await admin.query<{ id: string }>(
    `INSERT INTO trial_balance_version (tenant_id, trial_balance_id, version_no, version_kind, validation_status, row_count)
     VALUES ($1, $2, 1, 'initial', 'valid', $3) RETURNING id`,
    [TENANT, tb.rows[0].id, Object.keys(fixture).length],
  );
  let rowNo = 0;
  for (const [account, [od, oc, d, c]] of Object.entries(fixture)) {
    rowNo += 1;
    await admin.query(
      `INSERT INTO trial_balance_row
         (tenant_id, version_id, row_no, account_code, account_name, opening_debit, opening_credit, debit, credit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [TENANT, version.rows[0].id, rowNo, account, `Account ${account}`, od, oc, d, c],
    );
  }
}

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Data Firm', 'data-test')", [TENANT]);
  await admin.query(
    "INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'data@test.local', 'Data Tester', 'x')",
    [USER],
  );
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'TB SA', 'SA') RETURNING id",
    [TENANT],
  );
  clientId = client.rows[0].id;
  priorEngagement = await createEngagement({ clientId, fiscalYear: 2024, periodEnd: "2024-12-31" });
  currentEngagement = await createEngagement({ clientId, fiscalYear: 2025, periodEnd: "2025-12-31" });
  await seedTb(priorEngagement, PRIOR_TB, "2024-12-31");
  await seedTb(currentEngagement, CURRENT_TB, "2025-12-31");
  const item = await admin.query<{ id: string }>(
    "SELECT id FROM file_item WHERE engagement_id = $1 AND code = 'E4.1'",
    [currentEngagement],
  );
  e100ItemId = item.rows[0].id;
}, 30_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("grouping resolution (pure)", () => {
  const global = [
    { prefix: "41", sectionCode: "E4.1", exact: false, priority: 10 },
    { prefix: "4", sectionCode: "E4.13", exact: false, priority: 0 },
  ];
  const overrides = [{ prefix: "411", sectionCode: "E6.2", exact: false, priority: 100 }];

  it("longest prefix wins within a rule set", () => {
    expect(resolveSection("411000", [], global)).toBe("E4.1");
    expect(resolveSection("450000", [], global)).toBe("E4.13");
  });
  it("client overrides beat global rules", () => {
    expect(resolveSection("411000", overrides, global)).toBe("E6.2");
  });
  it("returns null when nothing matches", () => {
    expect(resolveSection("999999", overrides, global)).toBeNull();
  });
});

describe("sub-ledger parsing (pure)", () => {
  it("parses CSV with quoted cells and detects the amount column", async () => {
    const csv = 'Customer,Invoice,"Balance"\n"ACME, SA",F001,1 250 000\nBeta,F002,750000\n';
    const table = await parseTabularFile("ar.csv", Buffer.from(csv, "utf8"));
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0].Customer).toBe("ACME, SA");
    expect(detectAmountColumn(table)).toBe("Balance");
  });
});

describe("sub-ledger datasets (3.4)", () => {
  it("imports a CSV dataset with computed total", async () => {
    const csv = "Ref,Montant\nA,1000000\nB,2500000\n";
    await createDataset(currentEngagement, "ar_open_items", "ar.csv", Buffer.from(csv, "utf8"));
    const datasets = await listDatasets(currentEngagement);
    expect(datasets).toHaveLength(1);
    expect(datasets[0].rowCount).toBe(2);
    expect(datasets[0].totalAmount).toBe(3_500_000);
    expect(datasets[0].amountColumn).toBe("Montant");
  });
});

describe("section balances + lead schedules (3.7/3.8)", () => {
  it("groups the TB by section with prior-year comparatives and unmapped report", async () => {
    const sections = await sectionBalances(currentEngagement);
    const e100 = sections.get("E4.1")!;
    expect(e100.rows.map((r) => r.accountCode)).toEqual(["411000", "701000"]);
    expect(e100.total).toBe(80_000_000 - 150_000_000);
    expect(e100.priorTotal).toBe(50_000_000 - 70_000_000);
    expect(e100.unmappedAccounts).toContain("999999");
  });

  it("generates the Excel lead schedule as a versioned leadsheet document", async () => {
    const result = await generateLeadSchedule(e100ItemId, "en");
    expect(result.versionNo).toBe(1);
    expect(result.rowCount).toBe(2);
    const version = await admin.query<{ content: Buffer; mime: string }>(
      "SELECT content, mime FROM document_version WHERE document_id = $1 AND version_no = 1",
      [result.documentId],
    );
    expect(version.rows[0].mime).toContain("spreadsheetml");
    expect(version.rows[0].content.subarray(0, 2).toString("latin1")).toBe("PK");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(version.rows[0].content as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    expect(String(sheet.getCell("A8").value)).toBe("411000"); // first data row
    expect(sheet.getCell("C10").formula).toContain("SUM"); // live totals
  });

  it("regeneration preserves tickmarks/commentary by account and reports lost lines", async () => {
    // Simulate a user annotating v1 in Excel.
    const doc = await admin.query<{ id: string; content: Buffer }>(
      `SELECT d.id, v.content FROM document d
         JOIN document_version v ON v.document_id = d.id AND v.version_no = d.current_version
        WHERE d.file_item_id = $1 AND d.kind = 'leadsheet'`,
      [e100ItemId],
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(doc.rows[0].content as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    sheet.getCell("H8").value = "√"; // tickmark on 411000
    sheet.getCell("I8").value = "Agreed to confirmations";
    const annotated = Buffer.from(await workbook.xlsx.writeBuffer());
    await admin.query(
      "UPDATE document_version SET content = $2 WHERE document_id = $1 AND version_no = 1",
      [doc.rows[0].id, annotated],
    );

    // Drop account 701000 from the TB so its (unannotated) line disappears and
    // 411000's annotation must survive.
    await admin.query(
      `DELETE FROM trial_balance_row USING trial_balance_version v, trial_balance tb
        WHERE trial_balance_row.version_id = v.id AND v.trial_balance_id = tb.id
          AND tb.engagement_id = $1 AND trial_balance_row.account_code = '701000'`,
      [currentEngagement],
    );

    const result = await generateLeadSchedule(e100ItemId, "en");
    expect(result.versionNo).toBe(2);
    expect(result.preservedCount).toBe(1);
    expect(result.lostAccounts).toEqual([]);

    const v2 = await admin.query<{ content: Buffer }>(
      "SELECT content FROM document_version WHERE document_id = $1 AND version_no = 2",
      [doc.rows[0].id],
    );
    const regenerated = new ExcelJS.Workbook();
    await regenerated.xlsx.load(v2.rows[0].content as unknown as ArrayBuffer);
    const cell = regenerated.worksheets[0].getCell("I8");
    expect(String(cell.value)).toBe("Agreed to confirmations");

    // Restore the deleted row for the analytics test below.
    const version = await admin.query<{ id: string }>(
      `SELECT v.id FROM trial_balance_version v JOIN trial_balance tb ON tb.id = v.trial_balance_id
        WHERE tb.engagement_id = $1`,
      [currentEngagement],
    );
    await admin.query(
      `INSERT INTO trial_balance_row
         (tenant_id, version_id, row_no, account_code, account_name, opening_debit, opening_credit, debit, credit)
       VALUES ($1, $2, 99, '701000', 'Ventes', 0, 0, 0, 150000000)`,
      [TENANT, version.rows[0].id],
    );
  });
});

describe("preliminary analytical review (3.9)", () => {
  it("flags section movements above performance materiality and computes ratios", async () => {
    const versionNo = await createMaterialityVersion(currentEngagement, {
      benchmark: "revenue",
      benchmarkAmount: 150_000_000,
      percentage: 1,
      justification: "Revenue benchmark.",
      performancePct: 75,
      trivialPct: 5,
    });
    await approveMateriality(currentEngagement, versionNo);

    const review = await analyticalReview(currentEngagement);
    expect(review.hasTb).toBe(true);
    expect(review.hasPrior).toBe(true);
    expect(review.performanceMateriality).toBe(1_125_000);

    const e100 = review.lines.find((line) => line.sectionCode === "E4.1")!;
    // movement = (80M-150M) - (50M-70M) = -50M -> flagged (>|PM|)
    expect(e100.movement).toBe(-50_000_000);
    expect(e100.flagged).toBe(true);

    const revenue = review.ratios.find((ratio) => ratio.key === "revenue")!;
    expect(revenue.current).toBe(150_000_000);
    const payroll = review.ratios.find((ratio) => ratio.key === "payroll_to_revenue")!;
    expect(payroll.current).toBeCloseTo((20_000_000 / 150_000_000) * 100, 1);
  });
});
