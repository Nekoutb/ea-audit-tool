// F008 (firm decision 2026-10-27): ONLY an accepted team member opens an
// engagement — no exception for a firm administrator or a partner who is not
// on the team, no allowance for an engagement without a team, no grant through
// a task assignment, and an invited member sees the invitation only.

import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5";
const PARTNER = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e501";
const ON_TEAM = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e502";
const OUTSIDER = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e503";
const ADMIN = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e504";
const OTHER_PARTNER = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e505";

let actor = { id: PARTNER, role: "partner" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: TENANT, role: actor.role, locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { canSeeEngagement, invitationPending, requireEngagementAccess, visibleToUser } from "@/lib/engagement-access";
import { createEngagement, listEngagements } from "@/lib/engagements";
import { recentEngagements } from "@/lib/engagement-dashboard";
import { portfolioActions } from "@/lib/dashboards";
import { search } from "@/lib/search";
import { listMyNotifications, unreadCount } from "@/lib/notifications";
import { myInvitation, respondToEngagement } from "@/lib/team";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let assigned: string;
let unassigned: string;

const as = (id: string, role: string) => { actor = { id, role }; };

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [[PARTNER, ON_TEAM, OUTSIDER, ADMIN, OTHER_PARTNER]]);
}

async function setStatus(engagementId: string, userId: string, status: string): Promise<void> {
  await admin.query("UPDATE team_member SET status = $3 WHERE engagement_id = $1 AND user_id = $2", [engagementId, userId, status]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Access Firm', 'access-test')", [TENANT]);
  for (const [id, email, role] of [
    [PARTNER, "partner@access.local", "partner"],
    [ON_TEAM, "member@access.local", "senior"],
    [OUTSIDER, "outsider@access.local", "senior"],
    [ADMIN, "admin@access.local", "firm_admin"],
    [OTHER_PARTNER, "other-partner@access.local", "partner"],
  ]) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, TENANT, role]);
  }
  as(PARTNER, "partner");
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Access SA', 'SA') RETURNING id",
    [TENANT],
  );
  // created by the engagement partner themselves: PARTNER is seated, accepted
  assigned = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31", partnerId: PARTNER });
  unassigned = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2024, periodEnd: "2024-12-31", partnerId: PARTNER });
  // a file opened before the partner became mandatory: no team at all
  await admin.query("DELETE FROM team_member WHERE engagement_id = $1", [unassigned]);
  await admin.query(
    "INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status) VALUES ($1,$2,$3,'senior','accepted')",
    [TENANT, assigned, ON_TEAM],
  );
}, 60_000);

afterEach(() => { as(PARTNER, "partner"); });

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("who may open an engagement (F008)", () => {
  it("lets an accepted member in", async () => {
    as(ON_TEAM, "senior");
    expect(await canSeeEngagement(assigned)).toBe(true);
    as(PARTNER, "partner");
    expect(await canSeeEngagement(assigned)).toBe(true);
  });

  it("keeps a colleague who is not on the team out", async () => {
    as(OUTSIDER, "senior");
    expect(await canSeeEngagement(assigned)).toBe(false);
    await expect(requireEngagementAccess(assigned)).rejects.toThrow("not-on-this-engagement");
  });

  it("keeps a firm administrator who is not on the team out — no exception", async () => {
    as(ADMIN, "firm_admin");
    expect(await canSeeEngagement(assigned)).toBe(false);
    await expect(requireEngagementAccess(assigned)).rejects.toThrow("not-on-this-engagement");
    expect(await visibleToUser(assigned, TENANT, ADMIN)).toBe(false);
  });

  it("keeps a partner who is not on the team out", async () => {
    as(OTHER_PARTNER, "partner");
    expect(await canSeeEngagement(assigned)).toBe(false);
  });

  it("opens an engagement with no team to nobody", async () => {
    for (const [id, role] of [[ADMIN, "firm_admin"], [PARTNER, "partner"], [OUTSIDER, "senior"]] as const) {
      as(id, role);
      expect(await canSeeEngagement(unassigned)).toBe(false);
    }
  });

  it("grants nothing through a task assignment without a team row", async () => {
    const item = await admin.query<{ id: string }>("SELECT id FROM file_item WHERE engagement_id = $1 LIMIT 1", [assigned]);
    if (item.rows[0]) {
      await admin.query("UPDATE file_item SET assignee_user_id = $2, owner_id = $2 WHERE id = $1", [item.rows[0].id, OUTSIDER]);
    }
    as(OUTSIDER, "senior");
    expect(await canSeeEngagement(assigned)).toBe(false);
    if (item.rows[0]) {
      await admin.query("UPDATE file_item SET assignee_user_id = NULL, owner_id = NULL WHERE id = $1", [item.rows[0].id]);
    }
  });

  it("excludes someone who declined", async () => {
    await setStatus(assigned, ON_TEAM, "declined");
    as(ON_TEAM, "senior");
    expect(await canSeeEngagement(assigned)).toBe(false);
    await setStatus(assigned, ON_TEAM, "accepted");
  });
});

