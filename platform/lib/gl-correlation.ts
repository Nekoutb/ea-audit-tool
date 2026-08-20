// Account correlation over the typed line projection.
//
// Three questions an auditor actually asks of a ledger:
//   1. What is in here? -> accountsFor
//   2. When I post to these accounts, what else moves in the same entry?
//      -> entryAnalysis
//   3. Do these two accounts move together, and by what ratio? ->
//      twoAccountCorrelation
// and then, for any figure on screen, "show me the lines behind it" ->
// drillDown.
//
// Every one of them is a SQL aggregate against gl_line. Nothing walks the
// ledger in Node: a correlation study on a 400 000-line file costs the same
// round trips as one on a 400-line file.
//
// Amount convention: signed = debit - credit (debits positive, credits
// negative). Ratios preserve that sign and are null — never Infinity — when the
// denominator is nil.

import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { pearson } from "@/lib/gl-analytics";
import { requireTenant } from "@/lib/tenant";

type Tx = PoolClient;

const MONTH = "coalesce(to_char(journal_date, 'YYYY-MM'), 'n/a')";

/** Account codes reach SQL as parameters, but they also reach LIKE patterns. */
export const ACCOUNT_RE = /^[A-Za-z0-9._-]{1,40}$/;

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Ratio that keeps its sign and refuses to become Infinity. */
function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0 || !Number.isFinite(denominator)) return null;
  const r = numerator / denominator;
  return Number.isFinite(r) ? Math.round(r * 10000) / 10000 : null;
}

function cleanAccounts(value: unknown, max: number): string[] {
  const raw = Array.isArray(value) ? value : [];
  const cleaned = [...new Set(raw.map((a) => String(a).trim()).filter((a) => ACCOUNT_RE.test(a)))];
  if (cleaned.length === 0) throw new Error("invalid-accounts");
  return cleaned.slice(0, max);
}

// ---------------------------------------------------------------------------
// 1. the account list

export interface AccountSummary {
  account: string;
  name: string | null;
  lines: number;
  entries: number;
  debit: number;
  credit: number;
  signed: number;
}

export interface AccountList {
  accounts: AccountSummary[];
  /** distinct accounts in the ledger, before the cap */
  total: number;
  /** true when the list was cut short by the cap */
  truncated: boolean;
}

const ACCOUNT_CAP = 500;

/**
 * The accounts in the projected ledger with their weight, optionally filtered
 * by a substring of the code or the name. Capped: the picker needs a workable
 * list, not every account in a group chart.
 */
export async function accountsFor(
  engagementId: string,
  datasetId: string,
  search?: string,
): Promise<AccountList> {
  const { tenantId } = await requireTenant();
  // % and _ are LIKE wildcards; a user typing them means the literal character
  const term = String(search ?? "").trim().slice(0, 60).replace(/([%_\\])/g, "\\$1");
  return withTenant(tenantId, async (tx) => {
    // the search parameter is only bound when it is actually used: Postgres
    // rejects a bind that supplies more parameters than the statement declares
    const params = term ? [datasetId, engagementId, term] : [datasetId, engagementId];
    const filter = term
      ? `AND (account ILIKE '%' || $3 || '%' ESCAPE '\\'
              OR coalesce(account_name, '') ILIKE '%' || $3 || '%' ESCAPE '\\')`
      : "";
    const total = await tx.query<{ n: number }>(
      `SELECT count(DISTINCT account)::int AS n FROM gl_line
        WHERE dataset_id = $1 AND engagement_id = $2 ${filter}`,
      params,
    );
    const q = await tx.query<{
      account: string; name: string | null; lines: number; entries: number;
      debit: number; credit: number; signed: number;
    }>(
      `SELECT account, min(account_name) AS name, count(*)::int AS lines,
              count(DISTINCT je_number)::int AS entries,
              coalesce(sum(debit), 0)::float8 AS debit,
              coalesce(sum(credit), 0)::float8 AS credit,
              coalesce(sum(signed), 0)::float8 AS signed
         FROM gl_line
        WHERE dataset_id = $1 AND engagement_id = $2 ${filter}
        GROUP BY account
        ORDER BY account
        LIMIT ${ACCOUNT_CAP}`,
      params,
    );
    const count = total.rows[0]?.n ?? 0;
    return {
      accounts: q.rows.map((r) => ({
        account: r.account, name: r.name, lines: r.lines, entries: r.entries,
        debit: round2(r.debit), credit: round2(r.credit), signed: round2(r.signed),
      })),
      total: count,
      truncated: count > ACCOUNT_CAP,
    };
  });
}

