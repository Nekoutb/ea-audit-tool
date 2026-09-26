// Sub-ledger imports (spec §10.1, step 3.4): typed datasets attached to the
// engagement, consumed by the Phase 5 automation engines (sampling,
// reconciliations, JE testing). Rows are kept as imported (jsonb) plus a parsed
// amount column so populations can be totalled and tied to the TB.

import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { withTenant } from "@/lib/db";
import { type SubLedgerKind } from "@/lib/subledger-kinds";
import { requireTenant } from "@/lib/tenant";
import { parseAmount } from "@/lib/amount";

export { isSubLedgerKind, SUB_LEDGER_KINDS, type SubLedgerKind } from "@/lib/subledger-kinds";

export interface ParsedTable {
  headers: string[];
  rows: Record<string, unknown>[];
}

export class SubLedgerError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "SubLedgerError";
  }
}

const CSV_DELIMITERS = [";", ",", "\t", "|"] as const;

/** Count a delimiter's occurrences outside quotes. */
function countOutsideQuotes(line: string, delimiter: string): number {
  let n = 0;
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === delimiter) n += 1;
  }
  return n;
}

/**
 * One delimiter per file, detected from the first lines: the candidate that
 * splits the most lines into the same, widest shape. Splitting on both ',' and
 * ';' read a French "10 000 000,00" as two cells and lost the credits (UAT B27).
 */
export function detectCsvDelimiter(lines: readonly string[]): string {
  const sample = lines.slice(0, 25);
  let best: { delimiter: string; score: number } = { delimiter: ",", score: -1 };
  for (const delimiter of CSV_DELIMITERS) {
    const counts = sample.map((line) => countOutsideQuotes(line, delimiter)).filter((n) => n > 0);
    if (counts.length === 0) continue;
    // the width most lines agree on, weighted by how many lines agree
    const modal = new Map<number, number>();
    for (const n of counts) modal.set(n, (modal.get(n) ?? 0) + 1);
    const [width, agree] = [...modal.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    const score = agree * 1000 + width;
    if (score > best.score) best = { delimiter, score };
  }
  return best.delimiter;
}

export function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { current += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { cells.push(current); current = ""; }
    else current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/**
 * Exports open with title/banner lines ("BALANCE GENERALE", the period…) that
 * carry a single cell. The header row is the first line with at least two
 * non-empty cells — never blindly line 1 (UAT B28).
 */
function headerLineIndex(cellsByLine: readonly string[][]): number {
  const limit = Math.min(cellsByLine.length, 25);
  for (let i = 0; i < limit; i += 1) {
    if (cellsByLine[i].filter((cell) => cell !== "").length >= 2) return i;
  }
  return 0;
}

/**
 * The physical file row (1-based line or Excel row) a parsed record came from,
 * carried as a non-enumerable property so it never becomes a column; messages
 * then point at the row the user sees in the spreadsheet (UAT B135).
 */
export function sourceRowOf(record: Record<string, unknown>): number | null {
  const n = (record as { __row?: unknown }).__row;
  return typeof n === "number" ? n : null;
}

function tagSourceRow(record: Record<string, unknown>, rowNumber: number): void {
  Object.defineProperty(record, "__row", { value: rowNumber, enumerable: false });
}

function parseCsv(text: string, headerRow = true): ParsedTable {
  const allLines = text.replace(/\r\n?/g, "\n").split("\n");
  const lineNos: number[] = [];
  allLines.forEach((line, index) => { if (line.trim().length > 0) lineNos.push(index + 1); });
  const lines = allLines.filter((line) => line.trim().length > 0);
  if (lines.length < (headerRow ? 2 : 1)) throw new SubLedgerError("empty-file");
  const delimiter = detectCsvDelimiter(lines);
  const split = (line: string): string[] => splitCsvLine(line, delimiter);
  const headerAt = headerRow ? headerLineIndex(lines.map(split)) : 0;
  if (headerRow && lines.length < headerAt + 2) throw new SubLedgerError("empty-file");
  // Without a header row every line is data and the columns get positional
  // names, so the mapping dropdowns always have something honest to offer.
  const width = headerRow ? split(lines[headerAt]).length : Math.max(...lines.slice(0, 25).map((l) => split(l).length));
  const headers = headerRow
    ? split(lines[headerAt]).map((header, index) => header || `col_${index + 1}`)
    : Array.from({ length: width }, (_, index) => `col_${index + 1}`);
  const start = headerRow ? headerAt + 1 : 0;
  const rows = lines.slice(start).map((line, offset) => {
    const cells = split(line);
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => { row[header] = cells[index] ?? ""; });
    tagSourceRow(row, lineNos[start + offset]);
    return row;
  });
  return { headers, rows };
}

/**
 * Excel cells are not always scalars: formulas carry `{ result }`, styled text
 * arrives as `{ richText: [...] }`, hyperlinks as `{ text, hyperlink }`, and
 * error cells as `{ error }`. Left unwrapped they stringify to
 * "[object Object]" in previews and never parse as numbers.
 */
function cellScalar(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if ("richText" in value) {
    return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  if ("result" in value) return cellScalar((value as { result: unknown }).result);
  if ("text" in value) return cellScalar((value as { text: unknown }).text);
  if ("error" in value) return null;
  return value;
}

async function parseXlsx(buffer: Buffer, headerRow = true): Promise<ParsedTable> {
  const workbook = new ExcelJS.Workbook();
  // A corrupt or mis-named file is the user's problem to hear about, not a
  // fault to hide behind "unauthenticated" (UAT B103).
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new SubLedgerError("unreadable-file");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < (headerRow ? 2 : 1)) throw new SubLedgerError("empty-file");
  // Exports often open with a title or blank banner row ("BALANCE GENERALE",
  // the period line): the header row is the first row carrying at least two
  // values, not blindly row 1 nor the first non-empty one (UAT B28). A sheet
  // with only single-cell rows in its first 25 falls back to the first
  // non-empty row.
  let headerRowNo = 1;
  if (headerRow) {
    let firstNonEmpty = 0;
    let found = 0;
    for (let r = 1; r <= Math.min(sheet.rowCount, 25); r += 1) {
      // A merged title banner repeats its value in every cell of the range:
      // only the master cell counts, and the row needs two DISTINCT values
      // to be a header (UAT B64).
      const distinct = new Set<string>();
      sheet.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
        if (cell.isMerged && cell.master !== cell) return;
        const v = cellScalar(cell.value);
        if (v !== null && v !== undefined && String(v).trim() !== "") distinct.add(String(v).trim());
      });
      const values = distinct.size;
      if (values > 0 && !firstNonEmpty) firstNonEmpty = r;
      if (values >= 2) { found = r; break; }
    }
    headerRowNo = found || firstNonEmpty || 1;
  }
  const headers: string[] = [];
  if (headerRow) {
    const seen = new Map<string, number>();
    sheet.getRow(headerRowNo).eachCell({ includeEmpty: true }, (cell, col) => {
      const raw = cell.isMerged && cell.master !== cell ? null : cellScalar(cell.value);
      const name = String(raw ?? `col_${col}`).trim() || `col_${col}`;
      // identical headers would collapse the record keys: suffix _2, _3...
      const count = (seen.get(name) ?? 0) + 1;
      seen.set(name, count);
      headers[col - 1] = count === 1 ? name : `${name}_${count}`;
    });
  } else {
    for (let c = 1; c <= sheet.columnCount; c += 1) headers[c - 1] = `col_${c}`;
  }
  const rows: Record<string, unknown>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (headerRow && rowNumber <= headerRowNo) return;
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      const cell = row.getCell(index + 1);
      // ExcelJS reports the master's value for every cell of a merged range,
      // so a merged debit cell was counted once per row it spans (UAT B82).
      // Only the master keeps the value; the others read as empty.
      record[header] = cell.isMerged && cell.master !== cell ? null : cellScalar(cell.value);
    });
    if (Object.values(record).some((v) => v !== null && v !== undefined && String(v).trim() !== "")) {
      tagSourceRow(record, rowNumber);
      rows.push(record);
    }
  });
  if (rows.length === 0) throw new SubLedgerError("empty-file");
  return { headers, rows };
}

