// Atlas engagement dashboard data: per-phase progress gauges, the "requires your
// attention" queue, and the most-recently-worked engagement (login landing).
// All reads are tenant-scoped through withTenant — RLS guarantees isolation.

import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import {
  type EngagementPhase,
  type EngagementSummary,
} from "@/lib/engagements";
import { fileItemHasAssignee } from "@/lib/team";
import { requireTenant } from "@/lib/tenant";

/**
 * Schema-tolerant due-date read (expand/contract deploy): the app ships before
 * the file_item.due_date migration runs; until the column exists every task
 * simply reports no custom due date. Checked once per process.
 */
let dueDateColumnKnown: boolean | null = null;
async function dueDateExpr(tx: PoolClient): Promise<string> {
  if (dueDateColumnKnown === null) {
    const r = await tx.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'file_item' AND column_name = 'due_date'",
    );
    dueDateColumnKnown = (r.rowCount ?? 0) > 0;
  }
  return dueDateColumnKnown ? "to_char(fi.due_date, 'YYYY-MM-DD')" : "NULL::text";
}

/** Schema-tolerant assignee columns (same expand/contract story as due_date). */
async function assigneeExprs(tx: PoolClient): Promise<{ id: string; name: string }> {
  return (await fileItemHasAssignee(tx))
    ? {
        id: "fi.assignee_user_id",
        name: "(SELECT coalesce(name, email) FROM app_user WHERE id = fi.assignee_user_id)",
      }
    : { id: "NULL::uuid", name: "NULL::text" };
}

/** The four dashboard phases (all engagement phases except terminal `archived`). */
export type DashboardPhase = Exclude<EngagementPhase, "archived">;

/** The four audit phases shown on the dashboard, in order. `archived` is terminal. */
export const PHASE_ORDER: DashboardPhase[] = ["acceptance", "planning", "execution", "conclusion"];

/** URL slugs for the phase drill-down screens (acceptance is branded Pre-Planning). */
export const PHASE_SLUGS: Record<string, DashboardPhase> = {
  "pre-planning": "acceptance",
  planning: "planning",
  execution: "execution",
  conclusion: "conclusion",
};

export const PHASE_SLUG_OF: Record<DashboardPhase, string> = {
  acceptance: "pre-planning",
  planning: "planning",
  execution: "execution",
  conclusion: "conclusion",
};

export type PhaseStatus = "complete" | "current" | "upcoming";

export interface PhaseProgress {
  phase: DashboardPhase;
  total: number;
  done: number;
  status: PhaseStatus;
}

/** TS mirror of BUCKET_CASE for a single item (keep the two in sync). */
export function phaseOfTask(section: string, code: string): DashboardPhase {
  if (section === "E") return "execution";
  if (section === "A" || section === "B" || section === "C" || section === "F") return "conclusion";
  if (["D3.1", "D1", "D4.1", "D6.1", "D7.1"].includes(code)) return "acceptance";
  return "planning";
}

/** SQL bucket mapping file-index items to the four dashboard phases. */
const BUCKET_CASE = `CASE
  WHEN fi.section = 'E' THEN 'execution'
  WHEN fi.section IN ('A', 'B', 'C', 'F') THEN 'conclusion'
  WHEN fi.code IN ('D3.1', 'D1', 'D4.1', 'D6.1', 'D7.1') THEN 'acceptance'
  ELSE 'planning'
END`;

/**
 * Per-phase task progress. Tasks are the engagement's (active) file-index items,
 * bucketed into the four phases: section D setup items → acceptance, the rest of
 * D → planning, section E → execution, sections A/B/C/F → conclusion. Phases the
 * engagement has already passed read as fully done, the current phase shows live
 * completion (file items with a signed working paper), and future phases are zero
 * — the honest "closed / active / not started" model.
 */
