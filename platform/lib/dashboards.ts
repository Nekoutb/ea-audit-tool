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
              (SELECT count(*)::text FROM pbc_item WHERE engagement_id = e.id AND status <> 'accepted') AS pbc_open
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
  mandateExpiries: { clientName: string; expiryYear: number }[];
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
    const mandates = await tx.query<{ client_name: string; expiry_year: number }>(
      `SELECT name AS client_name,
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
      mandateExpiries: mandates.rows.map((row) => ({ clientName: row.client_name, expiryYear: row.expiry_year })),
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
