import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const USER = "ffffffff-ffff-ffff-ffff-fffffffffff1";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en" },
  })),
}));

import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { sectionBalances } from "@/lib/leadsheets";
import {
  addOverride,
  createJournal,
  diffTbVersions,
  importTrialBalance,
  inferTbMapping,
  listTbVersions,
  postJournal,
} from "@/lib/tb";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let clientId: string;
let engagementId: string;
let priorEngagement: string;

// Balance générale structure (SYSCOHADA art. 19) — FR headers.
const HEADERS = "Compte;Libellé;Solde initial débit;Solde initial crédit;Mouvement débit;Mouvement crédit";
const csv = (rows: string[]): Buffer => Buffer.from([HEADERS, ...rows].join("\n"), "utf8");

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'TB Firm', 'tb-test')", [TENANT]);
  await admin.query(
    "INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'tb@test.local', 'TB Tester', 'x')",
    [USER],
  );
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Import SA', 'SA') RETURNING id",
    [TENANT],
  );
  clientId = client.rows[0].id;
  priorEngagement = await createEngagement({ clientId, fiscalYear: 2024, periodEnd: "2024-12-31" });
  engagementId = await createEngagement({ clientId, fiscalYear: 2025, periodEnd: "2025-12-31" });
}, 30_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("column-mapping inference (3.1)", () => {
  it("recognises FR balance générale headers", () => {
    const mapping = inferTbMapping(HEADERS.split(";"));
    expect(mapping.account).toBe("Compte");
    expect(mapping.openingDebit).toBe("Solde initial débit");
    expect(mapping.debit).toBe("Mouvement débit");
  });
  it("accepts closing-only files and rejects unmappable ones", () => {
    expect(inferTbMapping(["Account", "Balance"]).closing).toBe("Balance");
    expect(() => inferTbMapping(["foo", "bar"])).toThrow("missing-account-column");
    expect(() => inferTbMapping(["Compte", "note"])).toThrow("missing-amount-columns");
  });
});

describe("validation engine (3.2)", () => {
  it("imports a balanced prior-year TB as valid", async () => {
    const result = await importTrialBalance(
      priorEngagement,
      "tb-2024.csv",
      csv(["411000;Clients;0;0;50000000;0", "701000;Ventes;0;0;0;70000000", "601000;Achats;0;0;20000000;0"]),
    );
    expect(result.summary.status).toBe("valid");
    expect(result.summary.checks.balanced.ok).toBe(true);
  });

  it("marks an unbalanced import invalid and does NOT activate it", async () => {
    const result = await importTrialBalance(
      engagementId,
      "bad.csv",
      csv(["411000;Clients;0;0;10;0"]), // debits 10 / credits 0
    );
    expect(result.summary.status).toBe("invalid");
    const versions = await listTbVersions(engagementId);
    expect(versions.find((v) => v.versionNo === result.versionNo)?.isCurrent).toBe(false);
  });

  it("flags codification, unknown accounts and opening-tie exceptions (E6.5)", async () => {
    const result = await importTrialBalance(
      engagementId,
      "tb-2025.csv",
      csv([
        // opening 60,000,000 ≠ prior closing 50,000,000 -> E6.5 exception
        "411000;Clients;60000000;0;20000000;0",
        "701000;Ventes;0;60000000;0;25000000",
        "601000;Achats;0;0;5000000;0",
        "999999;Inconnu;0;0;0;0", // unknown grouping
        "ABC;Bad;0;0;0;0", // bad codification
      ]),
    );
    expect(result.summary.status).toBe("valid"); // warnings, not blockers
    expect(result.summary.checks.codification.badAccounts).toContain("ABC");
    expect(result.summary.checks.unknownAccounts).toContain("999999");
    expect(result.summary.checks.openingTiesToPrior.checked).toBe(true);
    expect(result.summary.checks.openingTiesToPrior.exceptions.map((e) => e.account)).toContain("411000");
    const versions = await listTbVersions(engagementId);
    expect(versions.find((v) => v.isCurrent)?.versionNo).toBe(result.versionNo);
  });
});

describe("adjusting journals + versions (3.3)", () => {
  it("rejects unbalanced journals", async () => {
    await expect(
      createJournal(engagementId, "Bad", [
        { account: "601000", debit: 100, credit: 0 },
        { account: "401000", debit: 0, credit: 50 },
      ]),
    ).rejects.toThrow("journal-unbalanced");
  });

  it("posting derives a new ADJUSTED version = base + journal, reproducibly", async () => {
    const before = (await listTbVersions(engagementId)).find((v) => v.isCurrent)!;
    const journalId = await createJournal(engagementId, "Accrual", [
      { account: "601000", debit: 1_000_000, credit: 0 },
      { account: "408000", label: "FNP", debit: 0, credit: 1_000_000 },
    ]);
    const newVersion = await postJournal(journalId, "adjusted");
    expect(newVersion).toBe(before.versionNo + 1);

    const versions = await listTbVersions(engagementId);
    const current = versions.find((v) => v.isCurrent)!;
    expect(current.kind).toBe("adjusted");

    const diff = await diffTbVersions(engagementId, before.versionNo, newVersion);
    const accounts = Object.fromEntries(diff.map((line) => [line.account, line.difference]));
    expect(accounts["601000"]).toBe(1_000_000);
    expect(accounts["408000"]).toBe(-1_000_000);
    expect(diff).toHaveLength(2);

    await expect(postJournal(journalId, "final")).rejects.toThrow("journal-not-draft");
  });
});

describe("grouping seed + client overrides (3.5/3.6)", () => {
  it("uses the corrected Appendix A mapping (66 = payroll, not finance)", async () => {
    const sections = await sectionBalances(priorEngagement);
    expect(sections.get("E4.1")?.rows.map((r) => r.accountCode)).toContain("701000");
    const rule = await admin.query<{ section_code: string; label_fr: string }>(
      "SELECT section_code, label_fr FROM syscohada_grouping_rule WHERE account_prefix = '66'",
    );
    expect(rule.rows[0].section_code).toBe("E4.3");
    expect(rule.rows[0].label_fr).toBe("Charges de personnel");
  });

  it("client overrides beat the global rules in grouped balances", async () => {
    await addOverride(clientId, {
      matchType: "prefix",
      accountPrefix: "601",
      sectionCode: "E4.4",
      rationale: "Client books direct materials under purchases.",
    });
    const sections = await sectionBalances(priorEngagement);
    expect(sections.get("E4.4")?.rows.map((r) => r.accountCode)).toContain("601000");
    expect(sections.get("E4.2")?.rows.map((r) => r.accountCode) ?? []).not.toContain("601000");
  });
});
