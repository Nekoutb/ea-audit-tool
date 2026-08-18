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
  /** already posted onto the misstatement schedule */
  posted: boolean;
}

export interface SadView {
  entries: SadEntry[];
  /** approved materiality: overall, performance, trivial (SAD nominal) */
  materiality: { overall: number; performance: number; trivial: number } | null;
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
