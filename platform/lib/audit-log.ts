// F027 (firm decision 2026-10-27): the firm-wide audit log, and the per-field
// history of working-paper answers.
//
// The firm log reads activity_log across every engagement of the firm, plus the
// firm-level entries (no engagement). It is the firm administrator's ONLY:
// partners and managers see an engagement's trail on that engagement's own
// activity page, and only when they are on its team (lib/engagement-access.ts).
// It is a firm page, not an engagement page, so it is not limited to the files
// the administrator is staffed on — that is its whole purpose.
//
// The answer history is written by the form_response trigger of migration
// 20261027000002 (entity_type 'form_response', action 'answer_changed', meta
// {code, field}, before/after values); answerHistory() reads it back for the
// engagement activity page.

import { withTenant } from "@/lib/db";
import { requireEngagementAccess } from "@/lib/engagement-access";
import { ForbiddenError, requireTenant } from "@/lib/tenant";

export const AUDIT_LOG_PAGE_SIZE = 50;
/** The CSV export's ceiling: a year of a busy firm, not an unbounded dump. */
export const AUDIT_LOG_EXPORT_MAX = 50_000;

export interface AuditLogFilters {
  userId?: string | null;
  engagementId?: string | null;
  /** inclusive, YYYY-MM-DD (UTC) */
  from?: string | null;
  /** inclusive, YYYY-MM-DD (UTC) */
  to?: string | null;
  /** exact entity type, e.g. form_response, document, team_member */
  entityType?: string | null;
  /** exact action code, e.g. answer_changed, signed_off */
  action?: string | null;
}

export interface AuditLogRow {
  id: string;
  at: string;
  userId: string | null;
  userName: string | null;
  actingRole: string | null;
  engagementId: string | null;
  engagementName: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  summary: string | null;
  outcome: string;
  beforeValue: string | null;
  afterValue: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CODE = /^[a-z0-9_.:-]{1,80}$/i;

/** The firm log is the firm administrator's alone (F027). */
async function requireFirmAdmin() {
  const ctx = await requireTenant();
  if (ctx.role !== "firm_admin") throw new ForbiddenError("firm-admin-only");
  return ctx;
}

/** Normalise untrusted filter input: anything malformed is dropped, not trusted. */
export function cleanFilters(raw: Record<string, unknown>): AuditLogFilters {
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const userId = s(raw.userId);
  const engagementId = s(raw.engagementId);
  const from = s(raw.from);
  const to = s(raw.to);
  const entityType = s(raw.entityType);
  const action = s(raw.action);
  return {
    userId: UUID.test(userId) ? userId : null,
    engagementId: engagementId === "firm" || UUID.test(engagementId) ? engagementId : null,
    from: DAY.test(from) ? from : null,
    to: DAY.test(to) ? to : null,
    entityType: CODE.test(entityType) ? entityType : null,
    action: CODE.test(action) ? action : null,
  };
}

/** WHERE clause and parameters for the filters (the tenant is RLS-scoped). */
function where(filters: AuditLogFilters): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  const bind = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (filters.userId) parts.push(`a.user_id = ${bind(filters.userId)}::uuid`);
  // "firm" selects the firm-level entries, which belong to no engagement
  if (filters.engagementId === "firm") parts.push("a.engagement_id IS NULL");
  else if (filters.engagementId) parts.push(`a.engagement_id = ${bind(filters.engagementId)}::uuid`);
  if (filters.from) parts.push(`a.created_at >= ${bind(filters.from)}::date`);
  if (filters.to) parts.push(`a.created_at < (${bind(filters.to)}::date + 1)`);
  if (filters.entityType) parts.push(`a.entity_type = ${bind(filters.entityType)}`);
  if (filters.action) parts.push(`a.action = ${bind(filters.action)}`);
  return { sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params };
}

type RawRow = {
  id: string;
  at: string;
  user_id: string | null;
  user_name: string | null;
  acting_role: string | null;
  engagement_id: string | null;
  engagement_name: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  summary: string | null;
  outcome: string | null;
  before_value: string | null;
  after_value: string | null;
};

const SELECT = `
  SELECT a.id, a.user_id, a.engagement_id, a.entity_type, a.entity_id, a.action, a.summary,
         coalesce(a.outcome, 'success') AS outcome, a.acting_role,
         a.before_value::text AS before_value, a.after_value::text AS after_value,
         to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || ' UTC' AS at,
         (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = a.user_id) AS user_name,
         (SELECT coalesce(e.name, c.name) FROM engagement e JOIN client c ON c.id = e.client_id
           WHERE e.id = a.engagement_id) AS engagement_name
    FROM activity_log a`;

function toRow(r: RawRow): AuditLogRow {
  return {
    id: r.id,
    at: r.at,
    userId: r.user_id,
    userName: r.user_name,
    actingRole: r.acting_role,
    engagementId: r.engagement_id,
    engagementName: r.engagement_name,
    entityType: r.entity_type,
    entityId: r.entity_id,
    action: r.action,
    summary: r.summary,
    outcome: r.outcome ?? "success",
    beforeValue: r.before_value,
    afterValue: r.after_value,
  };
}

