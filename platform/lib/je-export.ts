// Assembles the E3.1 view from the engagement's own data — the journal entry
// dataset registered against the file, the population checks already run on the
// projection, and one run of the selection engine — and hands it to the workbook
// builder. Nothing is invented here: a field the tool does not capture arrives
// null and becomes an entry cell in the file.
//
// The selection is re-run at export time rather than read back from a stored
// result, because there is nowhere to read it back from: lib/je-selection.ts
// computes and returns, it does not persist. That has a consequence worth being
// plain about — an export taken after the ledger was re-imported reflects the
// ledger as it is now, so the parameters the run used are written onto the
// Criteria tab and the ledger it read onto the Population tab. The workbook can
// then be checked against the file rather than trusted.
//
// A missing ledger is not an error. The paper still exports, saying on its
// Population tab that no dataset is registered and that nothing has been
// selected — which is the true state of the work, and more use to the auditor
// than a 404.

import { withTenant } from "@/lib/db";
import { getEngagement } from "@/lib/engagements";
import { validatePopulation } from "@/lib/gl-line";
import {
  CRITERION_BY_KEY,
  JE_CRITERIA,
  resolveSettings,
  runSelection,
  type CriterionKey,
  type SelectionParams,
  type SelectionResult,
  type UserRule,
  SELECTION_CAP,
} from "@/lib/je-selection";
import {
  buildJeWorkbook,
  type JeCriterion,
  type JeLedger,
  type JePopulationCheck,
  type JeSelectedLine,
  type JeView,
} from "@/lib/je-workbook";
import { requireTenant } from "@/lib/tenant";

