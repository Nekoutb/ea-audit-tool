// The default audit file index (master spec §3), instantiated per engagement.
// The numbering gaps are INTENTIONAL and follow the methodology's convention:
// there is no D2 and no D5.3; D1 jumps to D3.1. Do not "normalize" them.

export type Section = "A" | "B" | "C" | "D" | "E" | "F";

/**
 * Documentation tier (nature/timing/extent scaling by engagement complexity):
 * "core" items instantiate on EVERY engagement including very simple ones;
 * "standard" items add on non-complex and complex engagements; "extended"
 * items only instantiate on complex engagements. Entries without a tier are
 * standard.
 */
export type FileIndexTier = "core" | "standard" | "extended";

export interface FileIndexEntry {
  code: string;
  section: Section;
  titleEn: string;
  titleFr: string;
  /** Instantiated but only activated when a trigger question answers "yes". */
  conditional?: boolean;
  tier?: FileIndexTier;
}

export const DEFAULT_FILE_INDEX: readonly FileIndexEntry[] = [
  // A — Financial statements
  {
    code: "A1",
    section: "A",
    titleEn: "Financial Statements Program",
    titleFr: "Programme des états financiers",
  },

  // B — Completion
  { code: "B1", section: "B", titleEn: "Completion Checklist", titleFr: "Liste de contrôle d'achèvement" },
  { code: "B2", section: "B", titleEn: "Engagement Quality Review", titleFr: "Revue de qualité de la mission" },
  { code: "B3", section: "B", titleEn: "Consultation Record", titleFr: "Registre des consultations" },
  { code: "B4", section: "B", titleEn: "Significant Matters / Issues", titleFr: "Questions significatives" },
  { code: "B5", section: "B", titleEn: "Summary of Misstatements", titleFr: "Récapitulatif des anomalies" },
  { code: "B6", section: "B", titleEn: "Points Outstanding", titleFr: "Points en suspens" },
  { code: "B7", section: "B", titleEn: "Subsequent Events Review (ISA 560)", titleFr: "Revue des événements postérieurs (ISA 560)" },
  { code: "B8", section: "B", titleEn: "Management Representation Letter(s) (ISA 580)", titleFr: "Lettre(s) d'affirmation de la direction (ISA 580)" },
  { code: "B9", section: "B", titleEn: "External Confirmation Letter", titleFr: "Lettre de confirmation externe" },
  { code: "B10", section: "B", titleEn: "Points Forward (next year)", titleFr: "Points à reporter (exercice suivant)" },

  // C — Communication
  {
    code: "C1",
    section: "C",
    titleEn: "Communications with Those Charged with Governance and Management (ISA 260/265)",
    titleFr: "Communications avec les responsables de la gouvernance et la direction (ISA 260/265)",
  },

  // D — Acceptance & Planning (no D2; no D5.3 — intentional gaps)
  { code: "D1", section: "D", titleEn: "Engagement Strategy Driver", titleFr: "Pilote de la stratégie de mission" },
  { code: "D3.1", section: "D", titleEn: "Engagement Acceptance / Continuance Procedures", titleFr: "Procédures d'acceptation / de maintien de la mission" },
  { code: "D4.1", section: "D", titleEn: "Direction from the Engagement Partner", titleFr: "Directives de l'associé responsable de la mission" },
  { code: "D4.2", section: "D", titleEn: "Understanding the Entity, its Environment and the Applicable Financial Reporting Framework (ISA 315)", titleFr: "Connaissance de l'entité, de son environnement et du référentiel comptable applicable (ISA 315)" },
  { code: "D4.3", section: "D", titleEn: "Analytical Risk Assessment Procedures", titleFr: "Procédures analytiques d'évaluation des risques" },
  { code: "D4.4", section: "D", titleEn: "Understanding the Components of Internal Control", titleFr: "Connaissance des composantes du contrôle interne" },
  { code: "D4.5", section: "D", titleEn: "Control Environment Assessment", titleFr: "Évaluation de l'environnement de contrôle", conditional: true },
  { code: "D4.6", section: "D", titleEn: "Understanding the IT Environment", titleFr: "Connaissance de l'environnement informatique", conditional: true },
  { code: "D4.7", section: "D", titleEn: "Reliance on Experts (ISA 620)", titleFr: "Utilisation des travaux d'un expert (ISA 620)", conditional: true },
  { code: "D4.8", section: "D", titleEn: "Service Organisations (ISA 402)", titleFr: "Sociétés de services (ISA 402)", conditional: true },
  { code: "D4.9", section: "D", titleEn: "Internal Audit (ISA 610)", titleFr: "Audit interne (ISA 610)", conditional: true },
  { code: "D5.1", section: "D", titleEn: "Materiality (ISA 320)", titleFr: "Seuil de signification (ISA 320)" },
  { code: "D5.2", section: "D", titleEn: "Commitments & Contingencies", titleFr: "Engagements et passifs éventuels" },
  { code: "D5.4", section: "D", titleEn: "Fraud Risk Assessment (ISA 240)", titleFr: "Évaluation du risque de fraude (ISA 240)" },
  { code: "D5.5", section: "D", titleEn: "Going Concern — Preliminary (ISA 570)", titleFr: "Continuité d'exploitation — préliminaire (ISA 570)" },
  { code: "D5.6", section: "D", titleEn: "Related Parties (ISA 550)", titleFr: "Parties liées (ISA 550)" },
  { code: "D5.7", section: "D", titleEn: "Accounting Estimates — Planning (ISA 540)", titleFr: "Estimations comptables — planification (ISA 540)" },
  { code: "D6.1", section: "D", titleEn: "Documentation of Job Arrangements", titleFr: "Documentation de l'organisation de la mission" },
  { code: "D7.1", section: "D", titleEn: "Team Discussion", titleFr: "Discussion d'équipe" },
  { code: "D7.2", section: "D", titleEn: "Risk Assessment (Risk Register)", titleFr: "Évaluation des risques (registre des risques)" },

  // E — Execution: default audit cycles (E100…) then standard cross-cutting
  // sections with pre-built programs (E270–E390).
  { code: "E100", section: "E", titleEn: "Revenue & Receivables", titleFr: "Ventes et créances clients" },
  { code: "E110", section: "E", titleEn: "Purchases & Payables", titleFr: "Achats et dettes fournisseurs" },
  { code: "E120", section: "E", titleEn: "Payroll & Personnel Costs", titleFr: "Paie et charges de personnel" },
  { code: "E130", section: "E", titleEn: "Inventories (ISA 501)", titleFr: "Stocks (ISA 501)" },
  { code: "E140", section: "E", titleEn: "Property, Plant & Equipment", titleFr: "Immobilisations corporelles" },
  { code: "E150", section: "E", titleEn: "Intangibles & Goodwill", titleFr: "Immobilisations incorporelles et fonds commercial" },
  { code: "E160", section: "E", titleEn: "Investments & Financial Assets", titleFr: "Titres et actifs financiers" },
  { code: "E170", section: "E", titleEn: "Cash & Bank / Loans & Borrowings", titleFr: "Trésorerie / emprunts et dettes financières" },
  { code: "E180", section: "E", titleEn: "Taxation (current & deferred)", titleFr: "Impôts (exigibles et différés)" },
  { code: "E190", section: "E", titleEn: "VAT / Sales Taxes", titleFr: "TVA / taxes sur le chiffre d'affaires" },
  { code: "E200", section: "E", titleEn: "Provisions & Employee Benefits", titleFr: "Provisions et avantages du personnel" },
  { code: "E210", section: "E", titleEn: "Leases / Location-acquisition", titleFr: "Contrats de location-acquisition" },
  { code: "E220", section: "E", titleEn: "HAO Items (SYSCOHADA classes 8 / 48)", titleFr: "Éléments HAO (classes 8 / comptes 48)" },
  { code: "E230", section: "E", titleEn: "Cash Flow Statement (TFT) Tie-out", titleFr: "Concordance du tableau des flux de trésorerie (TFT)" },
  { code: "E270", section: "E", titleEn: "Commitments & Contingencies", titleFr: "Engagements et passifs éventuels" },
  { code: "E280", section: "E", titleEn: "Equity & Reserves", titleFr: "Capitaux propres et réserves" },
  { code: "E310", section: "E", titleEn: "Laws & Regulations / NOCLAR (ISA 250)", titleFr: "Textes légaux et réglementaires / NOCLAR (ISA 250)" },
  { code: "E320", section: "E", titleEn: "Related Parties (ISA 550)", titleFr: "Parties liées (ISA 550)" },
  { code: "E330", section: "E", titleEn: "Going Concern (ISA 570)", titleFr: "Continuité d'exploitation (ISA 570)" },
  { code: "E350", section: "E", titleEn: "Fraud & Management Override (ISA 240)", titleFr: "Fraude et contournement des contrôles par la direction (ISA 240)" },
  { code: "E360", section: "E", titleEn: "Minutes & Statutory Records", titleFr: "Procès-verbaux et registres légaux" },
  { code: "E370", section: "E", titleEn: "Opening Balances & Comparatives (ISA 510/710)", titleFr: "Soldes d'ouverture et chiffres comparatifs (ISA 510/710)" },
  { code: "E380", section: "E", titleEn: "Subsequent Events (ISA 560)", titleFr: "Événements postérieurs à la clôture (ISA 560)" },
  { code: "E390", section: "E", titleEn: "Accounting Estimates (ISA 540)", titleFr: "Estimations comptables (ISA 540)" },
  // E2 (IT) group of the ST/E/C hierarchy — general and application IT controls.
  { code: "E500", section: "E", titleEn: "ITGC Testing", titleFr: "Tests des contrôles généraux informatiques" },
  { code: "E510", section: "E", titleEn: "Application & IT-Dependent Controls", titleFr: "Contrôles applicatifs et dépendants de l'informatique" },

  // F — OHADA statutory section
  { code: "F1", section: "F", titleEn: "Statutory Deadlines Calendar", titleFr: "Calendrier des échéances légales" },
  { code: "F2", section: "F", titleEn: "Conventions Réglementées Register & Rapport Spécial", titleFr: "Registre des conventions réglementées et rapport spécial" },
  { code: "F3", section: "F", titleEn: "Article 715 Report to the Board", titleFr: "Rapport article 715 au conseil d'administration" },
  { code: "F4", section: "F", titleEn: "Procédure d'Alerte File", titleFr: "Dossier de procédure d'alerte" },
  { code: "F5", section: "F", titleEn: "Révélation des Faits Délictueux", titleFr: "Révélation des faits délictueux" },
  { code: "F6", section: "F", titleEn: "Registres de Titres Nominatifs Attestation", titleFr: "Attestation sur les registres de titres nominatifs" },
  { code: "F7", section: "F", titleEn: "Equity vs Half-of-Share-Capital Monitoring", titleFr: "Suivi capitaux propres / moitié du capital social" },
  { code: "F8", section: "F", titleEn: "Co-CAC Coordination File", titleFr: "Dossier de coordination co-commissariat" },
] as const;