export async function parseTabularFile(
  filename: string,
  buffer: Buffer,
  /** false: the file has no header row — row 1 is data, columns are col_1..N */
  headerRow = true,
): Promise<ParsedTable> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return parseCsv(buffer.toString("utf8"), headerRow);
  if (lower.endsWith(".xlsx")) return parseXlsx(buffer, headerRow);
  throw new SubLedgerError("unsupported-file");
}

/** Amounts come from lib/amount.ts — one parser for the whole product. */
function toNumber(value: unknown): number | null {
  return parseAmount(value);
}

const AMOUNT_HINTS = ["amount", "balance", "solde", "montant", "total", "net", "nbv", "value", "valeur"];

/** Pick the amount column: named hint first, else the most numeric column. */
export function detectAmountColumn(table: ParsedTable): string | null {
  const normalized = (header: string) =>
    header.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const hinted = table.headers.find((header) =>
    AMOUNT_HINTS.some((hint) => normalized(header).includes(hint)),
  );
  if (hinted) return hinted;
  let best: { header: string; score: number } | null = null;
  for (const header of table.headers) {
    const score = table.rows.filter((row) => toNumber(row[header]) !== null).length;
    if (score > (best?.score ?? 0)) best = { header, score };
  }
  return best && best.score >= Math.max(1, table.rows.length / 2) ? best.header : null;
}

export type DatasetTiming = "pre_audit" | "post_audit" | "prior_year";

