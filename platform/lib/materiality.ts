// Materiality (ISA 320, spec §5.1) — calculated, versioned, partner-approved.
// Benchmark figures are entered manually until the TB engine (Phase 3) supplies
// them. Firm-default percentage ranges shown as guidance: PBT 5–10 %, revenue
// 0.5–2 %, total assets 0.5–2 %.

import { withTenant } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { canPartnerSignoff } from "@/lib/rbac";
import { requireTenant } from "@/lib/tenant";
import { recordActivity } from "@/lib/activity";

export type Benchmark = "pbt" | "revenue" | "total_assets" | "equity" | "expenses";
export const BENCHMARKS: readonly Benchmark[] = ["pbt", "revenue", "total_assets", "equity", "expenses"];

export const BENCHMARK_RANGES: Record<Benchmark, { min: number; max: number }> = {
  pbt: { min: 5, max: 10 },
  revenue: { min: 0.5, max: 2 },
  total_assets: { min: 0.5, max: 2 },
  equity: { min: 1, max: 5 },
  expenses: { min: 0.5, max: 2 },
};

export interface MaterialityInput {
  benchmark: Benchmark;
  benchmarkAmount: number;
  percentage: number;
  justification: string;
  performancePct: number;
  performanceJustification?: string;
  trivialPct: number;
}

export interface MaterialityVersion {
  id: string;
  versionNo: number;
  benchmark: Benchmark;
  benchmarkAmount: number;
  percentage: number;
  justification: string;
  performancePct: number;
  overall: number;
  performance: number;
  trivial: number;
  status: "draft" | "approved" | "superseded";
  approvedByName: string | null;
}

export function computeMateriality(input: MaterialityInput): {
  overall: number;
  performance: number;
  trivial: number;
} {
  const overall = Math.round(input.benchmarkAmount * (input.percentage / 100));
  const performance = Math.round(overall * (input.performancePct / 100));
  const trivial = Math.round(overall * (input.trivialPct / 100));
  return { overall, performance, trivial };
}

function toVersion(row: {
  id: string;
  version_no: number;
  benchmark: Benchmark;
  benchmark_amount: string;
  percentage: string;
  justification: string;
  performance_pct: string;
  overall: string;
  performance: string;
  trivial: string;
  status: MaterialityVersion["status"];
  approved_by_name: string | null;
}): MaterialityVersion {
  return {
    id: row.id,
    versionNo: row.version_no,
    benchmark: row.benchmark,
    benchmarkAmount: Number(row.benchmark_amount),
    percentage: Number(row.percentage),
    justification: row.justification,
    performancePct: Number(row.performance_pct),
    overall: Number(row.overall),
    performance: Number(row.performance),
    trivial: Number(row.trivial),
    status: row.status,
    approvedByName: row.approved_by_name,
  };
}

const SELECT_VERSION = `
  SELECT m.id, m.version_no, m.benchmark, m.benchmark_amount::text, m.percentage::text,
         m.justification, m.performance_pct::text, m.overall::text, m.performance::text,
         m.trivial::text, m.status, coalesce(u.name, u.email) AS approved_by_name
    FROM materiality m
    LEFT JOIN app_user u ON u.id = m.approved_by`;

/**
 * Candidate benchmark amounts derived from the current trial-balance version,
 * by SYSCOHADA class: revenue = class 7 (credit), expenses = class 6 (debit),
 * PBT = revenue - expenses, equity = accounts 10-15 (credit), total assets =
 * debit-balance accounts of classes 2-5. Null when no TB is ingested yet.
 */
export async function tbBenchmarkAmounts(
  engagementId: string,
): Promise<Record<Benchmark, number> | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ account_code: string; closing: string }>(
      `SELECT r.account_code,
              (r.opening_debit - r.opening_credit + r.debit - r.credit)::text AS closing
         FROM trial_balance tb
         JOIN trial_balance_version v
           ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
         JOIN trial_balance_row r ON r.version_id = v.id
        WHERE tb.engagement_id = $1`,
      [engagementId],
    );
    if (r.rows.length === 0) return null;
    let cl6 = 0, cl7 = 0, equity = 0, assets = 0;
    for (const row of r.rows) {
      const closing = Number(row.closing);
      const c1 = row.account_code[0];
      const c2 = row.account_code.slice(0, 2);
      if (c1 === "6") cl6 += closing;
      else if (c1 === "7") cl7 += closing;
      if (["10", "11", "12", "13", "14", "15"].includes(c2)) equity += closing;
      if (["2", "3", "4", "5"].includes(c1) && closing > 0) assets += closing;
    }
    const revenue = Math.round(-cl7);
    const expenses = Math.round(cl6);
    return {
      revenue: Math.max(0, revenue),
      expenses: Math.max(0, expenses),
      pbt: revenue - expenses,
      equity: Math.max(0, Math.round(-equity)),
      total_assets: Math.round(assets),
    };
  });
}

