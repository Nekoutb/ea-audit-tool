// P6.2 — significant accounts and disclosures (D5.8): every lead-schedule
// index with its closing balance, the volume of general-ledger lines behind
// it, and its significance. Anything above tolerable error is significant by
// default; overriding that either way needs a written justification.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { LEAD_INDEXES, leadIndexFor } from "@/lib/lead-classes";
import { approvedMateriality } from "@/lib/materiality";

export interface SignificantAccountRow {
  index: string;
  label: string;
  accountType: string;
  accountClass: string;
  closing: number;
  /** general-ledger lines touching the accounts of this index */
  volume: number;
  /** closing balance exceeds tolerable error */
  aboveTe: boolean;
  /** the default from the threshold, before any override */
  defaultStatus: "significant" | "not_significant";
  /** the recorded decision (defaults to defaultStatus) */
  status: "significant" | "not_significant";
  /** set when the decision departs from the default */
  overridden: boolean;
  justification: string;
}

export interface SignificantAccountsView {
  rows: SignificantAccountRow[];
  tolerableError: number | null;
  totalClosing: number;
  significantCount: number;
  /** overrides still missing their justification */
  unjustified: number;
  glAvailable: boolean;
}

const KEY = (index: string) => `sa_${index}`;

export async function significantAccounts(engagementId: string): Promise<SignificantAccountsView | null> {
  const { tenantId } = await requireTenant();
  const materiality = await approvedMateriality(engagementId);
  const tolerableError = materiality?.performance ?? null;

  return withTenant(tenantId, async (tx) => {
    const meta = await tx.query<{ client_id: string }>(
      "SELECT client_id FROM engagement WHERE id = $1",
      [engagementId],
    );
    if (!meta.rows[0]) return null;

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

    const over = await tx.query<{ account_prefix: string; index_code: string }>(
      "SELECT account_prefix, index_code FROM client_lead_index_override WHERE client_id = $1",
      [meta.rows[0].client_id],
    );
    const overrides = over.rows
      .map((r) => [r.account_prefix, r.index_code] as [string, string])
      .sort((a, b) => b[0].length - a[0].length);
    const indexOf = (account: string): string | null => {
      for (const [prefix, code] of overrides) if (account.startsWith(prefix)) return code;
      return leadIndexFor(account);
    };

    // general-ledger line volume per index
    const gl = await tx.query<{ id: string; mapping: Record<string, string> | null }>(
      `SELECT id, mapping FROM sub_ledger_dataset
        WHERE engagement_id = $1 AND kind = 'journal_entries'
        ORDER BY created_at DESC LIMIT 1`,
      [engagementId],
    );
    const mapping = gl.rows[0]?.mapping;
    const volumes = new Map<string, number>();
    let glAvailable = false;
    if (gl.rows[0] && mapping?.account) {
      glAvailable = true;
      const lines = await tx.query<{ data: Record<string, unknown> }>(
        "SELECT data FROM sub_ledger_row WHERE dataset_id = $1",
        [gl.rows[0].id],
      );
      for (const { data } of lines.rows) {
        const account = String(data[mapping.account] ?? "").trim();
        if (!account) continue;
        const index = indexOf(account);
        if (!index) continue;
        volumes.set(index, (volumes.get(index) ?? 0) + 1);
      }
    }

    // recorded decisions live with the paper's answers (code "wp:D5.8")
    const saved = await tx.query<{ field_key: string; value: string }>(
      `SELECT field_key, value #>> '{}' AS value
         FROM form_response WHERE engagement_id = $1 AND code = 'wp:D5.8'`,
      [engagementId],
    );
    const decisions = new Map(saved.rows.map((r) => [r.field_key, r.value]));

    const closings = new Map<string, number>();
    for (const row of tb.rows) {
      const index = indexOf(row.account_code);
      if (!index) continue;
      closings.set(index, (closings.get(index) ?? 0) + Number(row.closing));
    }

    const rows: SignificantAccountRow[] = [];
    for (const def of LEAD_INDEXES) {
      if (!closings.has(def.code)) continue;
      const closing = Math.round(closings.get(def.code) ?? 0);
      const aboveTe = tolerableError !== null && Math.abs(closing) > tolerableError;
      const defaultStatus: SignificantAccountRow["defaultStatus"] = aboveTe ? "significant" : "not_significant";
      const recorded = decisions.get(KEY(def.code));
      const status = recorded === "significant" || recorded === "not_significant" ? recorded : defaultStatus;
      rows.push({
        index: def.code,
        label: def.labelEn,
        accountType: def.accountType,
        accountClass: def.accountClass,
        closing,
        volume: volumes.get(def.code) ?? 0,
        aboveTe,
        defaultStatus,
        status,
        overridden: status !== defaultStatus,
        justification: decisions.get(`${KEY(def.code)}_x`) ?? "",
      });
    }

    return {
      rows,
      tolerableError,
      totalClosing: rows.reduce((sum, r) => sum + r.closing, 0),
      significantCount: rows.filter((r) => r.status === "significant").length,
      unjustified: rows.filter((r) => r.overridden && r.justification.trim() === "").length,
      glAvailable,
    };
  });
}

/** Persist one index's significance decision and its justification. */
export async function saveSignificance(
  engagementId: string,
  index: string,
  status: "significant" | "not_significant",
  justification: string,
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!/^[A-Z0-9]{1,4}$/.test(index)) throw new Error("invalid-index");
  await withTenant(tenantId, async (tx) => {
    for (const [key, value] of [
      [KEY(index), status],
      [`${KEY(index)}_x`, justification.trim()],
    ] as const) {
      if (value === "") {
        await tx.query(
          "DELETE FROM form_response WHERE engagement_id = $1 AND code = 'wp:D5.8' AND field_key = $2",
          [engagementId, key],
        );
        continue;
      }
      await tx.query(
        `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by)
         VALUES ($1, $2, 'wp:D5.8', $3, to_jsonb($4::text), $5)
         ON CONFLICT (engagement_id, code, field_key)
         DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [tenantId, engagementId, key, value, userId],
      );
    }
  });
}
