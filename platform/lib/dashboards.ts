// Phase 9 (9.3-9.5): engagement + firm dashboards and portfolio risk views.
// Single-query aggregates — no state, everything derived live.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export interface EngagementDashboard {
  phase: string;
  steps: { total: number; complete: number; na: number };
  risks: { identified: number; concluded: number; significant: number };
  b5: { uncorrected: number; materiality: number | null };
  documentsUnsigned: number;
  pbcOpen: number;
  misstatementCount: number;
  deficiencyCount: number;
  nextDeadlines: { key: string; dueDate: string; daysLeft: number }[];
}

export async function engagementDashboard(engagementId: string): Promise<EngagementDashboard> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const summary = await tx.query<{
      phase: string;
      steps_total: string; steps_complete: string; steps_na: string;
      risks_open: string; risks_concluded: string; risks_significant: string;
      b5_uncorrected: string | null;
      materiality: string | null;
      docs_unsigned: string;
      pbc_open: string;
      missta_count: string;
      defic_count: string;
    }>(
      `SELECT e.phase,
              (SELECT count(*)::text FROM program_step WHERE engagement_id = e.id) AS steps_total,
              (SELECT count(*)::text FROM program_step WHERE engagement_id = e.id AND status = 'complete') AS steps_complete,
              (SELECT count(*)::text FROM program_step WHERE engagement_id = e.id AND status = 'na') AS steps_na,
              (SELECT count(*)::text FROM risk WHERE engagement_id = e.id AND rebutted = false AND status <> 'concluded') AS risks_open,
              (SELECT count(*)::text FROM risk WHERE engagement_id = e.id AND status = 'concluded') AS risks_concluded,
              (SELECT count(*)::text FROM risk WHERE engagement_id = e.id AND significant AND rebutted = false) AS risks_significant,
              (SELECT sum(amount)::text FROM misstatement WHERE engagement_id = e.id AND trivial = false AND corrected = false) AS b5_uncorrected,
              (SELECT overall::text FROM materiality WHERE engagement_id = e.id AND status = 'approved' ORDER BY version_no DESC LIMIT 1) AS materiality,
              (SELECT count(*)::text FROM document WHERE engagement_id = e.id AND status = 'draft') AS docs_unsigned,
              (SELECT count(*)::text FROM pbc_item WHERE engagement_id = e.id AND status <> 'accepted') AS pbc_open,
              (SELECT count(*)::text FROM misstatement WHERE engagement_id = e.id AND trivial = false) AS missta_count,
              (SELECT count(*)::text FROM finding WHERE engagement_id = e.id AND status = 'open') AS defic_count
         FROM engagement e WHERE e.id = $1`,
      [engagementId],
    );
    const row = summary.rows[0];
    const deadlines = await tx.query<{ key: string; due_date: string; days_left: number }>(
      `SELECT key, to_char(due_date, 'YYYY-MM-DD') AS due_date, (due_date - CURRENT_DATE)::int AS days_left
         FROM statutory_deadline
        WHERE engagement_id = $1 AND done = false
        ORDER BY due_date LIMIT 5`,
      [engagementId],
    );
    return {
      phase: row.phase,
      steps: { total: Number(row.steps_total), complete: Number(row.steps_complete), na: Number(row.steps_na) },
      risks: {
        identified: Number(row.risks_open),
        concluded: Number(row.risks_concluded),
        significant: Number(row.risks_significant),
      },
      b5: {
        uncorrected: Number(row.b5_uncorrected ?? 0),
        materiality: row.materiality === null ? null : Number(row.materiality),
      },
      documentsUnsigned: Number(row.docs_unsigned),
      pbcOpen: Number(row.pbc_open),
      misstatementCount: Number(row.missta_count),
      deficiencyCount: Number(row.defic_count),
      nextDeadlines: deadlines.rows.map((deadline) => ({
        key: deadline.key, dueDate: deadline.due_date, daysLeft: deadline.days_left,
      })),
    };
  });
}

export interface FirmDashboard {
  byPhase: { phase: string; count: number }[];
  deadlineHeat: {
    engagementId: string; clientName: string; fiscalYear: number;
    key: string; dueDate: string; daysLeft: number;
  }[];
  workload: { userName: string; openSteps: number }[];
  mandateExpiries: { clientId: string; clientName: string; expiryYear: number }[];
  /** 9.5 portfolio risk view. */
  significantRisks: {
    engagementId: string; clientName: string; fiscalYear: number; description: string; status: string;
  }[];
  b5Exposure: {
    engagementId: string; clientName: string; fiscalYear: number;
    uncorrected: number; materiality: number | null; exceeds: boolean;
  }[];
}

