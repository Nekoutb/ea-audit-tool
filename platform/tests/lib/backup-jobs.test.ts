import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Archiving a file must queue its off-site copy, and must not depend on that
// copy succeeding. The second half is the one worth testing: a partner closing
// an audit file cannot be blocked because object storage is down — that would be
// a compliance failure manufactured by the compliance tooling.

const TENANT = "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d401";
const USER = "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d402";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "partner", locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { archivedWithoutBackup, backupsFor, enqueueBackup } from "@/lib/backup-jobs";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1 OR slug = 'backup-jobs-test'", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query(
    "INSERT INTO tenant (id, name, slug) VALUES ($1, 'Jobs Firm', 'backup-jobs-test')",
    [TENANT],
  );
  await admin.query(
    "INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'jobs@backup.local', 'Jobs', 'x')",
    [USER],
  );
  await admin.query(
    "INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'partner')",
    [USER, TENANT],
  );
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Jobs SA', 'SA') RETURNING id",
    [TENANT],
  );
  const eng = await admin.query<{ id: string }>(
    `INSERT INTO engagement (tenant_id, client_id, fiscal_year, period_end)
     VALUES ($1, $2, 2025, '2025-12-31') RETURNING id`,
    [TENANT, client.rows[0].id],
  );
  engagementId = eng.rows[0].id;
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("backup queue", () => {
  it("queues one archival copy", async () => {
    await enqueueBackup({ tenantId: TENANT, engagementId, kind: "engagement-archive" });
    const jobs = await backupsFor(engagementId);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].kind).toBe("engagement-archive");
    expect(jobs[0].state).toBe("queued");
    expect(jobs[0].objectKey).toBeNull();
  });

  it("does not queue a second archival copy for the same file", async () => {
    await enqueueBackup({ tenantId: TENANT, engagementId, kind: "engagement-archive" });
    await enqueueBackup({ tenantId: TENANT, engagementId, kind: "engagement-archive" });
    expect(await backupsFor(engagementId)).toHaveLength(1);
  });

  it("never throws, whatever the database says", async () => {
    // The whole point: archiveEngagement() has already committed by the time
    // this runs, so a failure here must not look like a failed archive.
    await expect(
      enqueueBackup({ tenantId: "not-a-uuid", engagementId, kind: "engagement-archive" }),
    ).resolves.toBeUndefined();
  });

  it("reports an archived file that has no completed copy", async () => {
    await admin.query(
      "UPDATE engagement SET archived_at = now(), phase = 'archived' WHERE id = $1",
      [engagementId],
    );
    const orphans = await archivedWithoutBackup();
    expect(orphans.map((o) => o.id)).toContain(engagementId);

    await admin.query(
      "UPDATE backup_job SET state = 'done', completed_at = now(), object_key = 'tenant/x/engagement/y/archive/z' WHERE engagement_id = $1",
      [engagementId],
    );
    const after = await archivedWithoutBackup();
    expect(after.map((o) => o.id)).not.toContain(engagementId);
  });

  it("records where the copy went", async () => {
    const jobs = await backupsFor(engagementId);
    expect(jobs[0].state).toBe("done");
    expect(jobs[0].objectKey).toMatch(/^tenant\//);
    expect(jobs[0].completedAt).toBeTruthy();
  });
});
