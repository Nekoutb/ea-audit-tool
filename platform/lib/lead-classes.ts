// The lead-schedule taxonomy from the firm's "Lead Schedule" workbook,
// embedded: every index carries its account type and account class; a
// SYSCOHADA longest-prefix map auto-assigns an index to each account class of
// an uploaded trial balance, and the user can override per client.
// Client-safe: no server dependencies.

export interface LeadIndexDef {
  /** the workbook's index code, e.g. "K", "E", "VD1" */
  code: string;
  /** Assets · Liabilities · Equity · Revenues · Expenses */
  accountType: string;
  /** the workbook's account class, e.g. "Fixed Assets" */
  accountClass: string;
  labelFr: string;
}

export const LEAD_INDEXES: readonly LeadIndexDef[] = [
  // Balance sheet
  { code: "T", accountType: "Equity", accountClass: "Equity", labelFr: "Capitaux propres" },
  { code: "Q", accountType: "Liabilities", accountClass: "Other LT Liabilities", labelFr: "Emprunts" },
  { code: "P1", accountType: "Liabilities", accountClass: "Other LT Liabilities", labelFr: "Provisions pour risques et charges" },
  { code: "P2", accountType: "Liabilities", accountClass: "Other LT Liabilities", labelFr: "Dettes sociales" },
  { code: "P3", accountType: "Liabilities", accountClass: "Other LT Liabilities", labelFr: "Comptes d'attente & produits constatés d'avance" },
  { code: "P4", accountType: "Liabilities", accountClass: "Other LT Liabilities", labelFr: "Écart de conversion passif" },
  { code: "L", accountType: "Assets", accountClass: "Intangible Assets", labelFr: "Immobilisations incorporelles & charges immobilisées" },
  { code: "K", accountType: "Assets", accountClass: "Fixed Assets", labelFr: "Immobilisations corporelles" },
  { code: "J", accountType: "Assets", accountClass: "Other LT Assets", labelFr: "Immobilisations financières" },
  { code: "F", accountType: "Assets", accountClass: "Inventory", labelFr: "Stocks" },
  { code: "N", accountType: "Liabilities", accountClass: "Accounts Payable", labelFr: "Fournisseurs & comptes rattachés" },
  { code: "E", accountType: "Assets", accountClass: "Accounts Receivable", labelFr: "Créances clients" },
  { code: "O1", accountType: "Liabilities", accountClass: "Other Assets/Liabilities", labelFr: "Créances fiscales" },
  { code: "O2", accountType: "Liabilities", accountClass: "Other Assets/Liabilities", labelFr: "Dettes fiscales" },
  { code: "O4", accountType: "Expenses", accountClass: "Taxes Expense", labelFr: "IS & participation" },
  { code: "I1", accountType: "Assets", accountClass: "Other Assets/Liabilities", labelFr: "Groupe et associés (court terme)" },
  { code: "I2", accountType: "Assets", accountClass: "Other Assets/Liabilities", labelFr: "Groupe et associés" },
  { code: "G2", accountType: "Assets", accountClass: "Other Current Assets", labelFr: "Autres actifs circulants" },
  { code: "G3", accountType: "Assets", accountClass: "Other Current Assets", labelFr: "Écart de conversion actif" },
  { code: "C", accountType: "Assets", accountClass: "Cash", labelFr: "Disponibilités" },
  // Income statement
  { code: "UA", accountType: "Revenues", accountClass: "Revenue", labelFr: "Chiffre d'affaires" },
  { code: "UB2", accountType: "Revenues", accountClass: "Other Income/Expense", labelFr: "Autres produits" },
  { code: "UC", accountType: "Revenues", accountClass: "Interest Income/Expense", labelFr: "Revenus financiers" },
  { code: "U1", accountType: "Revenues", accountClass: "Extraordinary Income/Expense", labelFr: "Produits exceptionnels" },
  { code: "VA1", accountType: "Expenses", accountClass: "Cost of Goods Sold", labelFr: "Achats" },
  { code: "VA2", accountType: "Expenses", accountClass: "Cost of Goods Sold", labelFr: "Variation de stocks" },
  { code: "VB", accountType: "Expenses", accountClass: "Other Operating Expenses", labelFr: "Charges de personnel" },
  { code: "VO", accountType: "Expenses", accountClass: "Other Operating Expenses", labelFr: "Impôts & taxes" },
  { code: "VD1", accountType: "Expenses", accountClass: "Other Operating Expenses", labelFr: "Achats non stockés, transports & services extérieurs" },
  { code: "VD2", accountType: "Expenses", accountClass: "Other Operating Expenses", labelFr: "Dotations aux amortissements et provisions" },
  { code: "VD3", accountType: "Expenses", accountClass: "Other Operating Expenses", labelFr: "Reprises de provisions / transferts de charges" },
  { code: "VD4", accountType: "Expenses", accountClass: "Other Operating Expenses", labelFr: "Autres charges" },
  { code: "VD5", accountType: "Expenses", accountClass: "Interest Income/Expense", labelFr: "Charges financières" },
  { code: "V1", accountType: "Expenses", accountClass: "Extraordinary Income/Expense", labelFr: "Charges exceptionnelles" },
] as const;

export const LEAD_INDEX_BY_CODE: Record<string, LeadIndexDef> = Object.fromEntries(
  LEAD_INDEXES.map((d) => [d.code, d]),
);

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
