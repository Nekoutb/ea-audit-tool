// Analytical procedures over the lead schedules: every account of the
// pre-audit trial balance under its index, closing against the TB's opening
// (the prior-year balance), the movement, the variance — and the auditor's
// commentary, stored per account and per schedule total in form_response
// under the code "ap:<index>".

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { LEAD_INDEXES, leadIndexFor, type LeadIndexDef } from "@/lib/lead-classes";

export interface ApAccountRow {
  account: string;
  name: string;
  closing: number;
  /** the opening balance of the uploaded TB — the prior-year closing */
  prior: number;
  movement: number;
  variancePct: number | null;
}

export interface ApLeadSchedule {
  def: LeadIndexDef;
  accounts: ApAccountRow[];
  closing: number;
  prior: number;
  movement: number;
  variancePct: number | null;
}

const pct = (movement: number, prior: number): number | null =>
  prior !== 0 ? Math.round((movement / Math.abs(prior)) * 1000) / 10 : null;

/** The account-level lead schedules from the current (pre-audit) TB. */
export async function apLeadSchedules(engagementId: string): Promise<ApLeadSchedule[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const meta = await tx.query<{ client_id: string }>(
      "SELECT client_id FROM engagement WHERE id = $1",
      [engagementId],
    );
    if (!meta.rows[0]) return [];
    const rows = await tx.query<{
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
    if (rows.rows.length === 0) return [];
    const idxOver = await tx.query<{ account_prefix: string; index_code: string }>(
      "SELECT account_prefix, index_code FROM client_lead_index_override WHERE client_id = $1",
      [meta.rows[0].client_id],
    );
    const overrides = idxOver.rows
      .map((r) => [r.account_prefix, r.index_code] as [string, string])
      .sort((a, b) => b[0].length - a[0].length);
    const indexOf = (account: string): string | null => {
      for (const [prefix, code] of overrides) if (account.startsWith(prefix)) return code;
      return leadIndexFor(account);
    };

    const byIndex = new Map<string, ApAccountRow[]>();
    for (const row of rows.rows) {
      const index = indexOf(row.account_code);
      if (!index) continue;
      const closing = Math.round(Number(row.closing));
      const prior = Math.round(Number(row.opening));
      const list = byIndex.get(index) ?? [];
      list.push({
        account: row.account_code,
        name: row.account_name ?? "—",
        closing,
        prior,
        movement: closing - prior,
        variancePct: pct(closing - prior, prior),
      });
      byIndex.set(index, list);
    }

    const out: ApLeadSchedule[] = [];
    for (const def of LEAD_INDEXES) {
      const accounts = byIndex.get(def.code);
      if (!accounts) continue;
      const closing = accounts.reduce((sum, a) => sum + a.closing, 0);
      const prior = accounts.reduce((sum, a) => sum + a.prior, 0);
      out.push({
        def,
        accounts,
        closing,
        prior,
        movement: closing - prior,
        variancePct: pct(closing - prior, prior),
      });
    }
    return out;
  });
}

/** Saved commentary, keyed "<index>|<account>" ("total" for the schedule row). */
export async function apComments(engagementId: string): Promise<Record<string, string>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ code: string; field_key: string; value: string }>(
      `SELECT code, field_key, value #>> '{}' AS value
         FROM form_response
        WHERE engagement_id = $1 AND code LIKE 'ap:%'`,
      [engagementId],
    );
    const out: Record<string, string> = {};
    for (const row of r.rows) out[`${row.code.slice(3)}|${row.field_key}`] = row.value;
    return out;
  });
}

/** Upsert the commentary of one lead schedule (empty values clear the cell). */
export async function saveApComments(
  engagementId: string,
  index: string,
  entries: { key: string; value: string }[],
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!/^[A-Z0-9]{1,4}$/.test(index)) throw new Error("invalid-index");
  await withTenant(tenantId, async (tx) => {
    for (const entry of entries) {
      if (!/^[0-9]{1,12}$|^total$/.test(entry.key)) continue;
      if (entry.value.trim() === "") {
        await tx.query(
          "DELETE FROM form_response WHERE engagement_id = $1 AND code = $2 AND field_key = $3",
          [engagementId, `ap:${index}`, entry.key],
        );
      } else {
        await tx.query(
          `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by)
           VALUES ($1, $2, $3, $4, to_jsonb($5::text), $6)
           ON CONFLICT (engagement_id, code, field_key)
           DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [tenantId, engagementId, `ap:${index}`, entry.key, entry.value.trim(), userId],
        );
      }
    }
  });
}
