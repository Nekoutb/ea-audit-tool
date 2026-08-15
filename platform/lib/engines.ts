// Phase 5 automation engines (spec §11). Every run records inputs (dataset),
// parameters, user and results — full reproducibility — and produces an Excel
// working-paper output indexed under the section. Exceptions route into the
// findings system; projected misstatements land in C1.1 automatically.

import { createHash, createHmac } from "node:crypto";
import ExcelJS from "exceljs";
import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { routeFinding } from "@/lib/execution";
import { CONFIDENCE_FACTORS, musPlan, type ConfidenceLevel } from "@/lib/sampling-params";
import { requireTenant } from "@/lib/tenant";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export class EngineError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "EngineError";
  }
}

export type Engine =
  | "sampling"
  | "recon_subledger"
  | "recon_far"
  | "recon_bank"
  | "recon_supplier"
  | "je_testing"
  | "substantive_analytics";

/** Deterministic pseudo-random in [0,1) from a seed + index — reproducible runs. */
export function seededRandom(seed: string, index: number): number {
  const digest = createHmac("sha256", seed).update(String(index)).digest();
  return digest.readUInt32BE(0) / 0x100000000;
}

interface DatasetRow {
  rowNo: number;
  data: Record<string, unknown>;
  amount: number | null;
}

async function loadDataset(
  tx: PoolClient,
  datasetId: string,
): Promise<{ engagementId: string; kind: string; rows: DatasetRow[]; total: number }> {
  const dataset = await tx.query<{ engagement_id: string; kind: string }>(
    "SELECT engagement_id, kind FROM sub_ledger_dataset WHERE id = $1",
    [datasetId],
  );
  if (!dataset.rows[0]) throw new EngineError("not-found");
  const rows = await tx.query<{ row_no: number; data: Record<string, unknown>; amount: string | null }>(
    "SELECT row_no, data, amount FROM sub_ledger_row WHERE dataset_id = $1 ORDER BY row_no",
    [datasetId],
  );
  const parsed = rows.rows.map((row) => ({
    rowNo: row.row_no,
    data: row.data,
    amount: row.amount === null ? null : Number(row.amount),
  }));
  return {
    engagementId: dataset.rows[0].engagement_id,
    kind: dataset.rows[0].kind,
    rows: parsed,
    total: parsed.reduce((sum, row) => sum + (row.amount ?? 0), 0),
  };
}

async function tbClosingForPrefixes(
  tx: PoolClient,
  engagementId: string,
  prefixes: string[],
): Promise<number> {
  const result = await tx.query<{ total: string | null }>(
    `SELECT sum(r.opening_debit - r.opening_credit + r.debit - r.credit)::text AS total
       FROM trial_balance tb
       JOIN trial_balance_version v ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
       JOIN trial_balance_row r ON r.version_id = v.id
      WHERE tb.engagement_id = $1
        AND (${prefixes.map((_, i) => `r.account_code LIKE $${i + 2} || '%'`).join(" OR ")})`,
    [engagementId, ...prefixes],
  );
  return Number(result.rows[0]?.total ?? 0);
}

async function materialityThresholds(
  tx: PoolClient,
  engagementId: string,
): Promise<{ performance: number | null; trivial: number | null }> {
  const result = await tx.query<{ performance: string; trivial: string }>(
    `SELECT performance::text, trivial::text FROM materiality
      WHERE engagement_id = $1 AND status = 'approved'
      ORDER BY version_no DESC LIMIT 1`,
    [engagementId],
  );
  return result.rows[0]
    ? { performance: Number(result.rows[0].performance), trivial: Number(result.rows[0].trivial) }
    : { performance: null, trivial: null };
}

