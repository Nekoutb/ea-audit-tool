// Assembles the tests-of-details sampling workbook for one side of the
// financial statements: every lead-schedule index of that side, its ledger
// lines, the CRA S3.1 settled for it and the key-item threshold set there,
// through the one plan the screen uses, into the workbook builder.
//
// Nothing is invented: an index S3.1 does not assess gets the default CRA and
// says so on its tab; an index with no ledger line is named on the cover
// rather than silently absent; the ledger the lines came from is named too.
import { jeIdentity, jeKeyColumns } from "@/lib/dataset-mapping";
import { withTenant } from "@/lib/db";
import { getEngagement } from "@/lib/engagements";
import { amountOr } from "@/lib/amount";
import { craBoard, rowWorstTod } from "@/lib/cra";
import { INDEX_SECTION, LEAD_INDEXES, leadIndexFor } from "@/lib/lead-classes";
import { approvedMateriality } from "@/lib/materiality";
import { specificThresholds } from "@/lib/significant-accounts";
import { requireTenant } from "@/lib/tenant";
import { planTod, stableStartFraction, TOD_ASSURANCES, type GlLine, type TodAssurance, type TodCra } from "@/lib/tod-plan";
import { buildTodWorkbook, type FsSide, type TodIndexSheet, type TodSideView } from "@/lib/tod-workbook";

/** Which indexes belong to which side of the statements. */
export function indexesOfSide(side: FsSide): typeof LEAD_INDEXES[number][] {
  return LEAD_INDEXES.filter((d) =>
    side === "bs"
      ? d.accountType === "Assets" || d.accountType === "Liabilities" || d.accountType === "Equity"
      : d.accountType === "Revenues" || d.accountType === "Expenses",
  );
}

/** The CRA an index gets when S3.1 has not assessed it: the middle of the table, never the lightest. */
export const DEFAULT_CRA: TodCra = "moderate";

export interface TodExportOptions {
  side: FsSide;
  assurance?: TodAssurance;
  locale?: "en" | "fr";
  /** reproducible draws, for tests */
  startFraction?: number;
}