// ---------------------------------------------------------------------------
// 2. entry analysis

export type EntryMode = "any" | "all";
export type CounterpartRank = "abs" | "net" | "postings" | "entries" | "account";
export type CounterpartLimit = 10 | 20 | 50 | "all";

export interface CounterpartAccount {
  account: string;
  name: string | null;
  net: number;
  gross: number;
  postings: number;
  entries: number;
}

export interface EntryAnalysis {
  accounts: string[];
  mode: EntryMode;
  rank: CounterpartRank;
  /** journal entries that satisfied the selection */
  linkedEntries: number;
  counterpartAccounts: CounterpartAccount[];
  /** one row per month; cells align with counterpartAccounts */
  months: { month: string; cells: (number | null)[]; total: number }[];
  /** totals over the counterpart lines shown in the grid */
  totalDebit: number;
  totalCredit: number;
  net: number;
  /** counterpart accounts beyond the limit, folded out of the grid */
  hiddenAccounts: number;
}

const RANK_SQL: Record<CounterpartRank, string> = {
  abs: "gross DESC, account",
  net: "net DESC, account",
  postings: "postings DESC, account",
  entries: "entries DESC, account",
  account: "account",
};

const ALL_CAP = 200;

/**
 * Take every journal entry that touches the selected accounts — "any" of them
 * or "all" of them — then look at what ELSE those entries posted to. The
 * selected accounts are excluded from the counterpart columns on purpose: an
 * account is not its own counterpart, and leaving it in would swamp the grid
 * with the very balance the auditor already chose.
 */
