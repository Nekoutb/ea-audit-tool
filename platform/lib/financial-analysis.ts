// Financial Analysis: the ratio battery computed twice from the pre-audit
// trial balance — Current Y from closing balances, Prior Y from the TB's
// opening balances — with DSO and DPO drawing the last three months of sales
// and purchases from the ingested general ledger (current year only).
// Sign convention: balances are debit-positive, so credit-natured aggregates
// (equity, liabilities, revenue) are negated.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export type RatioGroup = "Liquidity" | "Activity" | "Profitability" | "Leverage" | "Investment";

export interface RatioRow {
  key: string;
  label: string;
  group: RatioGroup;
  unit: "x" | "%" | "days" | "FCFA";
  current: number | null;
  prior: number | null;
  note?: string;
}

export interface FinancialAnalysis {
  rows: RatioRow[];
  glAvailable: boolean;
  periodEnd: string;
}

interface Balances {
  inventory: number;
  receivables: number;
  cash: number;
  currentAssets: number;
  currentLiabilities: number;
  payables: number;
  equity: number;
  financialDebt: number;
  totalAssets: number;
  revenue: number;
  expenses: number;
  cogs: number;
  financeCosts: number;
  depreciation: number;
  pbt: number;
  ebitda: number;
}

function aggregate(rows: { account: string; value: number }[]): Balances {
  const sum = (test: (r: { account: string; value: number }) => boolean) =>
    rows.reduce((total, row) => (test(row) ? total + row.value : total), 0);
  const inventory = sum((r) => r.account.startsWith("3"));
  const cash = sum((r) => r.account.startsWith("5") && !r.account.startsWith("59"));
  const class4Debit = sum((r) => r.account.startsWith("4") && r.value > 0);
  const class4Credit = -sum((r) => r.account.startsWith("4") && r.value < 0);
  const revenue = -sum((r) => r.account.startsWith("7"));
  const expenses = sum((r) => r.account.startsWith("6"));
  const cogs = sum((r) => r.account.startsWith("60"));
  const financeCosts = sum((r) => r.account.startsWith("67"));
  const depreciation = sum((r) => r.account.startsWith("68") || r.account.startsWith("69"));
  const pbt = revenue - expenses;
  return {
    inventory,
    receivables: sum((r) => r.account.startsWith("41")),
    cash,
    currentAssets: inventory + class4Debit + Math.max(cash, 0),
    currentLiabilities: class4Credit + Math.max(-cash, 0),
    payables: -sum((r) => r.account.startsWith("40") && r.value < 0),
    equity: -sum((r) => /^1[0-5]/.test(r.account)),
    financialDebt: -sum((r) => /^1[6-8]/.test(r.account)),
    totalAssets: sum((r) => r.account.startsWith("2")) + inventory + class4Debit + Math.max(cash, 0),
    revenue,
    expenses,
    cogs,
    financeCosts,
    depreciation,
    pbt,
    ebitda: pbt + financeCosts + depreciation,
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const div = (a: number, b: number): number | null => (b !== 0 ? r2(a / b) : null);
const pct = (a: number, b: number): number | null => (b !== 0 ? r2((a / b) * 100) : null);

/** The ratio set for one balance state; P&L ratios go null when there is no activity. */
function ratioSet(b: Balances): Record<string, number | null> {
  const noPl = b.revenue === 0 && b.expenses === 0;
  return {
    current: div(b.currentAssets, b.currentLiabilities),
    quick: div(b.currentAssets - b.inventory, b.currentLiabilities),
    cash: div(Math.max(b.cash, 0), b.currentLiabilities),
    wc: Math.round(b.currentAssets - b.currentLiabilities),
    inv_turn: noPl ? null : div(b.cogs, b.inventory),
    rec_turn: noPl ? null : div(b.revenue, b.receivables),
    pay_turn: noPl ? null : div(b.cogs, b.payables),
    asset_turn: noPl ? null : div(b.revenue, b.totalAssets),
    gross: noPl ? null : pct(b.revenue - b.cogs, b.revenue),
    ebitda: noPl ? null : pct(b.ebitda, b.revenue),
    net: noPl ? null : pct(b.pbt, b.revenue),
    gearing: pct(b.financialDebt, b.financialDebt + b.equity),
    dte: div(b.financialDebt, b.equity),
    equity_ratio: pct(b.equity, b.totalAssets),
    int_cover: noPl ? null : div(b.pbt + b.financeCosts, b.financeCosts),
    roa: noPl ? null : pct(b.pbt, b.totalAssets),
    roe: noPl ? null : pct(b.pbt, b.equity),
    roce: noPl ? null : pct(b.pbt + b.financeCosts, b.equity + b.financialDebt),
  };
}

const DEFS: { key: string; label: string; group: RatioGroup; unit: RatioRow["unit"] }[] = [
  { key: "current", label: "Current ratio", group: "Liquidity", unit: "x" },
  { key: "quick", label: "Quick ratio", group: "Liquidity", unit: "x" },
  { key: "cash", label: "Cash ratio", group: "Liquidity", unit: "x" },
  { key: "wc", label: "Working capital", group: "Liquidity", unit: "FCFA" },
  { key: "dso", label: "DSO (days sales outstanding)", group: "Activity", unit: "days" },
  { key: "dpo", label: "DPO (days payables outstanding)", group: "Activity", unit: "days" },
  { key: "inv_turn", label: "Inventory turnover", group: "Activity", unit: "x" },
  { key: "rec_turn", label: "Receivables turnover", group: "Activity", unit: "x" },
  { key: "pay_turn", label: "Payables turnover", group: "Activity", unit: "x" },
  { key: "asset_turn", label: "Asset turnover", group: "Activity", unit: "x" },
  { key: "gross", label: "Gross margin", group: "Profitability", unit: "%" },
  { key: "ebitda", label: "EBITDA margin", group: "Profitability", unit: "%" },
  { key: "net", label: "Net margin (PBT)", group: "Profitability", unit: "%" },
  { key: "gearing", label: "Gearing", group: "Leverage", unit: "%" },
  { key: "dte", label: "Debt to equity", group: "Leverage", unit: "x" },
  { key: "equity_ratio", label: "Equity ratio", group: "Leverage", unit: "%" },
  { key: "int_cover", label: "Interest cover", group: "Leverage", unit: "x" },
  { key: "roa", label: "Return on assets", group: "Investment", unit: "%" },
  { key: "roe", label: "Return on equity", group: "Investment", unit: "%" },
  { key: "roce", label: "Return on capital employed", group: "Investment", unit: "%" },
];

export async function financialAnalysis(engagementId: string): Promise<FinancialAnalysis | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const meta = await tx.query<{ period_end: string }>(
      "SELECT to_char(period_end, 'YYYY-MM-DD') AS period_end FROM engagement WHERE id = $1",
      [engagementId],
    );
    if (!meta.rows[0]) return null;
    const periodEnd = meta.rows[0].period_end;

    const tb = await tx.query<{ account_code: string; opening: string; closing: string }>(
      `SELECT r.account_code,
              (r.opening_debit - r.opening_credit)::text AS opening,
              (r.opening_debit - r.opening_credit + r.debit - r.credit)::text AS closing
         FROM trial_balance tb
         JOIN trial_balance_version v ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
         JOIN trial_balance_row r ON r.version_id = v.id
        WHERE tb.engagement_id = $1`,
      [engagementId],
    );
    if (tb.rows.length === 0) return null;
    const currentB = aggregate(tb.rows.map((r) => ({ account: r.account_code, value: Number(r.closing) })));
    const priorB = aggregate(tb.rows.map((r) => ({ account: r.account_code, value: Number(r.opening) })));
    const cur = ratioSet(currentB);
    const pri = ratioSet(priorB);

    // GL: last 3 months of sales (70x) and purchases (60x-62x), current year only
    const gl = await tx.query<{ mapping: Record<string, string> | null; id: string }>(
      `SELECT id, mapping FROM sub_ledger_dataset
        WHERE engagement_id = $1 AND kind = 'journal_entries'
        ORDER BY (timing = 'pre_audit') DESC, created_at DESC LIMIT 1`,
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
        const raw = String(v ?? "").trim();
        const m = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
        const d = m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : new Date(raw);
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
    const glNote = "Requires the General Ledger (last 3 months) — upload it in the GL Analyzer";
    cur.dso = sales3m !== null && sales3m > 0 ? Math.round((currentB.receivables / sales3m) * 90) : null;
    cur.dpo = purchases3m !== null && purchases3m > 0 ? Math.round((currentB.payables / purchases3m) * 90) : null;
    pri.dso = null;
    pri.dpo = null;

    const rows: RatioRow[] = DEFS.map((def) => ({
      ...def,
      current: cur[def.key] ?? null,
      prior: pri[def.key] ?? null,
      note: (def.key === "dso" || def.key === "dpo") && sales3m === null ? glNote : undefined,
    }));

    return { rows, glAvailable: sales3m !== null, periodEnd };
  });
}
