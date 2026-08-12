// Trial-balance engine (steps 3.1–3.3, spec §10.1): import with column-mapping
// inference (balance générale structure per SYSCOHADA art. 19 or closing-only),
// a validation engine (balance checks, codification, unknown accounts,
// opening-ties-to-prior feeding E370), and versioning where
// FINAL = initial + posted adjusting journals, reproducibly
// (trial_balance_version_journal keeps the applied set).

import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { resolveSection } from "@/lib/leadsheets";
import { LEAD_INDEXES, SUB_INDEX_BY_CODE, leadIndexFor, subIndexFor } from "@/lib/lead-classes";
import { parseTabularFile, type ParsedTable } from "@/lib/subledgers";
import { requireTenant } from "@/lib/tenant";

export type TbColumn =
  | "account"
  | "label"
  | "openingDebit"
  | "openingCredit"
  | "debit"
  | "credit"
  | "closingDebit"
  | "closingCredit"
  | "closing"
  | "opening";

export type TbMapping = Partial<Record<TbColumn, string>>;

const ALIASES: Record<TbColumn, readonly string[]> = {
  account: ["account", "accountcode", "accountnumber", "compte", "ncompte", "numerocompte", "numero", "code"],
  label: ["label", "libelle", "intitule", "accountname", "description", "designation"],
  openingDebit: ["openingdebit", "soldeouverturedebit", "anouveaudebit", "debitouverture", "soldeinitialdebit", "odebit"],
  openingCredit: ["openingcredit", "soldeouverturecredit", "anouveaucredit", "creditouverture", "soldeinitialcredit", "ocredit"],
  debit: ["debit", "debits", "mouvementdebit", "mouvementsdebit", "movementdebit", "cumuldebit"],
  credit: ["credit", "credits", "mouvementcredit", "mouvementscredit", "movementcredit", "cumulcredit"],
  closingDebit: ["closingdebit", "soldedebit", "soldefinaldebit", "balancedebit"],
  closingCredit: ["closingcredit", "soldecredit", "soldefinalcredit", "balancecredit"],
  closing: ["closing", "closingbalance", "solde", "soldefinal", "soldecloture", "balance", "net"],
  opening: ["opening", "openingbalance", "soldeouverture", "soldedouverture", "anouveau", "soldeinitial", "ouverture", "soldedebut"],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

export class TbError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "TbError";
  }
}

/** Infer the column mapping from headers (EN/FR aliases). */
export function inferTbMapping(headers: readonly string[]): TbMapping {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const mapping: TbMapping = {};
  for (const column of Object.keys(ALIASES) as TbColumn[]) {
    for (const alias of ALIASES[column]) {
      const hit = normalized.get(alias);
      if (hit && !Object.values(mapping).includes(hit)) {
        mapping[column] = hit;
        break;
      }
    }
  }
  if (!mapping.account) throw new TbError("missing-account-column");
  const hasMovements = mapping.debit && mapping.credit;
  const hasClosing = (mapping.closingDebit && mapping.closingCredit) || mapping.closing;
  if (!hasMovements && !hasClosing) throw new TbError("missing-amount-columns");
  return mapping;
}

function parseAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[\s  ]/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, "");
  if (cleaned === "" || cleaned === "-") return 0;
  const negative = cleaned.startsWith("(") && cleaned.endsWith(")");
  const parsed = Number(cleaned.replace(/[()]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

export interface TbImportRow {
  account: string;
  label: string | null;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  raw: Record<string, unknown>;
}

/** Normalise a parsed file into TB rows. Closing-only files land in debit/credit. */
export function extractTbRows(table: ParsedTable, mapping: TbMapping): TbImportRow[] {
  const rows: TbImportRow[] = [];
  for (const raw of table.rows) {
    const account = String(raw[mapping.account!] ?? "").trim();
    if (!account) continue;
    const get = (column: TbColumn): number =>
      mapping[column] ? parseAmount(raw[mapping[column]!]) : 0;
    let debit = get("debit");
    let credit = get("credit");
    if (!mapping.debit && !mapping.credit) {
      if (mapping.closingDebit || mapping.closingCredit) {
        debit = get("closingDebit");
        credit = get("closingCredit");
      } else {
        const closing = get("closing");
        debit = closing > 0 ? closing : 0;
        credit = closing < 0 ? -closing : 0;
      }
    }
    let openingDebit = get("openingDebit");
    let openingCredit = get("openingCredit");
    if (!mapping.openingDebit && !mapping.openingCredit && mapping.opening) {
      const opening = get("opening");
      openingDebit = opening > 0 ? opening : 0;
      openingCredit = opening < 0 ? -opening : 0;
    }
    rows.push({
      account,
      label: mapping.label ? String(raw[mapping.label] ?? "").trim() || null : null,
      openingDebit,
      openingCredit,
      debit,
      credit,
      raw,
    });
  }
  if (rows.length === 0) throw new TbError("empty-file");
  return rows;
}

export interface TbValidationSummary {
  status: "valid" | "invalid";
  checks: {
    balanced: { ok: boolean; totalDebit: number; totalCredit: number };
    openingBalanced: { ok: boolean; totalDebit: number; totalCredit: number };
    closingEquation: { ok: boolean; failures: string[] };
    codification: { ok: boolean; badAccounts: string[] };
    unknownAccounts: string[];
    openingTiesToPrior: { checked: boolean; exceptions: { account: string; opening: number; priorClosing: number }[] };
  };
  mapping: TbMapping;
}

const EPSILON = 0.01;

/** The 3.2 validation engine (spec §10.1). */
export function validateTbRows(
  rows: TbImportRow[],
  knownPrefixes: string[],
  priorClosings: Map<string, number> | null,
  mapping: TbMapping,
): TbValidationSummary {
  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  const totalOpeningDebit = rows.reduce((sum, row) => sum + row.openingDebit, 0);
  const totalOpeningCredit = rows.reduce((sum, row) => sum + row.openingCredit, 0);

  const hasClosingColumns = Boolean(mapping.closingDebit || mapping.closingCredit || mapping.closing);
  const hasOpening = Boolean(mapping.openingDebit || mapping.openingCredit);

  // closing = opening + movements per account — checkable only when the file
  // carries opening + movements + closing simultaneously.
  const closingFailures: string[] = [];
  if (hasOpening && hasClosingColumns && mapping.debit && mapping.credit) {
    for (const row of rows) {
      const closingFromFile =
        (mapping.closingDebit ? parseAmount(row.raw[mapping.closingDebit]) : 0) -
        (mapping.closingCredit ? parseAmount(row.raw[mapping.closingCredit]) : 0) +
        (mapping.closing ? parseAmount(row.raw[mapping.closing]) : 0);
      const computed = row.openingDebit - row.openingCredit + row.debit - row.credit;
      if (Math.abs(closingFromFile - computed) > EPSILON) closingFailures.push(row.account);
    }
  }

  const badAccounts = rows
    .filter((row) => !/^[1-9][0-9]{0,7}$/.test(row.account))
    .map((row) => row.account);

  const unknownAccounts = rows
    .filter((row) => /^[1-9]/.test(row.account))
    .filter((row) => !knownPrefixes.some((prefix) => row.account.startsWith(prefix)))
    .map((row) => row.account);

  const openingExceptions: { account: string; opening: number; priorClosing: number }[] = [];
  if (priorClosings && hasOpening) {
    for (const row of rows) {
      const opening = row.openingDebit - row.openingCredit;
      const prior = priorClosings.get(row.account) ?? 0;
      if (Math.abs(opening - prior) > EPSILON) {
        openingExceptions.push({ account: row.account, opening, priorClosing: prior });
      }
    }
  }

  const balancedOk = Math.abs(totalDebit - totalCredit) <= EPSILON;
  const openingOk = Math.abs(totalOpeningDebit - totalOpeningCredit) <= EPSILON;
  const closingOk = closingFailures.length === 0;

  return {
    status: balancedOk && openingOk && closingOk ? "valid" : "invalid",
    checks: {
      balanced: { ok: balancedOk, totalDebit, totalCredit },
      openingBalanced: { ok: openingOk, totalDebit: totalOpeningDebit, totalCredit: totalOpeningCredit },
      closingEquation: { ok: closingOk, failures: closingFailures.slice(0, 50) },
      codification: { ok: badAccounts.length === 0, badAccounts: badAccounts.slice(0, 50) },
      unknownAccounts: unknownAccounts.slice(0, 50),
      openingTiesToPrior: { checked: priorClosings !== null, exceptions: openingExceptions.slice(0, 50) },
    },
    mapping,
  };
}

async function priorClosingsMap(tx: PoolClient, engagementId: string): Promise<Map<string, number> | null> {
  const prior = await tx.query<{ id: string }>(
    `SELECT p.id FROM engagement e
       JOIN engagement p ON p.client_id = e.client_id AND p.fiscal_year < e.fiscal_year
      WHERE e.id = $1 ORDER BY p.fiscal_year DESC LIMIT 1`,
    [engagementId],
  );
  if (!prior.rows[0]) return null;
  const rows = await tx.query<{ account_code: string; closing: string }>(
    `SELECT r.account_code,
            (r.opening_debit - r.opening_credit + r.debit - r.credit)::text AS closing
       FROM trial_balance tb
       JOIN trial_balance_version v ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
       JOIN trial_balance_row r ON r.version_id = v.id
      WHERE tb.engagement_id = $1`,
    [prior.rows[0].id],
  );
  if (rows.rows.length === 0) return null;
  return new Map(rows.rows.map((row) => [row.account_code, Number(row.closing)]));
}

export interface TbImportResult {
  versionId: string;
  versionNo: number;
  summary: TbValidationSummary;
}

/** 3.1: import a TB file as the next version (kind 'initial'), validate, activate. */
export type TbTiming = "pre_audit" | "post_audit";

export async function importTrialBalance(
  engagementId: string,
  filename: string,
  buffer: Buffer,
  mappingOverride?: TbMapping,
  timing: TbTiming = "pre_audit",
): Promise<TbImportResult> {
  const { tenantId, userId } = await requireTenant();
  const table = await parseTabularFile(filename, buffer);
  const mapping = mappingOverride ?? inferTbMapping(table.headers);
  validateMapping(mapping);
  const rows = extractTbRows(table, mapping);

  return withTenant(tenantId, async (tx) => {
    const meta = await tx.query<{ client_id: string; period_end: string }>(
      "SELECT client_id, to_char(period_end, 'YYYY-MM-DD') AS period_end FROM engagement WHERE id = $1",
      [engagementId],
    );
    if (!meta.rows[0]) throw new TbError("not-found");

    const prefixes = await tx.query<{ p: string }>(
      `SELECT account_prefix AS p FROM syscohada_grouping_rule WHERE active
       UNION SELECT account_prefix FROM client_grouping_override WHERE client_id = $1 AND active`,
      [meta.rows[0].client_id],
    );
    const priorClosings = await priorClosingsMap(tx, engagementId);
    const summary = validateTbRows(rows, prefixes.rows.map((r) => r.p), priorClosings, mapping);

    const tb = await tx.query<{ id: string }>(
      `INSERT INTO trial_balance (tenant_id, client_id, engagement_id, period_end)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (engagement_id) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [tenantId, meta.rows[0].client_id, engagementId, meta.rows[0].period_end],
    );
    const trialBalanceId = tb.rows[0].id;

    // one TB per timing: a new upload replaces the previous one outright
    await tx.query(
      "DELETE FROM trial_balance_version WHERE trial_balance_id = $1 AND timing = $2",
      [trialBalanceId, timing],
    );

    const next = await tx.query<{ v: number }>(
      "SELECT coalesce(max(version_no), 0) + 1 AS v FROM trial_balance_version WHERE trial_balance_id = $1",
      [trialBalanceId],
    );
    const versionNo = next.rows[0].v;
    const version = await tx.query<{ id: string }>(
      `INSERT INTO trial_balance_version
         (tenant_id, trial_balance_id, version_no, version_kind, validation_status,
          source_filename, source_sha256, row_count, total_debit, total_credit,
          validation_summary, created_by, timing)
       VALUES ($1, $2, $3, 'initial', $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        tenantId,
        trialBalanceId,
        versionNo,
        summary.status,
        filename,
        createHash("sha256").update(buffer).digest("hex"),
        rows.length,
        summary.checks.balanced.totalDebit,
        summary.checks.balanced.totalCredit,
        JSON.stringify(summary),
        userId,
        timing,
      ],
    );

    let rowNo = 0;
    for (const row of rows) {
      rowNo += 1;
      await tx.query(
        `INSERT INTO trial_balance_row
           (tenant_id, version_id, row_no, account_code, account_name,
            opening_debit, opening_credit, debit, credit, raw_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [tenantId, version.rows[0].id, rowNo, row.account, row.label, row.openingDebit, row.openingCredit, row.debit, row.credit, JSON.stringify(row.raw)],
      );
    }
    // Only a VALID pre-audit import becomes the active (working) version —
    // the post-audit TB sits alongside for comparison and never drives the file.
    if (summary.status === "valid" && timing === "pre_audit") {
      await tx.query("UPDATE trial_balance SET current_version_no = $2 WHERE id = $1", [trialBalanceId, versionNo]);
    }
    return { versionId: version.rows[0].id, versionNo, summary };
  });
}

export interface TbVersionSummary {
  id: string;
  versionNo: number;
  kind: "initial" | "adjusted" | "final";
  status: "pending" | "valid" | "invalid";
  rowCount: number;
  totalDebit: number;
  totalCredit: number;
  isCurrent: boolean;
  createdAt: string;
  summary: TbValidationSummary | null;
}

export async function listTbVersions(engagementId: string): Promise<TbVersionSummary[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      version_no: number;
      version_kind: TbVersionSummary["kind"];
      validation_status: TbVersionSummary["status"];
      row_count: number;
      total_debit: string;
      total_credit: string;
      current_version_no: number;
      created_at: string;
      validation_summary: TbValidationSummary | Record<string, never>;
    }>(
      `SELECT v.id, v.version_no, v.version_kind, v.validation_status, v.row_count,
              v.total_debit::text, v.total_credit::text, tb.current_version_no,
              to_char(v.created_at, 'YYYY-MM-DD HH24:MI') AS created_at, v.validation_summary
         FROM trial_balance_version v
         JOIN trial_balance tb ON tb.id = v.trial_balance_id
        WHERE tb.engagement_id = $1
        ORDER BY v.version_no DESC`,
      [engagementId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      versionNo: row.version_no,
      kind: row.version_kind,
      status: row.validation_status,
      rowCount: row.row_count,
      totalDebit: Number(row.total_debit),
      totalCredit: Number(row.total_credit),
      isCurrent: row.version_no === row.current_version_no,
      createdAt: row.created_at,
      summary: "status" in row.validation_summary ? (row.validation_summary as TbValidationSummary) : null,
    }));
  });
}

export interface TbTimingSlot {
  timing: TbTiming;
  filename: string;
  rowCount: number;
  status: "pending" | "valid" | "invalid";
  createdAt: string;
  summary: TbValidationSummary | null;
}

/** The two TB slots (Pre-audit / Post-audit) — at most one each. */
export async function listTbTimings(engagementId: string): Promise<TbTimingSlot[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      timing: TbTiming;
      source_filename: string;
      row_count: number;
      validation_status: TbTimingSlot["status"];
      created_at: string;
      validation_summary: TbValidationSummary | Record<string, never>;
    }>(
      `SELECT v.timing, v.source_filename, v.row_count, v.validation_status,
              to_char(v.created_at, 'YYYY-MM-DD HH24:MI') AS created_at, v.validation_summary
         FROM trial_balance_version v
         JOIN trial_balance tb ON tb.id = v.trial_balance_id
        WHERE tb.engagement_id = $1
        ORDER BY v.created_at DESC`,
      [engagementId],
    );
    const seen = new Set<string>();
    const out: TbTimingSlot[] = [];
    for (const row of result.rows) {
      if (seen.has(row.timing)) continue;
      seen.add(row.timing);
      out.push({
        timing: row.timing,
        filename: row.source_filename,
        rowCount: row.row_count,
        status: row.validation_status,
        createdAt: row.created_at,
        summary: "status" in row.validation_summary ? (row.validation_summary as TbValidationSummary) : null,
      });
    }
    return out;
  });
}

export interface LeadScheduleSubtotal {
  code: string;
  label: string;
  current: number;
  prior: number;
  variance: number;
  variancePct: number | null;
}

export interface LeadScheduleView {
  index: string;
  label: string;
  accountType: string;
  accountClass: string;
  subtotals: LeadScheduleSubtotal[];
  current: number;
  prior: number;
  variance: number;
  variancePct: number | null;
}

/**
 * The workbook-layout lead schedules: one per index present in the pre-audit
 * TB, broken into the workbook's sub-totals, each with current-year balance,
 * prior-year balance and the variance in amount and percent. Client index
 * overrides re-home whole account classes.
 */
export async function leadSchedules(engagementId: string): Promise<LeadScheduleView[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const meta = await tx.query<{ client_id: string }>(
      "SELECT client_id FROM engagement WHERE id = $1",
      [engagementId],
    );
    if (!meta.rows[0]) return [];
    const rows = await tx.query<{ account_code: string; closing: string }>(
      `SELECT r.account_code,
              (r.opening_debit - r.opening_credit + r.debit - r.credit)::text AS closing
         FROM trial_balance tb
         JOIN trial_balance_version v ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
         JOIN trial_balance_row r ON r.version_id = v.id
        WHERE tb.engagement_id = $1`,
      [engagementId],
    );
    if (rows.rows.length === 0) return [];
    const prior = (await priorClosingsMap(tx, engagementId)) ?? new Map<string, number>();
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

    // accumulate account → (index, sub-total): current from the TB; prior-only
    // accounts still appear so a disappeared balance shows its variance
    const cells = new Map<string, { index: string; sub: string; current: number; prior: number }>();
    const put = (account: string, current: number, priorAmt: number) => {
      const index = indexOf(account);
      if (!index) return;
      const sub = subIndexFor(account) ?? `${index}-1`;
      const key = index + "|" + sub;
      const cell = cells.get(key) ?? { index, sub, current: 0, prior: 0 };
      cell.current += current;
      cell.prior += priorAmt;
      cells.set(key, cell);
    };
    const seen = new Set<string>();
    for (const row of rows.rows) {
      seen.add(row.account_code);
      put(row.account_code, Number(row.closing), prior.get(row.account_code) ?? 0);
    }
    for (const [account, amount] of prior) {
      if (!seen.has(account)) put(account, 0, amount);
    }

    const byIndex = new Map<string, LeadScheduleSubtotal[]>();
    for (const cell of cells.values()) {
      const list = byIndex.get(cell.index) ?? [];
      const current = Math.round(cell.current);
      const priorAmt = Math.round(cell.prior);
      list.push({
        code: cell.sub,
        label: SUB_INDEX_BY_CODE[cell.sub]?.labelEn ?? cell.sub,
        current,
        prior: priorAmt,
        variance: current - priorAmt,
        variancePct: priorAmt !== 0 ? Math.round(((current - priorAmt) / Math.abs(priorAmt)) * 1000) / 10 : null,
      });
      byIndex.set(cell.index, list);
    }

    const out: LeadScheduleView[] = [];
    for (const def of LEAD_INDEXES) {
      const subtotals = byIndex.get(def.code);
      if (!subtotals) continue;
      subtotals.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      const current = subtotals.reduce((sum, x) => sum + x.current, 0);
      const priorAmt = subtotals.reduce((sum, x) => sum + x.prior, 0);
      out.push({
        index: def.code,
        label: def.labelEn,
        accountType: def.accountType,
        accountClass: def.accountClass,
        subtotals,
        current,
        prior: priorAmt,
        variance: current - priorAmt,
        variancePct: priorAmt !== 0 ? Math.round(((current - priorAmt) / Math.abs(priorAmt)) * 1000) / 10 : null,
      });
    }
    return out;
  });
}

export interface JournalLineInput {
  account: string;
  label?: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalSummary {
  id: string;
  journalNo: number;
  description: string;
  status: "draft" | "posted" | "voided";
  total: number;
  lines: { account: string; debit: number; credit: number }[];
}

/** 3.3: create a balanced adjusting journal (draft). */
export async function createJournal(
  engagementId: string,
  description: string,
  lines: JournalLineInput[],
): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  if (!description.trim()) throw new TbError("description-required");
  if (lines.length < 2) throw new TbError("journal-lines-required");
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > EPSILON) throw new TbError("journal-unbalanced");

  return withTenant(tenantId, async (tx) => {
    const tb = await tx.query<{ id: string }>(
      "SELECT id FROM trial_balance WHERE engagement_id = $1",
      [engagementId],
    );
    if (!tb.rows[0]) throw new TbError("no-tb");
    const next = await tx.query<{ v: number }>(
      "SELECT coalesce(max(journal_no), 0) + 1 AS v FROM adjusting_journal WHERE trial_balance_id = $1",
      [tb.rows[0].id],
    );
    const journal = await tx.query<{ id: string }>(
      `INSERT INTO adjusting_journal (tenant_id, engagement_id, trial_balance_id, journal_no, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [tenantId, engagementId, tb.rows[0].id, next.rows[0].v, description.trim(), userId],
    );
    let lineNo = 0;
    for (const line of lines) {
      lineNo += 1;
      await tx.query(
        `INSERT INTO adjusting_journal_line
           (tenant_id, journal_id, line_no, account_code, account_name, debit, credit, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [tenantId, journal.rows[0].id, lineNo, line.account, line.label ?? null, line.debit, line.credit, line.description ?? null],
      );
    }
    return journal.rows[0].id;
  });
}

export async function listJournals(engagementId: string): Promise<JournalSummary[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      journal_no: number;
      description: string;
      status: JournalSummary["status"];
      lines: string;
    }>(
      `SELECT j.id, j.journal_no, j.description, j.status,
              (SELECT json_agg(json_build_object('account', l.account_code, 'debit', l.debit, 'credit', l.credit) ORDER BY l.line_no)
                 FROM adjusting_journal_line l WHERE l.journal_id = j.id)::text AS lines
         FROM adjusting_journal j
        WHERE j.engagement_id = $1
        ORDER BY j.journal_no`,
      [engagementId],
    );
    return result.rows.map((row) => {
      const lines = (JSON.parse(row.lines ?? "[]") as { account: string; debit: string | number; credit: string | number }[]).map(
        (line) => ({ account: line.account, debit: Number(line.debit), credit: Number(line.credit) }),
      );
      return {
        id: row.id,
        journalNo: row.journal_no,
        description: row.description,
        status: row.status,
        total: lines.reduce((sum, line) => sum + line.debit, 0),
        lines,
      };
    });
  });
}

/**
 * Post a journal: derives a new TB version = current version + this journal's
 * deltas, links the journal (reproducibility), and activates the new version.
 */
export async function postJournal(
  journalId: string,
  kind: "adjusted" | "final",
): Promise<number> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const journal = await tx.query<{ id: string; trial_balance_id: string; status: string }>(
      "SELECT id, trial_balance_id, status FROM adjusting_journal WHERE id = $1 FOR UPDATE",
      [journalId],
    );
    const j = journal.rows[0];
    if (!j) throw new TbError("not-found");
    if (j.status !== "draft") throw new TbError("journal-not-draft");

    const tb = await tx.query<{ id: string; current_version_no: number }>(
      "SELECT id, current_version_no FROM trial_balance WHERE id = $1 FOR UPDATE",
      [j.trial_balance_id],
    );
    if (tb.rows[0].current_version_no === 0) throw new TbError("no-tb");
    const base = await tx.query<{ id: string }>(
      "SELECT id FROM trial_balance_version WHERE trial_balance_id = $1 AND version_no = $2",
      [j.trial_balance_id, tb.rows[0].current_version_no],
    );

    // Base rows + journal deltas.
    const rows = await tx.query<{
      account_code: string;
      account_name: string | null;
      opening_debit: string;
      opening_credit: string;
      debit: string;
      credit: string;
    }>(
      "SELECT account_code, account_name, opening_debit::text, opening_credit::text, debit::text, credit::text FROM trial_balance_row WHERE version_id = $1",
      [base.rows[0].id],
    );
    const byAccount = new Map(
      rows.rows.map((row) => [
        row.account_code,
        {
          name: row.account_name,
          openingDebit: Number(row.opening_debit),
          openingCredit: Number(row.opening_credit),
          debit: Number(row.debit),
          credit: Number(row.credit),
        },
      ]),
    );
    const lines = await tx.query<{ account_code: string; account_name: string | null; debit: string; credit: string }>(
      "SELECT account_code, account_name, debit::text, credit::text FROM adjusting_journal_line WHERE journal_id = $1",
      [journalId],
    );
    for (const line of lines.rows) {
      const entry = byAccount.get(line.account_code) ?? {
        name: line.account_name,
        openingDebit: 0,
        openingCredit: 0,
        debit: 0,
        credit: 0,
      };
      entry.debit += Number(line.debit);
      entry.credit += Number(line.credit);
      byAccount.set(line.account_code, entry);
    }

    const versionNo = tb.rows[0].current_version_no + 1;
    const totalDebit = [...byAccount.values()].reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = [...byAccount.values()].reduce((sum, row) => sum + row.credit, 0);
    const version = await tx.query<{ id: string }>(
      `INSERT INTO trial_balance_version
         (tenant_id, trial_balance_id, version_no, version_kind, validation_status,
          base_version_id, row_count, total_debit, total_credit, created_by)
       VALUES ($1, $2, $3, $4, 'valid', $5, $6, $7, $8, $9)
       RETURNING id`,
      [tenantId, j.trial_balance_id, versionNo, kind, base.rows[0].id, byAccount.size, totalDebit, totalCredit, userId],
    );
    let rowNo = 0;
    for (const [account, entry] of [...byAccount.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      rowNo += 1;
      await tx.query(
        `INSERT INTO trial_balance_row
           (tenant_id, version_id, row_no, account_code, account_name,
            opening_debit, opening_credit, debit, credit)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [tenantId, version.rows[0].id, rowNo, account, entry.name, entry.openingDebit, entry.openingCredit, entry.debit, entry.credit],
      );
    }
    await tx.query(
      "INSERT INTO trial_balance_version_journal (tenant_id, version_id, journal_id, applied_order) VALUES ($1, $2, $3, 1)",
      [tenantId, version.rows[0].id, journalId],
    );
    await tx.query(
      "UPDATE adjusting_journal SET status = 'posted', posted_by = $2, posted_at = now() WHERE id = $1",
      [journalId, userId],
    );
    await tx.query("UPDATE trial_balance SET current_version_no = $2 WHERE id = $1", [j.trial_balance_id, versionNo]);
    return versionNo;
  });
}

export interface TbDiffLine {
  account: string;
  closingA: number;
  closingB: number;
  difference: number;
}

/** Per-account closing diff between two versions of the engagement's TB. */
export async function diffTbVersions(
  engagementId: string,
  versionA: number,
  versionB: number,
): Promise<TbDiffLine[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ account: string; a: string | null; b: string | null }>(
      `WITH balances AS (
         SELECT v.version_no, r.account_code,
                sum(r.opening_debit - r.opening_credit + r.debit - r.credit) AS closing
           FROM trial_balance tb
           JOIN trial_balance_version v ON v.trial_balance_id = tb.id
           JOIN trial_balance_row r ON r.version_id = v.id
          WHERE tb.engagement_id = $1 AND v.version_no IN ($2, $3)
          GROUP BY v.version_no, r.account_code
       )
       SELECT coalesce(a.account_code, b.account_code) AS account,
              a.closing::text AS a, b.closing::text AS b
         FROM (SELECT * FROM balances WHERE version_no = $2) a
         FULL OUTER JOIN (SELECT * FROM balances WHERE version_no = $3) b
           ON a.account_code = b.account_code
        ORDER BY 1`,
      [engagementId, versionA, versionB],
    );
    return result.rows
      .map((row) => ({
        account: row.account,
        closingA: Number(row.a ?? 0),
        closingB: Number(row.b ?? 0),
        difference: Number(row.b ?? 0) - Number(row.a ?? 0),
      }))
      .filter((line) => Math.abs(line.difference) > EPSILON);
  });
}

// ---- 3.6 client grouping overrides ----

export interface GroupingOverride {
  id: string;
  matchType: "exact" | "prefix";
  accountPrefix: string;
  sectionCode: string;
  rationale: string;
  active: boolean;
}

export async function listOverrides(clientId: string): Promise<GroupingOverride[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      match_type: "exact" | "prefix";
      account_prefix: string;
      section_code: string;
      rationale: string;
      active: boolean;
    }>(
      "SELECT id, match_type, account_prefix, section_code, rationale, active FROM client_grouping_override WHERE client_id = $1 ORDER BY account_prefix",
      [clientId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      matchType: row.match_type,
      accountPrefix: row.account_prefix,
      sectionCode: row.section_code,
      rationale: row.rationale,
      active: row.active,
    }));
  });
}

