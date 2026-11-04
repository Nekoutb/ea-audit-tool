// Pure, so the client grid can import it without the database layer.

/** How each ratio is computed, for the tooltip and the column (F064). */
export const RATIO_FORMULAS: Record<string, { en: string; fr: string }> = {
  current: { en: "Current assets / current liabilities", fr: "Actif circulant / passif circulant" },
  quick: { en: "(Current assets - inventory) / current liabilities", fr: "(Actif circulant - stocks) / passif circulant" },
  cash: { en: "Cash / current liabilities", fr: "Trésorerie / passif circulant" },
  wc: { en: "Current assets - current liabilities", fr: "Actif circulant - passif circulant" },
  dso: { en: "Receivables / last 3 months' sales (GL) x 90", fr: "Clients / ventes des 3 derniers mois (grand livre) x 90" },
  dpo: { en: "Payables / last 3 months' purchases (GL) x 90", fr: "Fournisseurs / achats des 3 derniers mois (grand livre) x 90" },
  inv_turn: { en: "Cost of sales / inventory", fr: "Coût des ventes / stocks" },
  rec_turn: { en: "Revenue / receivables", fr: "Chiffre d'affaires / clients" },
  pay_turn: { en: "Cost of sales / payables", fr: "Coût des ventes / fournisseurs" },
  asset_turn: { en: "Revenue / total net assets", fr: "Chiffre d'affaires / total actif net" },
  gross: { en: "(Revenue - cost of sales) / revenue", fr: "(Chiffre d'affaires - coût des ventes) / chiffre d'affaires" },
  ebitda: { en: "(Classes 7 - 6 + finance costs + depreciation) / revenue", fr: "(Classes 7 - 6 + charges financières + dotations) / chiffre d'affaires" },
  net: { en: "(Classes 7 - 6, before tax) / revenue", fr: "(Classes 7 - 6, avant impôt) / chiffre d'affaires" },
  gearing: { en: "Financial debt / (financial debt + equity)", fr: "Dettes financières / (dettes financières + capitaux propres)" },
  dte: { en: "Financial debt / equity", fr: "Dettes financières / capitaux propres" },
  equity_ratio: { en: "Equity / total net assets", fr: "Capitaux propres / total actif net" },
  int_cover: { en: "(Classes 7 - 6 + finance costs) / finance costs", fr: "(Classes 7 - 6 + charges financières) / charges financières" },
  roa: { en: "Net result after tax (after 89) / total net assets", fr: "Résultat net après impôt (après 89) / total actif net" },
  roe: { en: "Net result after tax (after 89) / equity", fr: "Résultat net après impôt (après 89) / capitaux propres" },
  roce: { en: "(Net result after tax + finance costs) / (equity + financial debt)", fr: "(Résultat net après impôt + charges financières) / (capitaux propres + dettes financières)" },
};

/**
 * The relative change of a line. A ratio's relative change explodes near zero
 * and says nothing the points column does not: only amounts and day counts get
 * one, and it is capped at +/-999 % (F064).
 */
export function relativeVariance(unit: string, current: number | null, prior: number | null): number | null {
  if (unit === "%" || unit === "x") return null;
  if (current === null || prior === null || prior === 0) return null;
  const change = Math.round(((current - prior) / Math.abs(prior)) * 1000) / 10;
  return Math.max(-999, Math.min(999, change));
}
