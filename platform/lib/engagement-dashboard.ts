// Atlas engagement dashboard data: per-phase progress gauges, the "requires your
// attention" queue, and the most-recently-worked engagement (login landing).
// All reads are tenant-scoped through withTenant — RLS guarantees isolation.

import { withTenant } from "@/lib/db";
import {
  type EngagementPhase,
  type EngagementSummary,
} from "@/lib/engagements";
import { requireTenant } from "@/lib/tenant";

/** The four audit phases shown on the dashboard, in order. `archived` is terminal. */
export const PHASE_ORDER: EngagementPhase[] = ["acceptance", "planning", "execution", "conclusion"];

export type PhaseStatus = "complete" | "current" | "upcoming";

export interface PhaseProgress {
  phase: EngagementPhase;
  total: number;
  done: number;
  status: PhaseStatus;
}

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
                  CASE
                    WHEN fi.section = 'E' THEN 'execution'
                    WHEN fi.section IN ('A', 'B', 'C', 'F') THEN 'conclusion'
                    WHEN fi.code IN ('D3.1', 'D1', 'D4.1', 'D6.1', 'D7.1') THEN 'acceptance'
                    ELSE 'planning'
                  END AS bucket,
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
}

function toSummary(row: RecentRow): EngagementSummary {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    fiscalYear: row.fiscal_year,
    periodEnd: row.period_end,
    phase: row.phase,
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
              to_char(e.period_end, 'YYYY-MM-DD') AS period_end, e.phase
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