/** The latest PARTNER-APPROVED thresholds — what the working papers may cite. */
export async function approvedMateriality(engagementId: string): Promise<MaterialityVersion | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query(
      `${SELECT_VERSION} WHERE m.engagement_id = $1 AND m.status = 'approved' ORDER BY m.version_no DESC LIMIT 1`,
      [engagementId],
    );
    return result.rows[0] ? toVersion(result.rows[0]) : null;
  });
}

export async function currentMateriality(engagementId: string): Promise<MaterialityVersion | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query(
      `${SELECT_VERSION} WHERE m.engagement_id = $1 ORDER BY m.version_no DESC LIMIT 1`,
      [engagementId],
    );
    return result.rows[0] ? toVersion(result.rows[0]) : null;
  });
}

export async function listMaterialityVersions(engagementId: string): Promise<MaterialityVersion[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query(
      `${SELECT_VERSION} WHERE m.engagement_id = $1 ORDER BY m.version_no DESC`,
      [engagementId],
    );
    return result.rows.map(toVersion);
  });
}

/**
 * Create a new materiality version (drafts supersede nothing; a revision after
 * approval supersedes the approved one and re-flags dependents — spec §8.2:
 * Phase 3+ artifacts recompute from the current version; here we notify).
 */
export async function createMaterialityVersion(
  engagementId: string,
  input: MaterialityInput,
): Promise<number> {
  const { tenantId, userId } = await requireTenant();
  if (!input.justification.trim()) throw new Error("justification-required");
  // Validate ranges HERE so bad input becomes a friendly banner, never a DB
  // CHECK-constraint 500. [Adversarial-review fix]
  if (
    !Number.isFinite(input.benchmarkAmount) || input.benchmarkAmount <= 0 ||
    !Number.isFinite(input.percentage) || input.percentage <= 0 || input.percentage > 100 ||
    !Number.isFinite(input.performancePct) || input.performancePct < 60 || input.performancePct > 85 ||
    !Number.isFinite(input.trivialPct) || input.trivialPct <= 0 || input.trivialPct > 10
  ) {
    throw new Error("invalid-materiality");
  }
  const { overall, performance, trivial } = computeMateriality(input);

  return withTenant(tenantId, async (tx) => {
    // COUNT the approved version; do not supersede it. Drafting a revision
    // used to retire the approved figure immediately, which left the engagement
    // with NO approved materiality until the partner got round to approving the
    // draft — and nothing degrades gracefully without one. Scoping defaults
    // every account to not-significant, the CRA board collapses to whatever has
    // saved cells, S5.5 empties with it, the sampling studio refuses with
    // "materiality not approved yet", the completion gate b5 fails, and the
    // trivial threshold becomes null so NOTHING counts as clearly trivial.
    // approveMateriality already supersedes the prior version at the moment the
    // new one takes effect, which is the correct point.
    const superseded = await tx.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM materiality
        WHERE engagement_id = $1 AND status = 'approved'`,
      [engagementId],
    );
    const next = await tx.query<{ v: number }>(
      "SELECT coalesce(max(version_no), 0) + 1 AS v FROM materiality WHERE engagement_id = $1",
      [engagementId],
    );
    const versionNo = next.rows[0].v;
    await tx.query(
      `INSERT INTO materiality
         (tenant_id, engagement_id, version_no, benchmark, benchmark_amount, percentage,
          justification, performance_pct, performance_justification, trivial_pct,
          overall, performance, trivial, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        tenantId,
        engagementId,
        versionNo,
        input.benchmark,
        input.benchmarkAmount,
        input.percentage,
        input.justification,
        input.performancePct,
        input.performanceJustification ?? null,
        input.trivialPct,
        overall,
        performance,
        trivial,
        userId,
      ],
    );
    // Revision after approval: tell the partner dependents must be reviewed.
    if (Number(superseded.rows[0].n) > 0) {
      const partners = await tx.query<{ user_id: string }>(
        "SELECT user_id FROM team_member WHERE engagement_id = $1 AND team_role = 'partner'",
        [engagementId],
      );
      for (const partner of partners.rows) {
        await createNotification({
          tenantId,
          userId: partner.user_id,
          kind: "materiality-revised",
          title: "Materiality revised",
          body: `Version ${versionNo} created — items computed under the prior figure need review and the new version needs approval.`,
          href: `/engagements/${engagementId}/tools/materiality`,
        });
      }
    }
    return versionNo;
  });
}

