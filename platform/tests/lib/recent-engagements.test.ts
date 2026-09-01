// `recentEngagements` feeds the nav switcher, and the nav swallows its errors.
// That combination hid a query that threw for every partner and firm admin:
// $2 exists only inside the visibility clause, the clause is empty for a role
// with portfolio oversight, and userId was bound regardless — two parameters
// against a one-parameter statement.
//
// The cases below run the query as BOTH sides of that branch, which is the gap
// the previous tests left: they only ever exercised roles that keep the clause.

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "e7e7e7e7-e7e7-4e7e-8e7e-e7e7e7e7e7e7";
const ADMIN = "e7e7e7e7-e7e7-4e7e-8e7e-e7e7e7e7e701";
const PARTNER = "e7e7e7e7-e7e7-4e7e-8e7e-e7e7e7e7e702";
const SENIOR = "e7e7e7e7-e7e7-4e7e-8e7e-e7e7e7e7e703";

let actor = { id: ADMIN, role: "firm_admin" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: TENANT, role: actor.role, locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { hasPortfolioOversight } from "@/lib/engagement-access";
import { recentEngagements } from "@/lib/engagement-dashboard";
import { createEngagement } from "@/lib/engagements";
import type { Role } from "@/lib/rbac";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const as = (id: string, role: string) => { actor = { id, role }; };

let mine: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [[ADMIN, PARTNER, SENIOR]]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Recent Firm', 'recent-test')", [TENANT]);
  for (const [id, email, role] of [
    [ADMIN, "admin@recent.local", "firm_admin"],
    [PARTNER, "partner@recent.local", "partner"],
    [SENIOR, "senior@recent.local", "senior"],
  ]) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, TENANT, role]);
  }
  as(ADMIN, "firm_admin");
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Recent SA', 'SA') RETURNING id",
    [TENANT],
  );
  mine = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
  // The senior sees it only through the team; the oversight roles see it anyway.
  await admin.query(
    "INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status) VALUES ($1,$2,$3,'senior','accepted')",
    [TENANT, mine, SENIOR],
  );
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("recentEngagements", () => {
  // The regression itself: these two roles drop the visibility clause, so the
  // statement has one placeholder and must be given one parameter.
  it.each([
    ["firm_admin", ADMIN],
    ["partner", PARTNER],
  ])("runs for %s, whose visibility clause is empty", async (role, id) => {
    expect(hasPortfolioOversight(role as Role)).toBe(true);
    as(id, role);
    const rows = await recentEngagements(6);
    expect(rows.map((r) => r.id)).toContain(mine);
  });

  it("still filters for a role that keeps the visibility clause", async () => {
    expect(hasPortfolioOversight("senior" as Role)).toBe(false);
    as(SENIOR, "senior");
    const rows = await recentEngagements(6);
    expect(rows.map((r) => r.id)).toContain(mine);
  });

  it("honours the limit", async () => {
    as(ADMIN, "firm_admin");
    expect((await recentEngagements(1)).length).toBeLessThanOrEqual(1);
  });
});