export async function engagementPhaseProgress(
  engagementId: string,
  phase: EngagementPhase,
): Promise<PhaseProgress[]> {
  const { tenantId } = await requireTenant();
  const rows = await withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ bucket: string; total: string; done_signed: string }>(
      `SELECT bucket,
              count(*)::text AS total,
              count(*) FILTER (WHERE signed)::text AS done_signed
         FROM (
           SELECT fi.id,
                  ${BUCKET_CASE} AS bucket,
                  EXISTS (
                    SELECT 1 FROM document d
                     WHERE d.file_item_id = fi.id AND d.status = 'signed'
                  ) AS signed
             FROM file_item fi
            WHERE fi.engagement_id = $1 AND fi.conditional = false
         ) s
        GROUP BY bucket`,
      [engagementId],
    );
    return result.rows;
  });

  const totals = new Map<string, { total: number; signed: number }>();
  for (const row of rows) {
    totals.set(row.bucket, { total: Number(row.total), signed: Number(row.done_signed) });
  }

  const currentIdx = phase === "archived" ? PHASE_ORDER.length : PHASE_ORDER.indexOf(phase);
  return PHASE_ORDER.map((p, i) => {
    const bucket = totals.get(p) ?? { total: 0, signed: 0 };
    const status: PhaseStatus = i < currentIdx ? "complete" : i === currentIdx ? "current" : "upcoming";
    const done = status === "complete" ? bucket.total : status === "current" ? bucket.signed : 0;
    return { phase: p, total: bucket.total, done, status };
  });
}

/** Row status across the preparer → reviewer lifecycle. */
export type PhaseTaskStatus = "reviewed" | "in_review" | "in_progress" | "not_started";

export interface PhaseTask {
  id: string;
  code: string;
  section: string;
  titleEn: string;
  titleFr: string;
  documentId: string | null;
  /** Editable per-task due date (YYYY-MM-DD) or null → phase-derived. */
  dueDate: string | null;
  /** Assigned preparer (file_item.owner_id), name or null. */
  ownerName: string | null;
  /** Direct task assignee (file_item.assignee_user_id), or null. */
  assigneeUserId: string | null;
  assigneeName: string | null;
  /** Preparer sign-off, if signed. */
  preparerName: string | null;
  preparerAt: string | null;
  /** Reviewer / partner sign-off, if signed. */
  reviewerName: string | null;
  reviewerAt: string | null;
  status: PhaseTaskStatus;
}

/** Three-letter initials, e.g. "Nekout Boma" → NBO, "Josiane" → JOS. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + words[words.length - 1].slice(0, 2)).toUpperCase();
}

/**
 * The exhaustive, sequentially-ordered task list for one dashboard phase, with
 * the real preparer (owner + preparer sign-off) and reviewer (partner sign-off)
 * state for the sign-off columns. Same bucket mapping as the gauges.
 */
export async function phaseTasks(engagementId: string, phase: DashboardPhase): Promise<PhaseTask[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const dueDate = await dueDateExpr(tx);
    const assignee = await assigneeExprs(tx);
    const result = await tx.query<{
      id: string;
      code: string;
      section: string;
      title_en: string;
      title_fr: string;
      document_id: string | null;
      due_date: string | null;
      owner_name: string | null;
      assignee_user_id: string | null;
      assignee_name: string | null;
      preparer_name: string | null;
      preparer_at: string | null;
      reviewer_name: string | null;
      reviewer_at: string | null;
    }>(
      `SELECT fi.id, fi.code, fi.section, fi.title_en, fi.title_fr,
              d.id AS document_id,
              ${dueDate} AS due_date,
              (SELECT coalesce(name, email) FROM app_user WHERE id = fi.owner_id) AS owner_name,
              ${assignee.id} AS assignee_user_id,
              ${assignee.name} AS assignee_name,
              ps.signer AS preparer_name, to_char(ps.signed_at, 'DD Mon YYYY') AS preparer_at,
              rs.signer AS reviewer_name, to_char(rs.signed_at, 'DD Mon YYYY') AS reviewer_at
         FROM file_item fi
         LEFT JOIN LATERAL (
           SELECT id FROM document
            WHERE file_item_id = fi.id AND kind = 'workpaper'
            ORDER BY created_at LIMIT 1
         ) d ON true
         LEFT JOIN LATERAL (
           SELECT coalesce(u.name, u.email) AS signer, s.signed_at
             FROM signoff s JOIN app_user u ON u.id = s.user_id
            WHERE s.document_id = d.id AND s.role = 'preparer' AND s.voided_at IS NULL
            ORDER BY s.signed_at LIMIT 1
         ) ps ON true
         LEFT JOIN LATERAL (
           SELECT coalesce(u.name, u.email) AS signer, s.signed_at
             FROM signoff s JOIN app_user u ON u.id = s.user_id
            WHERE s.document_id = d.id AND s.role IN ('reviewer', 'partner') AND s.voided_at IS NULL
            ORDER BY s.signed_at LIMIT 1
         ) rs ON true
        WHERE fi.engagement_id = $1 AND fi.conditional = false
          AND ${BUCKET_CASE} = $2
        ORDER BY fi.sort_order`,
      [engagementId, phase],
    );
    return result.rows.map((row) => {
      const status: PhaseTaskStatus = row.reviewer_name
        ? "reviewed"
        : row.preparer_name
          ? "in_review"
          : row.document_id
            ? "in_progress"
            : "not_started";
      return {
        id: row.id,
        code: row.code,
        section: row.section,
        titleEn: row.title_en,
        titleFr: row.title_fr,
        documentId: row.document_id,
        dueDate: row.due_date,
        ownerName: row.owner_name,
        assigneeUserId: row.assignee_user_id,
        assigneeName: row.assignee_name,
        preparerName: row.preparer_name,
        preparerAt: row.preparer_at,
        reviewerName: row.reviewer_name,
        reviewerAt: row.reviewer_at,
        status,
      };
    });
  });
}