export async function entryAnalysis(
  engagementId: string,
  datasetId: string,
  accounts: string[],
  mode: EntryMode = "any",
  rank: CounterpartRank = "abs",
  limit: CounterpartLimit = 20,
): Promise<EntryAnalysis> {
  const selected = cleanAccounts(accounts, 25);
  const safeMode: EntryMode = mode === "all" ? "all" : "any";
  const safeRank: CounterpartRank = RANK_SQL[rank] ? rank : "abs";
  const cap = limit === "all" ? ALL_CAP : [10, 20, 50].includes(limit as number) ? (limit as number) : 20;

  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const scope = [datasetId, engagementId, selected];
    // "all" needs every selected account present in the entry; "any" needs one
    const need = safeMode === "all" ? selected.length : 1;
    const entriesCte = `
      WITH sel AS (
        SELECT je_number, count(DISTINCT account) FILTER (WHERE account = ANY($3::text[])) AS matched
          FROM gl_line WHERE dataset_id = $1 AND engagement_id = $2
         GROUP BY je_number),
      ent AS (SELECT je_number FROM sel WHERE matched >= $4::int),
      counter AS (
        SELECT l.* FROM gl_line l JOIN ent ON ent.je_number = l.je_number
         WHERE l.dataset_id = $1 AND l.engagement_id = $2
           AND NOT (l.account = ANY($3::text[])))`;

    const head = await tx.query<{ entries: number; accounts: number; debit: number; credit: number; net: number }>(
      `${entriesCte}
       SELECT (SELECT count(*)::int FROM ent) AS entries,
              count(DISTINCT account)::int AS accounts,
              coalesce(sum(debit), 0)::float8 AS debit,
              coalesce(sum(credit), 0)::float8 AS credit,
              coalesce(sum(signed), 0)::float8 AS net
         FROM counter`,
      [...scope, need],
    );

    const tops = await tx.query<{
      account: string; name: string | null; net: number; gross: number;
      postings: number; entries: number;
    }>(
      `${entriesCte}
       SELECT account, min(account_name) AS name,
              coalesce(sum(signed), 0)::float8 AS net,
              coalesce(sum(abs(signed)), 0)::float8 AS gross,
              count(*)::int AS postings,
              count(DISTINCT je_number)::int AS entries
         FROM counter GROUP BY account
        ORDER BY ${RANK_SQL[safeRank]}
        LIMIT ${cap}`,
      [...scope, need],
    );
    const shown = tops.rows.map((r) => r.account);

    const grid = shown.length === 0
      ? { rows: [] as { m: string; account: string; v: number }[] }
      : await tx.query<{ m: string; account: string; v: number }>(
          `${entriesCte}
           SELECT ${MONTH} AS m, account, coalesce(sum(signed), 0)::float8 AS v
             FROM counter WHERE account = ANY($5::text[])
            GROUP BY 1, 2 ORDER BY 1`,
          [...scope, need, shown],
        );

    const index = new Map(shown.map((a, i) => [a, i]));
    const byMonth = new Map<string, (number | null)[]>();
    for (const r of grid.rows) {
      const arr = byMonth.get(r.m) ?? Array.from({ length: shown.length }, () => null as number | null);
      const i = index.get(r.account);
      if (i !== undefined) arr[i] = round2((arr[i] ?? 0) + r.v);
      byMonth.set(r.m, arr);
    }

    const h = head.rows[0];
    return {
      accounts: selected,
      mode: safeMode,
      rank: safeRank,
      linkedEntries: h?.entries ?? 0,
      counterpartAccounts: tops.rows.map((r) => ({
        account: r.account, name: r.name, net: round2(r.net), gross: round2(r.gross),
        postings: r.postings, entries: r.entries,
      })),
      months: [...byMonth.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, cells]) => ({
          month,
          cells,
          total: round2(cells.reduce((s: number, v) => s + (v ?? 0), 0)),
        })),
      totalDebit: round2(h?.debit ?? 0),
      totalCredit: round2(h?.credit ?? 0),
      net: round2(h?.net ?? 0),
      hiddenAccounts: Math.max(0, (h?.accounts ?? 0) - shown.length),
    };
  });
}

// ---------------------------------------------------------------------------
// 3. two-account correlation

export interface CorrelationMonth {
  month: string;
  aTotal: number;
  bTotal: number;
  /** aTotal / bTotal, sign preserved; null when bTotal is nil */
  ratio: number | null;
  difference: number;
}

export interface TwoAccountCorrelation {
  a: string;
  b: string;
  months: CorrelationMonth[];
  /** Pearson r on the signed monthly totals; null when a series is flat */
  pearson: number | null;
  /** Pearson r on the absolute monthly totals — co-movement of magnitude */
  pearsonAbs: number | null;
  /** entries containing BOTH accounts */
  commonEntries: number;
  monthsWithActivity: number;
  totalA: number;
  totalB: number;
  largestDifference: number;
  largestDifferenceMonth: string | null;
}

/**
 * Restricted to the entries where the two accounts actually meet. Correlating
 * the two accounts' whole-ledger movements would measure the client's seasonal
 * rhythm; correlating only their shared entries measures the relationship
 * between them, which is the question.
 */
