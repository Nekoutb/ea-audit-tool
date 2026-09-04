// The application's half of the backup queue: ask for a copy, and report what
// exists. The drainer that actually produces and uploads the object runs as
// root on the server (deploy/ea-audit-backup-drain.sh).

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export type BackupKind = "engagement-archive" | "engagement-rolling" | "tenant-full";

export interface BackupJob {
  id: string;
  kind: BackupKind;
  state: "queued" | "running" | "done" | "failed";
  requestedAt: string;
  completedAt: string | null;
  objectKey: string | null;
  objectBytes: number | null;
  lastError: string | null;
}

/**
 * Ask for a backup. Never throws.
 *
 * This is called immediately after an engagement is archived, and the archive
 * has already committed by then. If the queue insert fails — and the only
 * realistic reason is the migration not having run yet — the right outcome is a
 * file that is archived but not yet copied, which the monitoring query catches.
 * The wrong outcome is an exception propagating out of archiveEngagement() and
 * making a partner believe the archiving failed when it did not. Same posture as
 * recordActivity() in lib/activity.ts.
 */
export async function enqueueBackup(input: {
  tenantId: string;
  engagementId?: string | null;
  kind: BackupKind;
}): Promise<void> {
  try {
    // withTenant, not the bare pool: backup_job is under FORCE row-level
    // security like every other tenant table, so an insert without
    // app.tenant_id set is refused by the WITH CHECK clause.
    await withTenant(input.tenantId, async (tx) => {
      await tx.query(
        `INSERT INTO backup_job (tenant_id, engagement_id, kind)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [input.tenantId, input.engagementId ?? null, input.kind],
      );
    });
  } catch (error) {
    console.error("[backup] could not enqueue a backup job", error);
  }
}

/** What has been copied off the box for this engagement, newest first. */
export async function backupsFor(engagementId: string): Promise<BackupJob[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const { rows } = await tx.query<{
      id: string;
      kind: BackupKind;
      state: BackupJob["state"];
      requested_at: string;
      completed_at: string | null;
      object_key: string | null;
      object_bytes: string | null;
      last_error: string | null;
    }>(
      `SELECT id, kind, state, requested_at, completed_at, object_key, object_bytes, last_error
         FROM backup_job WHERE engagement_id = $1 ORDER BY requested_at DESC`,
      [engagementId],
    );
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      state: r.state,
      requestedAt: new Date(r.requested_at).toISOString(),
      completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
      objectKey: r.object_key,
      objectBytes: r.object_bytes === null ? null : Number(r.object_bytes),
      lastError: r.last_error,
    }));
  });
}

/**
 * The acceptance criterion for the whole per-engagement scheme, as a query:
 * every archived file must have a completed archival copy. A non-empty result
 * means a closed audit file exists only on this box.
 *
 * Scoped to the caller's firm, because that is all row-level security will show
 * it. The cross-firm operator view is the same query run as `postgres` by
 * deploy/ea-audit-backup-drain.sh, which alerts on it every ten minutes.
 */
export async function archivedWithoutBackup(): Promise<{ id: string; archivedAt: string }[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const { rows } = await tx.query<{ id: string; archived_at: string }>(
      `SELECT e.id, e.archived_at
         FROM engagement e
        WHERE e.archived_at IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM backup_job j
                           WHERE j.engagement_id = e.id
                             AND j.kind = 'engagement-archive' AND j.state = 'done')
        ORDER BY e.archived_at`,
    );
    return rows.map((r) => ({ id: r.id, archivedAt: new Date(r.archived_at).toISOString() }));
  });
}