/** The account and at least one amount column must be mapped. */
function validateMapping(mapping: TbMapping): void {
  if (!mapping.account) throw new TbError("missing-account-column");
  const hasMovements = mapping.debit && mapping.credit;
  const hasClosing = (mapping.closingDebit && mapping.closingCredit) || mapping.closing;
  if (!hasMovements && !hasClosing) throw new TbError("missing-amount-columns");
}

export interface TbPreviewClass {
  /** four-digit account prefix found in the file */
  prefix: string;
  accountCount: number;
  closingTotal: number;
  /** lead-schedule section the grouping rules resolve to, null = unmapped */
  section: string | null;
  /** lead-schedule index (firm taxonomy): client override, else the embedded SYSCOHADA map */
  leadIndex: string | null;
}

export interface TbPreview {
  headers: string[];
  /** first non-empty values of each header, so the user can see the data behind a column choice */
  headerSamples: Record<string, string[]>;
  mapping: TbMapping;
  /** null when the mapping supports extraction; else the blocking error code */
  mappingError: string | null;
  rowCount: number;
  sample: { account: string; label: string | null; opening: number; closing: number }[];
  classes: TbPreviewClass[];
}

/**
 * Analyze a TB file WITHOUT ingesting: infer (or take) the column mapping,
 * extract the rows, and resolve each two-digit account class against the
 * grouping rules — the confirm-and-map screen renders this.
 */