export interface DatasetSummary {
  id: string;
  kind: SubLedgerKind;
  timing: DatasetTiming;
  name: string;
  sourceFilename: string;
  rowCount: number;
  totalAmount: number | null;
  amountColumn: string | null;
  createdAt: string;
}

export async function createDataset(
  engagementId: string,
  kind: SubLedgerKind,
  filename: string,
  buffer: Buffer,
  mapping?: Record<string, string>,
  timing: DatasetTiming = "pre_audit",
  headerRow = true,
): Promise<{ datasetId: string; rowCount: number }> {
  const { tenantId, userId } = await requireTenant();
  const table = await parseTabularFile(filename, buffer, headerRow);
  // the confirmed amount-bearing column wins over the guess; a ledger that
  // states value as a debit/credit pair has no single amount column, so the
  // row amount is derived as debit - credit (debits positive, credits negative)
  const debitColumn = mapping?.debit ?? null;
  const creditColumn = mapping?.credit ?? null;
  const signedPair = Boolean(debitColumn && creditColumn) && !mapping?.amount;
  const amountColumn = mapping?.amount ?? (signedPair ? debitColumn : detectAmountColumn(table));
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  return withTenant(tenantId, async (tx) => {
    let total: number | null = null;
    // TB semantics: one dataset per kind and timing — a new upload replaces the
    // previous one (rows cascade; engine runs keep their summaries, dataset_id
    // nulls out). No accumulating list of superseded files.
    await tx.query(
      "DELETE FROM sub_ledger_dataset WHERE engagement_id = $1 AND kind = $2 AND timing = $3",
      [engagementId, kind, timing],
    );
    const dataset = await tx.query<{ id: string }>(
      `INSERT INTO sub_ledger_dataset
         (tenant_id, engagement_id, kind, timing, name, source_filename, source_sha256,
          row_count, amount_column, mapping, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [tenantId, engagementId, kind, timing, filename.replace(/\.[^.]+$/, ""), filename, sha256, table.rows.length, amountColumn, mapping ? JSON.stringify(mapping) : null, userId],
    );
    const datasetId = dataset.rows[0].id;
    // Batched ingest (audit H22): one round-trip per BATCH rows via unnest,
    // not one per row — a six-figure ledger arrives in hundreds of queries,
    // not hundreds of thousands.
    const BATCH = 5000;
    let rowNo = 0;
    for (let start = 0; start < table.rows.length; start += BATCH) {
      const chunk = table.rows.slice(start, start + BATCH);
      const rowNos: number[] = [];
      const datas: string[] = [];
      const amounts: (number | null)[] = [];
      for (const row of chunk) {
        rowNo += 1;
        const amount = signedPair
          ? (toNumber(row[debitColumn as string]) ?? 0) - (toNumber(row[creditColumn as string]) ?? 0)
          : amountColumn
            ? toNumber(row[amountColumn])
            : null;
        if (amount !== null) total = (total ?? 0) + amount;
        rowNos.push(rowNo);
        datas.push(JSON.stringify(row));
        amounts.push(amount);
      }
      await tx.query(
        `INSERT INTO sub_ledger_row (tenant_id, dataset_id, row_no, data, amount)
         SELECT $1, $2, r, d::jsonb, a
           FROM unnest($3::int[], $4::text[], $5::numeric[]) AS t(r, d, a)`,
        [tenantId, datasetId, rowNos, datas, amounts],
      );
    }
    await tx.query("UPDATE sub_ledger_dataset SET total_amount = $2 WHERE id = $1", [datasetId, total]);
    return { datasetId, rowCount: table.rows.length };
  });
}

export interface DatasetPreview {
  headers: string[];
  headerSamples: Record<string, string[]>;
  rowCount: number;
}

/** Parse a sub-ledger file without storing it: headers + example values. */
export async function previewDataset(filename: string, buffer: Buffer, headerRow = true): Promise<DatasetPreview> {
  const table = await parseTabularFile(filename, buffer, headerRow);
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
  return { headers: table.headers, headerSamples, rowCount: table.rows.length };
}

export async function listDatasets(engagementId: string): Promise<DatasetSummary[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      kind: SubLedgerKind;
      timing: DatasetTiming;
      name: string;
      source_filename: string;
      row_count: number;
      total_amount: string | null;
      amount_column: string | null;
      created_at: string;
    }>(
      `SELECT id, kind, timing, name, source_filename, row_count, total_amount::text,
              amount_column, to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
         FROM sub_ledger_dataset
        WHERE engagement_id = $1
        ORDER BY created_at DESC`,
      [engagementId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      timing: row.timing,
      name: row.name,
      sourceFilename: row.source_filename,
      rowCount: row.row_count,
      totalAmount: row.total_amount === null ? null : Number(row.total_amount),
      amountColumn: row.amount_column,
      createdAt: row.created_at,
    }));
  });
}