export async function twoAccountCorrelation(
  engagementId: string,
  datasetId: string,
  a: string,
  b: string,
): Promise<TwoAccountCorrelation> {
  const accountA = String(a ?? "").trim();
  const accountB = String(b ?? "").trim();
  if (!ACCOUNT_RE.test(accountA) || !ACCOUNT_RE.test(accountB)) throw new Error("invalid-accounts");
  if (accountA === accountB) throw new Error("same-account");

  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const cte = `
      WITH both AS (
        SELECT je_number FROM gl_line
         WHERE dataset_id = $1 AND engagement_id = $2 AND account IN ($3, $4)
         GROUP BY je_number HAVING count(DISTINCT account) = 2),
      lines AS (
        SELECT l.* FROM gl_line l JOIN both ON both.je_number = l.je_number
         WHERE l.dataset_id = $1 AND l.engagement_id = $2 AND l.account IN ($3, $4))`;
    const params = [datasetId, engagementId, accountA, accountB];

    const q = await tx.query<{ m: string; a: number; b: number }>(
      `${cte}
       SELECT ${MONTH} AS m,
              coalesce(sum(signed) FILTER (WHERE account = $3), 0)::float8 AS a,
              coalesce(sum(signed) FILTER (WHERE account = $4), 0)::float8 AS b
         FROM lines GROUP BY 1 ORDER BY 1`,
      params,
    );
    const count = await tx.query<{ n: number }>(
      `${cte} SELECT (SELECT count(*)::int FROM both) AS n`,
      params,
    );

    const months: CorrelationMonth[] = q.rows.map((r) => ({
      month: r.m,
      aTotal: round2(r.a),
      bTotal: round2(r.b),
      ratio: ratio(r.a, r.b),
      difference: round2(r.a - r.b),
    }));

    let largest = 0;
    let largestMonth: string | null = null;
    for (const m of months) {
      if (Math.abs(m.difference) > Math.abs(largest)) {
        largest = m.difference;
        largestMonth = m.month;
      }
    }

    return {
      a: accountA,
      b: accountB,
      months,
      pearson: pearson(q.rows.map((r) => r.a), q.rows.map((r) => r.b)),
      pearsonAbs: pearson(q.rows.map((r) => Math.abs(r.a)), q.rows.map((r) => Math.abs(r.b))),
      commonEntries: count.rows[0]?.n ?? 0,
      monthsWithActivity: months.filter((m) => m.aTotal !== 0 || m.bTotal !== 0).length,
      totalA: round2(q.rows.reduce((s, r) => s + r.a, 0)),
      totalB: round2(q.rows.reduce((s, r) => s + r.b, 0)),
      largestDifference: round2(largest),
      largestDifferenceMonth: largestMonth,
    };
  });
}

// ---------------------------------------------------------------------------
// 4. drill-down

export interface DrillFilter {
  /** restrict to lines posted to these accounts */
  accounts?: string[];
  /** restrict to lines belonging to entries that touch these accounts */
  entryAccounts?: string[];
  entryMode?: EntryMode;
  /** YYYY-MM, or "n/a" for lines with no readable journal date */
  month?: string;
  jeNumber?: string;
  preparer?: string;
  reviewer?: string;
  approver?: string;
  /** minimum absolute signed amount */
  minAbs?: number;
  /** only lines dated on a Saturday or Sunday */
  weekendOnly?: boolean;
  /** only lines with no document reference */
  missingReference?: boolean;
  limit?: number;
  offset?: number;
}

export interface DrillLine {
  lineNo: number;
  account: string;
  accountName: string | null;
  jeNumber: string;
  journalCode: string | null;
  journalDate: string | null;
  entryDate: string | null;
  reference: string | null;
  lineDescription: string | null;
  thirdPartyCode: string | null;
  thirdPartyName: string | null;
  preparer: string | null;
  reviewer: string | null;
  debit: number;
  credit: number;
  signed: number;
}

export interface DrillResult {
  lines: DrillLine[];
  total: number;
  limit: number;
  offset: number;
}

const DRILL_CAP = 500;
const MONTH_RE = /^(\d{4}-(0[1-9]|1[0-2])|n\/a)$/;

/**
 * The lines behind a cell. Always paginated and always capped: a drill-down is
 * evidence to read, not a second copy of the ledger to download.
 */