export async function previewTrialBalance(
  engagementId: string,
  filename: string,
  buffer: Buffer,
  mappingOverride?: TbMapping,
): Promise<TbPreview> {
  const { tenantId } = await requireTenant();
  const table = await parseTabularFile(filename, buffer);
  let mapping: TbMapping = mappingOverride ?? {};
  let mappingError: string | null = null;
  let rows: TbImportRow[] = [];
  try {
    if (!mappingOverride) mapping = inferTbMapping(table.headers);
    else validateMapping(mapping);
    rows = extractTbRows(table, mapping);
  } catch (error) {
    mappingError = error instanceof TbError ? error.code : "mapping-failed";
  }

  const closingOf = (row: TbImportRow) =>
    row.openingDebit - row.openingCredit + row.debit - row.credit;

  return withTenant(tenantId, async (tx) => {
    const meta = await tx.query<{ client_id: string }>(
      "SELECT client_id FROM engagement WHERE id = $1",
      [engagementId],
    );
    if (!meta.rows[0]) throw new TbError("not-found");
    const over = await tx.query<{ account_prefix: string; section_code: string; match_type: string }>(
      "SELECT account_prefix, section_code, match_type FROM client_grouping_override WHERE client_id = $1 AND active",
      [meta.rows[0].client_id],
    );
    const idxOver = await tx.query<{ account_prefix: string; index_code: string }>(
      "SELECT account_prefix, index_code FROM client_lead_index_override WHERE client_id = $1",
      [meta.rows[0].client_id],
    );
    const indexOverride = new Map(idxOver.rows.map((r) => [r.account_prefix, r.index_code]));
    const glob = await tx.query<{ account_prefix: string; section_code: string; priority: number }>(
      "SELECT account_prefix, section_code, priority FROM syscohada_grouping_rule WHERE active",
    );
    const overrides = over.rows.map((r) => ({ prefix: r.account_prefix, sectionCode: r.section_code, exact: r.match_type === "exact", priority: 100 }));
    const global = glob.rows.map((r) => ({ prefix: r.account_prefix, sectionCode: r.section_code, exact: false, priority: r.priority }));

    const byPrefix = new Map<string, { accounts: Set<string>; total: number; sections: Map<string | null, number> }>();
    for (const row of rows) {
      const prefix = row.account.slice(0, 4);
      const entry = byPrefix.get(prefix) ?? { accounts: new Set<string>(), total: 0, sections: new Map<string | null, number>() };
      entry.accounts.add(row.account);
      entry.total += closingOf(row);
      const section = resolveSection(row.account, overrides, global);
      entry.sections.set(section, (entry.sections.get(section) ?? 0) + 1);
      byPrefix.set(prefix, entry);
    }
    const classes: TbPreviewClass[] = [...byPrefix.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([prefix, entry]) => {
        // the class maps to the section most of its accounts resolve to
        let section: string | null = null;
        let best = -1;
        for (const [sec, count] of entry.sections) if (count > best) { best = count; section = sec; }
        return {
          prefix,
          accountCount: entry.accounts.size,
          closingTotal: Math.round(entry.total),
          section,
          leadIndex: indexOverride.get(prefix) ?? leadIndexFor(prefix),
        };
      });

    const headerSamples: Record<string, string[]> = {};
    for (const header of table.headers) {
      const values: string[] = [];
      for (const raw of table.rows) {
        const v = String(raw[header] ?? "").trim();
        if (v) values.push(v);
        if (values.length >= 3) break;
      }
      headerSamples[header] = values;
    }
    return {
      headers: table.headers,
      headerSamples,
      mapping,
      mappingError,
      rowCount: rows.length,
      sample: rows.slice(0, 6).map((row) => ({
        account: row.account,
        label: row.label,
        opening: Math.round(row.openingDebit - row.openingCredit),
        closing: Math.round(closingOf(row)),
      })),
      classes,
    };
  });
}

