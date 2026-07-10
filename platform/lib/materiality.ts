// Materiality (ISA 320, spec §5.1) — calculated, versioned, partner-approved.
// Benchmark figures are entered manually until the TB engine (Phase 3) supplies
// them. Firm-default percentage ranges shown as guidance: PBT 5–10 %, revenue
// 0.5–2 %, total assets 0.5–2 %.

import { withTenant } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { canPartnerSignoff } from "@/lib/rbac";
import { requireTenant } from "@/lib/tenant";

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
    const superseded = await tx.query<{ n: string }>(
      `WITH up AS (
         UPDATE materiality SET status = 'superseded'
          WHERE engagement_id = $1 AND status = 'approved'
          RETURNING 1
       ) SELECT count(*)::text AS n FROM up`,
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
}
