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

function parseCsv(text: string): ParsedTable {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new SubLedgerError("empty-file");
  const split = (line: string): string[] => {
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
      else if (char === "," || char === ";") { cells.push(current); current = ""; }
      else current += char;
    }
    cells.push(current);
    return cells.map((cell) => cell.trim());
  };
  const headers = split(lines[0]).map((header, index) => header || `col_${index + 1}`);
  const rows = lines.slice(1).map((line) => {
    const cells = split(line);
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => { row[header] = cells[index] ?? ""; });
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

async function parseXlsx(buffer: Buffer): Promise<ParsedTable> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) throw new SubLedgerError("empty-file");
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cellScalar(cell.value) ?? `col_${col}`).trim() || `col_${col}`;
  });
  const rows: Record<string, unknown>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      record[header] = cellScalar(row.getCell(index + 1).value);
    });
    if (Object.values(record).some((v) => v !== null && v !== undefined && String(v).trim() !== "")) {
      rows.push(record);
    }
  });
  if (rows.length === 0) throw new SubLedgerError("empty-file");
  return { headers, rows };
}

export async function parseTabularFile(filename: string, buffer: Buffer): Promise<ParsedTable> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return parseCsv(buffer.toString("utf8"));
  if (lower.endsWith(".xlsx")) return parseXlsx(buffer);
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
): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  const table = await parseTabularFile(filename, buffer);
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
    let rowNo = 0;
    for (const row of table.rows) {
      rowNo += 1;
      const amount = signedPair
        ? (toNumber(row[debitColumn as string]) ?? 0) - (toNumber(row[creditColumn as string]) ?? 0)
        : amountColumn
          ? toNumber(row[amountColumn])
          : null;
      if (amount !== null) total = (total ?? 0) + amount;
      await tx.query(
        "INSERT INTO sub_ledger_row (tenant_id, dataset_id, row_no, data, amount) VALUES ($1, $2, $3, $4, $5)",
        [tenantId, datasetId, rowNo, JSON.stringify(row), amount],
      );
    }
    await tx.query("UPDATE sub_ledger_dataset SET total_amount = $2 WHERE id = $1", [datasetId, total]);
    return datasetId;
  });
}

export interface DatasetPreview {
  headers: string[];
  headerSamples: Record<string, string[]>;
  rowCount: number;
}

/** Parse a sub-ledger file without storing it: headers + example values. */
export async function previewDataset(filename: string, buffer: Buffer): Promise<DatasetPreview> {
  const table = await parseTabularFile(filename, buffer);
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