/** The engagement's default reviewer = its partner team member, if any. */
export async function engagementReviewer(engagementId: string): Promise<string | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ name: string }>(
      `SELECT coalesce(u.name, u.email) AS name
         FROM team_member tm JOIN app_user u ON u.id = tm.user_id
        WHERE tm.engagement_id = $1 AND tm.team_role = 'partner'
        ORDER BY tm.created_at LIMIT 1`,
      [engagementId],
    );
    return r.rows[0]?.name ?? null;
  });
}

/**
 * Target completion date for a phase, derived from the engagement period end
 * (no per-task deadline field yet): pre-planning and planning fall before
 * year-end, execution and conclusion after it. Returns YYYY-MM-DD.
 */
export function phaseDeadline(periodEnd: string, phase: DashboardPhase): string {
  const offsets: Record<DashboardPhase, number> = {
    acceptance: -90,
    planning: -45,
    execution: 90,
    conclusion: 150,
  };
  const base = new Date(periodEnd + "T00:00:00Z");
  base.setUTCDate(base.getUTCDate() + offsets[phase]);
  return base.toISOString().slice(0, 10);
}

export type AttentionTone = "rose" | "warn" | "accent";

export interface AttentionItem {
  code: string;
  title: string;
  meta: string;
  tone: AttentionTone;
  ageDays: number;
}

/**
 * The "requires your attention" queue: open findings (routed B4/C1), uncorrected
 * misstatements (B5), unconcluded significant risks, unsigned working papers and
 * outstanding PBC items — most recent first.
 */
