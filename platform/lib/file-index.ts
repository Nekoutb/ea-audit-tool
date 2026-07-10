// The default audit file index (master spec §3), instantiated per engagement.
// The numbering gaps are INTENTIONAL and follow the methodology's convention:
// there is no D2 and no D5.3; D1 jumps to D3.1. Do not "normalize" them.

export type Section = "A" | "B" | "C" | "D" | "E" | "F";

export interface FileIndexEntry {
  code: string;
  section: Section;
  titleEn: string;
  titleFr: string;
  /** Instantiated but only activated when a trigger question answers "yes". */
  conditional?: boolean;
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

export const SECTIONS: readonly { section: Section; titleEn: string; titleFr: string }[] = [
  { section: "A", titleEn: "Financial statements", titleFr: "États financiers" },
  { section: "B", titleEn: "Completion", titleFr: "Achèvement" },
  { section: "C", titleEn: "Communication", titleFr: "Communication" },
  { section: "D", titleEn: "Acceptance & planning", titleFr: "Acceptation et planification" },
  { section: "E", titleEn: "Execution", titleFr: "Exécution" },
  { section: "F", titleEn: "OHADA statutory", titleFr: "Obligations légales OHADA" },
] as const;
