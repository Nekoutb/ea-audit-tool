import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5";
const PARTNER = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e501";
const ON_TEAM = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e502";
const OUTSIDER = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e503";

let actor = { id: PARTNER, role: "firm_admin" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: TENANT, role: actor.role, locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { canSeeEngagement, hasPortfolioOversight, requireEngagementAccess } from "@/lib/engagement-access";
import { createEngagement, listEngagements } from "@/lib/engagements";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let assigned: string;
let unassigned: string;

const as = (id: string, role: string) => { actor = { id, role }; };

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [[PARTNER, ON_TEAM, OUTSIDER]]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Access Firm', 'access-test')", [TENANT]);
  for (const [id, email, role] of [
    [PARTNER, "partner@access.local", "firm_admin"],
    [ON_TEAM, "member@access.local", "senior"],
    [OUTSIDER, "outsider@access.local", "senior"],
  ]) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, TENANT, role]);
  }
  as(PARTNER, "firm_admin");
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Access SA', 'SA') RETURNING id",
    [TENANT],
  );
  assigned = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
  unassigned = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2024, periodEnd: "2024-12-31" });
  // Only the first gets a team; the second stands for the 528 of 531 live
  // engagements that have none.
  await admin.query(
    "INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status) VALUES ($1,$2,$3,'senior','accepted')",
    [TENANT, assigned, ON_TEAM],
  );
}, 60_000);

afterEach(() => { as(PARTNER, "firm_admin"); delete process.env.ENGAGEMENT_ACCESS_STRICT; });

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("who may open an engagement", () => {
  it("lets an assigned member in", async () => {
    as(ON_TEAM, "senior");
    expect(await canSeeEngagement(assigned)).toBe(true);
  });

  it("keeps an unassigned colleague out of an engagement that HAS a team", async () => {
    as(OUTSIDER, "senior");
    expect(await canSeeEngagement(assigned)).toBe(false);
    await expect(requireEngagementAccess(assigned)).rejects.toThrow("not-on-this-engagement");
  });

  it("lets a partner see everything, assigned or not", async () => {
    as(PARTNER, "partner");
    expect(await canSeeEngagement(assigned)).toBe(true);
    expect(await canSeeEngagement(unassigned)).toBe(true);
  });

  it("admits an invited member who has not yet accepted", async () => {
    // The invitation email links to the engagement dashboard to accept or
    // decline; if only 'accepted' granted access, no invitation could be acted on.
    await admin.query("UPDATE team_member SET status='invited' WHERE engagement_id=$1 AND user_id=$2", [assigned, ON_TEAM]);
    as(ON_TEAM, "senior");
    expect(await canSeeEngagement(assigned)).toBe(true);
    await admin.query("UPDATE team_member SET status='accepted' WHERE engagement_id=$1 AND user_id=$2", [assigned, ON_TEAM]);
  });

  it("excludes someone who declined", async () => {
    await admin.query("UPDATE team_member SET status='declined' WHERE engagement_id=$1 AND user_id=$2", [assigned, ON_TEAM]);
    as(ON_TEAM, "senior");
    expect(await canSeeEngagement(assigned)).toBe(false);
    await admin.query("UPDATE team_member SET status='accepted' WHERE engagement_id=$1 AND user_id=$2", [assigned, ON_TEAM]);
  });

  it("admits someone who owns a task on it even with no team row", async () => {
    const item = await admin.query<{ id: string }>(
      "SELECT id FROM file_item WHERE engagement_id = $1 LIMIT 1", [assigned]);
    await admin.query("UPDATE file_item SET assignee_user_id=$2 WHERE id=$1", [item.rows[0].id, OUTSIDER]);
    as(OUTSIDER, "senior");
    expect(await canSeeEngagement(assigned)).toBe(true);
    await admin.query("UPDATE file_item SET assignee_user_id=NULL WHERE id=$1", [item.rows[0].id]);
  });
});

describe("the unassigned allowance — nobody is locked out on deploy day", () => {
  it("leaves an engagement with no team open to the firm", async () => {
    // 528 of 531 live engagements have no team_member rows. Gating strictly
    // would make almost the whole product invisible to everyone but partners.
    as(OUTSIDER, "senior");
    expect(await canSeeEngagement(unassigned)).toBe(true);
  });

  it("closes it the moment somebody is actually assigned", async () => {
    await admin.query(
      "INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status) VALUES ($1,$2,$3,'senior','accepted')",
      [TENANT, unassigned, ON_TEAM],
    );
    as(OUTSIDER, "senior");
    expect(await canSeeEngagement(unassigned)).toBe(false);
    as(ON_TEAM, "senior");
    expect(await canSeeEngagement(unassigned)).toBe(true);
    await admin.query("DELETE FROM team_member WHERE engagement_id=$1", [unassigned]);
  });

  it("withdraws the allowance under ENGAGEMENT_ACCESS_STRICT", async () => {
    process.env.ENGAGEMENT_ACCESS_STRICT = "1";
    as(OUTSIDER, "senior");
    expect(await canSeeEngagement(unassigned)).toBe(false);
  });
});

describe("the register reflects the same rule", () => {
  it("shows a partner both engagements", async () => {
    as(PARTNER, "partner");
    const ids = (await listEngagements()).map((e) => e.id);
    expect(ids).toContain(assigned);
    expect(ids).toContain(unassigned);
  });

  it("hides the assigned one from an outsider but keeps the unassigned one", async () => {
    as(OUTSIDER, "senior");
    const ids = (await listEngagements()).map((e) => e.id);
    expect(ids).not.toContain(assigned);
    expect(ids).toContain(unassigned);
  });

  it("shows the assigned one to its member", async () => {
    as(ON_TEAM, "senior");
    expect((await listEngagements()).map((e) => e.id)).toContain(assigned);
  });
});

describe("hasPortfolioOversight", () => {
  it("is partner and above", () => {
    expect(hasPortfolioOversight("partner")).toBe(true);
    expect(hasPortfolioOversight("firm_admin")).toBe(true);
    expect(hasPortfolioOversight("manager")).toBe(false);
    expect(hasPortfolioOversight("senior")).toBe(false);
  });
});
