// The one SYSCOHADA balance sheet (F013). Materiality, the financial analysis and
// the SAD each summed the trial balance their own way and showed three "total
// assets" for one file. Every total now comes from here: the révisé bilan, net
// of amortisation and depreciation (28, 29, 39, 49, 59), class 4 by the sign of
// each account's balance, and 56 (banques, crédits de trésorerie) on the passif.
// 490 and 499 follow lib/lead-classes.ts, which files them under liability
// indexes (N and P1): they sit on the passif, whatever their sign, and never
// net the assets (F059).

export interface TbBalance {
  account: string;
  /** closing balance, debit positive */
  value: number;
}

export interface BilanTotals {
  /** class 2, net of 28 and 29 */
  fixedAssets: number;
  /** class 3, net of 39 */
  inventory: number;
  /** class 4 accounts in debit, net of 49 (490 and 499 excepted) */
  receivables: number;
  /** class 5 accounts in debit (56 excluded), net of 59 */
  cashAssets: number;
  /** inventory + receivables + cash assets */
  currentAssets: number;
  /** fixed + current assets: "Total actif net" */
  totalAssets: number;
  /** class 4 accounts in credit (49 excluded), plus 490 and 499 */
  class4Credit: number;
  /** 56, and class 5 accounts in credit */
  cashLiabilities: number;
  /** class 4 in credit + treasury liabilities */
  currentLiabilities: number;
  /** class 1, credit positive */
  class1: number;
  /** classes 6 to 8, credit positive: the year's net result after 89 */
  netResult: number;
  /** class 1 + current liabilities + net result, when the result is not yet in class 13 */
  totalLiabilitiesAndEquity: number;
}

export function bilanTotals(rows: readonly TbBalance[]): BilanTotals {
  let fixedAssets = 0;
  let inventory = 0;
  let debit4 = 0;
  let credit4 = 0;
  let prov49 = 0;
  let cashDebit = 0;
  let cashCredit = 0;
  let prov59 = 0;
  let class1 = 0;
  let resultAccounts = 0;
  for (const { account, value } of rows) {
    const c1 = account[0];
    const c2 = account.slice(0, 2);
    if (c1 === "1") class1 -= value;
    else if (c1 === "2") fixedAssets += value;
    else if (c1 === "3") inventory += value;
    else if (c1 === "4") {
      if (account.startsWith("490") || account.startsWith("499")) credit4 -= value;
      else if (c2 === "49") prov49 += value;
      else if (value > 0) debit4 += value;
      else credit4 -= value;
    } else if (c1 === "5") {
      if (c2 === "59") prov59 += value;
      else if (c2 === "56") cashCredit -= value;
      else if (value > 0) cashDebit += value;
      else cashCredit -= value;
    } else if (c1 === "6" || c1 === "7" || c1 === "8") resultAccounts -= value;
  }
  const receivables = debit4 + prov49;
  const cashAssets = cashDebit + prov59;
  const currentAssets = inventory + receivables + cashAssets;
  const totalAssets = fixedAssets + currentAssets;
  const currentLiabilities = credit4 + cashCredit;
  return {
    fixedAssets,
    inventory,
    receivables,
    cashAssets,
    currentAssets,
    totalAssets,
    class4Credit: credit4,
    cashLiabilities: cashCredit,
    currentLiabilities,
    class1,
    netResult: resultAccounts,
    totalLiabilitiesAndEquity: class1 + currentLiabilities + resultAccounts,
  };
}

/**
 * The income statement of the SYSCOHADA TB: result before tax is classes 7 and 8
 * (without 89) less class 6; the net result takes account 89 off (F019, F064).
 */
export function incomeFromTb(rows: readonly TbBalance[]): { beforeTax: number; incomeTax: number; netResult: number } {
  let beforeTax = 0;
  let incomeTax = 0;
  for (const { account, value } of rows) {
    if (account.startsWith("89")) incomeTax += value;
    else if (account[0] === "6" || account[0] === "7" || account[0] === "8") beforeTax -= value;
  }
  return { beforeTax, incomeTax, netResult: beforeTax - incomeTax };
}

/** The label shown beside every total-assets figure (F013). */
export function assetBasisLabel(locale: "en" | "fr", tbVersion: number | null): string {
  const tb = tbVersion === null ? "" : `, ${locale === "fr" ? "balance" : "TB"} v${tbVersion}`;
  return locale === "fr" ? `Total actif net (SYSCOHADA)${tb}` : `Total net assets (SYSCOHADA)${tb}`;
}
