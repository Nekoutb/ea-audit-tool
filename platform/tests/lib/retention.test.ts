import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a7a7";
const PARTNER = "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a701";
const MANAGER = "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a702";
const STAFF = "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a703";

let actor = { id: PARTNER, role: "partner" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: TENANT, role: actor.role, locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import {
  activeHold,
  listHolds,
  placeLegalHold,
  releaseLegalHold,
  retentionDate,
  retentionPolicy,
  setRetentionYears,
} from "@/lib/retention";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;

const as = (id: string, role: string) => { actor = { id, role }; };

/**
 * legal_hold refuses DELETE by design, so teardown disables the trigger rather
 * than the guard being relaxed to suit the tests. A superuser may disable a
 * trigger; the application role cannot, which is the point.
 */
async function clearHolds(): Promise<void> {
  await admin.query("ALTER TABLE legal_hold DISABLE TRIGGER trg_legal_hold_append_only");
  try {
    await admin.query("DELETE FROM legal_hold WHERE tenant_id = $1", [TENANT]);
  } finally {
    await admin.query("ALTER TABLE legal_hold ENABLE TRIGGER trg_legal_hold_append_only");
  }
}

async function removeFixture(): Promise<void> {
  await clearHolds();
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [[PARTNER, MANAGER, STAFF]]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1,'Hold Firm','hold-test')", [TENANT]);
  for (const [id, email, role] of [
    [PARTNER, "partner@hold.local", "partner"],
    [MANAGER, "manager@hold.local", "manager"],
    [STAFF, "staff@hold.local", "staff"],
  ]) {
    await admin.query("INSERT INTO app_user (id,email,name,password_hash) VALUES ($1,$2,$2,'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id,tenant_id,role) VALUES ($1,$2,$3)", [id, TENANT, role]);
  }
  as(PARTNER, "partner");
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id,name,legal_form) VALUES ($1,'Hold SA','SA') RETURNING id", [TENANT]);
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
}, 60_000);

afterEach(async () => {
  as(PARTNER, "partner");
  await clearHolds();
});

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("retention period", () => {
  it("defaults to ten years", async () => {
    expect((await retentionPolicy()).years).toBe(10);
  });

  it("counts from the report date when there is one", () => {
    expect(retentionDate("2026-04-30", "2025-12-31", 10)).toBe("2036-04-30");
  });

  it("falls back to the period end when no report was issued", () => {
    expect(retentionDate(null, "2025-12-31", 10)).toBe("2035-12-31");
  });

  it("refuses a period below the floor any jurisdiction allows", async () => {
    as(PARTNER, "firm_admin");
    await expect(setRetentionYears(3)).rejects.toThrow("out-of-range");
    await expect(setRetentionYears(31)).rejects.toThrow("out-of-range");
  });

  it("is a firm-admin setting", async () => {
    as(MANAGER, "manager");
    await expect(setRetentionYears(12)).rejects.toThrow("requires-firm-admin");
  });

  it("accepts a period inside the range", async () => {
    as(PARTNER, "firm_admin");
    await expect(setRetentionYears(12)).resolves.toBeUndefined();
    expect((await retentionPolicy()).years).toBe(12);
    await setRetentionYears(10);
  });
});

