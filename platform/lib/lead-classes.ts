// The lead-schedule taxonomy from the firm's "Lead Schedule" workbook,
// embedded: every index carries its account type and account class, and each
// index breaks into the workbook's sub-totals (K-1, K-2 …). A SYSCOHADA
// longest-prefix map auto-assigns an index and a sub-total to every account of
// an uploaded trial balance; the user can override per client.
// Client-safe: no server dependencies.

export interface LeadIndexDef {
  /** the workbook's index code, e.g. "K", "E", "VD1" */
  code: string;
  /** Assets · Liabilities · Equity · Revenues · Expenses */
  accountType: string;
  /** the workbook's account class, e.g. "Fixed Assets" */
  accountClass: string;
  labelEn: string;
}

export const LEAD_INDEXES: readonly LeadIndexDef[] = [
  // Balance sheet
  { code: "T", accountType: "Equity", accountClass: "Equity", labelEn: "Share Capital & Reserves" },
  { code: "Q", accountType: "Liabilities", accountClass: "Other LT Liabilities", labelEn: "Borrowings" },
  { code: "P1", accountType: "Liabilities", accountClass: "Other LT Liabilities", labelEn: "Provisions for Risks & Charges" },
  { code: "P2", accountType: "Liabilities", accountClass: "Other LT Liabilities", labelEn: "Social & Payroll Liabilities" },
  { code: "P3", accountType: "Liabilities", accountClass: "Other LT Liabilities", labelEn: "Suspense & Deferred Income" },
  { code: "P4", accountType: "Liabilities", accountClass: "Other LT Liabilities", labelEn: "Translation Difference — Liabilities" },
  { code: "L", accountType: "Assets", accountClass: "Intangible Assets", labelEn: "Intangible Assets & Deferred Charges" },
  { code: "K", accountType: "Assets", accountClass: "Fixed Assets", labelEn: "Property, Plant & Equipment" },
  { code: "J", accountType: "Assets", accountClass: "Other LT Assets", labelEn: "Financial Assets" },
  { code: "F", accountType: "Assets", accountClass: "Inventory", labelEn: "Inventories" },
  { code: "N", accountType: "Liabilities", accountClass: "Accounts Payable", labelEn: "Trade Payables" },
  { code: "E", accountType: "Assets", accountClass: "Accounts Receivable", labelEn: "Trade Receivables" },
  { code: "O1", accountType: "Assets", accountClass: "Other Assets/Liabilities", labelEn: "Tax Receivables" },
  { code: "O2", accountType: "Liabilities", accountClass: "Other Assets/Liabilities", labelEn: "Tax Payables" },
  { code: "O4", accountType: "Expenses", accountClass: "Taxes Expense", labelEn: "Income Tax & Profit-Sharing" },
  { code: "I1", accountType: "Assets", accountClass: "Other Assets/Liabilities", labelEn: "Group & Associates — Short Term" },
  { code: "I2", accountType: "Assets", accountClass: "Other Assets/Liabilities", labelEn: "Group & Associates" },
  { code: "G2", accountType: "Assets", accountClass: "Other Current Assets", labelEn: "Other Current Assets" },
  { code: "G3", accountType: "Assets", accountClass: "Other Current Assets", labelEn: "Translation Difference — Assets" },
  { code: "C", accountType: "Assets", accountClass: "Cash", labelEn: "Cash & Cash Equivalents" },
  // Income statement
  { code: "UA", accountType: "Revenues", accountClass: "Revenue", labelEn: "Revenue" },
  { code: "UB2", accountType: "Revenues", accountClass: "Other Income/Expense", labelEn: "Other Income" },
  { code: "UC", accountType: "Revenues", accountClass: "Interest Income/Expense", labelEn: "Finance Income" },
  { code: "U1", accountType: "Revenues", accountClass: "Extraordinary Income/Expense", labelEn: "Exceptional Income" },
  { code: "VA1", accountType: "Expenses", accountClass: "Cost of Goods Sold", labelEn: "Purchases" },
  { code: "VA2", accountType: "Expenses", accountClass: "Cost of Goods Sold", labelEn: "Change in Inventories" },
  { code: "VB", accountType: "Expenses", accountClass: "Other Operating Expenses", labelEn: "Personnel Costs" },
  { code: "VO", accountType: "Expenses", accountClass: "Other Operating Expenses", labelEn: "Taxes & Duties" },
  { code: "VD1", accountType: "Expenses", accountClass: "Other Operating Expenses", labelEn: "Non-Stored Purchases, Transport & External Services" },
  { code: "VD2", accountType: "Expenses", accountClass: "Other Operating Expenses", labelEn: "Depreciation & Provisions" },
  { code: "VD3", accountType: "Expenses", accountClass: "Other Operating Expenses", labelEn: "Provision Reversals & Expense Transfers" },
  { code: "VD4", accountType: "Expenses", accountClass: "Other Operating Expenses", labelEn: "Other Expenses" },
  { code: "VD5", accountType: "Expenses", accountClass: "Interest Income/Expense", labelEn: "Finance Costs" },
  { code: "V1", accountType: "Expenses", accountClass: "Extraordinary Income/Expense", labelEn: "Exceptional Expenses" },
] as const;

