// General-ledger insight suite over the ingested journal_entries datasets.
// CY = the post-audit GL when present, else the pre-audit GL; PY = the
// prior-year GL. Every insight tolerates a missing PY dataset or unmapped
// optional columns by returning nulls the UI explains — only the CY dataset
// with its mandatory columns (account, jeNumber, jeDescription, amount,
// journalDate) is assumed.

import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

// ---------------------------------------------------------------------------
// shared plumbing

type Tx = PoolClient;

interface GlDataset {
  id: string;
  timing: string;
  mapping: Record<string, string>;
}

interface GlDatasets {
  /** current-year GL: post_audit if present, else pre_audit */
  cy: GlDataset | null;
  /** prior-year GL, when uploaded */
  py: GlDataset | null;
}

async function glDatasets(tx: Tx, engagementId: string): Promise<GlDatasets> {
  const result = await tx.query<{ id: string; timing: string; mapping: Record<string, string> | null }>(
    `SELECT id, timing, mapping FROM sub_ledger_dataset
      WHERE engagement_id = $1 AND kind = 'journal_entries'
      ORDER BY created_at DESC`,
    [engagementId],
  );
  const latest = (timing: string): GlDataset | null => {
    const row = result.rows.find((r) => r.timing === timing && r.mapping);
    return row ? { id: row.id, timing: row.timing, mapping: row.mapping! } : null;
  };
  return { cy: latest("post_audit") ?? latest("pre_audit"), py: latest("prior_year") };
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

// ---------------------------------------------------------------------------
// 1. preparers / reviewers

export type GlRoleKey = "recordedBy" | "preparedBy" | "approvedBy";

export interface GlRoleInsight {
  key: GlRoleKey;
  /** the column is mapped on the CY dataset */
  mapped: boolean;
  cyCount: number | null;
  /** null when there is no PY dataset or the column is unmapped there */
  pyCount: number | null;
  /** names present in CY but absent from PY (empty when PY unavailable) */
  onlyCy: string[];
  /** names present in PY but absent from CY */
  onlyPy: string[];
}

export interface PreparersReviewers {
  roles: GlRoleInsight[];
  hasPy: boolean;
}

async function distinctValues(tx: Tx, datasetId: string, column: string): Promise<string[]> {
  const result = await tx.query<{ v: string }>(
    `SELECT DISTINCT trim(data->>$2) AS v FROM sub_ledger_row
      WHERE dataset_id = $1 AND coalesce(trim(data->>$2), '') <> ''
      ORDER BY 1`,
    [datasetId, column],
  );
  return result.rows.map((r) => r.v);
}

export async function preparersReviewers(engagementId: string): Promise<PreparersReviewers | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const { cy, py } = await glDatasets(tx, engagementId);
    if (!cy) return null;
    const roles: GlRoleInsight[] = [];
    for (const key of ["recordedBy", "preparedBy", "approvedBy"] as const) {
      const cyCol = cy.mapping[key];
      const pyCol = py?.mapping[key];
      if (!cyCol) {
        roles.push({ key, mapped: false, cyCount: null, pyCount: null, onlyCy: [], onlyPy: [] });
        continue;
      }
      const cyNames = await distinctValues(tx, cy.id, cyCol);
      const pyNames = py && pyCol ? await distinctValues(tx, py.id, pyCol) : null;
      const pySet = new Set(pyNames ?? []);
      const cySet = new Set(cyNames);
      roles.push({
        key,
        mapped: true,
        cyCount: cyNames.length,
        pyCount: pyNames === null ? null : pyNames.length,
        onlyCy: pyNames === null ? [] : cyNames.filter((n) => !pySet.has(n)),
        onlyPy: pyNames === null ? [] : pyNames.filter((n) => !cySet.has(n)),
      });
    }
    return { roles, hasPy: py !== null };
  });
}

// ---------------------------------------------------------------------------
// 2. volumes per SYSCOHADA account class

export interface ClassVolumeRow {
  cls: string;
  cyLines: number;
  cyGross: number;
  pyLines: number | null;
  pyGross: number | null;
  /** % change CY vs PY, null when PY has no base */
  linesPct: number | null;
  grossPct: number | null;
}