/** One page of the firm log, newest first, with the total for the pager. */
export async function listFirmActivity(
  filters: AuditLogFilters,
  page = 1,
): Promise<{ rows: AuditLogRow[]; total: number; page: number; pages: number }> {
  const { tenantId } = await requireFirmAdmin();
  const p = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  return withTenant(tenantId, async (tx) => {
    const w = where(filters);
    const count = await tx.query<{ n: string }>(`SELECT count(*)::text AS n FROM activity_log a ${w.sql}`, w.params);
    const total = Number(count.rows[0].n);
    const pages = Math.max(1, Math.ceil(total / AUDIT_LOG_PAGE_SIZE));
    const current = Math.min(p, pages);
    const params = [...w.params, AUDIT_LOG_PAGE_SIZE, (current - 1) * AUDIT_LOG_PAGE_SIZE];
    const r = await tx.query<RawRow>(
      `${SELECT} ${w.sql} ORDER BY a.created_at DESC, a.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { rows: r.rows.map(toRow), total, page: current, pages };
  });
}

/** Every matching row (up to the export ceiling), newest first, for the CSV. */
export async function firmActivityForExport(filters: AuditLogFilters): Promise<AuditLogRow[]> {
  const { tenantId } = await requireFirmAdmin();
  return withTenant(tenantId, async (tx) => {
    const w = where(filters);
    const r = await tx.query<RawRow>(
      `${SELECT} ${w.sql} ORDER BY a.created_at DESC, a.id DESC LIMIT ${AUDIT_LOG_EXPORT_MAX}`,
      w.params,
    );
    return r.rows.map(toRow);
  });
}

/** The choices the filter bar offers: the firm's users, engagements, entity types and actions. */
export async function firmActivityFacets(): Promise<{
  users: { id: string; name: string }[];
  engagements: { id: string; name: string }[];
  entityTypes: string[];
  actions: string[];
}> {
  const { tenantId } = await requireFirmAdmin();
  return withTenant(tenantId, async (tx) => {
    const [users, engagements, types, actions] = await Promise.all([
      tx.query<{ id: string; name: string }>(
        `SELECT u.id, coalesce(u.name, u.email) AS name
           FROM app_user u JOIN membership m ON m.user_id = u.id
          WHERE m.tenant_id = $1 ORDER BY name`,
        [tenantId],
      ),
      tx.query<{ id: string; name: string }>(
        `SELECT e.id, coalesce(e.name, c.name) || ' (' || e.fiscal_year || ')' AS name
           FROM engagement e JOIN client c ON c.id = e.client_id ORDER BY name`,
      ),
      tx.query<{ v: string }>("SELECT DISTINCT entity_type AS v FROM activity_log ORDER BY 1"),
      tx.query<{ v: string }>("SELECT DISTINCT action AS v FROM activity_log ORDER BY 1"),
    ]);
    return {
      users: users.rows,
      engagements: engagements.rows,
      entityTypes: types.rows.map((r) => r.v),
      actions: actions.rows.map((r) => r.v),
    };
  });
}

/** One quoted CSV cell; formula-leading text is defused for spreadsheet safety. */
export function csvCell(value: string | null): string {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function firmActivityCsv(rows: AuditLogRow[]): string {
  const header = ["at", "user", "role", "engagement", "engagement_id", "entity_type", "entity_id", "action", "summary", "outcome", "before", "after"];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [r.at, r.userName, r.actingRole, r.engagementName, r.engagementId, r.entityType, r.entityId, r.action, r.summary, r.outcome, r.beforeValue, r.afterValue]
        .map(csvCell)
        .join(","),
    ),
  ];
  // BOM so Excel opens the accented French text correctly
  return `﻿${lines.join("\r\n")}`;
}

/* ----------------------------- per-field answer history ----------------------------- */

export interface AnswerChange {
  at: string;
  userName: string | null;
  /** the stored value, as text (JSON strings unquoted) */
  before: string | null;
  after: string | null;
}

export interface AnswerHistory {
  code: string;
  field: string;
  changes: AnswerChange[];
}

/** A jsonb answer as display text: a string answer unquoted, anything else as JSON. */
export function answerText(json: string | null): string | null {
  if (json === null) return null;
  try {
    const v = JSON.parse(json) as unknown;
    if (v === null) return null;
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return json;
  }
}

/**
 * Every recorded change of every working-paper answer on the engagement,
 * grouped by paper and field, newest change first within a field and the most
 * recently changed field first. For the engagement's own team (the activity
 * page sits behind the engagement gate; checked again here).
 */
export async function answerHistory(engagementId: string, limit = 2000): Promise<AnswerHistory[]> {
  await requireEngagementAccess(engagementId);
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{
      code: string;
      field: string;
      at: string;
      user_name: string | null;
      before_value: string | null;
      after_value: string | null;
    }>(
      `SELECT a.meta->>'code' AS code, a.meta->>'field' AS field,
              to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || ' UTC' AS at,
              (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = a.user_id) AS user_name,
              a.before_value::text AS before_value, a.after_value::text AS after_value
         FROM activity_log a
        WHERE a.engagement_id = $1 AND a.entity_type = 'form_response' AND a.action = 'answer_changed'
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $2`,
      [engagementId, limit],
    );
    const byField = new Map<string, AnswerHistory>();
    for (const row of r.rows) {
      const key = `${row.code}\u0000${row.field}`;
      let entry = byField.get(key);
      if (!entry) {
        entry = { code: row.code, field: row.field, changes: [] };
        byField.set(key, entry);
      }
      entry.changes.push({
        at: row.at,
        userName: row.user_name,
        before: answerText(row.before_value),
        after: answerText(row.after_value),
      });
    }
    return [...byField.values()];
  });
}