// Concise task labels for the dashboard/phase task lists, keyed by the stable
// item code so they apply to existing and new engagements without a data
// migration. Kept short (<= ~36 chars) so no task name is cut off in the task
// column. The full titles above still drive documents, exports and workpapers.
const SHORT_TITLES: Record<string, { en: string; fr: string }> = {
  A1: { en: "Financial Statements Program", fr: "Programme des états financiers" },
  B1: { en: "Completion Checklist", fr: "Liste de contrôle d'achèvement" },
  B2: { en: "Engagement Quality Review", fr: "Revue qualité de la mission" },
  B3: { en: "Consultation Record", fr: "Registre des consultations" },
  B4: { en: "Significant Matters", fr: "Questions significatives" },
  B5: { en: "Summary of Misstatements", fr: "Récapitulatif des anomalies" },
  B6: { en: "Points Outstanding", fr: "Points en suspens" },
  B7: { en: "Subsequent Events (ISA 560)", fr: "Événements postérieurs (ISA 560)" },
  B8: { en: "Management Rep. Letters (ISA 580)", fr: "Lettres d'affirmation (ISA 580)" },
  B9: { en: "External Confirmation Letter", fr: "Lettre de confirmation externe" },
  B10: { en: "Points Forward (next year)", fr: "Points à reporter (N+1)" },
  C1: { en: "Governance Communications (ISA 260)", fr: "Communications gouvernance (ISA 260)" },
  D1: { en: "Engagement Strategy Driver", fr: "Pilote de stratégie de mission" },
  "D3.1": { en: "Acceptance / Continuance", fr: "Acceptation / maintien" },
  "D4.1": { en: "Partner Direction", fr: "Directives de l'associé" },
  "D4.2": { en: "Understanding the Entity (ISA 315)", fr: "Connaissance de l'entité (ISA 315)" },
  "D4.3": { en: "Analytical Risk Procedures", fr: "Procédures analytiques de risque" },
  "D4.4": { en: "Internal Control Components", fr: "Composantes du contrôle interne" },
  "D4.5": { en: "Control Environment", fr: "Environnement de contrôle" },
  "D4.6": { en: "IT Environment", fr: "Environnement informatique" },
  "D4.7": { en: "Reliance on Experts (ISA 620)", fr: "Recours à un expert (ISA 620)" },
  "D4.8": { en: "Service Organisations (ISA 402)", fr: "Sociétés de services (ISA 402)" },
  "D4.9": { en: "Internal Audit (ISA 610)", fr: "Audit interne (ISA 610)" },
  "D5.1": { en: "Materiality (ISA 320)", fr: "Seuil de signification (ISA 320)" },
  "D5.2": { en: "Commitments & Contingencies", fr: "Engagements et passifs éventuels" },
  "D5.4": { en: "Fraud Risk (ISA 240)", fr: "Risque de fraude (ISA 240)" },
  "D5.5": { en: "Going Concern — Prelim (ISA 570)", fr: "Continuité — préliminaire (ISA 570)" },
  "D5.6": { en: "Related Parties (ISA 550)", fr: "Parties liées (ISA 550)" },
  "D5.7": { en: "Estimates — Planning (ISA 540)", fr: "Estimations — planification (ISA 540)" },
  "D6.1": { en: "Job Arrangements", fr: "Organisation de la mission" },
  "D7.1": { en: "Team Discussion", fr: "Discussion d'équipe" },
  "D7.2": { en: "Risk Register", fr: "Registre des risques" },
  E100: { en: "Revenue & Receivables", fr: "Ventes et créances clients" },
  E110: { en: "Purchases & Payables", fr: "Achats et dettes fournisseurs" },
  E120: { en: "Payroll & Personnel", fr: "Paie et charges de personnel" },
  E130: { en: "Inventories (ISA 501)", fr: "Stocks (ISA 501)" },
  E140: { en: "Property, Plant & Equipment", fr: "Immobilisations corporelles" },
  E150: { en: "Intangibles & Goodwill", fr: "Incorporelles et goodwill" },
  E160: { en: "Investments & Financial Assets", fr: "Titres et actifs financiers" },
  E170: { en: "Cash, Loans & Borrowings", fr: "Trésorerie et emprunts" },
  E180: { en: "Taxation (current & deferred)", fr: "Impôts (exigibles / différés)" },
  E190: { en: "VAT / Sales Taxes", fr: "TVA / taxes sur ventes" },
  E200: { en: "Provisions & Benefits", fr: "Provisions et avantages" },
  E210: { en: "Leases", fr: "Contrats de location" },
  E220: { en: "HAO Items (classes 8 / 48)", fr: "Éléments HAO (classes 8 / 48)" },
  E230: { en: "Cash Flow (TFT) Tie-out", fr: "Concordance du TFT" },
  E270: { en: "Commitments & Contingencies", fr: "Engagements et passifs éventuels" },
  E280: { en: "Equity & Reserves", fr: "Capitaux propres et réserves" },
  E310: { en: "Laws & NOCLAR (ISA 250)", fr: "Textes légaux / NOCLAR (ISA 250)" },
  E320: { en: "Related Parties (ISA 550)", fr: "Parties liées (ISA 550)" },
  E330: { en: "Going Concern (ISA 570)", fr: "Continuité d'exploitation (ISA 570)" },
  E350: { en: "Fraud & Override (ISA 240)", fr: "Fraude et contournement (ISA 240)" },
  E360: { en: "Minutes & Statutory Records", fr: "Procès-verbaux et registres légaux" },
  E370: { en: "Opening Balances (ISA 510/710)", fr: "Soldes d'ouverture (ISA 510/710)" },
  E380: { en: "Subsequent Events (ISA 560)", fr: "Événements postérieurs (ISA 560)" },
  E390: { en: "Accounting Estimates (ISA 540)", fr: "Estimations comptables (ISA 540)" },
  E500: { en: "ITGC Testing", fr: "Contrôles généraux informatiques" },
  E510: { en: "Application Controls", fr: "Contrôles applicatifs" },
  F1: { en: "Statutory Deadlines Calendar", fr: "Calendrier des échéances légales" },
  F2: { en: "Conventions Réglementées", fr: "Conventions réglementées" },
  F3: { en: "Article 715 Board Report", fr: "Rapport article 715" },
  F4: { en: "Procédure d'Alerte", fr: "Procédure d'alerte" },
  F5: { en: "Révélation des Faits Délictueux", fr: "Révélation des faits délictueux" },
  F6: { en: "Titres Nominatifs Attestation", fr: "Attestation titres nominatifs" },
  F7: { en: "Equity vs Half-Capital", fr: "Capitaux propres / demi-capital" },
  F8: { en: "Co-CAC Coordination", fr: "Coordination co-commissariat" },
};