export interface ClassVolumes {
  rows: ClassVolumeRow[];
  hasPy: boolean;
}

async function classTotals(tx: Tx, datasetId: string, accountCol: string): Promise<Map<string, { lines: number; gross: number }>> {
  const result = await tx.query<{ cls: string; lines: number; gross: string }>(
    `SELECT left(trim(data->>$2), 1) AS cls, count(*)::int AS lines,
            coalesce(sum(abs(coalesce(amount, 0))), 0)::text AS gross
       FROM sub_ledger_row
      WHERE dataset_id = $1
      GROUP BY 1`,
    [datasetId, accountCol],
  );
  const map = new Map<string, { lines: number; gross: number }>();
  for (const row of result.rows) {
    if (/^[1-7]$/.test(row.cls ?? "")) map.set(row.cls, { lines: row.lines, gross: Math.round(Number(row.gross)) });
  }
  return map;
}

export async function classVolumes(engagementId: string): Promise<ClassVolumes | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const { cy, py } = await glDatasets(tx, engagementId);
    if (!cy?.mapping.account) return null;
    const cyTotals = await classTotals(tx, cy.id, cy.mapping.account);
    const pyTotals = py?.mapping.account ? await classTotals(tx, py.id, py.mapping.account) : null;
    const pct = (now: number, base: number | null): number | null =>
      base === null || base === 0 ? null : Math.round(((now - base) / base) * 1000) / 10;
    const rows: ClassVolumeRow[] = ["1", "2", "3", "4", "5", "6", "7"].map((cls) => {
      const c = cyTotals.get(cls) ?? { lines: 0, gross: 0 };
      const p = pyTotals?.get(cls) ?? (pyTotals ? { lines: 0, gross: 0 } : null);
      return {
        cls,
        cyLines: c.lines,
        cyGross: c.gross,
        pyLines: p === null ? null : p.lines,
        pyGross: p === null ? null : p.gross,
        linesPct: pct(c.lines, p === null ? null : p.lines),
        grossPct: pct(c.gross, p === null ? null : p.gross),
      };
    });
    return { rows, hasPy: pyTotals !== null };
  });
}

// ---------------------------------------------------------------------------
// 3. journals per weekday

export interface WeekdayRow {
  /** 0 = Monday … 6 = Sunday */
  dow: number;
  journals: number;
  lines: number;
  gross: number;
}

export interface WeekdayAnalysis {
  rows: WeekdayRow[];
  /** lines skipped because their journal date could not be read */
  undated: number;
}

export async function weekdayAnalysis(engagementId: string): Promise<WeekdayAnalysis | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const { cy } = await glDatasets(tx, engagementId);
    if (!cy?.mapping.journalDate || !cy.mapping.jeNumber) return null;
    const result = await tx.query<{ jdate: string | null; je: string | null; amt: string | null }>(
      `SELECT data->>$2 AS jdate, data->>$3 AS je, abs(coalesce(amount, 0))::text AS amt
         FROM sub_ledger_row WHERE dataset_id = $1`,
      [cy.id, cy.mapping.journalDate, cy.mapping.jeNumber],
    );
    const rows: WeekdayRow[] = Array.from({ length: 7 }, (_, dow) => ({ dow, journals: 0, lines: 0, gross: 0 }));
    const journals: Set<string>[] = Array.from({ length: 7 }, () => new Set<string>());
    let undated = 0;
    for (const line of result.rows) {
      const date = parseDate(line.jdate);
      if (!date) {
        undated += 1;
        continue;
      }
      const dow = (date.getUTCDay() + 6) % 7; // 0 = Monday
      rows[dow].lines += 1;
      rows[dow].gross += Number(line.amt ?? 0);
      const je = String(line.je ?? "").trim();
      if (je) journals[dow].add(je);
    }
    for (const row of rows) {
      row.journals = journals[row.dow].size;
      row.gross = Math.round(row.gross);
    }
    return { rows, undated };
  });
}

// ---------------------------------------------------------------------------
// 4. entry date vs effective date lag

export interface EntryLagBucket {
  key: "d0" | "d1_7" | "d8_30" | "d31_90" | "over90";
  journals: number;
}