export async function engagementAttention(
  engagementId: string,
  locale: "en" | "fr",
): Promise<AttentionItem[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const findings = await tx.query<{ route: string; title: string; code: string | null; age: number }>(
      `SELECT f.route, f.title,
              (SELECT code FROM file_item WHERE id = f.file_item_id) AS code,
              (CURRENT_DATE - f.created_at::date) AS age
         FROM finding f
        WHERE f.engagement_id = $1 AND f.status = 'open'
        ORDER BY f.created_at DESC LIMIT 6`,
      [engagementId],
    );
    const misstatements = await tx.query<{ description: string; amount: string; age: number }>(
      `SELECT description, amount::text, (CURRENT_DATE - created_at::date) AS age
         FROM misstatement
        WHERE engagement_id = $1 AND trivial = false AND corrected = false
        ORDER BY abs(amount) DESC LIMIT 4`,
      [engagementId],
    );
    const risks = await tx.query<{ description: string; age: number }>(
      `SELECT description, (CURRENT_DATE - created_at::date) AS age
         FROM risk
        WHERE engagement_id = $1 AND significant AND rebutted = false AND status <> 'concluded'
        ORDER BY created_at DESC LIMIT 3`,
      [engagementId],
    );
    const docs = await tx.query<{ code: string; title_en: string; title_fr: string; age: number }>(
      `SELECT fi.code, fi.title_en, fi.title_fr, (CURRENT_DATE - d.created_at::date) AS age
         FROM document d
         JOIN file_item fi ON fi.id = d.file_item_id
        WHERE d.engagement_id = $1 AND d.status = 'draft' AND d.kind = 'workpaper'
        ORDER BY d.created_at DESC LIMIT 4`,
      [engagementId],
    );
    const pbc = await tx.query<{ title: string; age: number }>(
      `SELECT title, (CURRENT_DATE - created_at::date) AS age
         FROM pbc_item
        WHERE engagement_id = $1 AND status <> 'accepted'
        ORDER BY created_at DESC LIMIT 3`,
      [engagementId],
    );

    const items: AttentionItem[] = [];
    for (const f of findings.rows) {
      items.push({
        code: f.route.toUpperCase(),
        title: f.title,
        meta: f.code ? `Finding · ${f.code}` : "Finding",
        tone: f.route === "b4" ? "rose" : "warn",
        ageDays: Number(f.age),
      });
    }
    for (const m of misstatements.rows) {
      items.push({
        code: "B5",
        title: m.description,
        meta: `Uncorrected · XAF ${Number(m.amount).toLocaleString("fr-FR")}`,
        tone: "warn",
        ageDays: Number(m.age),
      });
    }
    for (const r of risks.rows) {
      items.push({ code: "D7.2", title: r.description, meta: "Significant risk", tone: "rose", ageDays: Number(r.age) });
    }
    for (const d of docs.rows) {
      items.push({
        code: d.code,
        title: locale === "fr" ? d.title_fr : d.title_en,
        meta: "Working paper awaiting sign-off",
        tone: "accent",
        ageDays: Number(d.age),
      });
    }
    for (const p of pbc.rows) {
      items.push({ code: "PBC", title: p.title, meta: "Outstanding from client", tone: "warn", ageDays: Number(p.age) });
    }
    return items.sort((a, b) => a.ageDays - b.ageDays).slice(0, 8);
  });
}

interface RecentRow {
  id: string;
  client_id: string;
  client_name: string;
  fiscal_year: number;
  period_end: string;
  phase: EngagementPhase;
  name: string | null;
  complexity: EngagementSummary["complexity"];
}

function toSummary(row: RecentRow): EngagementSummary {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    fiscalYear: row.fiscal_year,
    periodEnd: row.period_end,
    phase: row.phase,
    name: row.name,
    complexity: row.complexity,
  };
}

const RECENT_ORDER = `greatest(
  e.updated_at,
  coalesce((SELECT max(ps.completed_at) FROM program_step ps WHERE ps.engagement_id = e.id), to_timestamp(0))
) DESC, e.created_at DESC`;

/** Recent non-archived engagements, most-recently-worked first (for the selector). */
export async function recentEngagements(limit = 6): Promise<EngagementSummary[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<RecentRow>(
      `SELECT e.id, e.client_id, c.name AS client_name, e.fiscal_year,
              to_char(e.period_end, 'YYYY-MM-DD') AS period_end, e.phase, e.name, e.complexity
         FROM engagement e
         JOIN client c ON c.id = e.client_id
        WHERE e.phase <> 'archived'
        ORDER BY ${RECENT_ORDER}
        LIMIT $1`,
      [limit],
    );
    return result.rows.map(toSummary);
  });
}

/** The engagement the user most recently worked on — the post-login landing target. */
export async function mostRecentEngagement(): Promise<EngagementSummary | null> {
  const [first] = await recentEngagements(1);
  return first ?? null;
}

/**
 * Every active task of the engagement in one query — the ST/E/C dashboard and
 * the group pages roll these up client-side via lib/task-groups (the grouping
 * is a presentation concern; internal codes stay the storage keys).
 */