export const LEAD_INDEX_BY_CODE: Record<string, LeadIndexDef> = Object.fromEntries(
  LEAD_INDEXES.map((d) => [d.code, d]),
);

/** Distinct account classes, for the analyzer's class dropdown. */
export const ACCOUNT_CLASSES: readonly string[] = [...new Set(LEAD_INDEXES.map((d) => d.accountClass))];

/** First index of an account class — the default when the user picks a class. */
export function defaultIndexForClass(accountClass: string): string | null {
  return LEAD_INDEXES.find((d) => d.accountClass === accountClass)?.code ?? null;
}

/**
 * SYSCOHADA prefix → index, longest prefix wins. Derived from the workbook's
 * chart order; the analyzer lets the user override any class.
 */
const PREFIX_INDEX: readonly [string, string][] = [
  // class 1
  ["10", "T"], ["11", "T"], ["12", "T"], ["13", "T"], ["14", "T"], ["15", "T"],
  ["16", "Q"], ["17", "Q"], ["18", "Q"], ["19", "P1"],
  // class 2
  ["20", "L"], ["21", "L"], ["22", "K"], ["23", "K"], ["24", "K"],
  ["25", "K"], ["26", "J"], ["27", "J"],
  ["28", "K"], ["281", "L"], ["29", "J"], ["291", "L"], ["293", "K"], ["294", "K"],
  // class 3
  ["3", "F"],
  // class 4
  ["40", "N"], ["41", "E"], ["42", "P2"], ["43", "P2"],
  ["44", "O2"], ["444", "O1"], ["445", "O1"], ["449", "O1"],
  ["45", "I2"], ["46", "I2"], ["462", "I1"],
  ["47", "G2"], ["476", "G2"], ["477", "P3"], ["478", "G3"], ["479", "P4"],
  ["48", "P3"], ["481", "N"],
  ["49", "G2"], ["490", "E"], ["491", "E"],
  // class 5
  ["5", "C"],
  // classes 6-8
  ["60", "VA1"], ["603", "VA2"], ["604", "VD1"], ["605", "VD1"], ["608", "VD1"],
  ["61", "VD1"], ["62", "VD1"], ["63", "VD1"], ["64", "VO"], ["65", "VD4"],
  ["66", "VB"], ["67", "VD5"], ["68", "VD2"], ["69", "VD2"],
  ["70", "UA"], ["71", "UB2"], ["72", "UB2"], ["73", "UB2"], ["75", "UB2"],
  ["77", "UC"], ["78", "VD3"], ["79", "VD3"],
  ["81", "V1"], ["82", "V1"], ["83", "V1"], ["84", "U1"], ["85", "U1"],
  ["86", "U1"], ["88", "U1"], ["89", "O4"],
];

/** The index a SYSCOHADA account (or class prefix) maps to; null when unknown. */
export function leadIndexFor(accountOrPrefix: string): string | null {
  let best: [string, string] | null = null;
  for (const rule of PREFIX_INDEX) {
    if (!accountOrPrefix.startsWith(rule[0])) continue;
    if (!best || rule[0].length > best[0].length) best = rule;
  }
  return best ? best[1] : null;
}

