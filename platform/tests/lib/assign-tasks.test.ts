import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a7a7";
const PARTNER = "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a701";
const MEMBER = "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a702";
const OUTSIDER = "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a703";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: PARTNER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { assignTasks } from "@/lib/team";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;
let itemIds: string[];

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [[PARTNER, MEMBER, OUTSIDER]]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Assign Firm', 'assign-test')", [TENANT]);
  for (const [id, email, role] of [
    [PARTNER, "partner@assign.local", "firm_admin"],
    [MEMBER, "member@assign.local", "senior"],
    [OUTSIDER, "outsider@assign.local", "senior"],
  ]) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, TENANT, role]);
  }
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Assign SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
  await admin.query(
    "INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status) VALUES ($1,$2,$3,'senior','accepted')",
    [TENANT, engagementId, MEMBER],
  );
  const items = await admin.query<{ id: string }>(
    "SELECT id FROM file_item WHERE engagement_id = $1 ORDER BY code LIMIT 3",
    [engagementId],
  );
  itemIds = items.rows.map((r) => r.id);
  expect(itemIds.length).toBe(3);
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("assignTasks", () => {
  it("assigns every listed task to the team member and reports the count", async () => {
    const n = await assignTasks(engagementId, itemIds, MEMBER);
    expect(n).toBe(3);
    const rows = await admin.query<{ assignee_user_id: string }>(
      "SELECT assignee_user_id FROM file_item WHERE id = ANY($1)",
      [itemIds],
    );
    expect(rows.rows.map((r) => r.assignee_user_id)).toEqual([MEMBER, MEMBER, MEMBER]);
  });

  it("refuses a target who is not on the engagement team", async () => {
    await expect(assignTasks(engagementId, itemIds, OUTSIDER)).rejects.toThrow("not-found");
    const rows = await admin.query<{ assignee_user_id: string }>(
      "SELECT DISTINCT assignee_user_id FROM file_item WHERE id = ANY($1)",
      [itemIds],
    );
    expect(rows.rows).toEqual([{ assignee_user_id: MEMBER }]);
  });

  it("unassigns with null and ignores an empty list", async () => {
    expect(await assignTasks(engagementId, [], MEMBER)).toBe(0);
    const n = await assignTasks(engagementId, [itemIds[0]], null);
    expect(n).toBe(1);
    const row = await admin.query<{ assignee_user_id: string | null }>(
      "SELECT assignee_user_id FROM file_item WHERE id = $1",
      [itemIds[0]],
    );
    expect(row.rows[0].assignee_user_id).toBeNull();
  });

  it("cannot repoint another engagement's items", async () => {
    const other = await admin.query<{ id: string }>(
      "SELECT fi.id FROM file_item fi WHERE fi.engagement_id <> $1 LIMIT 1",
      [engagementId],
    );
    if (other.rows[0]) {
      const n = await assignTasks(engagementId, [other.rows[0].id], MEMBER);
      expect(n).toBe(0);
    }
  });
});
