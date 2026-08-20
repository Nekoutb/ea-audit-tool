import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6";
const PARTNER = "f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f601";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: PARTNER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import {
  approveMateriality,
  approvedMateriality,
  createMaterialityVersion,
  reflagMisstatements,
} from "@/lib/materiality";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;

const version = (percentage: number, trivialPct: number) => ({
  benchmark: "revenue" as const,
  benchmarkAmount: 1_000_000_000,
  percentage,
  justification: "Test.",
  performancePct: 75,
  trivialPct,
});

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [PARTNER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Mat Firm', 'mat-test')", [TENANT]);
  await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1,'p@mat.local','P','x')", [PARTNER]);
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1,$2,'firm_admin')", [PARTNER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1,'Mat SA','SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("drafting a revision must not blank the file", () => {
  it("keeps the approved figure in force while a revision is only a draft", async () => {
    // Superseding at draft time left the engagement with NO approved
    // materiality until someone approved the draft — and nothing degrades
    // gracefully without one: every account defaults to not-significant, the
    // CRA board and S5.5 empty, sampling refuses, and the trivial threshold
    // becomes null so nothing counts as clearly trivial.
    const v1 = await createMaterialityVersion(engagementId, version(1, 5));
    await approveMateriality(engagementId, v1);
    const before = await approvedMateriality(engagementId);
    expect(before).not.toBeNull();

    await createMaterialityVersion(engagementId, version(0.5, 5));
    const during = await approvedMateriality(engagementId);
    expect(during).not.toBeNull();
    expect(during!.overall).toBe(before!.overall);
  });

  it("swaps only when the revision is approved", async () => {
    const before = await approvedMateriality(engagementId);
    const rows = await admin.query<{ version_no: number }>(
      "SELECT version_no FROM materiality WHERE engagement_id=$1 AND status='draft' ORDER BY version_no DESC LIMIT 1",
      [engagementId],
    );
    await approveMateriality(engagementId, rows.rows[0].version_no);
    const after = await approvedMateriality(engagementId);
    expect(after!.overall).not.toBe(before!.overall);
    // Exactly one approved version at any time.
    const approved = await admin.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM materiality WHERE engagement_id=$1 AND status='approved'",
      [engagementId],
    );
    expect(Number(approved.rows[0].n)).toBe(1);
  });
});

describe("reflagMisstatements — the classification follows materiality, the evidence does not", () => {
  async function post(amount: number, trivial: boolean): Promise<string> {
    const r = await admin.query<{ id: string }>(
      `INSERT INTO misstatement (tenant_id, engagement_id, description, accounts, amount, mtype, corrected, trivial, created_by)
       VALUES ($1,$2,'Test difference','Dr X / Cr Y',$3,'factual',false,$4,$5) RETURNING id`,
      [TENANT, engagementId, amount, trivial, PARTNER],
    );
    return r.rows[0].id;
  }
  const flagOf = async (id: string) =>
    (await admin.query<{ trivial: boolean }>("SELECT trivial FROM misstatement WHERE id=$1", [id])).rows[0].trivial;

  it("makes a previously trivial item reportable when the threshold falls", async () => {
    const current = await approvedMateriality(engagementId);
    // Sits just under today's threshold, so it was set aside as clearly trivial.
    const id = await post(current!.trivial - 1, true);

    const lower = await createMaterialityVersion(engagementId, version(0.05, 1));
    await approveMateriality(engagementId, lower);
    expect(await flagOf(id)).toBe(false);
  });

  it("does not rewrite the amount, the description or who recorded it", async () => {
    // A materiality change alters how a difference is judged, never what was
    // observed — that is evidence of work performed.
    const current = await approvedMateriality(engagementId);
    const id = await post(current!.trivial * 3, false);
    const before = await admin.query(
      "SELECT amount, description, accounts, created_by FROM misstatement WHERE id=$1", [id]);
    const higher = await createMaterialityVersion(engagementId, version(5, 10));
    await approveMateriality(engagementId, higher);
    const after = await admin.query(
      "SELECT amount, description, accounts, created_by FROM misstatement WHERE id=$1", [id]);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it("sets an item aside again when the threshold rises above it", async () => {
    const current = await approvedMateriality(engagementId);
    const id = await post(current!.trivial / 2, false);
    const counts = await reflagMisstatements(engagementId);
    expect(await flagOf(id)).toBe(true);
    expect(counts.nowTrivial).toBeGreaterThanOrEqual(1);
  });

  it("reports what moved, so a reviewer can see a revision did something", async () => {
    const current = await approvedMateriality(engagementId);
    await post(current!.trivial - 1, false);
    await post(current!.trivial - 2, false);
    const counts = await reflagMisstatements(engagementId);
    expect(counts.nowTrivial).toBeGreaterThanOrEqual(2);
  });

  it("is a no-op when nothing crosses the line", async () => {
    expect(await reflagMisstatements(engagementId)).toEqual({ nowReportable: 0, nowTrivial: 0 });
  });

  it("judges on magnitude, so a credit difference is treated like a debit one", async () => {
    const current = await approvedMateriality(engagementId);
    const id = await post(-(current!.trivial * 4), true);
    await reflagMisstatements(engagementId);
    expect(await flagOf(id)).toBe(false);
  });
});