/**
 * Partner approval gate (spec §5.1). Only the LATEST version is approvable, and
 * approving it supersedes any older approved version, so two versions can never
 * be simultaneously approved. [Adversarial-review fix]
 */
export async function approveMateriality(engagementId: string, versionNo: number): Promise<void> {
  const { tenantId, userId, role } = await requireTenant();
  if (!canPartnerSignoff(role)) throw new Error("forbidden");
  await withTenant(tenantId, async (tx) => {
    const latest = await tx.query<{ v: number }>(
      "SELECT coalesce(max(version_no), 0) AS v FROM materiality WHERE engagement_id = $1",
      [engagementId],
    );
    if (latest.rows[0].v !== versionNo) throw new Error("stale-version");
    await tx.query(
      `UPDATE materiality SET status = 'superseded'
        WHERE engagement_id = $1 AND status = 'approved' AND version_no <> $2`,
      [engagementId, versionNo],
    );
    const updated = await tx.query(
      `UPDATE materiality SET status = 'approved', approved_by = $3, approved_at = now()
        WHERE engagement_id = $1 AND version_no = $2 AND status = 'draft'`,
      [engagementId, versionNo, userId],
    );
    if (updated.rowCount === 0) throw new Error("not-found");
  });

  await reflagMisstatements(engagementId);
}

/**
 * Re-classify accumulated misstatements against the newly approved trivial
 * threshold.
 *
 * misstatement.trivial is STORED, decided at the moment the entry was posted
 * (lib/sad.ts postSadEntry). Revising materiality therefore left every earlier
 * entry carrying a verdict reached against a threshold that no longer exists —
 * and that verdict decides which misstatements accumulate toward the opinion.
 * ISA 450 para 5 requires accumulating misstatements other than those clearly
 * trivial, and ISA 320 para 12-13 requires revising materiality as the audit
 * progresses; if the threshold falls, items previously set aside become
 * reportable and the aggregate can cross into a modified opinion.
 *
 * What is re-derived is the CLASSIFICATION only. The amount, the description,
 * the accounts, who found it and when are evidence of work performed and are
 * never rewritten — a materiality change does not alter what was observed, only
 * how it is judged.
 *
 * Returned counts feed the activity entry, so a reviewer can see that a
 * revision moved items across the line rather than having to infer it.
 */
export async function reflagMisstatements(
  engagementId: string,
): Promise<{ nowReportable: number; nowTrivial: number }> {
  const { tenantId } = await requireTenant();
  const approved = await approvedMateriality(engagementId);
  if (!approved) return { nowReportable: 0, nowTrivial: 0 };

  const counts = await withTenant(tenantId, async (tx) => {
    // Two directed updates rather than one recompute, so each side can be
    // counted and reported separately.
    const reportable = await tx.query(
      `UPDATE misstatement SET trivial = false
        WHERE engagement_id = $1 AND trivial = true AND abs(amount) >= $2`,
      [engagementId, approved.trivial],
    );
    const trivial = await tx.query(
      `UPDATE misstatement SET trivial = true
        WHERE engagement_id = $1 AND trivial = false AND abs(amount) < $2`,
      [engagementId, approved.trivial],
    );
    return { nowReportable: reportable.rowCount ?? 0, nowTrivial: trivial.rowCount ?? 0 };
  });

  if (counts.nowReportable > 0 || counts.nowTrivial > 0) {
    await recordActivity({
      engagementId,
      entityType: "materiality",
      action: "materiality.reflagged",
      summary:
        `Materiality revised: ${counts.nowReportable} misstatement(s) became reportable, ` +
        `${counts.nowTrivial} became clearly trivial`,
      meta: { trivialThreshold: approved.trivial, ...counts },
    });
  }
  return counts;
}
