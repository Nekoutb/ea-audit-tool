// Build and validate the typed general-ledger line projection (gl_line).
//
// The imported ledger lives in sub_ledger_row as jsonb keyed by the source
// file's own headers. That is the right shape for provenance and the wrong
// shape for analysis: nothing is typed, nothing is indexed, and every aggregate
// would have to stream the whole ledger into Node. buildProjection reads that
// ledger ONCE, in bounded batches, and writes a typed row per line into
// gl_line; from there every analytic in lib/gl-analytics.ts and
// lib/gl-correlation.ts is a SQL aggregate over an indexed table.
//
// Amount convention, applied here and never reversed downstream:
//   signed = debit - credit   -> debits positive, credits negative.
// If the dataset maps a debit and a credit column, both are read and signed is
// derived. If it maps only a single amount column, that value is taken as
// already signed and split back into debit/credit by its sign.

import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { parseAmount } from "@/lib/amount";

type Tx = PoolClient;

/** Rows pulled out of sub_ledger_row per round trip. Bounded on purpose. */
const BATCH = 2000;

/** Debit/credit reconciliation tolerance, in currency units. */
export const TOLERANCE = 0.005;

export interface BuildResult {
  /** rows written to gl_line for this dataset */
  lines: number;
  /** imported rows skipped because account or JE number was empty */
  rejected: number;
  /** true when gl_line already held the projection and nothing was rebuilt */
  reused: boolean;
}

export interface GlDatasetMeta {
  id: string;
  engagementId: string;
  mapping: Record<string, string>;
  rowCount: number;
  sourceFilename: string;
}

// ---------------------------------------------------------------------------
// value parsing

/**
 * Locale-safe number parsing. Handles "1,234.56" (anglo) and "1 234,56" /
 * "1 234,56" (francophone, ordinary and narrow no-break spaces), plus
 * accounting parentheses for negatives. Same approach as lib/tb-rollforward.ts
 * — deliberately NOT a naive strip of every non-digit, which turns "1,234.56"
 * into 1.23456e5 nonsense on one locale or the other.
 */
/**
 * Amounts come from lib/amount.ts. Re-exported here because callers import it
 * from this module; the implementation is shared so the GL projection and the
 * trial balance can never disagree about what a figure means.
 */
export { parseAmount };

/** Excel's day 0 is 1899-12-30 (its 1900 leap-year bug included). */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const stamp = Date.UTC(y, m - 1, d);
  const date = new Date(stamp);
  if (Number.isNaN(stamp)) return null;
  // reject 31/02 and friends rather than let JS roll them forward
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Tolerant date parsing in the style of lib/aging.ts, widened for the formats a
 * client ledger export actually carries: ISO (yyyy-mm-dd), dd/mm/yyyy,
 * mm/dd/yyyy and Excel serial numbers. Ambiguous d/m pairs resolve to
 * day-first (the francophone default) unless the second component is > 12, in
 * which case the file is unambiguously month-first. Anything unreadable returns
 * null — a null date is honest, a guessed date is not.
 */
