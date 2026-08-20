// P6.2 — significant accounts and disclosures (P6.2): every lead-schedule
// index with its closing balance, the volume of general-ledger lines behind
// it, and its significance. Anything above tolerable error is significant by
// default; overriding that either way needs a written justification.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { LEAD_INDEXES, leadIndexFor } from "@/lib/lead-classes";
import { approvedMateriality } from "@/lib/materiality";
import { riskDerivedAssertions } from "@/lib/risks";
import { amountOr } from "@/lib/amount";

export interface SignificantAccountRow {
  index: string;
  label: string;
  accountType: string;
  accountClass: string;
  closing: number;
  /** general-ledger lines touching the accounts of this index */
  volume: number;
  /** closing balance exceeds the threshold that applies to this index */
  aboveTe: boolean;
  /** a lower specific materiality set for this index, when one exists */
  specificTe: number | null;
  /** the default from the threshold, before any override */
  defaultStatus: "significant" | "not_significant";
  /** the recorded decision (defaults to defaultStatus) */
  status: "significant" | "not_significant";
  /** set when the decision departs from the default */
  overridden: boolean;
  justification: string;
  /** relevant assertions recorded for the index, e.g. ["C","E","V"] */
  assertions: string[];
  /** assertions derived from risks linked to this index in the Risk Console */
  riskAssertions: string[];
  /** a live risk is linked to this index — significance is suggested regardless of size */
  hasRisk: boolean;
  /** a SCOT covers this index (S1.1 register) — the flow of transactions is identified */
  hasScot: boolean;
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
  // assertions the Risk Console derives per index (¶12(h): relevant = has an identified RMM)
  const derived = await riskDerivedAssertions(engagementId);

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
        ORDER BY (timing = 'pre_audit') DESC, created_at DESC LIMIT 1`,
      [engagementId],
    );
    const mapping = gl.rows[0]?.mapping;
    const accountKey = typeof mapping?.account === "string" ? mapping.account : null;
    const volumes = new Map<string, number>();
    let glAvailable = false;
    if (gl.rows[0] && accountKey) {
      glAvailable = true;
      // Count in the database, not in Node. Streaming every sub_ledger_row.data
      // jsonb into memory made an ordinary P6.2/E4 render load the whole general
      // ledger (hundreds of thousands of rows on a real file) inside an open
      // transaction. Grouping by account code returns one row per distinct
      // account — a few hundred at most — and the (tenant_id, dataset_id, row_no)
      // index serves the scan.
      //
      // The mapped column name comes from the uploaded file's header row, i.e.
      // it is user input: it is passed as a bind parameter to the jsonb `->>`
      // operator and never concatenated into the SQL text.
      const grouped = await tx.query<{ account: string; lines: string }>(
        `SELECT btrim(r.data ->> $2::text) AS account, count(*)::text AS lines
           FROM sub_ledger_row r
          WHERE r.dataset_id = $1
            AND btrim(coalesce(r.data ->> $2::text, '')) <> ''
          GROUP BY 1`,
        [gl.rows[0].id, accountKey],
      );
      for (const row of grouped.rows) {
        const index = indexOf(row.account);
        if (!index) continue;
        volumes.set(index, (volumes.get(index) ?? 0) + Number(row.lines));
      }
    }

    // SCOT coverage per index (S1.1 register write-back)
    const scotIdx = await tx.query<{ index_code: string }>(
      `SELECT DISTINCT si.index_code
         FROM scot_index si JOIN scot s ON s.id = si.scot_id
        WHERE s.engagement_id = $1`,
      [engagementId],
    );
    const scotCovered = new Set(scotIdx.rows.map((r) => r.index_code));

    // recorded decisions live with the paper's answers (code "wp:P6.2");
    // specific materiality per index rides with the materiality paper (wp:P6.1)
    const saved = await tx.query<{ code: string; field_key: string; value: string }>(
      `SELECT code, field_key, value #>> '{}' AS value
         FROM form_response WHERE engagement_id = $1 AND code IN ('wp:P6.2', 'wp:P6.1')`,
      [engagementId],
    );
    const decisions = new Map(
      saved.rows.filter((r) => r.code === "wp:P6.2").map((r) => [r.field_key, r.value]),
    );
    const specific = new Map<string, number>();
    for (const r of saved.rows) {
      if (r.code !== "wp:P6.1" || !r.field_key.startsWith("sm_")) continue;
      const amount = amountOr(r.value, 0);
      if (Number.isFinite(amount) && amount > 0) specific.set(r.field_key.slice(3), amount);
    }

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
      // a specific (lower) materiality on the index replaces TE for its default
      const specificTe = specific.get(def.code) ?? null;
      const threshold = specificTe ?? tolerableError;
      const aboveTe = threshold !== null && Math.abs(closing) > threshold;
      // ¶12(k): an index carrying an identified risk is significant regardless of size
      const riskSet = derived.get(def.code);
      const hasRisk = riskSet !== undefined;
      const defaultStatus: SignificantAccountRow["defaultStatus"] =
        aboveTe || hasRisk ? "significant" : "not_significant";
      const recorded = decisions.get(KEY(def.code));
      const status = recorded === "significant" || recorded === "not_significant" ? recorded : defaultStatus;
      const savedAssertions = decisions.get(`${KEY(def.code)}_a`) ?? "";
      rows.push({
        index: def.code,
        label: def.labelEn,
        accountType: def.accountType,
        accountClass: def.accountClass,
        closing,
        volume: volumes.get(def.code) ?? 0,
        aboveTe,
        specificTe,
        defaultStatus,
        status,
        overridden: status !== defaultStatus,
        justification: decisions.get(`${KEY(def.code)}_x`) ?? "",
        assertions: savedAssertions === "" ? [] : savedAssertions.split(","),
        riskAssertions: riskSet ? [...riskSet] : [],
        hasRisk,
        hasScot: scotCovered.has(def.code),
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

/** The specific (lower) materiality amounts recorded per lead index. */
export async function specificThresholds(engagementId: string): Promise<Map<string, number>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ field_key: string; value: string }>(
      `SELECT field_key, value #>> '{}' AS value
         FROM form_response
        WHERE engagement_id = $1 AND code = 'wp:P6.1' AND field_key LIKE 'sm\\_%'`,
      [engagementId],
    );
    const out = new Map<string, number>();
    for (const row of r.rows) {
      const amount = Number(row.value);
      if (Number.isFinite(amount) && amount > 0) out.set(row.field_key.slice(3), amount);
    }
    return out;
  });
}

const ASSERTION_CODES = new Set(["C", "E", "A", "V", "P"]);

/**
 * Persist one index's significance decision, its justification, the relevant
 * assertions, and — when given — its specific materiality (stored with the
 * P6.1 paper, since the threshold belongs to materiality, not to scoping).
 */
export async function saveSignificance(
  engagementId: string,
  index: string,
  status: "significant" | "not_significant",
  justification: string,
  assertions?: string[],
  specificTe?: string,
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!/^[A-Z0-9]{1,4}$/.test(index)) throw new Error("invalid-index");
  const assertionValue =
    assertions === undefined
      ? undefined
      : assertions.filter((a) => ASSERTION_CODES.has(a)).join(",");
  await withTenant(tenantId, async (tx) => {
    if (specificTe !== undefined) {
      const cleaned = specificTe.replace(/[^\d.]/g, "");
      const amount = Number(cleaned);
      if (cleaned === "" || !Number.isFinite(amount) || amount <= 0) {
        await tx.query(
          "DELETE FROM form_response WHERE engagement_id = $1 AND code = 'wp:P6.1' AND field_key = $2",
          [engagementId, `sm_${index}`],
        );
      } else {
        await tx.query(
          `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by)
           VALUES ($1, $2, 'wp:P6.1', $3, to_jsonb($4::text), $5)
           ON CONFLICT (engagement_id, code, field_key)
           DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [tenantId, engagementId, `sm_${index}`, String(Math.round(amount)), userId],
        );
      }
    }
    const pairs: (readonly [string, string])[] = [
      [KEY(index), status],
      [`${KEY(index)}_x`, justification.trim()],
    ];
    if (assertionValue !== undefined) pairs.push([`${KEY(index)}_a`, assertionValue]);
    for (const [key, value] of pairs) {
      if (value === "") {
        await tx.query(
          "DELETE FROM form_response WHERE engagement_id = $1 AND code = 'wp:P6.2' AND field_key = $2",
          [engagementId, key],
        );
        continue;
      }
      await tx.query(
        `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by)
         VALUES ($1, $2, 'wp:P6.2', $3, to_jsonb($4::text), $5)
         ON CONFLICT (engagement_id, code, field_key)
         DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [tenantId, engagementId, key, value, userId],
      );
    }
  });
}
