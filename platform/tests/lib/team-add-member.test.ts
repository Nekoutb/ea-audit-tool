import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Adding a colleague to an engagement. Two things this pins down:
//
//  - the name is whatever was typed, initials and all. Deriving it from the
//    address turned "j.p.mbarga@" into "J P Mbarga", which is not anybody's
//    name and which the firm then had to correct by hand.
//  - there is no cap on how many people an engagement can carry. The team page
//    only *suggests* colleagues who already exist in the firm, so a small firm
//    runs out of suggestions long before anything is actually full.

const TENANT = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e501";
const USER = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e502";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
  })),
}));
vi.mock("@/lib/locale", () => ({ getLocale: vi.fn(async () => "en") }));

import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { addTeamMemberByEmail, listTeam } from "@/lib/team";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1 OR slug = 'team-add-test'", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1 OR email LIKE '%@team-add.local'", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query(
    "INSERT INTO tenant (id, name, slug) VALUES ($1, 'Add Firm', 'team-add-test')",
    [TENANT],
  );
  await admin.query(
    "INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'boss@team-add.local', 'The Boss', 'x')",
    [USER],
  );
  await admin.query(
    "INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')",
    [USER, TENANT],
  );
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Add SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({
    clientId: client.rows[0].id,
    fiscalYear: 2025,
    periodEnd: "2025-12-31",
  });
}, 120_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("adding a team member", () => {
  it("uses the name as it was typed, initials and punctuation intact", async () => {
    await addTeamMemberByEmail(
      engagementId,
      "jp@team-add.local",
      "senior",
      "Add 2025",
      "J. P. Mbarga",
    );
    const row = await admin.query<{ name: string }>(
      "SELECT name FROM app_user WHERE lower(email) = 'jp@team-add.local'",
    );
    expect(row.rows[0].name).toBe("J. P. Mbarga");
  });

  it("falls back to the address only when nothing was typed", async () => {
    await addTeamMemberByEmail(
      engagementId,
      "marie.nkolo@team-add.local",
      "staff",
      "Add 2025",
      "   ",
    );
    const row = await admin.query<{ name: string }>(
      "SELECT name FROM app_user WHERE lower(email) = 'marie.nkolo@team-add.local'",
    );
    expect(row.rows[0].name).toBe("Marie Nkolo");
  });

  it("does not rename a colleague who already has an account", async () => {
    // The name on an existing account is theirs; the team screen has no
    // business rewriting it because someone typed something else here.
    // (Taken off the team first: "add" now refuses someone already on it.)
    await admin.query(
      "DELETE FROM team_member WHERE engagement_id = $1 AND user_id = (SELECT id FROM app_user WHERE lower(email) = 'jp@team-add.local')",
      [engagementId],
    );
    await addTeamMemberByEmail(
      engagementId,
      "jp@team-add.local",
      "manager",
      "Add 2025",
      "Somebody Else",
    );
    const row = await admin.query<{ name: string }>(
      "SELECT name FROM app_user WHERE lower(email) = 'jp@team-add.local'",
    );
    expect(row.rows[0].name).toBe("J. P. Mbarga");
  });

  it("carries far more than a handful of people", async () => {
    // 4 was never a limit — it was the number of colleagues the firm had.
    for (let i = 0; i < 22; i++) {
      await addTeamMemberByEmail(
        engagementId,
        `member${i}@team-add.local`,
        "staff",
        "Add 2025",
        `Member ${i}`,
      );
    }
    const team = await listTeam(engagementId);
    expect(team.length).toBeGreaterThanOrEqual(24);
    expect(new Set(team.map((m) => m.userId)).size).toBe(team.length);
  }, 180_000);
});
