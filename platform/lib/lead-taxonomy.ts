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
  "E4.1": "R", // Revenue & Receivables
  "E4.2": "P", // Purchases & Payables
  "E4.3": "Z", // Payroll & Personnel Costs
  "E4.4": "I", // Inventories
  "E4.5": "F", // Property, Plant & Equipment
  "E4.6": "F", // Intangibles & Goodwill
  "E4.7": "B", // Investments & Financial Assets
  "E4.8": "B", // Cash & Bank / Loans & Borrowings
  "E4.9": "X", // Taxation
  "E4.10": "X", // VAT / Sales Taxes
  "E4.11": "Q", // Provisions & Employee Benefits
  "E4.12": "F", // Leases
  "E4.13": "Q", // HAO Items
  "E4.14": "Q", // Cash Flow Statement Tie-out
  "E4.15": "Q", // Commitments & Contingencies
  "E4.16": "Q", // Equity & Reserves
  "E6.1": "G", "E6.2": "G", "E6.3": "G", "E3.1": "G", "E6.4": "G", "E6.5": "G", "E6.6": "G", "E6.7": "G",
  "E1.1": "G", "E1.2": "G", // IT overlay
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