/* ---- the workbook's sub-totals within each index ---- */

export interface SubIndexDef {
  /** e.g. "K-2" */
  code: string;
  index: string;
  labelEn: string;
}

export const SUB_INDEXES: readonly SubIndexDef[] = [
  { code: "T-1", index: "T", labelEn: "Share capital & reserves" },
  { code: "Q-1", index: "Q", labelEn: "Borrowings" },
  { code: "P1-1", index: "P1", labelEn: "Provisions for risks & charges" },
  { code: "P2-1", index: "P2", labelEn: "Social & payroll liabilities" },
  { code: "P3-1", index: "P3", labelEn: "Suspense accounts" },
  { code: "P3-3", index: "P3", labelEn: "Deferred income" },
  { code: "P4-1", index: "P4", labelEn: "Translation difference — liabilities" },
  { code: "L-1", index: "L", labelEn: "Deferred charges" },
  { code: "L-2", index: "L", labelEn: "Intangible assets, gross" },
  { code: "L-4", index: "L", labelEn: "Amortisation & impairment" },
  { code: "K-1", index: "K", labelEn: "Land" },
  { code: "K-2", index: "K", labelEn: "Buildings, technical installations & fittings" },
  { code: "K-3", index: "K", labelEn: "Equipment" },
  { code: "K-4", index: "K", labelEn: "Assets under construction & advances" },
  { code: "K-6", index: "K", labelEn: "Depreciation & impairment" },
  { code: "J-1", index: "J", labelEn: "Financial assets, gross" },
  { code: "J-2", index: "J", labelEn: "Impairment of financial assets" },
  { code: "F-1", index: "F", labelEn: "Inventories, gross" },
  { code: "F-2", index: "F", labelEn: "Impairment of inventories" },
  { code: "N-1", index: "N", labelEn: "Trade payables & related accounts" },
  { code: "N-2", index: "N", labelEn: "Capital-expenditure payables" },
  { code: "E-1", index: "E", labelEn: "Trade receivables, gross" },
  { code: "E-2", index: "E", labelEn: "Impairment of trade receivables" },
  { code: "O1-1", index: "O1", labelEn: "Tax receivables" },
  { code: "O2-1", index: "O2", labelEn: "Tax payables" },
  { code: "O4-1", index: "O4", labelEn: "Income tax & profit-sharing" },
  { code: "I1-1", index: "I1", labelEn: "Group & associates — short term" },
  { code: "I2-1", index: "I2", labelEn: "Group & associates" },
  { code: "G2-1", index: "G2", labelEn: "Suspense accounts" },
  { code: "G2-3", index: "G2", labelEn: "Prepaid expenses" },
  { code: "G2-4", index: "G2", labelEn: "Impairment of other current accounts" },
  { code: "G3-1", index: "G3", labelEn: "Translation difference — assets" },
  { code: "C-1", index: "C", labelEn: "Cash & banks" },
  { code: "C-3", index: "C", labelEn: "Provisioned financial risks" },
  { code: "UA-1", index: "UA", labelEn: "Revenue" },
  { code: "UB2-1", index: "UB2", labelEn: "Other income" },
  { code: "UC-1", index: "UC", labelEn: "Finance income" },
  { code: "U1-1", index: "U1", labelEn: "Exceptional income" },
  { code: "VA1-1", index: "VA1", labelEn: "Purchases" },
  { code: "VA2-1", index: "VA2", labelEn: "Change in inventories" },
  { code: "VB-1", index: "VB", labelEn: "Personnel costs" },
  { code: "VO-3", index: "VO", labelEn: "Taxes & duties" },
  { code: "VD1-1", index: "VD1", labelEn: "Non-stored purchases" },
  { code: "VD1-2", index: "VD1", labelEn: "Transport" },
  { code: "VD1-3", index: "VD1", labelEn: "External services" },
  { code: "VD2-1", index: "VD2", labelEn: "Depreciation charges" },
  { code: "VD2-2", index: "VD2", labelEn: "Provision charges" },
  { code: "VD3-1", index: "VD3", labelEn: "Provision reversals & expense transfers" },
  { code: "VD4-1", index: "VD4", labelEn: "Other expenses" },
  { code: "VD5-1", index: "VD5", labelEn: "Finance costs" },
  { code: "V1-1", index: "V1", labelEn: "Exceptional expenses" },
] as const;