describe("an invited member sees only the invitation until they accept (F008)", () => {
  it("cannot open the file while invited, sees the invitation, and opens it once accepted", async () => {
    await admin.query(
      `INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status, invited_at)
       VALUES ($1, $2, $3, 'senior', 'invited', now())`,
      [TENANT, assigned, OUTSIDER],
    );
    as(OUTSIDER, "senior");
    expect(await canSeeEngagement(assigned)).toBe(false);
    await expect(requireEngagementAccess(assigned)).rejects.toThrow("not-on-this-engagement");
    expect(await invitationPending(assigned, TENANT, OUTSIDER)).toBe(true);
    // the invitation states its own facts, nothing of the file
    const invitation = await myInvitation(assigned);
    expect(invitation?.teamRole).toBe("senior");
    expect(invitation?.clientName).toBe("Access SA");
    // not listed in the register either
    expect((await listEngagements()).map((e) => e.id)).not.toContain(assigned);
    // but the dashboard asks for the answer
    expect((await portfolioActions()).some((a) => a.kind === "invitation" && a.engagementId === assigned)).toBe(true);

    await respondToEngagement(assigned, true);
    expect(await canSeeEngagement(assigned)).toBe(true);
    expect(await invitationPending(assigned, TENANT, OUTSIDER)).toBe(false);
    expect(await myInvitation(assigned)).toBeNull();
    await admin.query("DELETE FROM team_member WHERE engagement_id = $1 AND user_id = $2", [assigned, OUTSIDER]);
  });
});

describe("listings follow the same rule (F008)", () => {
  it("the register shows a firm administrator nothing they are not staffed on", async () => {
    as(ADMIN, "firm_admin");
    const ids = (await listEngagements()).map((e) => e.id);
    expect(ids).not.toContain(assigned);
    expect(ids).not.toContain(unassigned);
    expect((await recentEngagements(10)).map((r) => r.id)).not.toContain(assigned);
  });

  it("the register shows a member their file, and not the one without a team", async () => {
    as(ON_TEAM, "senior");
    const ids = (await listEngagements()).map((e) => e.id);
    expect(ids).toContain(assigned);
    expect(ids).not.toContain(unassigned);
    expect((await recentEngagements(10)).map((r) => r.id)).toContain(assigned);
  });

  it("the search finds nothing of a file the administrator is not on", async () => {
    as(ADMIN, "firm_admin");
    const result = await search("Access");
    expect(result.hits.some((h) => h.engagementId === assigned || h.engagementId === unassigned)).toBe(false);
    as(ON_TEAM, "senior");
    expect((await search("Access")).hits.some((h) => h.engagementId === assigned)).toBe(true);
  });

  it("hides the notifications of a file the reader is not on", async () => {
    await admin.query(
      `INSERT INTO notification (tenant_id, user_id, kind, title, href) VALUES
         ($1, $2, 'test', 'On a file', $3), ($1, $2, 'test', 'Firm-level', '/settings')`,
      [TENANT, ADMIN, `/engagements/${assigned}/dashboard`],
    );
    as(ADMIN, "firm_admin");
    const titles = (await listMyNotifications()).map((n) => n.title);
    expect(titles).toContain("Firm-level");
    expect(titles).not.toContain("On a file");
    expect(await unreadCount()).toBe(1);
    await admin.query("DELETE FROM notification WHERE tenant_id = $1 AND user_id = $2", [TENANT, ADMIN]);
  });
});
