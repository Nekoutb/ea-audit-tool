// Unified activity log (audit trail). recordActivity() appends one row per
// meaningful action and is best-effort — it never throws into the caller, so a
// logging failure can't break the audit action it records. listActivity()
// powers the engagement activity timeline.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export interface ActivityInput {
  engagementId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  summary?: string | null;
  meta?: Record<string, unknown> | null;
}

export async function recordActivity(input: ActivityInput): Promise<void> {
  try {
    const { tenantId, userId } = await requireTenant();
    await withTenant(tenantId, async (tx) => {
      await tx.query(
        `INSERT INTO activity_log
           (tenant_id, engagement_id, user_id, entity_type, entity_id, action, summary, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          tenantId,
          input.engagementId ?? null,
          userId,
          input.entityType,
          input.entityId ?? null,
          input.action,
          input.summary ?? null,
          input.meta ? JSON.stringify(input.meta) : null,
        ],
      );
    });
  } catch {
    // Audit logging must never break the primary action it records.
  }
}

export interface ActivityRow {
  id: string;
  userName: string | null;
  entityType: string;
  action: string;
  summary: string | null;
  at: string;
}

export async function listActivity(engagementId: string, limit = 200): Promise<ActivityRow[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{
      id: string;
      user_name: string | null;
      entity_type: string;
      action: string;
      summary: string | null;
      at: string;
    }>(
      `SELECT a.id,
              (SELECT coalesce(name, email) FROM app_user WHERE id = a.user_id) AS user_name,
              a.entity_type, a.action, a.summary,
              to_char(a.created_at, 'YYYY-MM-DD HH24:MI') AS at
         FROM activity_log a
        WHERE a.engagement_id = $1
        ORDER BY a.created_at DESC
        LIMIT $2`,
      [engagementId, limit],
    );
    return r.rows.map((row) => ({
      id: row.id,
      userName: row.user_name,
      entityType: row.entity_type,
      action: row.action,
      summary: row.summary,
      at: row.at,
    }));
  });
}
