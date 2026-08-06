// Wave 1 of the ISA engine build prompt (A3): the cycle taxonomy — every
// E-section carries a lead letter and a working-paper reference. The lead
// schedule for a cycle is <letter>.100; detail papers count up from .110.
// Display-layer only: E-codes stay the storage keys (same rule as ST/E/C).

export interface LeadCycle {
  letter: string;
  titleEn: string;
  titleFr: string;
}

export const LEAD_CYCLES: Record<string, LeadCycle> = {
  R: { letter: "R", titleEn: "Revenue & receivables", titleFr: "Ventes et créances" },
  P: { letter: "P", titleEn: "Purchases & payables", titleFr: "Achats et dettes fournisseurs" },
  Z: { letter: "Z", titleEn: "Payroll", titleFr: "Paie et personnel" },
  I: { letter: "I", titleEn: "Inventory", titleFr: "Stocks" },
  F: { letter: "F", titleEn: "Fixed assets & intangibles", titleFr: "Immobilisations" },
  B: { letter: "B", titleEn: "Cash, investments & borrowings", titleFr: "Trésorerie, placements et emprunts" },
  X: { letter: "X", titleEn: "Tax", titleFr: "Impôts et taxes" },
  Q: { letter: "Q", titleEn: "Equity, provisions & other", titleFr: "Capitaux propres, provisions et autres" },
  G: { letter: "G", titleEn: "General & cross-cutting", titleFr: "Général et transversal" },
};

/** E-section code → lead letter. Codes not listed fall back to G. */
const LETTER_OF: Record<string, string> = {
  E100: "R", // Revenue & Receivables
  E110: "P", // Purchases & Payables
  E120: "Z", // Payroll & Personnel Costs
  E130: "I", // Inventories
  E140: "F", // Property, Plant & Equipment
  E150: "F", // Intangibles & Goodwill
  E160: "B", // Investments & Financial Assets
  E170: "B", // Cash & Bank / Loans & Borrowings
  E180: "X", // Taxation
  E190: "X", // VAT / Sales Taxes
  E200: "Q", // Provisions & Employee Benefits
  E210: "F", // Leases
  E220: "Q", // HAO Items
  E230: "Q", // Cash Flow Statement Tie-out
  E270: "Q", // Commitments & Contingencies
  E280: "Q", // Equity & Reserves
  E310: "G", E320: "G", E330: "G", E350: "G", E360: "G", E370: "G", E380: "G", E390: "G",
  E500: "G", E510: "G", // IT overlay
};

export function leadLetter(sectionCode: string): string {
  return LETTER_OF[sectionCode] ?? "G";
}

/**
 * Working-paper reference for a section's lead schedule: the cycle's .100
 * sheet when the section is the cycle's anchor, else .110/.120… by the
 * section's position within its cycle (stable, code-ordered).
 */
export function leadRef(sectionCode: string): string {
  const letter = leadLetter(sectionCode);
  const members = Object.keys(LETTER_OF).filter((c) => LETTER_OF[c] === letter).sort();
  const idx = Math.max(0, members.indexOf(sectionCode));
  return `${letter}.${100 + idx * 10}`;
}

export function cycleTitle(letter: string, locale: "en" | "fr"): string {
  const c = LEAD_CYCLES[letter] ?? LEAD_CYCLES.G;
  return locale === "fr" ? c.titleFr : c.titleEn;
}