export async function engagementTasks(engagementId: string): Promise<PhaseTask[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const dueDate = await dueDateExpr(tx);
    const assignee = await assigneeExprs(tx);
    const result = await tx.query<{
      id: string;
      code: string;
      section: string;
      title_en: string;
      title_fr: string;
      document_id: string | null;
      due_date: string | null;
      owner_name: string | null;
      assignee_user_id: string | null;
      assignee_name: string | null;
      preparer_name: string | null;
      preparer_at: string | null;
      reviewer_name: string | null;
      reviewer_at: string | null;
    }>(
      `SELECT fi.id, fi.code, fi.section, fi.title_en, fi.title_fr,
              d.id AS document_id,
              ${dueDate} AS due_date,
              (SELECT coalesce(name, email) FROM app_user WHERE id = fi.owner_id) AS owner_name,
              ${assignee.id} AS assignee_user_id,
              ${assignee.name} AS assignee_name,
              ps.signer AS preparer_name, to_char(ps.signed_at, 'DD Mon YYYY') AS preparer_at,
              rs.signer AS reviewer_name, to_char(rs.signed_at, 'DD Mon YYYY') AS reviewer_at
         FROM file_item fi
         LEFT JOIN LATERAL (
           SELECT id FROM document
            WHERE file_item_id = fi.id AND kind = 'workpaper'
            ORDER BY created_at LIMIT 1
         ) d ON true
         LEFT JOIN LATERAL (
           SELECT coalesce(u.name, u.email) AS signer, s.signed_at
             FROM signoff s JOIN app_user u ON u.id = s.user_id
            WHERE s.document_id = d.id AND s.role = 'preparer' AND s.voided_at IS NULL
            ORDER BY s.signed_at LIMIT 1
         ) ps ON true
         LEFT JOIN LATERAL (
           SELECT coalesce(u.name, u.email) AS signer, s.signed_at
             FROM signoff s JOIN app_user u ON u.id = s.user_id
            WHERE s.document_id = d.id AND s.role IN ('reviewer', 'partner') AND s.voided_at IS NULL
            ORDER BY s.signed_at LIMIT 1
         ) rs ON true
        WHERE fi.engagement_id = $1 AND fi.conditional = false
        ORDER BY fi.sort_order`,
      [engagementId],
    );
    return result.rows.map((row) => {
      const status: PhaseTaskStatus = row.reviewer_name
        ? "reviewed"
        : row.preparer_name
          ? "in_review"
          : row.document_id
            ? "in_progress"
            : "not_started";
      return {
        id: row.id,
        code: row.code,
        section: row.section,
        titleEn: row.title_en,
        titleFr: row.title_fr,
        documentId: row.document_id,
        dueDate: row.due_date,
        ownerName: row.owner_name,
        assigneeUserId: row.assignee_user_id,
        assigneeName: row.assignee_name,
        preparerName: row.preparer_name,
        preparerAt: row.preparer_at,
        reviewerName: row.reviewer_name,
        reviewerAt: row.reviewer_at,
        status,
      };
    });
  });
}

/** Summary-tile counts for the dashboard, per engagement or across the firm. */
export interface DashboardStats {
  myTasks: number;
  forMyReview: number;
  toDo: number;
  notesForMe: number;
  notesByMe: number;
}

async function statsScoped(engagementId: string | null): Promise<DashboardStats> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{
      my_tasks: string;
      for_my_review: string;
      to_do: string;
      notes_for_me: string;
      notes_by_me: string;
    }>(
      `SELECT
         (SELECT count(*) FROM file_item fi
           WHERE ($1::uuid IS NULL OR fi.engagement_id = $1) AND fi.conditional = false
             AND fi.owner_id = $2
             AND NOT EXISTS (
               SELECT 1 FROM document d JOIN signoff s ON s.document_id = d.id
                WHERE d.file_item_id = fi.id AND s.role IN ('reviewer','partner') AND s.voided_at IS NULL
             ))::text AS my_tasks,
         (SELECT count(*) FROM file_item fi
           WHERE ($1::uuid IS NULL OR fi.engagement_id = $1) AND fi.conditional = false
             AND EXISTS (
               SELECT 1 FROM document d JOIN signoff s ON s.document_id = d.id
                WHERE d.file_item_id = fi.id AND s.role = 'preparer' AND s.voided_at IS NULL
             )
             AND NOT EXISTS (
               SELECT 1 FROM document d JOIN signoff s ON s.document_id = d.id
                WHERE d.file_item_id = fi.id AND s.role IN ('reviewer','partner') AND s.voided_at IS NULL
             ))::text AS for_my_review,
         (SELECT count(*) FROM file_item fi
           WHERE ($1::uuid IS NULL OR fi.engagement_id = $1) AND fi.conditional = false
             AND fi.owner_id = $2
             AND NOT EXISTS (SELECT 1 FROM document d WHERE d.file_item_id = fi.id))::text AS to_do,
         (SELECT count(*) FROM review_note n
           JOIN document d ON d.id = n.document_id
           JOIN file_item fi ON fi.id = d.file_item_id
          WHERE ($1::uuid IS NULL OR fi.engagement_id = $1)
            AND n.status = 'open' AND fi.owner_id = $2)::text AS notes_for_me,
         (SELECT count(*) FROM review_note n
           JOIN document d ON d.id = n.document_id
           JOIN file_item fi ON fi.id = d.file_item_id
          WHERE ($1::uuid IS NULL OR fi.engagement_id = $1)
            AND n.status = 'open' AND n.author_id = $2)::text AS notes_by_me`,
      [engagementId, userId],
    );
    const row = r.rows[0];
    return {
      myTasks: Number(row.my_tasks),
      forMyReview: Number(row.for_my_review),
      toDo: Number(row.to_do),
      notesForMe: Number(row.notes_for_me),
      notesByMe: Number(row.notes_by_me),
    };
  });
}

