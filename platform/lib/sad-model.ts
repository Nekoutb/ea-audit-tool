// Pure, client-safe model for the Summary of Audit Differences.

export const SAD_CAPTIONS = [
  "current_asset",
  "non_current_asset",
  "current_liability",
  "non_current_liability",
  "equity",
  "income",
  "expense",
] as const;
export type SadCaption = (typeof SAD_CAPTIONS)[number];

export const SAD_TYPES = ["factual", "judgmental", "projected", "classification", "disclosure"] as const;

/** The six columns of the workbook's caption grid. */
export const SAD_COLUMN_COUNT = 6;

/**
 * Column of the caption grid a caption lands in:
 * 0 Assets current · 1 Assets non-current · 2 Liabilities current ·
 * 3 Liabilities non-current · 4 Equity · 5 Income statement (income & expense).
 */
export function captionColumn(caption: SadCaption): number {
  switch (caption) {
    case "current_asset":
      return 0;
    case "non_current_asset":
      return 1;
    case "current_liability":
      return 2;
    case "non_current_liability":
      return 3;
    case "equity":
      return 4;
    case "income":
    case "expense":
      return 5;
  }
}

/**
 * Qualitative factors the conclusion tab walks through (ISA 450 ¶A21 —
 * circumstances that can make a misstatement material despite its size).
 * Original wording lives in the board component.
 */
export const SAD_QUAL_FACTORS = [
  "sensitivity",
  "subtotals",
  "balance_sheet",
  "covenants",
  "loss_reversal",
  "segments",
  "trend_mask",
  "bias",
] as const;
export type SadQualFactor = (typeof SAD_QUAL_FACTORS)[number];

/** One manual row of the cash-flow misstatements tab (stored as JSON in meta key cf_rows). */
export interface SadCfRow {
  no: string;
  ref: string;
  line: string;
  operating: string;
  investing: string;
  financing: string;
  evaluation: string;
}

/** One manual row of the disclosure misstatements tab (meta key disc_rows). */
export interface SadDiscRow {
  no: string;
  fn: string;
  description: string;
  guidance: string;
  evaluation: string;
  corrected: boolean;
}

export interface SadEntry {
  stepId: string;
  taskCode: string;
  taskItemId: string;
  taskTitle: string;
  /** procedure reference, e.g. "E1" (first token of the step description) */
  ref: string;
  finding: string;
  drAccount: string;
  drAmount: number;
  crAccount: string;
  crAmount: number;
  /** caption per side — saved override, else suggested from the account number */
  drCaption: SadCaption;
  crCaption: SadCaption;
  drSuggested: boolean;
  crSuggested: boolean;
  mtype: string;
  corrected: boolean;
  /** rationale for correction / inclusion (corrected & reclassification tabs) */
  rationale: string;
  /** already posted onto the misstatement schedule */
  posted: boolean;
}

export interface SadView {
  entries: SadEntry[];
  /** approved materiality: overall (PM), performance (TE), trivial (SAD nominal) */
  materiality: { overall: number; performance: number; trivial: number } | null;
  /** engagement client name */
  entityName: string;
  /** period end, YYYY-MM-DD */
  periodEnd: string;
  /**
   * FS caption totals from the current TB, one per grid column (credit-positive
   * for liabilities/equity, column 5 = classes 7 minus 6 net). Null = no TB.
   */
  fsCaptions: number[] | null;
  /** current-year income before tax (TB classes 7 minus 6); null = no TB */
  incomeBeforeTax: number | null;
  /** code='sad' meta values: q_*, qx_*, concl_text, cf_rows, disc_rows */
  meta: Record<string, string>;
}

/**
 * SYSCOHADA caption suggestion from the account number's leading digits.
 * A suggestion only — the preparer's recorded caption always wins.
 */
export function suggestCaption(account: string): SadCaption {
  const a = account.replace(/[^0-9]/g, "");
  if (!a) return "current_asset";
  const d1 = a[0];
  const d2 = a.slice(0, 2);
  if (d1 === "1") return ["10", "11", "12", "13", "14", "15"].includes(d2) ? "equity" : "non_current_liability";
  if (d1 === "2") return "non_current_asset";
  if (d1 === "3") return "current_asset";
  if (d1 === "4") return ["41", "45", "47", "49"].includes(d2) ? "current_asset" : "current_liability";
  if (d1 === "5") return d2 === "56" ? "current_liability" : "current_asset";
  if (d1 === "6") return "expense";
  if (d1 === "7") return "income";
  if (d1 === "8") return Number(d2[1] ?? 1) % 2 === 1 ? "expense" : "income";
  return "current_asset";
}