export function parseDateIso(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) return fromSerial(value);
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/);
  if (isoMatch) return iso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));

  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
    // second > 12 -> the file is month-first; otherwise day-first
    return second > 12 ? iso(year, first, second) : iso(year, second, first);
  }

  // bare Excel serial arriving as text
  if (/^\d+(\.\d+)?$/.test(raw)) return fromSerial(Number(raw));

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function fromSerial(serial: number): string | null {
  // 1 = 1899-12-31, ~2958465 = 9999-12-31. Outside that it is not a date.
  if (!Number.isFinite(serial) || serial < 1 || serial > 2_958_465) return null;
  const date = new Date(EXCEL_EPOCH + Math.floor(serial) * 86_400_000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/**
 * Neutralise spreadsheet formula injection. A cell that starts with =, +, - or
 * @ is executed as a formula when the projection is later exported back to
 * .csv/.xlsx and opened; prefixing a single quote makes it inert text without
 * losing the original characters.
 */
export function safeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
}

// ---------------------------------------------------------------------------
// dataset lookup

/** The engagement's GL dataset, or null. Throws nothing — callers decide. */
export async function glDataset(
  tx: Tx,
  engagementId: string,
  datasetId: string,
): Promise<GlDatasetMeta | null> {
  const result = await tx.query<{
    id: string;
    mapping: Record<string, string> | null;
    row_count: number;
    source_filename: string;
  }>(
    `SELECT id, mapping, row_count, source_filename
       FROM sub_ledger_dataset
      WHERE id = $1 AND engagement_id = $2 AND kind = 'journal_entries'`,
    [datasetId, engagementId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    engagementId,
    mapping: row.mapping ?? {},
    rowCount: row.row_count,
    sourceFilename: row.source_filename,
  };
}

/** Which gl_line columns a mapping can actually feed. */
export function mappedFields(mapping: Record<string, string>): Set<string> {
  const set = new Set<string>();
  for (const [key, header] of Object.entries(mapping)) {
    if (typeof header === "string" && header.trim()) set.add(key);
  }
  // preparer is fed by preparedBy, falling back to recordedBy
  if (set.has("preparedBy") || set.has("recordedBy")) set.add("preparer");
  // a signed amount exists when either a single amount column or the pair is mapped
  if (set.has("amount") || (set.has("debit") && set.has("credit"))) set.add("signedAmount");
  return set;
}

// ---------------------------------------------------------------------------
// projection build

interface Column {
  lineNo: number[];
  account: (string | null)[];
  accountName: (string | null)[];
  jeNumber: (string | null)[];
  journalCode: (string | null)[];
  jeDescription: (string | null)[];
  lineDescription: (string | null)[];
  journalDate: (string | null)[];
  entryDate: (string | null)[];
  debit: number[];
  credit: number[];
  signed: number[];
  reference: (string | null)[];
  thirdPartyCode: (string | null)[];
  thirdPartyName: (string | null)[];
  preparer: (string | null)[];
  reviewer: (string | null)[];
  approver: (string | null)[];
  costCenter: (string | null)[];
}

function emptyColumns(): Column {
  return {
    lineNo: [], account: [], accountName: [], jeNumber: [], journalCode: [],
    jeDescription: [], lineDescription: [], journalDate: [], entryDate: [],
    debit: [], credit: [], signed: [], reference: [], thirdPartyCode: [],
    thirdPartyName: [], preparer: [], reviewer: [], approver: [], costCenter: [],
  };
}

const INSERT_SQL = `
  INSERT INTO gl_line (
    tenant_id, engagement_id, dataset_id, line_no, account, account_name, je_number,
    journal_code, je_description, line_description, journal_date, entry_date,
    debit, credit, signed, reference, third_party_code, third_party_name,
    preparer, reviewer, approver, cost_center)
  SELECT $1::uuid, $2::uuid, $3::uuid, t.*
    FROM unnest(
           $4::int[],  $5::text[],  $6::text[],  $7::text[],  $8::text[],
           $9::text[], $10::text[], $11::date[], $12::date[], $13::numeric[],
          $14::numeric[], $15::numeric[], $16::text[], $17::text[], $18::text[],
          $19::text[], $20::text[], $21::text[], $22::text[]
         ) AS t(line_no, account, account_name, je_number, journal_code,
                je_description, line_description, journal_date, entry_date, debit,
                credit, signed, reference, third_party_code, third_party_name,
                preparer, reviewer, approver, cost_center)
   ON CONFLICT (dataset_id, line_no) DO NOTHING`;

/**
 * Project the imported GL into gl_line. Idempotent: if the projection already
 * exists for this dataset the existing row count is returned untouched (drop
 * and re-import the dataset to rebuild — sub_ledger_dataset cascades).
 *
 * Memory profile is bounded by BATCH regardless of ledger size: one batch of
 * jsonb rows is read, converted to typed column arrays, inserted as a single
 * unnest INSERT, then released.
 */
export async function buildProjection(engagementId: string, datasetId: string): Promise<BuildResult> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const dataset = await glDataset(tx, engagementId, datasetId);
    if (!dataset) throw new Error("no-dataset");

    const existing = await tx.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM gl_line WHERE dataset_id = $1 AND engagement_id = $2",
      [datasetId, engagementId],
    );
    const already = Number(existing.rows[0]?.n ?? 0);
    if (already > 0) return { lines: already, rejected: 0, reused: true };

    const m = dataset.mapping;
    const col = (key: string): string | null => {
      const header = m[key];
      return typeof header === "string" && header.trim() ? header : null;
    };
    const cAccount = col("account");
    const cAccountName = col("accountName");
    const cJe = col("jeNumber");
    const cJournalCode = col("journalCode");
    const cJeDesc = col("jeDescription");
    const cLineDesc = col("lineDescription");
    const cJournalDate = col("journalDate");
    const cEntryDate = col("jeDate");
    const cDebit = col("debit");
    const cCredit = col("credit");
    const cAmount = col("amount");
    const cReference = col("reference");
    const cTpCode = col("thirdPartyCode");
    const cTpName = col("thirdPartyName");
    const cPreparer = col("preparedBy") ?? col("recordedBy");
    const cReviewer = col("reviewer");
    const cApprover = col("approvedBy");
    const cCostCenter = col("costCenter");
    if (!cAccount || !cJe) throw new Error("mapping-incomplete");
    // the pair wins over a single amount column: when both sides are present in
    // the file they are the authoritative debit/credit split
    const usePair = Boolean(cDebit && cCredit);

    const pick = (data: Record<string, unknown>, header: string | null): unknown =>
      header === null ? null : data[header];

    let lines = 0;
    let rejected = 0;
    let after = 0;

    for (;;) {
      const batch = await tx.query<{ row_no: number; data: Record<string, unknown> }>(
        `SELECT row_no, data FROM sub_ledger_row
          WHERE dataset_id = $1 AND row_no > $2
          ORDER BY row_no
          LIMIT ${BATCH}`,
        [datasetId, after],
      );
      if (batch.rows.length === 0) break;
      after = batch.rows[batch.rows.length - 1].row_no;

      const c = emptyColumns();
      for (const row of batch.rows) {
        const data = row.data ?? {};
        const account = safeText(pick(data, cAccount));
        const jeNumber = safeText(pick(data, cJe));
        // account and JE number are the spine of every analytic; a line without
        // either cannot be attributed, so it is rejected and counted rather
        // than projected under a blank key
        if (!account || !jeNumber) {
          rejected += 1;
          continue;
        }

        let debit = 0;
        let credit = 0;
        if (usePair) {
          debit = parseAmount(pick(data, cDebit)) ?? 0;
          credit = parseAmount(pick(data, cCredit)) ?? 0;
        } else {
          const signed = parseAmount(pick(data, cAmount)) ?? 0;
          if (signed >= 0) debit = signed;
          else credit = -signed;
        }
        const signed = debit - credit;

        c.lineNo.push(row.row_no);
        c.account.push(account);
        c.accountName.push(safeText(pick(data, cAccountName)));
        c.jeNumber.push(jeNumber);
        c.journalCode.push(safeText(pick(data, cJournalCode)));
        c.jeDescription.push(safeText(pick(data, cJeDesc)));
        c.lineDescription.push(safeText(pick(data, cLineDesc)));
        c.journalDate.push(parseDateIso(pick(data, cJournalDate)));
        c.entryDate.push(parseDateIso(pick(data, cEntryDate)));
        c.debit.push(debit);
        c.credit.push(credit);
        c.signed.push(signed);
        c.reference.push(safeText(pick(data, cReference)));
        c.thirdPartyCode.push(safeText(pick(data, cTpCode)));
        c.thirdPartyName.push(safeText(pick(data, cTpName)));
        c.preparer.push(safeText(pick(data, cPreparer)));
        c.reviewer.push(safeText(pick(data, cReviewer)));
        c.approver.push(safeText(pick(data, cApprover)));
        c.costCenter.push(safeText(pick(data, cCostCenter)));
      }

      if (c.lineNo.length > 0) {
        await tx.query(INSERT_SQL, [
          tenantId, engagementId, datasetId,
          c.lineNo, c.account, c.accountName, c.jeNumber, c.journalCode,
          c.jeDescription, c.lineDescription, c.journalDate, c.entryDate, c.debit,
          c.credit, c.signed, c.reference, c.thirdPartyCode, c.thirdPartyName,
          c.preparer, c.reviewer, c.approver, c.costCenter,
        ]);
        lines += c.lineNo.length;
      }
      if (batch.rows.length < BATCH) break;
    }

    return { lines, rejected, reused: false };
  });
}