/** Tile counts for the "My engagement / All engagements" summary toggle. */
export async function dashboardStats(
  engagementId: string,
): Promise<{ my: DashboardStats; all: DashboardStats }> {
  const [my, all] = await Promise.all([statsScoped(engagementId), statsScoped(null)]);
  return { my, all };
}

/**
 * One task by engagement + internal code — regardless of the conditional flag
 * (conditional items D4.7–D4.9 still have task pages and sign-offs even though
 * they are excluded from roll-ups until instantiated as applicable).
 */
export async function taskForItem(engagementId: string, code: string): Promise<PhaseTask | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const dueDate = await dueDateExpr(tx);
    const assignee = await assigneeExprs(tx);
    const result = await tx.query<{
      id: string;
      code: string;
      section: string;
      title_en: string;
      title_fr: string;
      document_id: string | null;
      due_date: string | null;
      owner_name: string | null;
      assignee_user_id: string | null;
      assignee_name: string | null;
      preparer_name: string | null;
      preparer_at: string | null;
      reviewer_name: string | null;
      reviewer_at: string | null;
    }>(
      `SELECT fi.id, fi.code, fi.section, fi.title_en, fi.title_fr,
              d.id AS document_id,
              ${dueDate} AS due_date,
              (SELECT coalesce(name, email) FROM app_user WHERE id = fi.owner_id) AS owner_name,
              ${assignee.id} AS assignee_user_id,
              ${assignee.name} AS assignee_name,
              ps.signer AS preparer_name, to_char(ps.signed_at, 'DD Mon YYYY') AS preparer_at,
              rs.signer AS reviewer_name, to_char(rs.signed_at, 'DD Mon YYYY') AS reviewer_at
         FROM file_item fi
         LEFT JOIN LATERAL (
           SELECT id FROM document
            WHERE file_item_id = fi.id AND kind = 'workpaper'
            ORDER BY created_at LIMIT 1
         ) d ON true
         LEFT JOIN LATERAL (
           SELECT coalesce(u.name, u.email) AS signer, s.signed_at
             FROM signoff s JOIN app_user u ON u.id = s.user_id
            WHERE s.document_id = d.id AND s.role = 'preparer' AND s.voided_at IS NULL
            ORDER BY s.signed_at LIMIT 1
         ) ps ON true
         LEFT JOIN LATERAL (
           SELECT coalesce(u.name, u.email) AS signer, s.signed_at
             FROM signoff s JOIN app_user u ON u.id = s.user_id
            WHERE s.document_id = d.id AND s.role IN ('reviewer', 'partner') AND s.voided_at IS NULL
            ORDER BY s.signed_at LIMIT 1
         ) rs ON true
        WHERE fi.engagement_id = $1 AND fi.code = $2
        LIMIT 1`,
      [engagementId, code],
    );
    const row = result.rows[0];
    if (!row) return null;
    const status: PhaseTaskStatus = row.reviewer_name
      ? "reviewed"
      : row.preparer_name
        ? "in_review"
        : row.document_id
          ? "in_progress"
          : "not_started";
    return {
      id: row.id,
      code: row.code,
      section: row.section,
      titleEn: row.title_en,
      titleFr: row.title_fr,
      documentId: row.document_id,
      dueDate: row.due_date,
      ownerName: row.owner_name,
      assigneeUserId: row.assignee_user_id,
      assigneeName: row.assignee_name,
      preparerName: row.preparer_name,
      preparerAt: row.preparer_at,
      reviewerName: row.reviewer_name,
      reviewerAt: row.reviewer_at,
      status,
    };
  });
}