export interface JeExportOptions {
  locale?: "en" | "fr";
  /** the dataset to test; the most recent journal entry dataset when absent */
  datasetId?: string;
  /** the criteria the auditor ran; the whole built-in catalogue when absent */
  criteria?: string[];
  params?: SelectionParams;
  userRules?: UserRule[];
  limit?: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The run the studio just made, as export options: the same dataset, criteria,
 * thresholds and rules the auditor saw on screen, so the workbook is the
 * selection they ran and not a fresh one over the whole catalogue. The page
 * size is not carried over — the paper holds the whole selection, up to the
 * engine's own cap, and says on its Selection tab if it had to stop there.
 * Anything malformed falls back to the export's defaults rather than failing:
 * a wrong criterion key is dropped by the engine, a missing dataset means the
 * current ledger.
 */
export function exportOptionsFrom(body: unknown, locale: "en" | "fr"): JeExportOptions {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const datasetId = typeof b.datasetId === "string" && UUID_RE.test(b.datasetId) ? b.datasetId : undefined;
  const criteria = Array.isArray(b.criteria) ? b.criteria.map((k) => String(k)) : undefined;
  const params = b.params && typeof b.params === "object" ? (b.params as SelectionParams) : undefined;
  const userRules = Array.isArray(b.userRules) ? (b.userRules as UserRule[]) : undefined;
  return { locale, datasetId, criteria, params, userRules, limit: SELECTION_CAP };
}

/** Every built-in criterion. "user-defined" is not one of them: it is the shape of a rule the auditor writes. */
const ALL_CRITERIA: CriterionKey[] = JE_CRITERIA
  .map((c) => c.key)
  .filter((key) => key !== "user-defined");

interface DatasetRow {
  id: string;
  timing: string;
  source_filename: string;
  row_count: number;
}

export async function jeView(
  engagementId: string,
  options: JeExportOptions = {},
): Promise<JeView | null> {
  const { tenantId } = await requireTenant();
  const engagement = await getEngagement(engagementId);
  if (!engagement) return null;

  const locale = options.locale === "fr" ? "fr" : "en";
  const fr = locale === "fr";
  const t = (en: string, frText: string): string => (fr ? frText : en);

  const meta = await withTenant(tenantId, async (tx) => {
    // The current-year ledger, preferring the post-audit extract over the
    // pre-audit one exactly as lib/gl-insights.ts does, so the paper and the
    // analytics never quietly read different datasets.
    const datasets = await tx.query<DatasetRow>(
      `SELECT id::text AS id, timing, source_filename, row_count
         FROM sub_ledger_dataset
        WHERE engagement_id = $1 AND kind = 'journal_entries'
        ORDER BY created_at DESC`,
      [engagementId],
    );
    const rows = datasets.rows;
    const chosen = options.datasetId
      ? rows.find((r) => r.id === options.datasetId)
      : rows.find((r) => r.timing === "post_audit")
        ?? rows.find((r) => r.timing === "pre_audit")
        ?? rows.find((r) => r.timing !== "prior_year");

    const signoffs = await tx.query<{ role: string; who: string }>(
      `SELECT s.role, coalesce(u.name, u.email) AS who
         FROM file_item fi
         JOIN document d ON d.file_item_id = fi.id AND d.kind = 'workpaper'
         JOIN signoff s ON s.document_id = d.id AND s.voided_at IS NULL
         JOIN app_user u ON u.id = s.user_id
        WHERE fi.engagement_id = $1 AND fi.code = 'E3.1'`,
      [engagementId],
    );
    const by = (role: string) => signoffs.rows.find((r) => r.role === role)?.who ?? null;
    return {
      dataset: chosen ?? null,
      preparer: by("preparer"),
      reviewer: by("reviewer"),
      partner: by("partner"),
    };
  });

  const settings = resolveSettings({ ...options.params, locale });
  const base = {
    locale,
    clientName: engagement.clientName,
    fiscalYear: engagement.fiscalYear,
    periodEnd: engagement.periodEnd,
    preparer: meta.preparer,
    reviewer: meta.reviewer,
    partner: meta.partner,
    dateBasis: settings.dateBasis,
  } satisfies Partial<JeView>;

  if (!meta.dataset) {
    return {
      ...base,
      ledger: null,
      populationChecks: [],
      criteria: [],
      selectedEntries: 0,
      selectedLines: 0,
      lines: [],
      exceptions: [],
      notes: [
        t(
          "No journal entry dataset is registered on this engagement, so no selection has been run.",
          "Aucun jeu de données d'écritures n'est enregistré sur cette mission : aucune sélection n'a donc été exécutée.",
        ),
      ],
      ceilingHit: false,
      truncated: false,
    };
  }

  const criteria = Array.isArray(options.criteria) && options.criteria.length > 0
    ? options.criteria
    : ALL_CRITERIA;

  const selection: SelectionResult = await runSelection(engagementId, meta.dataset.id, {
    criteria,
    params: { ...options.params, locale },
    userRules: options.userRules,
    limit: options.limit,
  });

  // The population checks are the automated half of establishing completeness
  // and accuracy; the auditor's own work is the other half, and the Population
  // tab keeps a block of entry cells for it. A dataset that has never been
  // projected has nothing to check, and saying so beats an empty table.
  let populationChecks: JePopulationCheck[] = [];
  try {
    const validation = await validatePopulation(engagementId, meta.dataset.id);
    populationChecks = validation.checks.map((check) => ({
      key: check.key,
      label: fr ? check.labelFr : check.labelEn,
      status: check.status,
      detail: fr ? check.detailFr : check.detailEn,
    }));
  } catch {
    populationChecks = [];
  }

  const ledger: JeLedger = {
    sourceFilename: meta.dataset.source_filename,
    timing: meta.dataset.timing,
    datasetRows: meta.dataset.row_count,
    lines: selection.population.lines,
    entries: selection.population.entries,
    datedLines: selection.population.datedLines,
  };

  const criterionRows: JeCriterion[] = selection.criteria.map((coverage) => {
    // A rule the auditor wrote carries the catalogue's own account of why the
    // product offers custom rules at all; the reason THIS rule was written is
    // the entry column beside it, which only the auditor can fill.
    const def = CRITERION_BY_KEY[coverage.key] ?? CRITERION_BY_KEY["user-defined"];
    return {
      key: coverage.key,
      name: coverage.name,
      description: coverage.description,
      rationale: fr ? def.rationaleFr : def.rationaleEn,
      settings: coverage.settings,
      matchedEntries: coverage.matchedEntries,
      matchedLines: coverage.matchedLines,
    };
  });

  const lines: JeSelectedLine[] = selection.lines.map((line) => ({
    jeNumber: line.jeNumber,
    lineNo: line.lineNo,
    journalCode: line.journalCode,
    journalDate: line.journalDate,
    entryDate: line.entryDate,
    account: line.account,
    accountName: line.accountName,
    description: (line.lineDescription ?? "").trim() || line.jeDescription,
    debit: line.debit,
    credit: line.credit,
    signed: line.signed,
    preparer: line.preparer,
    reviewer: line.reviewer,
    approver: line.approver,
    reference: line.reference,
    thirdPartyName: line.thirdPartyName,
    costCenter: line.costCenter,
    entryLines: line.entryLines,
    entryGrossValue: line.entryGrossValue,
    reasons: line.reasons.map((reason) => ({ label: reason.label, detail: reason.detail })),
  }));

  return {
    ...base,
    ledger,
    populationChecks,
    criteria: criterionRows,
    selectedEntries: selection.selectedEntries,
    selectedLines: selection.selectedLines,
    lines,
    // Exceptions are the auditor's conclusion on an item tested, and no test has
    // been performed at the moment of export. The tab ships with its columns and
    // its analysis prompts, and the rows are written by whoever does the work.
    exceptions: [],
    notes: selection.notes,
    ceilingHit: selection.ceilingHit,
    truncated: selection.truncated,
  };
}

export async function exportJeWorkbook(
  engagementId: string,
  options: JeExportOptions = {},
): Promise<{ filename: string; content: Buffer } | null> {
  const view = await jeView(engagementId, options);
  if (!view) return null;
  const content = await buildJeWorkbook(view);
  const safeClient = view.clientName.replace(/[^\w-]+/g, "_");
  return { filename: `E3.1-journal-entries-${safeClient}-${view.fiscalYear}.xlsx`, content };
}
