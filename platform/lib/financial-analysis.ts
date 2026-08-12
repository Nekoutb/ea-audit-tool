// Financial Analysis: the ratio battery computed from the pre-audit trial
// balance, with DSO and DPO drawing the last three months of sales and
// purchases from the ingested general ledger (journal_entries dataset).
// Sign convention: TB closings are debit-positive, so credit-natured balances
// (equity, liabilities, revenue) are negated on aggregation.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export interface RatioRow {
  key: string;
  label: string;
  group: "Liquidity" | "Profitability" | "Leverage" | "Activity" | "Investment";
  /** null = not computable (missing data); the note says why */
  value: number | null;
  unit: "x" | "%" | "days" | "FCFA";
  note?: string;
}

interface TbRow {
  account: string;
  closing: number;
}

function sum(rows: TbRow[], test: (r: TbRow) => boolean): number {
  let total = 0;
  for (const row of rows) if (test(row)) total += row.closing;
  return total;
}

const r1 = (n: number) => Math.round(n * 100) / 100;

export interface FinancialAnalysis {
  ratios: RatioRow[];
  glAvailable: boolean;
  periodEnd: string;
}

export async function financialAnalysis(engagementId: string): Promise<FinancialAnalysis | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const meta = await tx.query<{ period_end: string }>(
      "SELECT to_char(period_end, 'YYYY-MM-DD') AS period_end FROM engagement WHERE id = $1",
      [engagementId],
    );
    if (!meta.rows[0]) return null;
    const periodEnd = meta.rows[0].period_end;

    const tb = await tx.query<{ account_code: string; closing: string }>(
      `SELECT r.account_code,
              (r.opening_debit - r.opening_credit + r.debit - r.credit)::text AS closing
         FROM trial_balance tb
         JOIN trial_balance_version v ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
         JOIN trial_balance_row r ON r.version_id = v.id
        WHERE tb.engagement_id = $1`,
      [engagementId],
    );
    if (tb.rows.length === 0) return null;
    const rows: TbRow[] = tb.rows.map((r) => ({ account: r.account_code, closing: Number(r.closing) }));

    // ---- balance-sheet aggregates (SYSCOHADA classes) ----
    const inventory = sum(rows, (r) => r.account.startsWith("3"));
    const receivables = sum(rows, (r) => r.account.startsWith("41"));
    const cash = sum(rows, (r) => r.account.startsWith("5") && !r.account.startsWith("59"));
    const class4Debit = sum(rows, (r) => r.account.startsWith("4") && r.closing > 0);
    const class4Credit = -sum(rows, (r) => r.account.startsWith("4") && r.closing < 0);
    const payables = -sum(rows, (r) => r.account.startsWith("40") && r.closing < 0);
    const currentAssets = inventory + class4Debit + Math.max(cash, 0);
    const currentLiabilities = class4Credit + Math.max(-cash, 0);
    const equity = -sum(rows, (r) => /^1[0-5]/.test(r.account));
    const financialDebt = -sum(rows, (r) => /^1[6-8]/.test(r.account));
    const totalAssets =
      sum(rows, (r) => r.account.startsWith("2")) + currentAssets;

    // ---- income-statement aggregates ----
    const revenue = -sum(rows, (r) => r.account.startsWith("7"));
    const expenses = sum(rows, (r) => r.account.startsWith("6"));
    const cogs = sum(rows, (r) => r.account.startsWith("60"));
    const financeCosts = sum(rows, (r) => r.account.startsWith("67"));
    const depreciation = sum(rows, (r) => r.account.startsWith("68") || r.account.startsWith("69"));
    const pbt = revenue - expenses;
    const ebitda = pbt + financeCosts + depreciation;

    // ---- GL: last 3 months of sales (70x) and purchases (60x-62x) ----
    const gl = await tx.query<{ mapping: Record<string, string> | null; id: string }>(
      `SELECT id, mapping FROM sub_ledger_dataset
        WHERE engagement_id = $1 AND kind = 'journal_entries'
        ORDER BY created_at DESC LIMIT 1`,
      [engagementId],
    );
    let sales3m: number | null = null;
    let purchases3m: number | null = null;
    const mapping = gl.rows[0]?.mapping;
    if (gl.rows[0] && mapping?.account && mapping.amount && mapping.journalDate) {
      const glRows = await tx.query<{ data: Record<string, unknown> }>(
        "SELECT data FROM sub_ledger_row WHERE dataset_id = $1",
        [gl.rows[0].id],
      );
      const end = new Date(periodEnd + "T00:00:00Z");
      const start = new Date(end);
      start.setUTCMonth(start.getUTCMonth() - 3);
      const parseDate = (v: unknown): Date | null => {
        const s = String(v ?? "").trim();
        const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
        const d = m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : new Date(s);
        return Number.isNaN(d.getTime()) ? null : d;
      };
      const parseAmount = (v: unknown): number => {
        const n = Number(String(v ?? "").replace(/[\s  ]/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, ""));
        return Number.isFinite(n) ? n : 0;
      };
      let sales = 0;
      let purchases = 0;
      let inWindow = 0;
      for (const { data } of glRows.rows) {
        const d = parseDate(data[mapping.journalDate]);
        if (!d || d < start || d > end) continue;
        inWindow += 1;
        const account = String(data[mapping.account] ?? "");
        const amount = Math.abs(parseAmount(data[mapping.amount]));
        if (account.startsWith("70")) sales += amount;
        if (/^6[0-2]/.test(account)) purchases += amount;
      }
      if (inWindow > 0) {
        sales3m = sales;
        purchases3m = purchases;
      }
    }

    const glNote = "Requires the General Ledger (last 3 months) — upload it in the General Ledger Analyzer";
    const div = (a: number, b: number): number | null => (b !== 0 ? a / b : null);
    const pct = (v: number | null): number | null => (v === null ? null : r1(v * 100));
    const x = (v: number | null): number | null => (v === null ? null : r1(v));

    const ratios: RatioRow[] = [
      // Liquidity
      { key: "current", label: "Current ratio", group: "Liquidity", value: x(div(currentAssets, currentLiabilities)), unit: "x" },
      { key: "quick", label: "Quick ratio", group: "Liquidity", value: x(div(currentAssets - inventory, currentLiabilities)), unit: "x" },
      { key: "cash", label: "Cash ratio", group: "Liquidity", value: x(div(Math.max(cash, 0), currentLiabilities)), unit: "x" },
      { key: "wc", label: "Working capital", group: "Liquidity", value: Math.round(currentAssets - currentLiabilities), unit: "FCFA" },
      // Activity
      {
        key: "dso", label: "DSO — days sales outstanding", group: "Activity",
        value: sales3m !== null && sales3m > 0 ? Math.round((receivables / sales3m) * 90) : null,
        unit: "days", note: sales3m === null ? glNote : "Receivables ÷ last-3-months sales × 90",
      },
      {
        key: "dpo", label: "DPO — days payables outstanding", group: "Activity",
        value: purchases3m !== null && purchases3m > 0 ? Math.round((payables / purchases3m) * 90) : null,
        unit: "days", note: purchases3m === null ? glNote : "Payables ÷ last-3-months purchases × 90",
      },
      { key: "inv_turn", label: "Inventory turnover", group: "Activity", value: x(div(cogs, inventory)), unit: "x" },
      { key: "rec_turn", label: "Receivables turnover", group: "Activity", value: x(div(revenue, receivables)), unit: "x" },
      { key: "pay_turn", label: "Payables turnover", group: "Activity", value: x(div(cogs, payables)), unit: "x" },
      { key: "asset_turn", label: "Asset turnover", group: "Activity", value: x(div(revenue, totalAssets)), unit: "x" },
      // Profitability
      { key: "gross", label: "Gross margin", group: "Profitability", value: pct(div(revenue - cogs, revenue)), unit: "%" },
      { key: "ebitda", label: "EBITDA margin", group: "Profitability", value: pct(div(ebitda, revenue)), unit: "%" },
      { key: "net", label: "Net margin (PBT)", group: "Profitability", value: pct(div(pbt, revenue)), unit: "%" },
      // Leverage
      { key: "gearing", label: "Gearing (debt ÷ debt + equity)", group: "Leverage", value: pct(div(financialDebt, financialDebt + equity)), unit: "%" },
      { key: "dte", label: "Debt to equity", group: "Leverage", value: x(div(financialDebt, equity)), unit: "x" },
      { key: "equity_ratio", label: "Equity ratio", group: "Leverage", value: pct(div(equity, totalAssets)), unit: "%" },
      { key: "int_cover", label: "Interest cover", group: "Leverage", value: x(div(pbt + financeCosts, financeCosts)), unit: "x" },
      // Investment
      { key: "roa", label: "Return on assets (ROA)", group: "Investment", value: pct(div(pbt, totalAssets)), unit: "%" },
      { key: "roe", label: "Return on equity (ROE)", group: "Investment", value: pct(div(pbt, equity)), unit: "%" },
      { key: "roce", label: "Return on capital employed (ROCE)", group: "Investment", value: pct(div(pbt + financeCosts, equity + financialDebt)), unit: "%" },
    ];

    return { ratios, glAvailable: sales3m !== null, periodEnd };
  });
}