// ---------------------------------------------------------------------------
// population validation

export type CheckStatus = "passed" | "warning" | "failed";

export interface ValidationCheck {
  key: string;
  labelEn: string;
  labelFr: string;
  status: CheckStatus;
  detailEn: string;
  detailFr: string;
}

export interface ValidationResult {
  checks: ValidationCheck[];
  /** worst status across the checks */
  status: CheckStatus;
  lines: number;
  /** rows in the imported dataset, for the completeness check */
  sourceRows: number;
  passed: number;
  warnings: number;
  failed: number;
}

const nf = (value: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

/**
 * Does the projected population hold together? Every check is a SQL aggregate
 * over gl_line — nothing is streamed into Node. A "failed" check means the
 * population cannot be relied on as-is; a "warning" means it is usable but the
 * auditor must consider the exception.
 */
export async function validatePopulation(
  engagementId: string,
  datasetId: string,
): Promise<ValidationResult> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const dataset = await glDataset(tx, engagementId, datasetId);
    if (!dataset) throw new Error("no-dataset");
    const fields = mappedFields(dataset.mapping);

    const period = await tx.query<{ start: string | null; end: string | null }>(
      `SELECT to_char(period_end - interval '1 year' + interval '1 day', 'YYYY-MM-DD') AS start,
              to_char(period_end, 'YYYY-MM-DD') AS end
         FROM engagement WHERE id = $1`,
      [engagementId],
    );
    const periodStart = period.rows[0]?.start ?? null;
    const periodEnd = period.rows[0]?.end ?? null;

    const agg = await tx.query<{
      lines: string;
      no_account: string;
      no_je: string;
      no_desc: string;
      no_date: string;
      zero_amount: string;
      total_debit: string;
      total_credit: string;
      out_of_period: string;
      entries: string;
    }>(
      `SELECT count(*)::text                                                   AS lines,
              count(*) FILTER (WHERE coalesce(trim(account), '') = '')::text   AS no_account,
              count(*) FILTER (WHERE coalesce(trim(je_number), '') = '')::text AS no_je,
              count(*) FILTER (WHERE coalesce(trim(je_description), '') = '')::text AS no_desc,
              count(*) FILTER (WHERE journal_date IS NULL)::text               AS no_date,
              count(*) FILTER (WHERE debit = 0 AND credit = 0)::text           AS zero_amount,
              coalesce(sum(debit), 0)::text                                    AS total_debit,
              coalesce(sum(credit), 0)::text                                   AS total_credit,
              count(*) FILTER (
                WHERE journal_date IS NOT NULL
                  AND ($3::date IS NULL OR journal_date < $3::date OR journal_date > $4::date)
              )::text                                                          AS out_of_period,
              count(DISTINCT je_number)::text                                  AS entries
         FROM gl_line WHERE dataset_id = $1 AND engagement_id = $2`,
      [datasetId, engagementId, periodStart, periodEnd],
    );
    const a = agg.rows[0];
    const lines = Number(a?.lines ?? 0);
    const totalDebit = Number(a?.total_debit ?? 0);
    const totalCredit = Number(a?.total_credit ?? 0);
    const entries = Number(a?.entries ?? 0);

    const unbalanced = await tx.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM (
         SELECT je_number FROM gl_line
          WHERE dataset_id = $1 AND engagement_id = $2
          GROUP BY je_number HAVING abs(sum(signed)) > $3) q`,
      [datasetId, engagementId, TOLERANCE],
    );

    const dupes = await tx.query<{ groups: string; extra: string }>(
      `SELECT count(*)::text AS groups, coalesce(sum(n - 1), 0)::text AS extra FROM (
         SELECT count(*) AS n FROM gl_line
          WHERE dataset_id = $1 AND engagement_id = $2
          GROUP BY account, je_number, journal_date, coalesce(reference, ''),
                   signed, coalesce(je_description, '')
         HAVING count(*) > 1) q`,
      [datasetId, engagementId],
    );

    const checks: ValidationCheck[] = [];
    const push = (
      key: string, labelEn: string, labelFr: string,
      status: CheckStatus, detailEn: string, detailFr: string,
    ) => { checks.push({ key, labelEn, labelFr, status, detailEn, detailFr }); };

    // 1. mandatory fields mapped
    const mandatory = ["account", "jeNumber", "jeDescription", "journalDate"];
    const missingMap = mandatory.filter((f) => !fields.has(f));
    if (!fields.has("signedAmount")) missingMap.push("amount");
    push(
      "mandatory-mapped", "Mandatory fields mapped", "Champs obligatoires mappés",
      missingMap.length === 0 ? "passed" : "failed",
      missingMap.length === 0
        ? "Account, JE number, description, journal date and amount are all mapped."
        : `Not mapped: ${missingMap.join(", ")}.`,
      missingMap.length === 0
        ? "Compte, numéro d'écriture, libellé, date du journal et montant sont tous mappés."
        : `Non mappés : ${missingMap.join(", ")}.`,
    );

    // 2. account populated
    const noAccount = Number(a?.no_account ?? 0);
    push(
      "account-populated", "Account populated on every line", "Compte renseigné sur chaque ligne",
      noAccount === 0 ? "passed" : "failed",
      noAccount === 0 ? `All ${nf(lines)} lines carry an account.` : `${nf(noAccount)} lines carry no account.`,
      noAccount === 0 ? `Les ${nf(lines)} lignes portent un compte.` : `${nf(noAccount)} lignes sans compte.`,
    );

    // 3. JE number populated
    const noJe = Number(a?.no_je ?? 0);
    push(
      "je-populated", "JE number populated on every line", "Numéro d'écriture renseigné sur chaque ligne",
      noJe === 0 ? "passed" : "failed",
      noJe === 0 ? `All lines belong to one of ${nf(entries)} journal entries.` : `${nf(noJe)} lines carry no JE number.`,
      noJe === 0 ? `Toutes les lignes appartiennent à l'une des ${nf(entries)} écritures.` : `${nf(noJe)} lignes sans numéro d'écriture.`,
    );

    // 4. journal dates parsed
    const noDate = Number(a?.no_date ?? 0);
    push(
      "dates-parsed", "Journal dates readable", "Dates du journal lisibles",
      noDate === 0 ? "passed" : noDate < lines * 0.01 ? "warning" : "failed",
      noDate === 0
        ? "Every journal date parsed."
        : `${nf(noDate)} lines have an unreadable journal date and are grouped separately.`,
      noDate === 0
        ? "Toutes les dates du journal ont été lues."
        : `${nf(noDate)} lignes ont une date du journal illisible et sont regroupées à part.`,
    );

    // 5. amounts numeric
    const zeroAmount = Number(a?.zero_amount ?? 0);
    push(
      "amounts-numeric", "Amounts read as numbers", "Montants lus comme des nombres",
      zeroAmount === 0 ? "passed" : "warning",
      zeroAmount === 0
        ? "Every line carries a numeric debit or credit."
        : `${nf(zeroAmount)} lines carry neither a debit nor a credit (nil amount or an unreadable value).`,
      zeroAmount === 0
        ? "Chaque ligne porte un débit ou un crédit numérique."
        : `${nf(zeroAmount)} lignes ne portent ni débit ni crédit (montant nul ou valeur illisible).`,
    );

    // 6. debit / credit totals reconcile
    const diff = totalDebit - totalCredit;
    push(
      "debit-credit-reconcile", "Total debits equal total credits", "Total des débits égal au total des crédits",
      Math.abs(diff) <= TOLERANCE ? "passed" : "failed",
      `Debits ${nf(totalDebit)} vs credits ${nf(totalCredit)}; difference ${nf(diff)}.`,
      `Débits ${nf(totalDebit)} contre crédits ${nf(totalCredit)} ; différence ${nf(diff)}.`,
    );

    // 7. every entry balances
    const unbalancedEntries = Number(unbalanced.rows[0]?.n ?? 0);
    push(
      "entries-balance", "Every journal entry balances", "Chaque écriture est équilibrée",
      unbalancedEntries === 0 ? "passed" : "failed",
      unbalancedEntries === 0
        ? `All ${nf(entries)} journal entries net to nil.`
        : `${nf(unbalancedEntries)} of ${nf(entries)} journal entries do not net to nil.`,
      unbalancedEntries === 0
        ? `Les ${nf(entries)} écritures se soldent à zéro.`
        : `${nf(unbalancedEntries)} écritures sur ${nf(entries)} ne se soldent pas à zéro.`,
    );

    // 8. dates within the engagement period
    const outOfPeriod = Number(a?.out_of_period ?? 0);
    push(
      "dates-in-period", "Journal dates within the engagement period", "Dates du journal dans la période de la mission",
      periodStart === null ? "warning" : outOfPeriod === 0 ? "passed" : "warning",
      periodStart === null
        ? "The engagement period could not be read, so the check was not performed."
        : outOfPeriod === 0
          ? `All dated lines fall within ${periodStart} to ${periodEnd}.`
          : `${nf(outOfPeriod)} lines fall outside ${periodStart} to ${periodEnd} — an exception requiring audit consideration.`,
      periodStart === null
        ? "La période de la mission n'a pas pu être lue ; le contrôle n'a pas été effectué."
        : outOfPeriod === 0
          ? `Toutes les lignes datées se situent entre le ${periodStart} et le ${periodEnd}.`
          : `${nf(outOfPeriod)} lignes se situent hors de la période du ${periodStart} au ${periodEnd} — exception à examiner.`,
    );

    // 9. duplicate source rows
    const dupGroups = Number(dupes.rows[0]?.groups ?? 0);
    const dupExtra = Number(dupes.rows[0]?.extra ?? 0);
    push(
      "duplicate-rows", "No identical source rows", "Aucune ligne source identique",
      dupGroups === 0 ? "passed" : "warning",
      dupGroups === 0
        ? "No two lines share account, JE number, date, reference, amount and description."
        : `${nf(dupExtra)} lines repeat one of ${nf(dupGroups)} identical combinations — an exception requiring audit consideration.`,
      dupGroups === 0
        ? "Aucune ligne ne partage compte, numéro d'écriture, date, référence, montant et libellé."
        : `${nf(dupExtra)} lignes répètent l'une des ${nf(dupGroups)} combinaisons identiques — exception à examiner.`,
    );

    // 10. imported row count vs dataset row_count
    const missingRows = dataset.rowCount - lines;
    push(
      "row-count", "Imported line count complete", "Nombre de lignes importées complet",
      missingRows === 0 ? "passed" : "warning",
      missingRows === 0
        ? `${nf(lines)} of ${nf(dataset.rowCount)} source rows projected.`
        : `${nf(lines)} of ${nf(dataset.rowCount)} source rows projected; ${nf(missingRows)} were skipped for a missing account or JE number.`,
      missingRows === 0
        ? `${nf(lines)} lignes source sur ${nf(dataset.rowCount)} projetées.`
        : `${nf(lines)} lignes source sur ${nf(dataset.rowCount)} projetées ; ${nf(missingRows)} écartées faute de compte ou de numéro d'écriture.`,
    );

    const failed = checks.filter((c) => c.status === "failed").length;
    const warnings = checks.filter((c) => c.status === "warning").length;
    return {
      checks,
      status: failed > 0 ? "failed" : warnings > 0 ? "warning" : "passed",
      lines,
      sourceRows: dataset.rowCount,
      passed: checks.length - failed - warnings,
      warnings,
      failed,
    };
  });
}
