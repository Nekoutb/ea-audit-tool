// Time tracking: log actual hours, list a person's entries, and roll up
// budget-vs-actual by grade for an engagement. Tenant-scoped via withTenant.

import { recordActivity } from "@/lib/activity";
import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export class TimeError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "TimeError";
  }
}

export interface TimeEntryRow {
  id: string;
  date: string;
  hours: string;
  note: string | null;
  code: string | null;
}

export async function logTime(input: {
  engagementId: string;
  fileItemId?: string | null;
  date: string;
  hours: number;
  note?: string | null;
}): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!input.engagementId) throw new TimeError("invalid");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new TimeError("invalid-date");
  if (!(input.hours > 0) || input.hours > 24) throw new TimeError("invalid-hours");
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO time_entry (tenant_id, engagement_id, user_id, file_item_id, entry_date, hours, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, input.engagementId, userId, input.fileItemId || null, input.date, input.hours, input.note?.trim() || null],
    );
  });
  await recordActivity({
    engagementId: input.engagementId,
    entityType: "time_entry",
    action: "logged",
    summary: `Logged ${input.hours}h`,
  });
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    // A person can only remove their own entries.
    await tx.query("DELETE FROM time_entry WHERE id = $1 AND user_id = $2", [id, userId]);
  });
}

/** The current user's own time entries for an engagement, most recent first. */
export async function listMyTime(engagementId: string): Promise<TimeEntryRow[]> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ id: string; date: string; hours: string; note: string | null; code: string | null }>(
      `SELECT te.id, to_char(te.entry_date, 'YYYY-MM-DD') AS date, te.hours::text AS hours, te.note,
              (SELECT code FROM file_item WHERE id = te.file_item_id) AS code
         FROM time_entry te
        WHERE te.engagement_id = $1 AND te.user_id = $2
        ORDER BY te.entry_date DESC, te.created_at DESC
        LIMIT 200`,
      [engagementId, userId],
    );
    return r.rows;
  });
}

export interface BudgetActualRow {
  grade: string;
  budget: number;
  actual: number;
}

/**
 * Budget-vs-actual by grade: budgeted hours from budget_line, actual hours from
 * time_entry attributed to each logger's team grade on the engagement (people
 * with no team grade fall under "unassigned").
 */
export async function budgetVsActual(engagementId: string): Promise<BudgetActualRow[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ grade: string; budget: string; actual: string }>(
      `WITH b AS (
         SELECT grade, hours FROM budget_line WHERE engagement_id = $1
       ),
       a AS (
         SELECT coalesce(tm.team_role, 'unassigned') AS grade, sum(te.hours) AS hours
           FROM time_entry te
           LEFT JOIN team_member tm ON tm.engagement_id = te.engagement_id AND tm.user_id = te.user_id
          WHERE te.engagement_id = $1
          GROUP BY 1
       )
       SELECT coalesce(b.grade, a.grade) AS grade,
              coalesce(b.hours, 0)::text AS budget,
              coalesce(a.hours, 0)::text AS actual
         FROM b FULL OUTER JOIN a ON a.grade = b.grade
        ORDER BY 1`,
      [engagementId],
    );
    return r.rows.map((row) => ({ grade: row.grade, budget: Number(row.budget), actual: Number(row.actual) }));
  });
}
