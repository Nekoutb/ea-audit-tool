import { pool, withTenant } from "@/lib/db";
import { recordActivity } from "@/lib/activity";
import { ForbiddenError, requireRole, requireTenant } from "@/lib/tenant";

/**
 * How long a closed audit file is kept, and how to stop it going anywhere while
 * a dispute is live.
 *
 * C6.2 already asked a partner to confirm the retention period was set, against
 * a schema that could not hold one — the product asked for an attestation about
 * a fact it did not record. Both halves now exist.
 *
 * A legal hold ships BEFORE any destruction path, deliberately: a hold has
 * value only if it predates the attempt. The guarantee is a database trigger on
 * engagement DELETE, so a destruction route added later inherits the refusal
 * rather than having to remember it.
 */

export class RetentionError extends Error {}

export interface RetentionPolicy {
  years: number;
}

export interface LegalHold {
  id: string;
  engagementId: string;
  reason: string;
  placedBy: string;
  placedByName: string | null;
  placedAt: string;
  releasedAt: string | null;
  releasedByName: string | null;
  releaseReason: string | null;
}

/** The firm's retention period. Global table, so read outside withTenant. */
export async function retentionPolicy(): Promise<RetentionPolicy> {
  const { tenantId } = await requireTenant();
  const row = await pool.query<{ retention_years: number }>(
    "SELECT retention_years FROM tenant WHERE id = $1",
    [tenantId],
  );
  return { years: row.rows[0]?.retention_years ?? 10 };
}

/**
 * Change the firm's period. Only affects files archived from here on — an
 * engagement's retention_until is fixed at archive time precisely so a later
 * change cannot retrospectively shorten the life of a closed file.
 */
export async function setRetentionYears(years: number): Promise<void> {
  const { tenantId } = await requireRole("firm_admin");
  if (!Number.isInteger(years) || years < 5 || years > 30) throw new RetentionError("out-of-range");
  await pool.query("UPDATE tenant SET retention_years = $2 WHERE id = $1", [tenantId, years]);
  await recordActivity({
    entityType: "tenant",
    entityId: tenantId,
    action: "retention.period_set",
    summary: `Firm retention period set to ${years} years`,
    meta: { years },
  });
}

/**
 * The date this file may first be considered for destruction: the report date,
 * or the period end when no report was issued, plus the firm's period.
 */
export function retentionDate(reportDate: string | null, periodEnd: string, years: number): string {
  const from = new Date(`${reportDate ?? periodEnd}T00:00:00Z`);
  from.setUTCFullYear(from.getUTCFullYear() + years);
  return from.toISOString().slice(0, 10);
}

/** Stamp retention_until. Called from archiveEngagement, inside its transaction. */
export async function stampRetention(
  tx: { query: (text: string, values?: unknown[]) => Promise<unknown> },
  engagementId: string,
  years: number,
): Promise<void> {
  await tx.query(
    `UPDATE engagement
        SET retention_until = (coalesce(report_date, period_end) + ($2 || ' years')::interval)::date
      WHERE id = $1 AND retention_until IS NULL`,
    [engagementId, String(years)],
  );
}

/* ------------------------------------------------------------------ *
 * Legal hold
 * ------------------------------------------------------------------ */

/** The active hold on this engagement, if any. */
export async function activeHold(engagementId: string): Promise<LegalHold | null> {
  const holds = await listHolds(engagementId);
  return holds.find((h) => h.releasedAt === null) ?? null;
}

/** Every hold ever placed, newest first — released ones are history, not noise. */
export async function listHolds(engagementId: string): Promise<LegalHold[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.query<{
      id: string; engagement_id: string; reason: string; placed_by: string;
      placed_by_name: string | null; placed_at: string;
      released_at: string | null; released_by_name: string | null; release_reason: string | null;
    }>(
      `SELECT h.id, h.engagement_id, h.reason, h.placed_by,
              coalesce(p.name, p.email) AS placed_by_name,
              h.placed_at::text,
              h.released_at::text,
              coalesce(r.name, r.email) AS released_by_name,
              h.release_reason
         FROM legal_hold h
         LEFT JOIN app_user p ON p.id = h.placed_by
         LEFT JOIN app_user r ON r.id = h.released_by
        WHERE h.engagement_id = $1
        ORDER BY h.placed_at DESC`,
      [engagementId],
    );
    return rows.rows.map((r) => ({
      id: r.id,
      engagementId: r.engagement_id,
      reason: r.reason,
      placedBy: r.placed_by,
      placedByName: r.placed_by_name,
      placedAt: r.placed_at,
      releasedAt: r.released_at,
      releasedByName: r.released_by_name,
      releaseReason: r.release_reason,
    }));
  });
}

/**
 * Place a hold. Manager and above — the person who learns of a dispute is
 * usually not the partner, and a hold that waits for one is a hold placed too
 * late. Placing one wrongly costs nothing but disk.
 */
export async function placeLegalHold(engagementId: string, reason: string): Promise<string> {
  const { tenantId, userId } = await requireRole("manager");
  const text = reason.trim();
  if (!text) throw new RetentionError("reason-required");

  const id = await withTenant(tenantId, async (tx) => {
    const existing = await tx.query(
      "SELECT 1 FROM legal_hold WHERE engagement_id = $1 AND released_at IS NULL",
      [engagementId],
    );
    if (existing.rows.length > 0) throw new RetentionError("already-held");
    const row = await tx.query<{ id: string }>(
      `INSERT INTO legal_hold (tenant_id, engagement_id, reason, placed_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, engagementId, text, userId],
    );
    return row.rows[0].id;
  });

  await recordActivity({
    engagementId,
    entityType: "legal_hold",
    entityId: id,
    action: "legal_hold.placed",
    summary: "Legal hold placed — retention expiry suspended",
    meta: { reason: text },
  });
  return id;
}

/**
 * Release a hold. Partner only, and never a platform operator: releasing is the
 * act that lets a file become destructible, so it belongs to someone inside the
 * firm who carries the consequence — not to whoever happens to hold the
 * platform's super-admin flag.
 */
export async function releaseLegalHold(engagementId: string, reason: string): Promise<void> {
  const { tenantId, userId } = await requireRole("partner");
  const text = reason.trim();
  if (!text) throw new RetentionError("reason-required");

  const released = await withTenant(tenantId, async (tx) => {
    const result = await tx.query(
      `UPDATE legal_hold
          SET released_at = now(), released_by = $2, release_reason = $3
        WHERE engagement_id = $1 AND released_at IS NULL`,
      [engagementId, userId, text],
    );
    return result.rowCount ?? 0;
  });
  if (released === 0) throw new RetentionError("no-active-hold");

  await recordActivity({
    engagementId,
    entityType: "legal_hold",
    action: "legal_hold.released",
    summary: "Legal hold released — retention expiry resumes",
    meta: { reason: text },
  });
}

/** Refuse an operation that would destroy a held file. Belt to the trigger's braces. */
export async function assertNotHeld(engagementId: string): Promise<void> {
  if (await activeHold(engagementId)) throw new ForbiddenError("legal-hold");
}