/** Concise task label for lists; falls back to the provided full title. */
export function shortTitle(
  code: string,
  locale: "en" | "fr",
  fallback: string,
): string {
  const s = SHORT_TITLES[code];
  return s ? s[locale] : fallback;
}

// ---- documentation scaling by engagement complexity ----

/** Instantiated on every engagement, including very simple entities. */
const CORE_CODES = new Set([
  "A1",
  "B1", "B4", "B5", "B6", "B7", "B8", "B10",
  "C1",
  "D1", "D3.1", "D4.1", "D4.2", "D4.3", "D5.1", "D5.4", "D5.5", "D7.1", "D7.2",
  "E100", "E110", "E120", "E170", "E180", "E330", "E360", "E370", "E380",
  "F1",
]);

/** Only instantiated on complex engagements. */
const EXTENDED_CODES = new Set(["B2", "E150", "E160", "E210", "E220", "F4", "F8"]);

export function tierOf(entry: FileIndexEntry): FileIndexTier {
  if (entry.tier) return entry.tier;
  if (CORE_CODES.has(entry.code)) return "core";
  if (EXTENDED_CODES.has(entry.code)) return "extended";
  return "standard";
}

/**
 * The file-index entries to instantiate for a given complexity level — the
 * concrete "extent of documentation" effect of the classification:
 * very_simple = core only (no conditional forms), non_complex = core + standard,
 * complex = the full index.
 */
export function itemsForComplexity(
  complexity: "complex" | "non_complex" | "very_simple",
): FileIndexEntry[] {
  return DEFAULT_FILE_INDEX.filter((entry) => {
    const tier = tierOf(entry);
    if (complexity === "very_simple") return tier === "core" && !entry.conditional;
    if (complexity === "non_complex") return tier !== "extended";
    return true;
  });
}

export const SECTIONS: readonly { section: Section; titleEn: string; titleFr: string }[] = [
  { section: "A", titleEn: "Financial statements", titleFr: "États financiers" },
  { section: "B", titleEn: "Completion", titleFr: "Achèvement" },
  { section: "C", titleEn: "Communication", titleFr: "Communication" },
  { section: "D", titleEn: "Acceptance & planning", titleFr: "Acceptation et planification" },
  { section: "E", titleEn: "Execution", titleFr: "Exécution" },
  { section: "F", titleEn: "OHADA statutory", titleFr: "Obligations légales OHADA" },
] as const;