describe("legal hold", () => {
  it("can be placed by a manager, who is usually who hears of the dispute first", async () => {
    as(MANAGER, "manager");
    await placeLegalHold(engagementId, "Client dispute, letter of 20 August");
    const hold = await activeHold(engagementId);
    expect(hold?.reason).toContain("Client dispute");
    expect(hold?.releasedAt).toBeNull();
  });

  it("cannot be placed by staff", async () => {
    as(STAFF, "staff");
    await expect(placeLegalHold(engagementId, "reason")).rejects.toThrow("requires-manager");
  });

  it("requires a reason", async () => {
    as(MANAGER, "manager");
    await expect(placeLegalHold(engagementId, "   ")).rejects.toThrow("reason-required");
  });

  it("refuses a second active hold on the same file", async () => {
    as(MANAGER, "manager");
    await placeLegalHold(engagementId, "First");
    await expect(placeLegalHold(engagementId, "Second")).rejects.toThrow("already-held");
  });

  it("is released only by a partner, and only with a reason", async () => {
    as(MANAGER, "manager");
    await placeLegalHold(engagementId, "Dispute");
    as(MANAGER, "manager");
    await expect(releaseLegalHold(engagementId, "done")).rejects.toThrow("requires-partner");
    as(PARTNER, "partner");
    await expect(releaseLegalHold(engagementId, "  ")).rejects.toThrow("reason-required");
    await expect(releaseLegalHold(engagementId, "Matter settled")).resolves.toBeUndefined();
    expect(await activeHold(engagementId)).toBeNull();
  });

  it("keeps a released hold as history rather than deleting it", async () => {
    as(MANAGER, "manager");
    await placeLegalHold(engagementId, "Dispute");
    as(PARTNER, "partner");
    await releaseLegalHold(engagementId, "Settled");
    const holds = await listHolds(engagementId);
    expect(holds).toHaveLength(1);
    expect(holds[0].releasedAt).not.toBeNull();
    expect(holds[0].releaseReason).toBe("Settled");
    expect(holds[0].placedByName).toBeTruthy();
    expect(holds[0].releasedByName).toBeTruthy();
  });

  it("complains when releasing a file that is not held", async () => {
    as(PARTNER, "partner");
    await expect(releaseLegalHold(engagementId, "nothing to release")).rejects.toThrow("no-active-hold");
  });
});

describe("the guarantee is in the database, not the application", () => {
  it("refuses to delete a held engagement even as the table owner", async () => {
    // A hold is worth having only if it cannot be stepped around. This runs as
    // the migration role — a superuser — which bypasses row-level security; the
    // trigger still refuses.
    await admin.query(
      `INSERT INTO legal_hold (tenant_id, engagement_id, reason, placed_by) VALUES ($1,$2,'Litigation',$3)`,
      [TENANT, engagementId, PARTNER],
    );
    await expect(
      admin.query("DELETE FROM engagement WHERE id = $1", [engagementId]),
    ).rejects.toThrow(/legal-hold/);
  });

  it("stops objecting once the hold is released — and something else still does", async () => {
    // Releasing removes the HOLD's objection. The delete still fails, for an
    // independent reason worth recording: it cascades into activity_log, which
    // is append-only, so an engagement carrying any history cannot be removed
    // by SQL at all. Two unrelated controls both have to be satisfied before a
    // destruction path could ever work, which is the right number.
    await admin.query(
      `INSERT INTO legal_hold (tenant_id, engagement_id, reason, placed_by) VALUES ($1,$2,'Temp',$3)`,
      [TENANT, engagementId, PARTNER],
    );
    await admin.query(
      `UPDATE legal_hold SET released_at = now(), released_by = $2, release_reason = 'done'
        WHERE engagement_id = $1 AND released_at IS NULL`,
      [engagementId, PARTNER],
    );
    await expect(
      admin.query("DELETE FROM engagement WHERE id = $1", [engagementId]),
    ).rejects.toThrow(/append-only/);
  });

  it("refuses to delete a hold row at all", async () => {
    await admin.query(
      `INSERT INTO legal_hold (tenant_id, engagement_id, reason, placed_by) VALUES ($1,$2,'Keep',$3)`,
      [TENANT, engagementId, PARTNER],
    );
    await expect(
      admin.query("DELETE FROM legal_hold WHERE engagement_id = $1", [engagementId]),
    ).rejects.toThrow(/append-only/);
  });

  it("refuses to rewrite why a hold was placed", async () => {
    await admin.query(
      `INSERT INTO legal_hold (tenant_id, engagement_id, reason, placed_by) VALUES ($1,$2,'Original reason',$3)`,
      [TENANT, engagementId, PARTNER],
    );
    await expect(
      admin.query("UPDATE legal_hold SET reason = 'Rewritten' WHERE engagement_id = $1 AND released_at IS NULL", [engagementId]),
    ).rejects.toThrow(/only the release fields/);
  });

  it("refuses to re-open a released hold", async () => {
    await admin.query(
      `INSERT INTO legal_hold (tenant_id, engagement_id, reason, placed_by, released_at, released_by, release_reason)
       VALUES ($1,$2,'Done',$3, now(), $3, 'closed')`,
      [TENANT, engagementId, PARTNER],
    );
    await expect(
      admin.query("UPDATE legal_hold SET released_at = NULL, released_by = NULL, release_reason = NULL WHERE engagement_id = $1", [engagementId]),
    ).rejects.toThrow(/cannot be changed again/);
  });
});
