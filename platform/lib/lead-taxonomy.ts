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

/**
 * E-section code → lead letter. Codes not listed fall back to G.
 *
 * These assignments were written against the sixteen-cycle E-section list the
 * file index used before it was rebuilt on the SYSCOHADA lead codes, and were
 * never moved across: E4.3 was mapped to payroll when E4.3 is now Inventories,
 * E4.4 to inventory when E4.4 is now Property, Plant & Equipment, and so on
 * down the block. They are restated here against the titles that actually
 * ship in lib/file-index.ts, so a lead schedule is filed under the cycle it
 * belongs to.
 */
const LETTER_OF: Record<string, string> = {
  // R — revenue & receivables
  "E4.1": "R", // Trade Receivables (E)
  "E4.20": "R", // Revenue (UA)
  // P — purchases & payables
  "E4.2": "P", // Trade Payables (N)
  "E4.24": "P", // Purchases (VA1)
  "E4.28": "P", // External Services (VD1)
  // Z — payroll
  "E4.11": "Z", // Social & Payroll Liabilities (P2)
  "E4.26": "Z", // Personnel Costs (VB)
  // I — inventory
  "E4.3": "I", // Inventories (F)
  "E4.25": "I", // Change in Inventories (VA2)
  // F — fixed assets & intangibles
  "E4.4": "F", // Property, Plant & Equipment (K)
  "E4.5": "F", // Intangible Assets (L)
  "E4.29": "F", // Depreciation & Provisions (VD2)
  "E4.35": "F", // Leases
  // B — cash, investments & borrowings
  "E4.6": "B", // Financial Assets (J)
  "E4.7": "B", // Cash & Cash Equivalents (C)
  "E4.8": "B", // Borrowings (Q)
  "E4.22": "B", // Finance Income (UC)
  "E4.32": "B", // Finance Costs (VD5)
  // X — tax
  "E4.14": "X", // Tax Receivables (O1)
  "E4.15": "X", // Tax Payables (O2)
  "E4.27": "X", // Taxes & Duties (VO)
  "E4.34": "X", // Income Tax (O4)
  // Q — equity, provisions & other
  "E4.9": "Q", // Share Capital & Reserves (T)
  "E4.10": "Q", // Provisions for Risks & Charges (P1)
  "E4.12": "Q", // Suspense & Deferred Income (P3)
  "E4.13": "Q", // Translation Difference — Liabilities (P4)
  "E4.16": "Q", // Group & Associates — Short Term (I1)
  "E4.17": "Q", // Group & Associates (I2)
  "E4.18": "Q", // Other Current Assets (G2)
  "E4.19": "Q", // Translation Difference — Assets (G3)
  "E4.21": "Q", // Other Income (UB2)
  "E4.23": "Q", // Exceptional Income (U1)
  "E4.30": "Q", // Provision Reversals (VD3)
  "E4.31": "Q", // Other Expenses (VD4)
  "E4.33": "Q", // Exceptional Expenses (V1)
  // G — general & cross-cutting: the tie-out, the general audit procedures now
  // grouped under E5, and the IT overlay.
  "E4.36": "G", // Cash Flow (TFT) Tie-out
  "E6.1": "G", "E6.2": "G", "E6.3": "G", "E3.1": "G", "E6.4": "G", "E6.5": "G", "E6.6": "G", "E6.7": "G",
  "E6.9": "G", // Litigation & Claims (ISA 501)
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