async function storeRun(
  tx: PoolClient,
  tenantId: string,
  userId: string,
  input: {
    engagementId: string;
    fileItemId?: string;
    engine: Engine;
    params: Record<string, unknown>;
    datasetId?: string;
    summary: Record<string, unknown>;
    sheetTitle: string;
    header: string[];
    rows: (string | number | null)[][];
  },
): Promise<{ runId: string; documentId: string }> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(input.sheetTitle.slice(0, 30));
  sheet.addRow([`Engine: ${input.engine}`]);
  sheet.addRow([`Params: ${JSON.stringify(input.params)}`]);
  sheet.addRow([`Summary: ${JSON.stringify(input.summary)}`]);
  sheet.addRow([]);
  const headerRow = sheet.addRow(input.header);
  headerRow.font = { bold: true };
  for (const row of input.rows) sheet.addRow(row);
  const content = Buffer.from(await workbook.xlsx.writeBuffer());

  let documentId: string | null = null;
  if (input.fileItemId) {
    const doc = await tx.query<{ id: string }>(
      `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, kind, created_by, current_version)
       VALUES ($1, $2, $3, $4, 'en', 'engine_output', $5, 1) RETURNING id`,
      [tenantId, input.engagementId, input.fileItemId, `${input.sheetTitle} — ${new Date().toISOString().slice(0, 16)}`, userId],
    );
    documentId = doc.rows[0].id;
    await tx.query(
      `INSERT INTO document_version
         (tenant_id, document_id, version_no, mime, byte_size, sha256, content, note, created_by)
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8)`,
      [tenantId, documentId, XLSX_MIME, content.length, createHash("sha256").update(content).digest("hex"), content, `engine:${input.engine}`, userId],
    );
  }
  const run = await tx.query<{ id: string }>(
    `INSERT INTO automation_run
       (tenant_id, engagement_id, file_item_id, engine, params, dataset_id, result_summary, output_document_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [tenantId, input.engagementId, input.fileItemId ?? null, input.engine, JSON.stringify(input.params), input.datasetId ?? null, JSON.stringify(input.summary), documentId, userId],
  );
  return { runId: run.rows[0].id, documentId: documentId ?? "" };
}

// ---- 5.2 sampling (ISA 530) ----

export type SamplingMethod = "random" | "systematic" | "mus" | "criteria";

export interface SamplingResult {
  runId: string;
  documentId: string;
  selected: number;
  populationTotal: number;
  sampledValue: number;
  keyItems: number;
}

/** A2 (§04): what the MUS extent computation recorded on the run. */
interface MusComputation {
  populationValue: number;
  tolerable: number;
  expectedMisstatement: number;
  confidence: ConfidenceLevel;
  factor: number;
  interval: number;
  sampleSize: number;
}

export async function runSampling(input: {
  fileItemId: string;
  datasetId: string;
  method: SamplingMethod;
  sampleSize: number;
  seed: string;
  /** criteria method: everything above this is a key item, remainder sampled. */
  threshold?: number;
  /** A2 upgrade: with a confidence level and an approved tolerable
   *  (performance materiality), the MUS size is computed, not typed (R17). */
  confidence?: ConfidenceLevel;
  expectedMisstatement?: number;
  /** Manual size override — rationale mandatory, flagged in the summary (R17). */
  overrideSize?: number;
  overrideRationale?: string;
}): Promise<SamplingResult> {
  const { tenantId, userId } = await requireTenant();
  if (input.sampleSize < 1) throw new EngineError("invalid-sample-size");
  if (!input.seed.trim()) throw new EngineError("seed-required");

  return withTenant(tenantId, async (tx) => {
    const dataset = await loadDataset(tx, input.datasetId);
    const rows = dataset.rows;
    const selected = new Map<number, { row: DatasetRow; reason: string }>();

    // §04 arithmetic spine: interval = tolerable ÷ factor; size = population ÷
    // interval. Falls back to the typed size when no confidence was supplied
    // or materiality is not yet approved (legacy runs keep working).
    let effectiveSize = input.sampleSize;
    let sizeSource: "typed" | "computed" | "override" = "typed";
    let computed: MusComputation | null = null;
    if (input.method === "mus" && input.confidence !== undefined) {
      if (!CONFIDENCE_FACTORS[input.confidence]) throw new EngineError("invalid-confidence");
      const thresholds = await materialityThresholds(tx, dataset.engagementId);
      if (thresholds.performance !== null && thresholds.performance > 0) {
        const populationValue = rows.reduce((sum, row) => sum + Math.abs(row.amount ?? 0), 0);
        if (populationValue <= 0) throw new EngineError("empty-population");
        const plan = musPlan({
          populationValue,
          tolerable: thresholds.performance,
          expected: input.expectedMisstatement ?? 0,
          confidence: input.confidence,
        });
        computed = {
          populationValue,
          tolerable: thresholds.performance,
          expectedMisstatement: input.expectedMisstatement ?? 0,
          confidence: input.confidence,
          factor: plan.factor,
          interval: Math.round(plan.interval),
          sampleSize: plan.sampleSize,
        };
        effectiveSize = plan.sampleSize;
        sizeSource = "computed";
      }
    }
    if (input.overrideSize !== undefined) {
      if (input.overrideSize < 1) throw new EngineError("invalid-sample-size");
      if (!input.overrideRationale?.trim()) throw new EngineError("override-rationale-required");
      effectiveSize = input.overrideSize;
      sizeSource = "override";
    }

    if (input.method === "criteria") {
      const threshold = input.threshold ?? 0;
      if (threshold <= 0) throw new EngineError("threshold-required");
      for (const row of rows) {
        if (Math.abs(row.amount ?? 0) > threshold) selected.set(row.rowNo, { row, reason: "key-item" });
      }
    }
    const remainder = rows.filter((row) => !selected.has(row.rowNo));
    const remainderNeeded = Math.max(0, effectiveSize - (input.method === "criteria" ? 0 : 0));

    if (input.method === "random" || input.method === "criteria") {
      const pool = [...remainder];
      let index = 0;
      while (selected.size < (input.method === "criteria" ? selected.size + Math.min(remainderNeeded || effectiveSize, pool.length) : Math.min(effectiveSize, rows.length)) && pool.length > 0) {
        const pick = Math.floor(seededRandom(input.seed, index) * pool.length);
        const [row] = pool.splice(pick, 1);
        if (!selected.has(row.rowNo)) selected.set(row.rowNo, { row, reason: "random" });
        index += 1;
        if (input.method === "criteria" && index >= effectiveSize) break;
      }
    } else if (input.method === "systematic") {
      const interval = Math.max(1, Math.floor(rows.length / effectiveSize));
      const start = Math.floor(seededRandom(input.seed, 0) * interval);
      for (let i = start; i < rows.length && selected.size < effectiveSize; i += interval) {
        selected.set(rows[i].rowNo, { row: rows[i], reason: "systematic" });
      }
    } else if (input.method === "mus") {
      const total = rows.reduce((sum, row) => sum + Math.abs(row.amount ?? 0), 0);
      if (total <= 0) throw new EngineError("empty-population");
      const interval = total / effectiveSize;
      let target = seededRandom(input.seed, 0) * interval;
      let cumulative = 0;
      for (const row of rows) {
        cumulative += Math.abs(row.amount ?? 0);
        while (cumulative > target && selected.size < effectiveSize) {
          selected.set(row.rowNo, { row, reason: "mus" });
          target += interval;
        }
      }
    }

    const picks = [...selected.values()];
    const sampledValue = picks.reduce((sum, pick) => sum + Math.abs(pick.row.amount ?? 0), 0);
    const summary = {
      method: input.method,
      populationRows: rows.length,
      populationTotal: dataset.total,
      selected: picks.length,
      sampledValue,
      keyItems: picks.filter((pick) => pick.reason === "key-item").length,
      // A2: how the extent was set — "computed" means the §04 spine produced
      // it; "override" is surfaced to the reviewer with its rationale (R17).
      sampleSize: effectiveSize,
      sizeSource,
      ...(computed ? { computed } : {}),
      ...(sizeSource === "override"
        ? { override: true, overrideRationale: input.overrideRationale?.trim() }
        : {}),
    };
    const headers = Object.keys(rows[0]?.data ?? {});
    const { runId, documentId } = await storeRun(tx, tenantId, userId, {
      engagementId: dataset.engagementId,
      fileItemId: input.fileItemId,
      engine: "sampling",
      params: {
        method: input.method,
        sampleSize: input.sampleSize,
        seed: input.seed,
        threshold: input.threshold ?? null,
        confidence: input.confidence ?? null,
        expectedMisstatement: input.expectedMisstatement ?? null,
        overrideSize: input.overrideSize ?? null,
        overrideRationale: input.overrideRationale ?? null,
      },
      datasetId: input.datasetId,
      summary,
      sheetTitle: "Sampling worksheet",
      header: ["row_no", "reason", ...headers],
      rows: picks.map((pick) => [pick.row.rowNo, pick.reason, ...headers.map((h) => String(pick.row.data[h] ?? ""))]),
    });
    return { runId, documentId, selected: picks.length, populationTotal: dataset.total, sampledValue, keyItems: summary.keyItems };
  });
}

/** 5.3: evaluate sample results — projected misstatement auto-raised to C1.1. */
export async function evaluateSampling(
  runId: string,
  misstatementFound: number,
): Promise<{ projected: number; raisedToB5: boolean }> {
  const { tenantId } = await requireTenant();
  const context = await withTenant(tenantId, async (tx) => {
    const run = await tx.query<{
      engagement_id: string;
      file_item_id: string | null;
      result_summary: { sampledValue: number; populationTotal: number };
    }>(
      "SELECT engagement_id, file_item_id, result_summary FROM automation_run WHERE id = $1 AND engine = 'sampling'",
      [runId],
    );
    if (!run.rows[0]) throw new EngineError("not-found");
    const { sampledValue, populationTotal } = run.rows[0].result_summary;
    if (!sampledValue || sampledValue <= 0) throw new EngineError("empty-population");
    const projected = Math.round((misstatementFound / sampledValue) * Math.abs(populationTotal));
    const thresholds = await materialityThresholds(tx, run.rows[0].engagement_id);
    await tx.query(
      `UPDATE automation_run
          SET result_summary = result_summary || $2::jsonb
        WHERE id = $1`,
      [runId, JSON.stringify({ misstatementFound, projected })],
    );
    return {
      engagementId: run.rows[0].engagement_id,
      fileItemId: run.rows[0].file_item_id,
      projected,
      aboveTrivial: thresholds.trivial !== null && Math.abs(projected) >= thresholds.trivial,
    };
  });

  if (context.aboveTrivial) {
    await routeFinding({
      engagementId: context.engagementId,
      fileItemId: context.fileItemId ?? undefined,
      route: "b5",
      title: `Projected misstatement from sampling run ${runId.slice(0, 8)}`,
      amount: context.projected,
      mtype: "projected",
    });
  }
  return { projected: context.projected, raisedToB5: context.aboveTrivial };
}

// ---- 5.4/5.5/5.6 reconciliations ----

const RECON_PREFIXES: Record<string, string[]> = {
  ar_open_items: ["41"],
  ap_open_items: ["40"],
  inventory_listing: ["31", "32", "33", "34", "35", "36", "37", "38"],
  payroll_register: ["42", "66"],
  fixed_asset_register: ["21", "22", "23", "24", "25", "28", "29"],
  bank_statement: ["52", "53", "55", "56", "57", "58"],
};

export interface ReconResult {
  runId: string;
  documentId: string;
  datasetTotal: number;
  tbTotal: number;
  difference: number;
  aboveTrivial: boolean;
  staleItems?: number;
}

/** Sub-ledger → TB, FAR → TB, and bank-rec re-performance in one engine core. */
export async function runReconciliation(input: {
  fileItemId: string;
  datasetId: string;
  /** bank rec: rows with a date column older than this many days are stale. */
  staleDays?: number;
  periodEnd?: string;
}): Promise<ReconResult> {
  const { tenantId, userId } = await requireTenant();
  const outcome = await withTenant(tenantId, async (tx) => {
    const dataset = await loadDataset(tx, input.datasetId);
    const prefixes = RECON_PREFIXES[dataset.kind];
    if (!prefixes) throw new EngineError("unsupported-dataset");
    const tbTotal = await tbClosingForPrefixes(tx, dataset.engagementId, prefixes);
    // AP/credit balances: dataset totals are positive listings; TB closing for
    // liability prefixes is negative — compare on sign-adjusted book value.
    const liability = dataset.kind === "ap_open_items";
    const book = liability ? -tbTotal : tbTotal;
    const difference = dataset.total - book;
    const thresholds = await materialityThresholds(tx, dataset.engagementId);
    const aboveTrivial = thresholds.trivial !== null && Math.abs(difference) > thresholds.trivial;

    // Bank rec: age outstanding items when a date column exists.
    let staleItems = 0;
    const dateKey = Object.keys(dataset.rows[0]?.data ?? {}).find((key) => /date/i.test(key));
    const staleRows: (string | number | null)[][] = [];
    if (dataset.kind === "bank_statement" && dateKey && input.periodEnd) {
      const cutoff = new Date(input.periodEnd).getTime() - (input.staleDays ?? 30) * 86_400_000;
      for (const row of dataset.rows) {
        const when = new Date(String(row.data[dateKey])).getTime();
        if (Number.isFinite(when) && when < cutoff) {
          staleItems += 1;
          staleRows.push([row.rowNo, String(row.data[dateKey]), row.amount]);
        }
      }
    }

    const engine =
      dataset.kind === "fixed_asset_register"
        ? "recon_far"
        : dataset.kind === "bank_statement"
          ? "recon_bank"
          : "recon_subledger";
    const summary = { datasetTotal: dataset.total, tbTotal: book, difference, aboveTrivial, staleItems };
    const { runId, documentId } = await storeRun(tx, tenantId, userId, {
      engagementId: dataset.engagementId,
      fileItemId: input.fileItemId,
      engine,
      params: { datasetKind: dataset.kind, prefixes, staleDays: input.staleDays ?? null },
      datasetId: input.datasetId,
      summary,
      sheetTitle: "Reconciliation",
      header: ["measure", "amount"],
      rows: [
        ["dataset_total", dataset.total],
        ["tb_total", book],
        ["difference", difference],
        ...(staleRows.length > 0 ? ([["-- stale items --", null]] as (string | number | null)[][]) : []),
        ...staleRows,
      ],
    });
    return { runId, documentId, datasetTotal: dataset.total, tbTotal: book, difference, aboveTrivial, staleItems, engagementId: dataset.engagementId, kind: dataset.kind };
  });

  if (outcome.aboveTrivial) {
    await routeFinding({
      engagementId: outcome.engagementId,
      fileItemId: input.fileItemId,
      route: "b4",
      title: `Unreconciled difference (${outcome.kind}): ${Math.round(outcome.difference)}`,
      detail: `Dataset ${Math.round(outcome.datasetTotal)} vs TB ${Math.round(outcome.tbTotal)} — investigate.`,
    });
  }
  return outcome;
}

// ---- 5.7 supplier statements ----

export async function runSupplierRecon(input: {
  fileItemId: string;
  statementsDatasetId: string;
  ledgerDatasetId: string;
}): Promise<{ runId: string; documentId: string; suppliersCompared: number; differences: number }> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const statements = await loadDataset(tx, input.statementsDatasetId);
    const ledger = await loadDataset(tx, input.ledgerDatasetId);
    const supplierKey = (rows: DatasetRow[]): string | undefined =>
      Object.keys(rows[0]?.data ?? {}).find((key) => /supplier|fournisseur|name|nom/i.test(key));
    const statementKey = supplierKey(statements.rows);
    const ledgerKey = supplierKey(ledger.rows);
    if (!statementKey || !ledgerKey) throw new EngineError("supplier-column-missing");

    const sumBy = (rows: DatasetRow[], key: string): Map<string, number> => {
      const map = new Map<string, number>();
      for (const row of rows) {
        const supplier = String(row.data[key] ?? "").trim();
        if (!supplier) continue;
        map.set(supplier, (map.get(supplier) ?? 0) + (row.amount ?? 0));
      }
      return map;
    };
    const statementTotals = sumBy(statements.rows, statementKey);
    const ledgerTotals = sumBy(ledger.rows, ledgerKey);
    const suppliers = new Set([...statementTotals.keys(), ...ledgerTotals.keys()]);
    const lines: (string | number | null)[][] = [];
    let differences = 0;
    for (const supplier of [...suppliers].sort()) {
      const statement = statementTotals.get(supplier) ?? 0;
      const book = ledgerTotals.get(supplier) ?? 0;
      const diff = statement - book;
      if (Math.abs(diff) > 0.01) differences += 1;
      lines.push([supplier, statement, book, diff]);
    }
    const { runId, documentId } = await storeRun(tx, tenantId, userId, {
      engagementId: statements.engagementId,
      fileItemId: input.fileItemId,
      engine: "recon_supplier",
      params: { statementsDatasetId: input.statementsDatasetId, ledgerDatasetId: input.ledgerDatasetId },
      datasetId: input.statementsDatasetId,
      summary: { suppliersCompared: suppliers.size, differences },
      sheetTitle: "Supplier statements",
      header: ["supplier", "statement", "ledger", "difference"],
      rows: lines,
    });
    return { runId, documentId, suppliersCompared: suppliers.size, differences };
  });
}

// ---- 5.8 journal-entry testing ----

export interface JeScore {
  rowNo: number;
  score: number;
  flags: string[];
}

export async function runJeTesting(input: {
  fileItemId: string;
  datasetId: string;
  periodEnd: string;
  largeThreshold?: number;
}): Promise<{ runId: string; documentId: string; scored: number; flagged: number }> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const dataset = await loadDataset(tx, input.datasetId);
    const thresholds = await materialityThresholds(tx, dataset.engagementId);
    const large = input.largeThreshold ?? thresholds.performance ?? 0;
    const keys = Object.keys(dataset.rows[0]?.data ?? {});
    const dateKey = keys.find((key) => /date/i.test(key));
    const end = new Date(input.periodEnd).getTime();

    const scores: JeScore[] = dataset.rows.map((row) => {
      const flags: string[] = [];
      const amount = Math.abs(row.amount ?? 0);
      if (amount > 0 && amount % 1_000_000 === 0) flags.push("round-amount");
      if (large > 0 && amount >= large) flags.push("large");
      if (dateKey) {
        const when = new Date(String(row.data[dateKey])).getTime();
        if (Number.isFinite(when)) {
          const day = new Date(when).getDay();
          if (day === 0 || day === 6) flags.push("weekend");
          if (end - when <= 5 * 86_400_000 && end - when >= 0) flags.push("period-end");
        }
      }
      return { rowNo: row.rowNo, score: flags.length, flags };
    });
    const flagged = scores.filter((score) => score.score > 0);
    flagged.sort((a, b) => b.score - a.score);

    const { runId, documentId } = await storeRun(tx, tenantId, userId, {
      engagementId: dataset.engagementId,
      fileItemId: input.fileItemId,
      engine: "je_testing",
      params: { periodEnd: input.periodEnd, largeThreshold: large },
      datasetId: input.datasetId,
      summary: { scored: scores.length, flagged: flagged.length },
      sheetTitle: "JE testing",
      header: ["row_no", "score", "flags", ...keys],
      rows: flagged.map((score) => {
        const row = dataset.rows.find((r) => r.rowNo === score.rowNo)!;
        return [score.rowNo, score.score, score.flags.join("+"), ...keys.map((key) => String(row.data[key] ?? ""))];
      }),
    });
    return { runId, documentId, scored: scores.length, flagged: flagged.length };
  });
}

// ---- 5.9 substantive analytics ----

export async function runSubstantiveAnalytic(input: {
  fileItemId: string;
  expectation: number;
  tolerance: number;
  basis: string;
}): Promise<{ runId: string; actual: number; variance: number; raisedToB5: boolean }> {
  const { tenantId, userId } = await requireTenant();
  if (!(input.tolerance > 0)) throw new EngineError("tolerance-required");
  const outcome = await withTenant(tenantId, async (tx) => {
    const item = await tx.query<{ engagement_id: string; code: string }>(
      "SELECT engagement_id, code FROM file_item WHERE id = $1",
      [input.fileItemId],
    );
    if (!item.rows[0]) throw new EngineError("not-found");
    const engagementId = item.rows[0].engagement_id;

    // Actual = grouped closing of this section from the current TB.
    const clientRow = await tx.query<{ client_id: string }>(
      "SELECT client_id FROM engagement WHERE id = $1",
      [engagementId],
    );
    const rules = await tx.query<{ account_prefix: string }>(
      `SELECT account_prefix FROM syscohada_grouping_rule WHERE active AND section_code = $2
       UNION SELECT account_prefix FROM client_grouping_override
        WHERE client_id = $1 AND active AND section_code = $2`,
      [clientRow.rows[0].client_id, item.rows[0].code],
    );
    const prefixes = rules.rows.map((r) => r.account_prefix);
    const actual = prefixes.length > 0 ? await tbClosingForPrefixes(tx, engagementId, prefixes) : 0;
    const variance = actual - input.expectation;
    const unexplained = Math.abs(variance) > input.tolerance;

    const { runId } = await storeRun(tx, tenantId, userId, {
      engagementId,
      fileItemId: input.fileItemId,
      engine: "substantive_analytics",
      params: { expectation: input.expectation, tolerance: input.tolerance, basis: input.basis },
      summary: { actual, variance, unexplained },
      sheetTitle: "Substantive analytics",
      header: ["measure", "amount"],
      rows: [
        ["expectation", input.expectation],
        ["actual", actual],
        ["variance", variance],
        ["tolerance", input.tolerance],
      ],
    });
    return { runId, engagementId, actual, variance, unexplained };
  });

  if (outcome.unexplained) {
    await routeFinding({
      engagementId: outcome.engagementId,
      fileItemId: input.fileItemId,
      route: "b5",
      title: `Unresolved analytic variance (${input.basis})`,
      amount: Math.round(outcome.variance),
      mtype: "judgmental",
      trivialConfirmed: true, // small variances log as trivial rather than block
    });
  }
  return { runId: outcome.runId, actual: outcome.actual, variance: outcome.variance, raisedToB5: outcome.unexplained };
}

export interface RunInfo {
  id: string;
  engine: Engine;
  summary: Record<string, unknown>;
  outputDocumentId: string | null;
  createdAt: string;
}

export async function listRuns(fileItemId: string): Promise<RunInfo[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      engine: Engine;
      result_summary: Record<string, unknown>;
      output_document_id: string | null;
      created_at: string;
    }>(
      `SELECT id, engine, result_summary, output_document_id,
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
         FROM automation_run WHERE file_item_id = $1 ORDER BY created_at DESC`,
      [fileItemId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      engine: row.engine,
      summary: row.result_summary,
      outputDocumentId: row.output_document_id,
      createdAt: row.created_at,
    }));
  });
}
