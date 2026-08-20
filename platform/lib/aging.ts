// Receivables / payables aging from the ingested customer or vendor ledger:
// every transaction is bucketed by the age of its date at the period end, and
// summed per party. The dataset's confirmed column mapping tells us which
// column is the party, the reference, the date and the amount.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { amountOr } from "@/lib/amount";

export interface AgingRow {
  party: string;
  name: string;
  /** the party's first non-empty payment-terms value (only when mapped) */
  terms: string | null;
  current: number;
  d31_60: number;
  d61_90: number;
  over90: number;
  total: number;
}

export interface AgingResult {
  rows: AgingRow[];
  totals: Omit<AgingRow, "party" | "name" | "terms">;
  periodEnd: string;
  transactionCount: number;
  /** transactions skipped because their date could not be read */
  undated: number;
  /** the dataset mapping carries a paymentTerms column */
  hasTerms: boolean;
}

function parseDate(value: unknown): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
    const d = new Date(Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Amounts come from lib/amount.ts — one parser for the whole product. */
function parseAmount(value: unknown): number {
  return amountOr(value, 0);
}

/**
 * Age the latest dataset of `kind` for the engagement. Buckets are measured in
 * days from the transaction date to the period end: Current 0–30, 31–60,
 * 61–90, over 90.
 */
export async function agingFor(
  engagementId: string,
  kind: "ar_open_items" | "ap_open_items",
): Promise<AgingResult | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const meta = await tx.query<{ period_end: string }>(
      "SELECT to_char(period_end, 'YYYY-MM-DD') AS period_end FROM engagement WHERE id = $1",
      [engagementId],
    );
    if (!meta.rows[0]) return null;
    const periodEnd = meta.rows[0].period_end;

    const dataset = await tx.query<{ id: string; mapping: Record<string, string> | null }>(
      `SELECT id, mapping FROM sub_ledger_dataset
        WHERE engagement_id = $1 AND kind = $2
        ORDER BY created_at DESC LIMIT 1`,
      [engagementId, kind],
    );
    const mapping = dataset.rows[0]?.mapping;
    if (!dataset.rows[0] || !mapping?.party || !mapping.amount || !mapping.date) return null;

    const rows = await tx.query<{ data: Record<string, unknown> }>(
      "SELECT data FROM sub_ledger_row WHERE dataset_id = $1",
      [dataset.rows[0].id],
    );

    const end = new Date(periodEnd + "T00:00:00Z");
    const termsColumn = mapping.paymentTerms;
    const byParty = new Map<string, AgingRow>();
    let undated = 0;
    for (const { data } of rows.rows) {
      const party = String(data[mapping.party] ?? "").trim();
      if (!party) continue;
      const date = parseDate(data[mapping.date]);
      if (!date) {
        undated += 1;
        continue;
      }
      const amount = parseAmount(data[mapping.amount]);
      const age = Math.floor((end.getTime() - date.getTime()) / 86_400_000);
      const entry = byParty.get(party) ?? {
        party,
        name: mapping.partyName ? String(data[mapping.partyName] ?? "").trim() || party : party,
        terms: null,
        current: 0,
        d31_60: 0,
        d61_90: 0,
        over90: 0,
        total: 0,
      };
      if (termsColumn && entry.terms === null) {
        const terms = String(data[termsColumn] ?? "").trim();
        if (terms) entry.terms = terms;
      }
      if (age <= 30) entry.current += amount;
      else if (age <= 60) entry.d31_60 += amount;
      else if (age <= 90) entry.d61_90 += amount;
      else entry.over90 += amount;
      entry.total += amount;
      byParty.set(party, entry);
    }

    const result = [...byParty.values()]
      .map((r) => ({
        ...r,
        current: Math.round(r.current),
        d31_60: Math.round(r.d31_60),
        d61_90: Math.round(r.d61_90),
        over90: Math.round(r.over90),
        total: Math.round(r.total),
      }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    const totals = result.reduce(
      (sum, r) => ({
        current: sum.current + r.current,
        d31_60: sum.d31_60 + r.d31_60,
        d61_90: sum.d61_90 + r.d61_90,
        over90: sum.over90 + r.over90,
        total: sum.total + r.total,
      }),
      { current: 0, d31_60: 0, d61_90: 0, over90: 0, total: 0 },
    );

    return { rows: result, totals, periodEnd, transactionCount: rows.rows.length, undated, hasTerms: Boolean(termsColumn) };
  });
}