export async function drillDown(
  engagementId: string,
  datasetId: string,
  filter: DrillFilter,
): Promise<DrillResult> {
  const limit = Math.min(DRILL_CAP, Math.max(1, Math.floor(Number(filter.limit ?? 100)) || 100));
  const offset = Math.max(0, Math.floor(Number(filter.offset ?? 0)) || 0);

  const where: string[] = ["l.dataset_id = $1", "l.engagement_id = $2"];
  const params: unknown[] = [datasetId, engagementId];
  const add = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filter.accounts !== undefined) {
    where.push(`l.account = ANY(${add(cleanAccounts(filter.accounts, 50))}::text[])`);
  }
  if (filter.month !== undefined) {
    const month = String(filter.month).trim();
    if (!MONTH_RE.test(month)) throw new Error("invalid-month");
    where.push(`coalesce(to_char(l.journal_date, 'YYYY-MM'), 'n/a') = ${add(month)}`);
  }
  if (filter.jeNumber !== undefined) {
    where.push(`l.je_number = ${add(String(filter.jeNumber).trim().slice(0, 100))}`);
  }
  for (const [key, column] of [["preparer", "preparer"], ["reviewer", "reviewer"], ["approver", "approver"]] as const) {
    const value = filter[key];
    if (value !== undefined) {
      where.push(`coalesce(trim(l.${column}), '') = ${add(String(value).trim().slice(0, 200))}`);
    }
  }
  if (filter.minAbs !== undefined) {
    const min = Number(filter.minAbs);
    if (!Number.isFinite(min) || min < 0) throw new Error("invalid-amount");
    where.push(`abs(l.signed) >= ${add(min)}::numeric`);
  }
  if (filter.weekendOnly) where.push("extract(isodow FROM l.journal_date) IN (6, 7)");
  if (filter.missingReference) where.push("coalesce(trim(l.reference), '') = ''");

  // entry-level restriction: keep every line of the entries that touch the
  // chosen accounts, which is what a counterpart cell is made of
  let join = "";
  if (filter.entryAccounts !== undefined) {
    const entryAccounts = cleanAccounts(filter.entryAccounts, 25);
    const mode: EntryMode = filter.entryMode === "all" ? "all" : "any";
    const accountsParam = add(entryAccounts);
    const needParam = add(mode === "all" ? entryAccounts.length : 1);
    join = `JOIN (
              SELECT je_number FROM gl_line
               WHERE dataset_id = $1 AND engagement_id = $2
               GROUP BY je_number
              HAVING count(DISTINCT account) FILTER (WHERE account = ANY(${accountsParam}::text[])) >= ${needParam}::int
            ) ent ON ent.je_number = l.je_number`;
  }

  const clause = where.join(" AND ");
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const total = await tx.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM gl_line l ${join} WHERE ${clause}`,
      params,
    );
    const q = await tx.query<{
      line_no: number; account: string; account_name: string | null; je_number: string;
      journal_code: string | null; journal_date: string | null; entry_date: string | null;
      reference: string | null; line_description: string | null;
      third_party_code: string | null; third_party_name: string | null;
      preparer: string | null; reviewer: string | null;
      debit: number; credit: number; signed: number;
    }>(
      `SELECT l.line_no, l.account, l.account_name, l.je_number, l.journal_code,
              to_char(l.journal_date, 'YYYY-MM-DD') AS journal_date,
              to_char(l.entry_date, 'YYYY-MM-DD') AS entry_date,
              l.reference, coalesce(l.line_description, l.je_description) AS line_description,
              l.third_party_code, l.third_party_name, l.preparer, l.reviewer,
              l.debit::float8 AS debit, l.credit::float8 AS credit, l.signed::float8 AS signed
         FROM gl_line l ${join}
        WHERE ${clause}
        ORDER BY l.journal_date NULLS LAST, l.je_number, l.line_no
        LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    return {
      lines: q.rows.map((r) => ({
        lineNo: r.line_no,
        account: r.account,
        accountName: r.account_name,
        jeNumber: r.je_number,
        journalCode: r.journal_code,
        journalDate: r.journal_date,
        entryDate: r.entry_date,
        reference: r.reference,
        lineDescription: r.line_description,
        thirdPartyCode: r.third_party_code,
        thirdPartyName: r.third_party_name,
        preparer: r.preparer,
        reviewer: r.reviewer,
        debit: round2(r.debit),
        credit: round2(r.credit),
        signed: round2(r.signed),
      })),
      total: total.rows[0]?.n ?? 0,
      limit,
      offset,
    };
  });
}
