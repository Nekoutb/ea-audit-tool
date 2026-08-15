import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd";
const USER = "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcd01";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en" },
  })),
}));

import { closePool } from "@/lib/db";
import {
  evaluateSampling,
  runJeTesting,
  runReconciliation,
  runSampling,
  runSubstantiveAnalytic,
  runSupplierRecon,
  seededRandom,
} from "@/lib/engines";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { evaluateB5, listFindings } from "@/lib/execution";
import { approveMateriality, createMaterialityVersion } from "@/lib/materiality";
import { createDataset } from "@/lib/subledgers";
import { importTrialBalance } from "@/lib/tb";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let engagementId: string;
let e100: string;
let e110: string;
let arDataset: string;
let jeDataset: string;

const csv = (headers: string, rows: string[]): Buffer =>
  Buffer.from([headers, ...rows].join("\n"), "utf8");

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Engine Firm', 'engine-test')", [TENANT]);
  await admin.query(
    "INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'engine@test.local', 'Engine Tester', 'x')",
    [USER],
  );
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Engine SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
  const items = await listFileItems(engagementId);
  e100 = items.find((i) => i.code === "E4.1")!.id;
  e110 = items.find((i) => i.code === "E4.2")!.id;

  // Materiality: overall 2M, PM 1.5M, trivial 100k.
  const version = await createMaterialityVersion(engagementId, {
    benchmark: "revenue",
    benchmarkAmount: 200_000_000,
    percentage: 1,
    justification: "Test.",
    performancePct: 75,
    trivialPct: 5,
  });
  await approveMateriality(engagementId, version);

  // TB: AR 41 = 10,000,000 · revenue 70 = -10,000,000.
  await importTrialBalance(
    engagementId,
    "tb.csv",
    csv("Compte;Libellé;Mouvement débit;Mouvement crédit", [
      "411000;Clients;10000000;0",
      "701000;Ventes;0;10000000",
    ]),
  );

  // AR open items dataset totalling 12,600,000 (diff vs TB 2.6M > trivial).
  arDataset = await createDataset(
    engagementId,
    "ar_open_items",
    "ar.csv",
    csv("Customer;Amount", [
      "ACME;5000000", "Beta;2500000", "Gamma;1800000", "Delta;1200000",
      "Epsilon;900000", "Zeta;700000", "Eta;300000", "Theta;200000",
    ]),
  );

  jeDataset = await createDataset(
    engagementId,
    "journal_entries",
    "je.csv",
    csv("Date;Account;Amount", [
      "2025-12-30;701000;3000000",   // period-end + round
      "2025-12-28;521000;1234567",   // weekend (Sunday) — 2025-12-28 is a Sunday
      "2025-06-16;601000;500",       // clean (Monday, small, not round)
      "2025-07-19;601000;2000000",   // weekend (Saturday) + round
    ]),
  );
}, 40_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("5.1 reproducibility", () => {
  it("seeded selection is deterministic", () => {
    const a = Array.from({ length: 5 }, (_, i) => seededRandom("seed-1", i));
    const b = Array.from({ length: 5 }, (_, i) => seededRandom("seed-1", i));
    const c = Array.from({ length: 5 }, (_, i) => seededRandom("seed-2", i));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe("5.2/5.3 sampling + projection to C1.1", () => {
  it("selects reproducibly and records the run with an output document", async () => {
    const first = await runSampling({ fileItemId: e100, datasetId: arDataset, method: "random", sampleSize: 3, seed: "isa-530" });
    const second = await runSampling({ fileItemId: e100, datasetId: arDataset, method: "random", sampleSize: 3, seed: "isa-530" });
    expect(first.selected).toBe(3);
    expect(first.sampledValue).toBe(second.sampledValue); // same seed → same picks
    expect(first.documentId).toBeTruthy();
  });

  it("MUS covers the largest items; criteria pulls key items above threshold", async () => {
    const mus = await runSampling({ fileItemId: e100, datasetId: arDataset, method: "mus", sampleSize: 3, seed: "mus" });
    expect(mus.selected).toBeGreaterThan(0);
    const criteria = await runSampling({
      fileItemId: e100, datasetId: arDataset, method: "criteria", sampleSize: 2, seed: "crit", threshold: 2_000_000,
    });
    expect(criteria.keyItems).toBe(2); // ACME + Beta
  });

  it("projects sample misstatement to the population and auto-raises C1.1", async () => {
    const run = await runSampling({ fileItemId: e100, datasetId: arDataset, method: "random", sampleSize: 4, seed: "proj" });
    const result = await evaluateSampling(run.runId, Math.round(run.sampledValue * 0.1)); // 10% error rate
    expect(result.projected).toBeGreaterThan(100_000); // > trivial
    expect(result.raisedToB5).toBe(true);
    const b5 = await evaluateB5(engagementId);
    expect(b5.items.some((item) => item.mtype === "projected" && !item.trivial)).toBe(true);
  });
});

describe("5.4 sub-ledger → TB reconciliation", () => {
  it("computes the difference vs the 41-accounts and raises a finding above trivial", async () => {
    const result = await runReconciliation({ fileItemId: e100, datasetId: arDataset });
    expect(result.tbTotal).toBe(10_000_000);
    expect(result.datasetTotal).toBe(12_600_000);
    expect(result.difference).toBe(2_600_000);
    expect(result.aboveTrivial).toBe(true);
    const findings = await listFindings(engagementId);
    expect(findings.some((f) => f.route === "b4" && f.title.includes("Unreconciled"))).toBe(true);
  });
});

describe("5.7 supplier statements", () => {
  it("compares statement vs ledger per supplier", async () => {
    const statements = await createDataset(
      engagementId, "supplier_statements", "stmt.csv",
      csv("Supplier;Balance", ["Omega;4000000", "Sigma;1000000"]),
    );
    const ledger = await createDataset(
      engagementId, "ap_open_items", "ap.csv",
      csv("Supplier;Balance", ["Omega;4000000", "Sigma;800000", "Tau;150000"]),
    );
    const result = await runSupplierRecon({ fileItemId: e110, statementsDatasetId: statements, ledgerDatasetId: ledger });
    expect(result.suppliersCompared).toBe(3);
    expect(result.differences).toBe(2); // Sigma 200k + Tau missing from statements
  });
});

describe("5.8 JE testing", () => {
  it("scores round/weekend/period-end/large entries", async () => {
    const result = await runJeTesting({ fileItemId: e100, datasetId: jeDataset, periodEnd: "2025-12-31" });
    expect(result.scored).toBe(4);
    expect(result.flagged).toBe(3); // all but the clean mid-June entry
  });
});

describe("5.9 substantive analytics", () => {
  it("auto-raises an unexplained variance to C1.1", async () => {
    // E4.1 actual (41+70 grouped) = 0; expect 5,000,000 with 1,000,000 tolerance.
    const result = await runSubstantiveAnalytic({
      fileItemId: e100, expectation: 5_000_000, tolerance: 1_000_000, basis: "Prior-year margin trend",
    });
    expect(result.actual).toBe(0);
    expect(Math.abs(result.variance)).toBe(5_000_000);
    expect(result.raisedToB5).toBe(true);
    const b5 = await evaluateB5(engagementId);
    expect(b5.items.some((item) => item.description.includes("Unresolved analytic"))).toBe(true);
  });
});
