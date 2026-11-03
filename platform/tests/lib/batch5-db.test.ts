import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Batch 5 on the database (2026-11-03):
//   F045 the standards edition is derived at creation from the first day of
//        the period, read back on the engagement, overridable by a manager with
//        a reason that goes to activity_log (migration 20261103000001)
//   D1   the answer-history trigger ignores no-op changes between NULL, '' and
//        '""' (migration 20261103000002)
//   D2   the F002 role minimum is known before the click (roleMinimumRefusals)
//
// Needs migrations 20261103000001 and 20261103000002 applied.

const TENANT = "b5b5b5b5-b5b5-4b5b-8b5b-b5b5b5b5b5b5";
const ADMIN = "b5b5b5b5-b5b5-4b5b-8b5b-b5b5b5b5b501";
const MANAGER = "b5b5b5b5-b5b5-4b5b-8b5b-b5b5b5b5b502";
const STAFF = "b5b5b5b5-b5b5-4b5b-8b5b-b5b5b5b5b503";
const USERS = [ADMIN, MANAGER, STAFF];

let actor = { id: ADMIN, role: "firm_admin" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: TENANT, role: actor.role, locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { createEngagement, getEngagement, setStandardsEdition, standardsEditionOf } from "@/lib/engagements";
import { roleMinimumRefusals } from "@/lib/signoff-policy";

const as = (id: string, role: string) => {
  actor = { id, role };
};

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let clientId: string;
let current2026: string;
let revised2027: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1::uuid[])", [USERS]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Batch5 Firm', 'batch5-test')", [TENANT]);
  for (const [id, email, role] of [
    [ADMIN, "admin@batch5.local", "firm_admin"],
    [MANAGER, "manager@batch5.local", "manager"],
    [STAFF, "staff@batch5.local", "staff"],
  ]) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, TENANT, role]);
  }
  as(ADMIN, "firm_admin");
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Batch5 SA', 'SA') RETURNING id",
    [TENANT],
  );
  clientId = client.rows[0].id;
  // period 2026-01-01 → 2026-12-31: the editions in force
  current2026 = await createEngagement({ clientId, fiscalYear: 2026, periodEnd: "2026-12-31", partnerId: ADMIN, durationMonths: 12 });
  // period 2027-01-01 → 2027-12-31: the revised standards
  revised2027 = await createEngagement({ clientId, fiscalYear: 2027, periodEnd: "2027-12-31", partnerId: ADMIN });
  for (const [eng, user, role] of [
    [current2026, MANAGER, "manager"],
    [current2026, STAFF, "staff"],
  ]) {
    await admin.query(
      "INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status) VALUES ($1, $2, $3, $4, 'accepted')",
      [TENANT, eng, user, role],
    );
  }
}, 30_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("F045 — the standards edition on the engagement", () => {
  it("derives the edition at creation from the first day of the period", async () => {
    as(ADMIN, "firm_admin");
    expect((await getEngagement(current2026))!.standardsEdition).toBe("current");
    expect((await getEngagement(revised2027))!.standardsEdition).toBe("revised_2026");
    // the boundary: a period beginning on 15 December 2026 is revised, one beginning on 1 December is not
    // (one engagement per client and fiscal year: the label is free here)
    const boundary = await createEngagement({ clientId, fiscalYear: 2028, periodEnd: "2027-12-14", partnerId: ADMIN, durationMonths: 12 });
    expect((await getEngagement(boundary))!.standardsEdition).toBe("revised_2026");
    const before = await createEngagement({ clientId, fiscalYear: 2029, periodEnd: "2027-11-30", partnerId: ADMIN, durationMonths: 12 });
    expect((await getEngagement(before))!.standardsEdition).toBe("current");
    // a six-month first period starting in 2027
    const short = await createEngagement({ clientId, fiscalYear: 2030, periodEnd: "2027-06-30", partnerId: ADMIN, durationMonths: 6 });
    const info = await standardsEditionOf(short);
    expect(info).toEqual({ edition: "revised_2026", derived: "revised_2026", periodStart: "2027-01-01", overridden: false });
  });

  it("backfilled every existing row and refuses an unknown value", async () => {
    const nulls = await admin.query<{ n: string }>("SELECT count(*)::text AS n FROM engagement WHERE standards_edition IS NULL");
    expect(nulls.rows[0].n).toBe("0");
    await expect(admin.query("UPDATE engagement SET standards_edition = 'isa_2009' WHERE id = $1", [current2026])).rejects.toThrow();
  });

  it("lets a manager override it with a reason, logged with both values", async () => {
    as(STAFF, "staff");
    await expect(setStandardsEdition(current2026, "revised_2026", "early adoption")).rejects.toThrow("forbidden");
    as(MANAGER, "manager");
    await expect(setStandardsEdition(current2026, "revised_2026", "   ")).rejects.toThrow("reason-required");
    await setStandardsEdition(current2026, "revised_2026", "Early adoption decided by the engagement partner");
    const eng = await getEngagement(current2026);
    expect(eng!.standardsEdition).toBe("revised_2026");
    const info = await standardsEditionOf(current2026);
    expect(info).toMatchObject({ edition: "revised_2026", derived: "current", periodStart: "2026-01-01", overridden: true });
    const log = await admin.query<{ before_value: string; after_value: string; meta: { reason: string }; acting_role: string }>(
      `SELECT before_value, after_value, meta, acting_role FROM activity_log
        WHERE engagement_id = $1 AND action = 'standards_edition_changed' ORDER BY created_at DESC LIMIT 1`,
      [current2026],
    );
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0].before_value).toBe("current");
    expect(log.rows[0].after_value).toBe("revised_2026");
    expect(log.rows[0].meta.reason).toBe("Early adoption decided by the engagement partner");
    expect(log.rows[0].acting_role).toBe("manager");
    // setting the same value again logs nothing
    await setStandardsEdition(current2026, "revised_2026", "no change");
    const again = await admin.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM activity_log WHERE engagement_id = $1 AND action = 'standards_edition_changed'",
      [current2026],
    );
    expect(again.rows[0].n).toBe("1");
    // back to the derived value for the other tests
    await setStandardsEdition(current2026, "current", "test reset");
  });
});