/** Persist the user's lead-index choice for an account-class prefix. */
export async function saveLeadIndexOverride(
  clientId: string,
  accountPrefix: string,
  indexCode: string,
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!/^[0-9]{1,8}$/.test(accountPrefix)) throw new TbError("invalid-prefix");
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO client_lead_index_override (tenant_id, client_id, account_prefix, index_code, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (client_id, account_prefix) DO UPDATE SET index_code = EXCLUDED.index_code`,
      [tenantId, clientId, accountPrefix, indexCode, userId],
    );
  });
}

export async function addOverride(
  clientId: string,
  input: { matchType: "exact" | "prefix"; accountPrefix: string; sectionCode: string; rationale: string },
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!/^[0-9]{1,8}$/.test(input.accountPrefix)) throw new TbError("invalid-prefix");
  if (!/^E[0-9]{3}$/.test(input.sectionCode)) throw new TbError("invalid-section");
  if (!input.rationale.trim()) throw new TbError("rationale-required");
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO client_grouping_override
         (tenant_id, client_id, match_type, account_prefix, label_en, label_fr, fs_ref, section_code, rationale, created_by)
       VALUES ($1, $2, $3, $4, 'Client override', 'Personnalisation client', '-', $5, $6, $7)
       ON CONFLICT (client_id, match_type, account_prefix)
       DO UPDATE SET section_code = EXCLUDED.section_code, rationale = EXCLUDED.rationale, active = true`,
      [tenantId, clientId, input.matchType, input.accountPrefix, input.sectionCode, input.rationale, userId],
    );
  });
}

export async function deactivateOverride(id: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query("UPDATE client_grouping_override SET active = false WHERE id = $1", [id]);
  });
}