export async function firmDashboard(): Promise<FirmDashboard> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const byPhase = await tx.query<{ phase: string; count: string }>(
      "SELECT phase, count(*)::text FROM engagement GROUP BY phase ORDER BY phase",
    );
    const deadlineHeat = await tx.query<{
      engagement_id: string; client_name: string; fiscal_year: number;
      key: string; due_date: string; days_left: number;
    }>(
      `SELECT sd.engagement_id, c.name AS client_name, e.fiscal_year, sd.key,
              to_char(sd.due_date, 'YYYY-MM-DD') AS due_date,
              (sd.due_date - CURRENT_DATE)::int AS days_left
         FROM statutory_deadline sd
         JOIN engagement e ON e.id = sd.engagement_id
         JOIN client c ON c.id = e.client_id
        WHERE sd.done = false AND e.phase <> 'archived'
        ORDER BY sd.due_date LIMIT 15`,
    );
    const workload = await tx.query<{ user_name: string; open_steps: string }>(
      `SELECT coalesce(u.name, u.email) AS user_name, count(ps.id)::text AS open_steps
         FROM file_item fi
         JOIN program_step ps ON ps.file_item_id = fi.id AND ps.status = 'planned'
         JOIN app_user u ON u.id = fi.owner_id
        GROUP BY u.id ORDER BY count(ps.id) DESC LIMIT 10`,
    );
    const mandates = await tx.query<{ client_id: string; client_name: string; expiry_year: number }>(
      `SELECT id AS client_id, name AS client_name,
              mandate_start_year + CASE mandate_type WHEN 'statutes' THEN 2 ELSE 6 END - 1 AS expiry_year
         FROM client
        WHERE mandate_type IS NOT NULL AND mandate_start_year IS NOT NULL
        ORDER BY expiry_year LIMIT 10`,
    );
    const significantRisks = await tx.query<{
      engagement_id: string; client_name: string; fiscal_year: number; description: string; status: string;
    }>(
      `SELECT r.engagement_id, c.name AS client_name, e.fiscal_year, r.description, r.status
         FROM risk r
         JOIN engagement e ON e.id = r.engagement_id
         JOIN client c ON c.id = e.client_id
        WHERE r.significant AND r.rebutted = false AND e.phase NOT IN ('archived')
        ORDER BY c.name, e.fiscal_year DESC LIMIT 25`,
    );
    const b5 = await tx.query<{
      engagement_id: string; client_name: string; fiscal_year: number;
      uncorrected: string | null; materiality: string | null;
    }>(
      `SELECT e.id AS engagement_id, c.name AS client_name, e.fiscal_year,
              (SELECT sum(amount)::text FROM misstatement
                WHERE engagement_id = e.id AND trivial = false AND corrected = false) AS uncorrected,
              (SELECT overall::text FROM materiality
                WHERE engagement_id = e.id AND status = 'approved'
                ORDER BY version_no DESC LIMIT 1) AS materiality
         FROM engagement e JOIN client c ON c.id = e.client_id
        WHERE e.phase NOT IN ('archived')
        ORDER BY c.name LIMIT 25`,
    );
    return {
      byPhase: byPhase.rows.map((row) => ({ phase: row.phase, count: Number(row.count) })),
      deadlineHeat: deadlineHeat.rows.map((row) => ({
        engagementId: row.engagement_id, clientName: row.client_name, fiscalYear: row.fiscal_year,
        key: row.key, dueDate: row.due_date, daysLeft: row.days_left,
      })),
      workload: workload.rows.map((row) => ({ userName: row.user_name, openSteps: Number(row.open_steps) })),
      mandateExpiries: mandates.rows.map((row) => ({ clientId: row.client_id, clientName: row.client_name, expiryYear: row.expiry_year })),
      significantRisks: significantRisks.rows.map((row) => ({
        engagementId: row.engagement_id, clientName: row.client_name, fiscalYear: row.fiscal_year,
        description: row.description, status: row.status,
      })),
      b5Exposure: b5.rows
        .filter((row) => row.uncorrected !== null || row.materiality !== null)
        .map((row) => {
          const uncorrected = Number(row.uncorrected ?? 0);
          const materiality = row.materiality === null ? null : Number(row.materiality);
          return {
            engagementId: row.engagement_id, clientName: row.client_name, fiscalYear: row.fiscal_year,
            uncorrected, materiality,
            exceeds: materiality !== null && Math.abs(uncorrected) > materiality,
          };
        }),
    };
  });
}