describe("D1 — the answer-history trigger ignores no-op changes", () => {
  const count = async (field: string): Promise<number> => {
    const r = await admin.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM activity_log
        WHERE engagement_id = $1 AND entity_type = 'form_response' AND meta->>'code' = 'P1.1' AND meta->>'field' = $2`,
      [current2026, field],
    );
    return Number(r.rows[0].n);
  };
  const write = (field: string, value: string) =>
    admin.query(
      `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by)
       VALUES ($1, $2, 'P1.1', $3, $4::jsonb, $5)
       ON CONFLICT (engagement_id, code, field_key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by`,
      [TENANT, current2026, field, value, MANAGER],
    );

  it("does not log an untouched field saved as the empty string", async () => {
    await write("q_untouched", '""');
    expect(await count("q_untouched")).toBe(0);
    // saved again as '' then as '""': still nothing
    await write("q_untouched", '""');
    await admin.query("UPDATE form_response SET value = '\"\"'::jsonb WHERE engagement_id = $1 AND field_key = 'q_untouched'", [current2026]);
    expect(await count("q_untouched")).toBe(0);
    // a DELETE + INSERT of a blank in one transaction is not a change either
    await admin.query("BEGIN");
    await admin.query("DELETE FROM form_response WHERE engagement_id = $1 AND field_key = 'q_untouched'", [current2026]);
    await write("q_untouched", '""');
    await admin.query("COMMIT");
    expect(await count("q_untouched")).toBe(0);
  });

  it("still logs the real change, once, with its before and after", async () => {
    await write("q_real", '""');
    expect(await count("q_real")).toBe(0);
    await write("q_real", '"yes"');
    expect(await count("q_real")).toBe(1);
    const row = await admin.query<{ before_value: string | null; after_value: string }>(
      `SELECT before_value, after_value FROM activity_log
        WHERE engagement_id = $1 AND entity_type = 'form_response' AND meta->>'field' = 'q_real'`,
      [current2026],
    );
    expect(row.rows[0].after_value).toBe("yes");
    expect(row.rows[0].before_value === "" || row.rows[0].before_value === null).toBe(true);
    // same value again: no second row; a different value: a second row
    await write("q_real", '"yes"');
    expect(await count("q_real")).toBe(1);
    await write("q_real", '"no"');
    expect(await count("q_real")).toBe(2);
    // clearing an answer is a change; clearing a blank is not
    await write("q_real", '""');
    expect(await count("q_real")).toBe(3);
    await admin.query("DELETE FROM form_response WHERE engagement_id = $1 AND field_key = 'q_real'", [current2026]);
    expect(await count("q_real")).toBe(3);
  });
});

describe("D2 — the role minimum is known before the click", () => {
  it("names the refusal for a staff member on P1.1 and leaves E4.1's P free", async () => {
    const staff = await roleMinimumRefusals(TENANT, current2026, STAFF, ["P1.1", "E4.1", "S3.1"]);
    expect(staff.get("P1.1")).toEqual({ preparer: "role-below-task-minimum-manager", reviewer: "role-below-task-minimum-partner" });
    expect(staff.get("E4.1")).toEqual({ preparer: null, reviewer: "role-below-task-minimum-senior" });
    expect(staff.get("S3.1")).toEqual({ preparer: "role-below-task-minimum-senior", reviewer: "role-below-task-minimum-manager" });
    const manager = await roleMinimumRefusals(TENANT, current2026, MANAGER, ["P1.1", "E4.1"]);
    expect(manager.get("P1.1")).toEqual({ preparer: null, reviewer: "role-below-task-minimum-partner" });
    expect(manager.has("E4.1")).toBe(false);
    // the engagement partner has nothing greyed out; someone off the team gets no refusal from here
    expect((await roleMinimumRefusals(TENANT, current2026, ADMIN, ["P1.1"])).size).toBe(0);
    expect((await roleMinimumRefusals(TENANT, revised2027, STAFF, ["P1.1"])).size).toBe(0);
    expect((await roleMinimumRefusals(TENANT, current2026, STAFF, [])).size).toBe(0);
  });
});
