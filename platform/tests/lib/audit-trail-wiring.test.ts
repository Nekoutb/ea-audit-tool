import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8";
const USER = "b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b801";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { approveMateriality, createMaterialityVersion } from "@/lib/materiality";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;

async function clearTrail(): Promise<void> {
  await admin.query("ALTER TABLE activity_log DISABLE TRIGGER activity_log_append_only");
  try {
    await admin.query("DELETE FROM activity_log WHERE tenant_id = $1", [TENANT]);
  } finally {
    await admin.query("ALTER TABLE activity_log ENABLE TRIGGER activity_log_append_only");
  }
}

async function removeFixture(): Promise<void> {
  await clearTrail();
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id,name,slug) VALUES ($1,'Trail Firm','trail-test')", [TENANT]);
  await admin.query("INSERT INTO app_user (id,email,name,password_hash) VALUES ($1,'t@trail.local','T','x')", [USER]);
  await admin.query("INSERT INTO membership (user_id,tenant_id,role) VALUES ($1,$2,'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id,name,legal_form) VALUES ($1,'Trail SA','SA') RETURNING id", [TENANT]);
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

const actions = async (): Promise<string[]> => {
  const r = await admin.query<{ action: string }>(
    "SELECT action FROM activity_log WHERE tenant_id = $1 ORDER BY created_at", [TENANT]);
  return r.rows.map((x) => x.action);
};

// Eleven typed helpers existed in lib/activity.ts with ZERO callers: the product
// claimed an audit trail and recorded none of the acts that matter.
describe("the trail records the acts that matter", () => {
  it("records a materiality revision and its approval", async () => {
    await clearTrail();
    const v = await createMaterialityVersion(engagementId, {
      benchmark: "revenue", benchmarkAmount: 1_000_000_000, percentage: 1,
      justification: "Initial.", performancePct: 75, trivialPct: 5,
    });
    expect(await actions()).toContain("materiality_revised");
    await approveMateriality(engagementId, v);
    expect(await actions()).toContain("materiality_approved");
  });

  it("carries the figures, so the entry says what changed", async () => {
    await clearTrail();
    await createMaterialityVersion(engagementId, {
      benchmark: "revenue", benchmarkAmount: 2_000_000_000, percentage: 2,
      justification: "Revised.", performancePct: 75, trivialPct: 5,
    });
    const r = await admin.query<{ after_value: unknown }>(
      "SELECT after_value FROM activity_log WHERE tenant_id=$1 AND action='materiality_revised' LIMIT 1", [TENANT]);
    expect(JSON.stringify(r.rows[0].after_value)).toMatch(/overall/);
  });

  it("attributes every entry to the person and the role they held at the time", async () => {
    // acting_role is captured at write time on purpose — a role can change
    // later, so resolving it at read time would misstate the history.
    const r = await admin.query<{ user_id: string; acting_role: string }>(
      "SELECT user_id, acting_role FROM activity_log WHERE tenant_id=$1 LIMIT 1", [TENANT]);
    expect(r.rows[0].user_id).toBe(USER);
    expect(r.rows[0].acting_role).toBe("firm_admin");
  });
});