export interface EntryLag {
  avgDays: number;
  maxDays: number;
  /** journals with both dates readable */
  journals: number;
  buckets: EntryLagBucket[];
}

/** null when the JE entry date column is unmapped (the UI shows a mapping hint). */
export async function entryLag(engagementId: string): Promise<EntryLag | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const { cy } = await glDatasets(tx, engagementId);
    if (!cy?.mapping.jeDate || !cy.mapping.journalDate || !cy.mapping.jeNumber) return null;
    const result = await tx.query<{ je: string | null; jdate: string | null; edate: string | null }>(
      `SELECT data->>$2 AS je, data->>$3 AS jdate, data->>$4 AS edate
         FROM sub_ledger_row WHERE dataset_id = $1`,
      [cy.id, cy.mapping.jeNumber, cy.mapping.journalDate, cy.mapping.jeDate],
    );
    // first readable date pair per journal
    const lagByJournal = new Map<string, number>();
    for (const line of result.rows) {
      const je = String(line.je ?? "").trim();
      if (!je || lagByJournal.has(je)) continue;
      const effective = parseDate(line.jdate);
      const entered = parseDate(line.edate);
      if (!effective || !entered) continue;
      lagByJournal.set(je, Math.round((entered.getTime() - effective.getTime()) / 86_400_000));
    }
    const lags = [...lagByJournal.values()];
    const buckets: EntryLagBucket[] = [
      { key: "d0", journals: 0 },
      { key: "d1_7", journals: 0 },
      { key: "d8_30", journals: 0 },
      { key: "d31_90", journals: 0 },
      { key: "over90", journals: 0 },
    ];
    for (const lag of lags) {
      const idx = lag <= 0 ? 0 : lag <= 7 ? 1 : lag <= 30 ? 2 : lag <= 90 ? 3 : 4;
      buckets[idx].journals += 1;
    }
    const avg = lags.length ? lags.reduce((s, v) => s + v, 0) / lags.length : 0;
    return {
      avgDays: Math.round(avg * 10) / 10,
      maxDays: lags.length ? Math.max(...lags) : 0,
      journals: lags.length,
      buckets,
    };
  });
}

// ---------------------------------------------------------------------------
// 5. account correlation

export interface GlPrefix {
  prefix: string;
  lines: number;
  name: string | null;
}

/** Distinct 3-digit account prefixes of the CY GL, for the correlation picker. */
export async function glAccountPrefixes(engagementId: string): Promise<GlPrefix[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const { cy } = await glDatasets(tx, engagementId);
    if (!cy?.mapping.account) return [];
    const nameCol = cy.mapping.accountName;
    const result = nameCol
      ? await tx.query<{ prefix: string; lines: number; name: string | null }>(
          `SELECT left(trim(data->>$2), 3) AS prefix, count(*)::int AS lines,
                  min(nullif(trim(data->>$3), '')) AS name
             FROM sub_ledger_row
            WHERE dataset_id = $1 AND trim(data->>$2) ~ '^[0-9]{3}'
            GROUP BY 1 ORDER BY 1`,
          [cy.id, cy.mapping.account, nameCol],
        )
      : await tx.query<{ prefix: string; lines: number; name: string | null }>(
          `SELECT left(trim(data->>$2), 3) AS prefix, count(*)::int AS lines, NULL AS name
             FROM sub_ledger_row
            WHERE dataset_id = $1 AND trim(data->>$2) ~ '^[0-9]{3}'
            GROUP BY 1 ORDER BY 1`,
          [cy.id, cy.mapping.account],
        );
    return result.rows.map((r) => ({ prefix: r.prefix, lines: r.lines, name: r.name }));
  });
}

export interface CorrelationPair {
  a: string;
  b: string;
  /** Pearson r on daily line volumes, 2 decimals; null when a series has no variance */
  r: number | null;
}

export interface CorrelationResult {
  prefixes: { prefix: string; lines: number; gross: number }[];
  /** journals (jeNumber) touching EVERY selected prefix */
  sharedJournals: number;
  /** 12 rows (Jan..Dec) x 31 columns (day of month): shared-journal counts */
  matrix: number[][];
  pairs: CorrelationPair[];
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i += 1) {
    cov += (xs[i] - mx) * (ys[i] - my);
    vx += (xs[i] - mx) ** 2;
    vy += (ys[i] - my) ** 2;
  }
  if (vx === 0 || vy === 0) return null;
  return Math.round((cov / Math.sqrt(vx * vy)) * 100) / 100;
}

