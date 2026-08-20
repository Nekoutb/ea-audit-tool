// Unified activity log (audit trail). recordActivity() appends one row per
// meaningful action and is best-effort — it never throws into the caller, so a
// logging failure can't break the audit action it records. listActivity()
// powers the engagement activity timeline.
//
// The table is append-only at the database level (migration
// 20260820000005_audit_trail_hardening.sql): ea_app holds only SELECT and
// INSERT, and a trigger refuses UPDATE/DELETE/TRUNCATE outright. Nothing in
// this module may attempt to amend a row — write a compensating entry instead.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

/** Did the attempt succeed, get refused, or fail? */
export type ActivityOutcome = "success" | "denied" | "failed";

export interface ActivityInput {
  engagementId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  summary?: string | null;
  meta?: Record<string, unknown> | null;
  /** state before the change, for actions that mutate a value */
  before?: unknown;
  /** state after the change */
  after?: unknown;
  /** defaults to "success"; log refusals too — they are what a reviewer looks for */
  outcome?: ActivityOutcome;
}

export async function recordActivity(input: ActivityInput): Promise<void> {
  try {
    // The acting user's role is captured HERE, at the moment of the action:
    // app_user.role can change later, so resolving it at read time would
    // misstate the history.
    const { tenantId, userId, role } = await requireTenant();
    await withTenant(tenantId, async (tx) => {
      await tx.query(
        `INSERT INTO activity_log
           (tenant_id, engagement_id, user_id, acting_role, entity_type, entity_id,
            action, summary, meta, before_value, after_value, outcome)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          tenantId,
          input.engagementId ?? null,
          userId,
          role ?? null,
          input.entityType,
          input.entityId ?? null,
          input.action,
          input.summary ?? null,
          input.meta ? JSON.stringify(input.meta) : null,
          input.before === undefined ? null : JSON.stringify(input.before),
          input.after === undefined ? null : JSON.stringify(input.after),
          input.outcome ?? "success",
        ],
      );
    });
  } catch {
    // Audit logging must never break the primary action it records.
  }
}

/* ------------------------------------------------------------------ *
 * Typed helpers for the events the assurance audit found missing.
 *
 * Each one is a single call the owning module makes at the point where
 * the action has actually succeeded (after COMMIT, never inside the
 * transaction that performs it — an audit entry must not be rolled back
 * with the work it describes, and recordActivity opens its own).
 *
 * `action` is a stable machine-readable code; `summary` is the human line
 * shown in the engagement timeline.
 * ------------------------------------------------------------------ */

/** Engagement archived and locked (ISA 230 ¶14–16). */
export function logArchive(engagementId: string, meta?: Record<string, unknown>): Promise<void> {
  return recordActivity({
    engagementId,
    entityType: "engagement",
    entityId: engagementId,
    action: "archived",
    summary: "Audit file archived and locked",
    before: { archived: false },
    after: { archived: true },
    meta: meta ?? null,
  });
}

/** Report issued — the engagement is finalised (opinion + report date fixed). */
export function logEngagementFinalised(
  engagementId: string,
  opinion: string,
  reportDate: string,
): Promise<void> {
  return recordActivity({
    engagementId,
    entityType: "engagement",
    entityId: engagementId,
    action: "report_issued",
    summary: `Report issued (${opinion}) dated ${reportDate}`,
    after: { opinion, reportDate },
  });
}

/** A paper was signed off. */
export function logSignOff(
  documentId: string,
  role: string,
  info: { engagementId?: string | null; title?: string | null; versionNo?: number | null } = {},
): Promise<void> {
  return recordActivity({
    engagementId: info.engagementId ?? null,
    entityType: "document",
    entityId: documentId,
    action: "signed_off",
    summary: `${role} sign-off${info.title ? ` on ${info.title}` : ""}${
      info.versionNo ? ` (v${info.versionNo})` : ""
    }`,
    after: { role, versionNo: info.versionNo ?? null },
  });
}

/** Sign-offs voided by a reopen — records the reason and whose sign-offs fell. */
export function logSignOffVoided(
  documentId: string,
  reason: string,
  info: { engagementId?: string | null; title?: string | null; voidedUserIds?: string[] } = {},
): Promise<void> {
  return recordActivity({
    engagementId: info.engagementId ?? null,
    entityType: "document",
    entityId: documentId,
    action: "signoff_voided",
    summary: `Sign-offs voided${info.title ? ` on ${info.title}` : ""}: ${reason}`,
    before: { status: "signed" },
    after: { status: "draft", voidedUserIds: info.voidedUserIds ?? [] },
    meta: { reason },
  });
}

/** A signed paper was reopened for further work. */
export function logReopen(
  documentId: string,
  reason: string,
  info: { engagementId?: string | null; title?: string | null } = {},
): Promise<void> {
  return recordActivity({
    engagementId: info.engagementId ?? null,
    entityType: "document",
    entityId: documentId,
    action: "reopened",
    summary: `Reopened${info.title ? ` ${info.title}` : ""}: ${reason}`,
    before: { status: "signed" },
    after: { status: "draft" },
    meta: { reason },
  });
}

/** An old document version was restored forward as a new version. */
export function logVersionRestored(
  documentId: string,
  fromVersion: number,
  toVersion: number,
  info: { engagementId?: string | null; title?: string | null } = {},
): Promise<void> {
  return recordActivity({
    engagementId: info.engagementId ?? null,
    entityType: "document",
    entityId: documentId,
    action: "version_restored",
    summary: `Restored v${fromVersion} as v${toVersion}${info.title ? ` on ${info.title}` : ""}`,
    before: { versionNo: fromVersion },
    after: { versionNo: toVersion },
  });
}

export type AttachmentEvent = "uploaded" | "deleted" | "restored" | "renamed";

/** Evidence attached to, removed from, or restored on a task. */
export function logAttachment(
  event: AttachmentEvent,
  attachmentId: string,
  info: {
    engagementId?: string | null;
    fileItemId?: string | null;
    name: string;
    version?: number | null;
    sizeBytes?: number | null;
    previousName?: string | null;
  },
): Promise<void> {
  const versionSuffix = info.version ? ` (v${info.version})` : "";
  const summary =
    event === "renamed"
      ? `Attachment renamed ${info.previousName ?? "?"} → ${info.name}`
      : `Attachment ${event}: ${info.name}${versionSuffix}`;
  return recordActivity({
    engagementId: info.engagementId ?? null,
    entityType: "attachment",
    entityId: attachmentId,
    action: `attachment_${event}`,
    summary,
    before: event === "deleted" || event === "renamed" ? { name: info.previousName ?? info.name } : undefined,
    after:
      event === "deleted"
        ? undefined
        : { name: info.name, version: info.version ?? null, sizeBytes: info.sizeBytes ?? null },
    meta: { fileItemId: info.fileItemId ?? null },
  });
}

/**
 * Materiality changed. `before`/`after` carry the actual figures so a reviewer
 * can see what moved without diffing versions by hand.
 */
export function logMaterialityChange(
  engagementId: string,
  event: "revised" | "approved",
  versionNo: number,
  values: { before?: unknown; after?: unknown } = {},
): Promise<void> {
  return recordActivity({
    engagementId,
    entityType: "materiality",
    entityId: null,
    action: `materiality_${event}`,
    summary: `Materiality v${versionNo} ${event}`,
    before: values.before,
    after: values.after,
    meta: { versionNo },
  });
}

/** A misstatement was raised, amended, or flagged corrected/uncorrected. */
export function logMisstatementChange(
  engagementId: string,
  misstatementId: string,
  event: "raised" | "updated" | "corrected" | "uncorrected",
  values: { before?: unknown; after?: unknown; summary?: string } = {},
): Promise<void> {
  return recordActivity({
    engagementId,
    entityType: "misstatement",
    entityId: misstatementId,
    action: `misstatement_${event}`,
    summary: values.summary ?? `Misstatement ${event}`,
    before: values.before,
    after: values.after,
  });
}

/**
 * Audit data left the system. Exports are the classic un-logged exfiltration
 * path, so they are recorded even though nothing changed.
 */
export function logExport(
  engagementId: string,
  kind: string,
  info: { filename?: string | null; rowCount?: number | null } = {},
): Promise<void> {
  return recordActivity({
    engagementId,
    entityType: "export",
    entityId: null,
    action: "exported",
    summary: `Exported ${kind}${info.filename ? ` (${info.filename})` : ""}`,
    after: { kind, filename: info.filename ?? null, rowCount: info.rowCount ?? null },
  });
}

/** A refused attempt at a privileged action. Recorded with outcome "denied". */
export function logDenied(
  action: string,
  entityType: string,
  info: { engagementId?: string | null; entityId?: string | null; reason?: string } = {},
): Promise<void> {
  return recordActivity({
    engagementId: info.engagementId ?? null,
    entityType,
    entityId: info.entityId ?? null,
    action,
    summary: `Refused: ${action}${info.reason ? ` (${info.reason})` : ""}`,
    outcome: "denied",
    meta: info.reason ? { reason: info.reason } : null,
  });
}

export interface ActivityRow {
  id: string;
  userName: string | null;
  /** the acting user's role at the time of the action */
  actingRole: string | null;
  entityType: string;
  action: string;
  summary: string | null;
  outcome: ActivityOutcome;
  at: string;
}

export async function listActivity(engagementId: string, limit = 200): Promise<ActivityRow[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{
      id: string;
      user_name: string | null;
      acting_role: string | null;
      entity_type: string;
      action: string;
      summary: string | null;
      outcome: ActivityOutcome;
      at: string;
    }>(
      `SELECT a.id,
              (SELECT coalesce(name, email) FROM app_user WHERE id = a.user_id) AS user_name,
              a.acting_role, a.entity_type, a.action, a.summary, a.outcome,
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
      actingRole: row.acting_role,
      entityType: row.entity_type,
      action: row.action,
      summary: row.summary,
      outcome: row.outcome ?? "success",
      at: row.at,
    }));
  });
}
