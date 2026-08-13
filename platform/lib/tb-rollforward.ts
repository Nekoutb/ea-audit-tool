// Trial-balance roll-forward reconciliation: for every account,
//   opening balance per TB  +  net movements per general ledger
//     =  expected closing  vs  closing balance per TB   →  variance (nil).
// The GL side uses the confirmed column mapping of the ingested journal-entries
// dataset; accounts present in only one source still appear, so nothing hides.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export interface RollForwardRow {
  account: string;
  name: string;
  opening: number;
  glMovement: number;
  expected: number;
  closing: number;
  variance: number;
}

export interface RollForwardResult {
  rows: RollForwardRow[];
  totals: { opening: number; glMovement: number; expected: number; closing: number; variance: number };
  reconciled: boolean;
  exceptions: number;
  glRowCount: number;
}

function parseAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value ?? "")
    .replace(/[\s  ]/g, "")
    .replace(/,(?=\d{1,2}$)/, ".")
    .replace(/,/g, "");
  if (cleaned === "" || cleaned === "-") return 0;
  const negative = cleaned.startsWith("(") && cleaned.endsWith(")");
  const parsed = Number(cleaned.replace(/[()]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

/** Null when there is no valid TB or no ingested general ledger to reconcile against. */
export async function rollForward(engagementId: string): Promise<RollForwardResult | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const tb = await tx.query<{
      account_code: string;
      account_name: string | null;
      opening: string;
      closing: string;
    }>(
      `SELECT r.account_code, r.account_name,
              (r.opening_debit - r.opening_credit)::text AS opening,
              (r.opening_debit - r.opening_credit + r.debit - r.credit)::text AS closing
         FROM trial_balance tb
         JOIN trial_balance_version v ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
         JOIN trial_balance_row r ON r.version_id = v.id
        WHERE tb.engagement_id = $1
        ORDER BY r.account_code`,
      [engagementId],
    );
    if (tb.rows.length === 0) return null;

    const gl = await tx.query<{ id: string; mapping: Record<string, string> | null }>(
      `SELECT id, mapping FROM sub_ledger_dataset
        WHERE engagement_id = $1 AND kind = 'journal_entries'
        ORDER BY created_at DESC LIMIT 1`,
      [engagementId],
    );
    const mapping = gl.rows[0]?.mapping;
    if (!gl.rows[0] || !mapping?.account || !mapping.amount) return null;

    const glRows = await tx.query<{ data: Record<string, unknown> }>(
      "SELECT data FROM sub_ledger_row WHERE dataset_id = $1",
      [gl.rows[0].id],
    );
    const movements = new Map<string, number>();
    for (const { data } of glRows.rows) {
      const account = String(data[mapping.account] ?? "").trim();
      if (!account) continue;
      movements.set(account, (movements.get(account) ?? 0) + parseAmount(data[mapping.amount]));
    }

    const names = new Map<string, string>();
    const rows: RollForwardRow[] = [];
    const seen = new Set<string>();
    for (const row of tb.rows) {
      const account = row.account_code;
      seen.add(account);
      names.set(account, row.account_name ?? "—");
      const opening = Math.round(Number(row.opening));
      const closing = Math.round(Number(row.closing));
      const glMovement = Math.round(movements.get(account) ?? 0);
      const expected = opening + glMovement;
      rows.push({
        account,
        name: row.account_name ?? "—",
        opening,
        glMovement,
        expected,
        closing,
        variance: expected - closing,
      });
    }
    // accounts posted in the ledger but absent from the trial balance
    for (const [account, movement] of movements) {
      if (seen.has(account)) continue;
      const glMovement = Math.round(movement);
      rows.push({
        account,
        name: names.get(account) ?? "— (not in trial balance)",
        opening: 0,
        glMovement,
        expected: glMovement,
        closing: 0,
        variance: glMovement,
      });
    }
    rows.sort((a, b) => a.account.localeCompare(b.account));

    const totals = rows.reduce(
      (sum, r) => ({
        opening: sum.opening + r.opening,
        glMovement: sum.glMovement + r.glMovement,
        expected: sum.expected + r.expected,
        closing: sum.closing + r.closing,
        variance: sum.variance + r.variance,
      }),
      { opening: 0, glMovement: 0, expected: 0, closing: 0, variance: 0 },
    );
    const exceptions = rows.filter((r) => Math.abs(r.variance) > 0.5).length;

    return { rows, totals, reconciled: exceptions === 0, exceptions, glRowCount: glRows.rows.length };
  });
}