/**
 * Correlation study limited to the latest CY dataset: which journals touch
 * every selected account prefix, when in the year they land (month x
 * day-of-month), and how the prefixes' daily line volumes co-move.
 */
export async function correlationMatrix(engagementId: string, accounts: string[]): Promise<CorrelationResult | null> {
  const cleaned = [...new Set(accounts.map((a) => String(a).trim()))];
  if (cleaned.length < 2 || cleaned.length > 6 || cleaned.some((a) => !/^[0-9]{2,4}$/.test(a))) {
    throw new Error("invalid-accounts");
  }
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const { cy } = await glDatasets(tx, engagementId);
    if (!cy?.mapping.account || !cy.mapping.jeNumber || !cy.mapping.journalDate) return null;
    const result = await tx.query<{ account: string | null; je: string | null; jdate: string | null; amt: string | null }>(
      `SELECT data->>$2 AS account, data->>$3 AS je, data->>$4 AS jdate, abs(coalesce(amount, 0))::text AS amt
         FROM sub_ledger_row WHERE dataset_id = $1`,
      [cy.id, cy.mapping.account, cy.mapping.jeNumber, cy.mapping.journalDate],
    );

    const totals = new Map(cleaned.map((p) => [p, { lines: 0, gross: 0 }]));
    const journalsByPrefix = new Map(cleaned.map((p) => [p, new Set<string>()]));
    // per prefix: daily line counts keyed by ISO date, for the Pearson vectors
    const dailyByPrefix = new Map(cleaned.map((p) => [p, new Map<string, number>()]));
    const allDates = new Set<string>();
    const journalDate = new Map<string, Date>();

    for (const line of result.rows) {
      const account = String(line.account ?? "").trim();
      const je = String(line.je ?? "").trim();
      const date = parseDate(line.jdate);
      if (je && date && !journalDate.has(je)) journalDate.set(je, date);
      for (const prefix of cleaned) {
        if (!account.startsWith(prefix)) continue;
        const total = totals.get(prefix)!;
        total.lines += 1;
        total.gross += Number(line.amt ?? 0);
        if (je) journalsByPrefix.get(prefix)!.add(je);
        if (date) {
          const iso = date.toISOString().slice(0, 10);
          allDates.add(iso);
          const daily = dailyByPrefix.get(prefix)!;
          daily.set(iso, (daily.get(iso) ?? 0) + 1);
        }
      }
    }

    // journals that touch EVERY selected prefix
    let shared: Set<string> | null = null;
    for (const prefix of cleaned) {
      const set = journalsByPrefix.get(prefix)!;
      if (shared === null) {
        shared = new Set(set);
      } else {
        const prev: Set<string> = shared;
        shared = new Set([...prev].filter((je) => set.has(je)));
      }
    }
    const sharedJournals = shared ?? new Set<string>();

    const matrix: number[][] = Array.from({ length: 12 }, () => Array.from({ length: 31 }, () => 0));
    for (const je of sharedJournals) {
      const date = journalDate.get(je);
      if (!date) continue;
      matrix[date.getUTCMonth()][date.getUTCDate() - 1] += 1;
    }

    const dates = [...allDates].sort();
    const vectors = new Map(
      cleaned.map((p) => [p, dates.map((iso) => dailyByPrefix.get(p)!.get(iso) ?? 0)]),
    );
    const pairs: CorrelationPair[] = [];
    for (let i = 0; i < cleaned.length; i += 1) {
      for (let j = i + 1; j < cleaned.length; j += 1) {
        pairs.push({ a: cleaned[i], b: cleaned[j], r: pearson(vectors.get(cleaned[i])!, vectors.get(cleaned[j])!) });
      }
    }

    return {
      prefixes: cleaned.map((p) => {
        const total = totals.get(p)!;
        return { prefix: p, lines: total.lines, gross: Math.round(total.gross) };
      }),
      sharedJournals: sharedJournals.size,
      matrix,
      pairs,
    };
  });
}