export async function todSideView(engagementId: string, options: TodExportOptions): Promise<TodSideView | "no-materiality" | "no-gl" | "no-mapping" | null> {
  const engagement = await getEngagement(engagementId);
  if (!engagement) return null;
  const materiality = await approvedMateriality(engagementId);
  if (!materiality) return "no-materiality";
  const te = materiality.performance;
  const assurance: TodAssurance = TOD_ASSURANCES.includes(options.assurance as TodAssurance) ? (options.assurance as TodAssurance) : "little";
  const locale = options.locale === "fr" ? "fr" : "en";
  const { tenantId, userId } = await requireTenant();

  const board = await craBoard(engagementId);
  // A specific (lower) materiality set on P6.2 drives that account's testing:
  // it caps both the tolerable error and the key-item threshold of its sheet.
  const specificByIndex = await specificThresholds(engagementId);
  const craByIndex = new Map<string, TodCra>();
  const thresholdByIndex = new Map<string, number>();
  for (const row of board.rows) {
    const worst = rowWorstTod(row);
    if (worst) craByIndex.set(row.indexCode, worst);
    if (row.keyItemThreshold && row.keyItemThreshold > 0) thresholdByIndex.set(row.indexCode, row.keyItemThreshold);
  }

  const loaded = await withTenant(tenantId, async (tx) => {
    const gl = await tx.query<{ id: string; mapping: Record<string, string> | null; source_filename: string; source_sha256: string | null }>(
      `SELECT id, mapping, source_filename, source_sha256 FROM sub_ledger_dataset
        WHERE engagement_id = $1 AND kind = 'journal_entries'
        ORDER BY (timing = 'pre_audit') DESC, created_at DESC LIMIT 1`,
      [engagementId],
    );
    if (!gl.rows[0]) return "no-gl" as const;
    const mapping = gl.rows[0].mapping ?? {};
    // A debit/credit pair is as good as a signed amount column (UAT B30) —
    // the importer accepts both, so the workbook has to too.
    const usePair = Boolean(mapping.debit && mapping.credit);
    if (!mapping.account || (!mapping.amount && !usePair)) return "no-mapping" as const;
    const signedOf = (data: Record<string, unknown>): number =>
      usePair
        ? amountOr(data[mapping.debit], 0) - amountOr(data[mapping.credit], 0)
        : amountOr(data[mapping.amount], 0);
    // thresholds set on S3.1 for indexes the board does not list (an account
    // below significance still carries one when set)
    const settings = await tx.query<{ index_code: string; key_item_threshold: string | null }>(
      "SELECT index_code, key_item_threshold FROM cra_index_setting WHERE engagement_id = $1",
      [engagementId],
    );
    for (const s of settings.rows) {
      const v = s.key_item_threshold === null ? 0 : Number(s.key_item_threshold);
      if (v > 0) thresholdByIndex.set(s.index_code, v);
    }
    const meta = await tx.query<{ client_id: string }>("SELECT client_id FROM engagement WHERE id = $1", [engagementId]);
    const over = await tx.query<{ account_prefix: string; index_code: string }>(
      "SELECT account_prefix, index_code FROM client_lead_index_override WHERE client_id = $1",
      [meta.rows[0]?.client_id ?? ""],
    );
    const overrides = over.rows.map((r) => [r.account_prefix, r.index_code] as [string, string]).sort((a, b) => b[0].length - a[0].length);
    const indexOf = (account: string): string | null => {
      for (const [prefix, code] of overrides) if (account.startsWith(prefix)) return code;
      return leadIndexFor(account);
    };
    const preparer = await tx.query<{ who: string }>("SELECT coalesce(name, email) AS who FROM app_user WHERE id = $1", [userId]);
    const tb = await tx.query<{ currency: string }>("SELECT currency FROM trial_balance WHERE engagement_id = $1", [engagementId]);

    const keyCols = jeKeyColumns(mapping);
    const jeHeader = typeof mapping.jeNumber === "string" ? mapping.jeNumber : null;
    const text = (v: unknown): string | null => (v === null || v === undefined ? null : String(v).trim() || null);
    const byIndex = new Map<string, GlLine[]>();
    const rows = await tx.query<{ data: Record<string, unknown> }>("SELECT data FROM sub_ledger_row WHERE dataset_id = $1", [gl.rows[0].id]);
    for (const { data } of rows.rows) {
      const account = String(data[mapping.account] ?? "").trim();
      if (!account) continue;
      const index = indexOf(account);
      if (!index) continue;
      const n = signedOf(data);
      if (!Number.isFinite(n) || n === 0) continue;
      const list = byIndex.get(index) ?? [];
      list.push({
        ref: jeIdentity(data, keyCols, jeHeader, text) ?? account,
        account,
        amount: Math.abs(n),
        description: text(mapping.jeDescription ? data[mapping.jeDescription] : null),
        date: text(mapping.journalDate ? data[mapping.journalDate] : null),
      });
      byIndex.set(index, list);
    }
    return { byIndex, ledgerFilename: gl.rows[0].source_filename, ledgerSha: gl.rows[0].source_sha256 ?? gl.rows[0].id, preparer: preparer.rows[0]?.who ?? null, currency: tb.rows[0]?.currency ?? "XAF" };
  });
  if (typeof loaded === "string") return loaded;

  const sheets: TodIndexSheet[] = [];
  const emptyIndexes: TodSideView["emptyIndexes"] = [];
  for (const def of indexesOfSide(options.side)) {
    const lines = loaded.byIndex.get(def.code) ?? [];
    const labelFr = def.labelFr;
    if (lines.length === 0) {
      emptyIndexes.push({ indexCode: def.code, labelEn: def.labelEn, labelFr });
      continue;
    }
    const cra = craByIndex.get(def.code);
    const threshold = thresholdByIndex.get(def.code);
    const specific = specificByIndex.get(def.code);
    const teForIndex = specific !== undefined ? Math.min(te, specific) : te;
    // capped at the account's TE: a specific figure never lifts the key-item
    // threshold above tolerable error (UAT B43)
    const thresholdForIndex =
      specific !== undefined ? Math.min(threshold ?? teForIndex, teForIndex) : (threshold ?? null);
    sheets.push({
      indexCode: def.code,
      labelEn: def.labelEn,
      labelFr,
      taskCode: INDEX_SECTION[def.code] ?? null,
      cra: cra ?? DEFAULT_CRA,
      craFromS31: cra !== undefined,
      thresholdFromS31: threshold !== undefined,
      assurance,
      // the same ledger, index and engagement draw the same sample on every
      // download; a caller-supplied start (tests) still wins
      plan: planTod({
        lines, te: teForIndex, threshold: thresholdForIndex, cra: cra ?? DEFAULT_CRA, assurance,
        startFraction: options.startFraction ?? stableStartFraction(engagementId, def.code, loaded.ledgerSha),
      }),
    });
  }

  return {
    locale,
    side: options.side,
    clientName: engagement.clientName,
    fiscalYear: engagement.fiscalYear,
    periodEnd: engagement.periodEnd,
    currency: loaded.currency,
    preparer: loaded.preparer,
    te,
    ledgerFilename: loaded.ledgerFilename,
    sheets,
    emptyIndexes,
  };
}

export async function exportTodWorkbook(
  engagementId: string,
  options: TodExportOptions,
): Promise<{ filename: string; content: Buffer } | "no-materiality" | "no-gl" | "no-mapping" | null> {
  const view = await todSideView(engagementId, options);
  if (!view || typeof view === "string") return view;
  const content = await buildTodWorkbook(view);
  const safeClient = view.clientName.replace(/[^\w-]+/g, "_");
  const side = options.side === "bs" ? "balance-sheet" : "income-statement";
  return { filename: `Tests-of-details-${side}-${safeClient}-${view.fiscalYear}.xlsx`, content };
}