/** One actionable row on My Audit Portfolio — always deep-links somewhere. */
export interface PortfolioAction {
  kind: "review" | "notes" | "independence" | "acceptance";
  engagementId: string;
  label: string;
  count: number;
  href: string;
}

/**
 * The personalised priority-action queue (IA audit, Part 5A §①): workpapers
 * awaiting review, open review notes on the user's own tasks, the user's
 * pending independence confirmation, and acceptances awaiting partner
 * sign-off. Reviewer-facing rows are for the caller to gate by role.
 */
export async function portfolioActions(): Promise<PortfolioAction[]> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const [review, notes, independence, acceptance] = await Promise.all([
      tx.query<{ id: string; label: string; n: string }>(
        `SELECT e.id, coalesce(e.name, c.name) AS label, count(*)::text AS n
           FROM file_item fi
           JOIN engagement e ON e.id = fi.engagement_id
           JOIN client c ON c.id = e.client_id
          WHERE e.phase <> 'archived' AND fi.conditional = false
            AND EXISTS (SELECT 1 FROM document d
                          JOIN signoff s ON s.document_id = d.id
                           AND s.role = 'preparer' AND s.voided_at IS NULL
                         WHERE d.file_item_id = fi.id)
            AND NOT EXISTS (SELECT 1 FROM document d
                          JOIN signoff s ON s.document_id = d.id
                           AND s.role IN ('reviewer', 'partner') AND s.voided_at IS NULL
                         WHERE d.file_item_id = fi.id)
          GROUP BY e.id, label
          ORDER BY count(*) DESC
          LIMIT 6`,
      ),
      tx.query<{ id: string; label: string; n: string }>(
        `SELECT e.id, coalesce(e.name, c.name) AS label, count(*)::text AS n
           FROM review_note rn
           JOIN document d ON d.id = rn.document_id
           JOIN file_item fi ON fi.id = d.file_item_id
           JOIN engagement e ON e.id = fi.engagement_id
           JOIN client c ON c.id = e.client_id
          WHERE rn.status = 'open' AND fi.owner_id = $1 AND e.phase <> 'archived'
          GROUP BY e.id, label
          LIMIT 6`,
        [userId],
      ),
      tx.query<{ id: string; label: string; token: string }>(
        `SELECT e.id, coalesce(e.name, c.name) AS label, ic.token
           FROM independence_confirmation ic
           JOIN independence_campaign cam ON cam.id = ic.campaign_id
           JOIN engagement e ON e.id = cam.engagement_id
           JOIN client c ON c.id = e.client_id
          WHERE ic.user_id = $1 AND ic.status IN ('sent', 'opened')
          LIMIT 6`,
        [userId],
      ),
      tx.query<{ id: string; label: string }>(
        `SELECT e.id, coalesce(e.name, c.name) AS label
           FROM engagement e
           JOIN client c ON c.id = e.client_id
          WHERE e.phase = 'acceptance'
            AND EXISTS (SELECT 1 FROM file_item fi
                          JOIN document d ON d.file_item_id = fi.id AND d.kind = 'workpaper'
                          JOIN signoff s ON s.document_id = d.id
                           AND s.role = 'preparer' AND s.voided_at IS NULL
                         WHERE fi.engagement_id = e.id AND fi.code = 'D3.1')
            AND NOT EXISTS (SELECT 1 FROM file_item fi
                          JOIN document d ON d.file_item_id = fi.id AND d.kind = 'workpaper'
                          JOIN signoff s ON s.document_id = d.id
                           AND s.role = 'partner' AND s.voided_at IS NULL
                         WHERE fi.engagement_id = e.id AND fi.code = 'D3.1')
          LIMIT 6`,
      ),
    ]);
    const actions: PortfolioAction[] = [];
    for (const row of independence.rows) {
      actions.push({ kind: "independence", engagementId: row.id, label: row.label, count: 1, href: `/independence/${row.token}` });
    }
    for (const row of notes.rows) {
      actions.push({ kind: "notes", engagementId: row.id, label: row.label, count: Number(row.n), href: `/engagements/${row.id}/dashboard` });
    }
    for (const row of review.rows) {
      actions.push({ kind: "review", engagementId: row.id, label: row.label, count: Number(row.n), href: `/engagements/${row.id}/dashboard` });
    }
    for (const row of acceptance.rows) {
      actions.push({ kind: "acceptance", engagementId: row.id, label: row.label, count: 1, href: `/engagements/${row.id}/acceptance` });
    }
    return actions;
  });
}
