// Preliminary analytical review (D4.3 / ISA 315, step 3.9): auto-computed
// variance of the current TB against prior year, grouped by E-section, with
// threshold flags against performance materiality and a small class-based
// ratio set. Every flagged line can raise a potential risk into D7.1.
// Ratios use SYSCOHADA class prefixes directly (Appendix A) so they do not
// depend on the grouping library's labels.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export interface VarianceLine {
  sectionCode: string;
  closing: number;
  prior: number;
  movement: number;
  variancePct: number | null;
  flagged: boolean;
}

export interface RatioLine {
  key: string;
  current: number | null;
  prior: number | null;
}

export interface AnalyticalReview {
  hasTb: boolean;
  hasPrior: boolean;
  performanceMateriality: number | null;
  lines: VarianceLine[];
  ratios: RatioLine[];
}

interface BalanceRow {
  account_code: string;
  closing: string;
}

async function closingsByEngagement(
  tx: import("pg").PoolClient,
  engagementId: string,
): Promise<BalanceRow[]> {
  const result = await tx.query<BalanceRow>(
    `SELECT r.account_code,
            (r.opening_debit - r.opening_credit + r.debit - r.credit)::text AS closing
       FROM trial_balance tb
       JOIN trial_balance_version v
         ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
       JOIN trial_balance_row r ON r.version_id = v.id
      WHERE tb.engagement_id = $1`,
    [engagementId],
  );
  return result.rows;
}

function sumByPrefix(rows: BalanceRow[], prefixes: string[]): number {
  let total = 0;
  for (const row of rows) {
    if (prefixes.some((prefix) => row.account_code.startsWith(prefix))) {
      total += Number(row.closing);
    }
  }
  return total;
}

function computeRatios(rows: BalanceRow[]): Map<string, number | null> {
  // SYSCOHADA sign convention: P&L credit balances are negative closings; use
  // absolute revenue so ratios read naturally.
  const revenue = Math.abs(sumByPrefix(rows, ["70", "71", "72", "73"]));
  const payroll = sumByPrefix(rows, ["66"]);
  const finance = sumByPrefix(rows, ["67"]);
  const purchases = sumByPrefix(rows, ["60", "61"]);
  const ratios = new Map<string, number | null>();
  ratios.set("revenue", revenue || null);
  ratios.set("payroll_to_revenue", revenue ? (payroll / revenue) * 100 : null);
  ratios.set("finance_to_revenue", revenue ? (finance / revenue) * 100 : null);
  ratios.set("purchases_to_revenue", revenue ? (purchases / revenue) * 100 : null);
  return ratios;
}

/**
 * Section-level variance current vs prior. A line is flagged when its absolute
 * movement exceeds performance materiality (spec §8.2: analytics read PM live).
 */
export async function analyticalReview(engagementId: string): Promise<AnalyticalReview> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const current = await closingsByEngagement(tx, engagementId);

    const prior = await tx.query<{ id: string }>(
      `SELECT p.id
         FROM engagement e
         JOIN engagement p ON p.client_id = e.client_id AND p.fiscal_year < e.fiscal_year
        WHERE e.id = $1
        ORDER BY p.fiscal_year DESC LIMIT 1`,
      [engagementId],
    );
    const priorRows = prior.rows[0] ? await closingsByEngagement(tx, prior.rows[0].id) : [];

    const materiality = await tx.query<{ performance: string }>(
      `SELECT performance::text FROM materiality
        WHERE engagement_id = $1 AND status = 'approved'
        ORDER BY version_no DESC LIMIT 1`,
      [engagementId],
    );
    const performance = materiality.rows[0] ? Number(materiality.rows[0].performance) : null;

    // Resolve sections through the grouping tables (client overrides included).
    const clientRow = await tx.query<{ client_id: string }>(
      "SELECT client_id FROM engagement WHERE id = $1",
      [engagementId],
    );
    const rules = await tx.query<{ account_prefix: string; section_code: string; priority: number; src: string; match_type: string }>(
      `SELECT account_prefix, section_code, priority, 'global' AS src, 'prefix' AS match_type
         FROM syscohada_grouping_rule WHERE active
       UNION ALL
       SELECT account_prefix, section_code, 100, 'override', match_type
         FROM client_grouping_override WHERE client_id = $1 AND active`,
      [clientRow.rows[0]?.client_id],
    );
    const resolve = (accountCode: string): string | null => {
      let best: { prefix: string; section: string; priority: number; override: boolean } | null = null;
      for (const rule of rules.rows) {
        const isOverride = rule.src === "override";
        const hit =
          rule.match_type === "exact" ? accountCode === rule.account_prefix : accountCode.startsWith(rule.account_prefix);
        if (!hit) continue;
        if (
          !best ||
          (isOverride && !best.override) ||
          (isOverride === best.override &&
            (rule.account_prefix.length > best.prefix.length ||
              (rule.account_prefix.length === best.prefix.length && rule.priority > best.priority)))
        ) {
          best = { prefix: rule.account_prefix, section: rule.section_code, priority: rule.priority, override: isOverride };
        }
      }
      return best?.section ?? null;
    };

    const bySection = new Map<string, { closing: number; prior: number }>();
    const add = (rows: BalanceRow[], field: "closing" | "prior") => {
      for (const row of rows) {
        const section = resolve(row.account_code) ?? "—";
        const entry = bySection.get(section) ?? { closing: 0, prior: 0 };
        entry[field] += Number(row.closing);
        bySection.set(section, entry);
      }
    };
    add(current, "closing");
    add(priorRows, "prior");

    const lines: VarianceLine[] = [...bySection.entries()]
      .map(([sectionCode, totals]) => {
        const movement = totals.closing - totals.prior;
        return {
          sectionCode,
          closing: totals.closing,
          prior: totals.prior,
          movement,
          variancePct: totals.prior !== 0 ? (movement / Math.abs(totals.prior)) * 100 : null,
          flagged: performance !== null && Math.abs(movement) > performance,
        };
      })
      .sort((a, b) => Math.abs(b.movement) - Math.abs(a.movement));

    const currentRatios = computeRatios(current);
    const priorRatios = computeRatios(priorRows);
    const ratios: RatioLine[] = [...currentRatios.keys()].map((key) => ({
      key,
      current: currentRatios.get(key) ?? null,
      prior: priorRatios.get(key) ?? null,
    }));

    return {
      hasTb: current.length > 0,
      hasPrior: priorRows.length > 0,
      performanceMateriality: performance,
      lines,
      ratios,
    };
  });
}