export const SUB_INDEX_BY_CODE: Record<string, SubIndexDef> = Object.fromEntries(
  SUB_INDEXES.map((d) => [d.code, d]),
);

/** account prefix → sub-total, longest prefix wins. */
const PREFIX_SUB: readonly [string, string][] = [
  ["1", "T-1"], ["16", "Q-1"], ["17", "Q-1"], ["18", "Q-1"], ["19", "P1-1"],
  ["20", "L-1"], ["21", "L-2"], ["281", "L-4"], ["291", "L-4"],
  ["22", "K-1"], ["23", "K-2"], ["24", "K-3"], ["25", "K-4"],
  ["28", "K-6"], ["293", "K-6"], ["294", "K-6"],
  ["26", "J-1"], ["27", "J-1"], ["29", "J-2"],
  ["3", "F-1"], ["39", "F-2"],
  ["40", "N-1"], ["481", "N-2"],
  ["41", "E-1"], ["490", "E-2"], ["491", "E-2"],
  ["42", "P2-1"], ["43", "P2-1"],
  ["44", "O2-1"], ["444", "O1-1"], ["445", "O1-1"], ["449", "O1-1"],
  ["45", "I2-1"], ["46", "I2-1"], ["462", "I1-1"],
  ["47", "G2-1"], ["476", "G2-3"], ["477", "P3-3"], ["478", "G3-1"], ["479", "P4-1"],
  ["48", "P3-1"], ["49", "G2-4"],
  ["5", "C-1"], ["59", "C-3"],
  ["60", "VA1-1"], ["603", "VA2-1"], ["604", "VD1-1"], ["605", "VD1-1"], ["608", "VD1-1"],
  ["61", "VD1-2"], ["62", "VD1-3"], ["63", "VD1-3"], ["64", "VO-3"], ["65", "VD4-1"],
  ["66", "VB-1"], ["67", "VD5-1"], ["68", "VD2-1"], ["69", "VD2-2"],
  ["70", "UA-1"], ["71", "UB2-1"], ["72", "UB2-1"], ["73", "UB2-1"], ["75", "UB2-1"],
  ["77", "UC-1"], ["78", "VD3-1"], ["79", "VD3-1"],
  ["81", "V1-1"], ["82", "V1-1"], ["83", "V1-1"], ["84", "U1-1"], ["85", "U1-1"],
  ["86", "U1-1"], ["88", "U1-1"], ["89", "O4-1"],
];

/** The workbook sub-total an account belongs to; null when unknown. */
export function subIndexFor(account: string): string | null {
  let best: [string, string] | null = null;
  for (const rule of PREFIX_SUB) {
    if (!account.startsWith(rule[0])) continue;
    if (!best || rule[0].length > best[0].length) best = rule;
  }
  return best ? best[1] : null;
}

/**
 * The internal working-paper section each index feeds — derived automatically,
 * never chosen by the user: the index IS the lead schedule.
 */
export const INDEX_SECTION: Record<string, string> = {
  T: "E4.16", Q: "E4.8", P1: "E4.11", P2: "E4.11", P3: "E4.9", P4: "E4.9",
  L: "E4.6", K: "E4.5", J: "E4.7", F: "E4.4", N: "E4.2", E: "E4.1",
  O1: "E4.9", O2: "E4.9", O4: "E4.9", I1: "E6.2", I2: "E6.2",
  G2: "E4.9", G3: "E4.9", C: "E4.8",
  UA: "E4.1", UB2: "E4.1", UC: "E4.8", U1: "E4.13",
  VA1: "E4.2", VA2: "E4.4", VB: "E4.3", VO: "E4.10", VD1: "E4.2",
  VD2: "E4.5", VD3: "E4.11", VD4: "E4.2", VD5: "E4.8", V1: "E4.13",
};
