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
    titleEn: "Final Overall Financial Statement Review (ISA 520)",
    titleFr: "Revue finale globale des états financiers (ISA 520)",
  },

  // B — Completion
  { code: "B1", section: "B", titleEn: "Review and Approval Summary", titleFr: "Récapitulatif de revue et d'approbation" },
  { code: "B2", section: "B", titleEn: "Engagement Quality Review", titleFr: "Revue de qualité de la mission" },
  { code: "B3", section: "B", titleEn: "Consultation Record", titleFr: "Registre des consultations" },
  { code: "B4", section: "B", titleEn: "Summary Review Memorandum", titleFr: "Mémorandum récapitulatif de revue" },
  { code: "B5", section: "B", titleEn: "Summary of Audit Differences", titleFr: "Récapitulatif des écarts d'audit" },
  { code: "B6", section: "B", titleEn: "Points Outstanding", titleFr: "Points en suspens" },
  { code: "B7", section: "B", titleEn: "Subsequent Events Review (ISA 560)", titleFr: "Revue des événements postérieurs (ISA 560)" },
  { code: "B8", section: "B", titleEn: "Management Representation Letter(s) (ISA 580)", titleFr: "Lettre(s) d'affirmation de la direction (ISA 580)" },
  { code: "B9", section: "B", titleEn: "External Confirmation Letter", titleFr: "Lettre de confirmation externe" },
  { code: "B10", section: "B", titleEn: "Points Forward (next year)", titleFr: "Points à reporter (exercice suivant)" },

  { code: "B11", section: "B", titleEn: "Complete Documentation and Archive Engagement", titleFr: "Finaliser la documentation et archiver la mission", tier: "core" },

  // C — Communication
  {
    code: "C1",
    section: "C",
    titleEn: "Client Communications — Those Charged with Governance and Management (ISA 260/265)",
    titleFr: "Communications avec les responsables de la gouvernance et la direction (ISA 260/265)",
  },

  // D — Acceptance & Planning (no D2; no D5.3 — intentional gaps)
  { code: "D1", section: "D", titleEn: "Prepare Audit Strategies Memorandum", titleFr: "Préparer le mémorandum de stratégie d'audit" },
  { code: "D3.1", section: "D", titleEn: "Consider Client Acceptance / Continuance Results", titleFr: "Examiner l'acceptation / le maintien du client" },
  // D3.2–D3.6 complete the acceptance phase: the ISA 210 / ISQM requirements
  // that previously had no working paper of their own.
  { code: "D3.2", section: "D", titleEn: "Independence and Ethics Conclusion (IESBA Code)", titleFr: "Conclusion sur l'indépendance et l'éthique (Code IESBA)" },
  { code: "D3.3", section: "D", titleEn: "Preconditions for an Audit (ISA 210)", titleFr: "Conditions préalables à l'audit (ISA 210)" },
  { code: "D3.4", section: "D", titleEn: "Predecessor Auditor Communication (ISA 300 / IESBA §320)", titleFr: "Communication avec l'auditeur précédent (ISA 300 / IESBA §320)", conditional: true },
  { code: "D3.5", section: "D", titleEn: "Engagement Letter (ISA 210)", titleFr: "Lettre de mission (ISA 210)" },
  { code: "D3.6", section: "D", titleEn: "Engagement Quality Review Determination (ISQM 1/2)", titleFr: "Détermination de la revue de qualité (ISQM 1/2)" },
  { code: "D4.1", section: "D", titleEn: "Direction from the Engagement Partner", titleFr: "Directives de l'associé responsable de la mission" },
  { code: "D4.2", section: "D", titleEn: "Understand the Business — the Entity, its Environment and the Applicable Framework (ISA 315)", titleFr: "Connaissance de l'entité, de son environnement et du référentiel comptable applicable (ISA 315)" },
  { code: "D4.3", section: "D", titleEn: "Analytical Risk Assessment Procedures", titleFr: "Procédures analytiques d'évaluation des risques" },
  { code: "D4.4", section: "D", titleEn: "Assess Internal Control at the Entity Level", titleFr: "Évaluer le contrôle interne au niveau de l'entité" },
  { code: "D4.5", section: "D", titleEn: "Control Environment Assessment", titleFr: "Évaluation de l'environnement de contrôle", conditional: true },
  { code: "D4.6", section: "D", titleEn: "Understand the IT Environment and Determine IT Involvement", titleFr: "Comprendre l'environnement informatique et déterminer l'implication IT", conditional: true },
  { code: "D4.7", section: "D", titleEn: "Reliance on Experts (ISA 620)", titleFr: "Utilisation des travaux d'un expert (ISA 620)", conditional: true },
  { code: "D4.8", section: "D", titleEn: "Service Organisations (ISA 402)", titleFr: "Sociétés de services (ISA 402)", conditional: true },
  { code: "D4.9", section: "D", titleEn: "Internal Audit (ISA 610)", titleFr: "Audit interne (ISA 610)", conditional: true },
  { code: "D5.1", section: "D", titleEn: "Determine Materiality — PM, TE and SAD Nominal Amount (ISA 320)", titleFr: "Déterminer le seuil de signification — PM, TE et seuil SAD (ISA 320)" },
  { code: "D5.2", section: "D", titleEn: "Commitments & Contingencies", titleFr: "Engagements et passifs éventuels" },
  { code: "D5.4", section: "D", titleEn: "Identify Fraud Risks and Determine Responses (ISA 240)", titleFr: "Identifier les risques de fraude et déterminer les réponses (ISA 240)" },
  { code: "D5.5", section: "D", titleEn: "Going Concern — Preliminary (ISA 570)", titleFr: "Continuité d'exploitation — préliminaire (ISA 570)" },
  { code: "D5.6", section: "D", titleEn: "Related Parties (ISA 550)", titleFr: "Parties liées (ISA 550)" },
  { code: "D5.7", section: "D", titleEn: "Accounting Estimates — Planning (ISA 540)", titleFr: "Estimations comptables — planification (ISA 540)" },
  { code: "D5.8", section: "D", titleEn: "Identify Significant Accounts, Disclosures and Relevant Assertions", titleFr: "Identifier les comptes significatifs, informations à fournir et assertions pertinentes", tier: "core" },
  { code: "D8.1", section: "D", titleEn: "Identify Significant Classes of Transactions and Related Applications", titleFr: "Identifier les catégories significatives de transactions et applications associées" },
  { code: "D8.2", section: "D", titleEn: "Understand Flows of Transactions, WCGWs and Controls", titleFr: "Comprendre les flux de transactions, les WCGW et les contrôles" },
  { code: "D8.3", section: "D", titleEn: "Perform Walkthroughs", titleFr: "Réaliser les tests de cheminement" },
  { code: "D8.4", section: "D", titleEn: "Understand and Evaluate the FSCP", titleFr: "Comprendre et évaluer le processus d'arrêté des comptes (FSCP)" },
  { code: "D8.5", section: "D", titleEn: "Select Controls to Test", titleFr: "Sélectionner les contrôles à tester" },
  { code: "D8.6", section: "D", titleEn: "Design Tests of Controls", titleFr: "Concevoir les tests de contrôles" },
  { code: "D9.1", section: "D", titleEn: "Planning Review and Approval Summary", titleFr: "Revue et approbation de la planification", tier: "core" },
  { code: "D9.2", section: "D", titleEn: "Report to Those Charged with Governance - Audit Planning", titleFr: "Rapport aux responsables de la gouvernance - planification de l'audit", tier: "core" },
  { code: "D6.1", section: "D", titleEn: "Assess the Team and Determine Need for Specialised Skills", titleFr: "Evaluer l'equipe et determiner le besoin de competences specialisees" },
  { code: "D6.2", section: "D", titleEn: "Audit Scope and Components (ISA 600)", titleFr: "Perimetre d'audit et composants (ISA 600)", tier: "extended" },
  { code: "D7.1", section: "D", titleEn: "Engagement Team Discussion", titleFr: "Discussion de l'équipe de mission" },
  { code: "D7.2", section: "D", titleEn: "Make Combined Risk Assessments (Risk Register)", titleFr: "Établir l'évaluation combinée des risques (registre des risques)" },

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
  { code: "E300", section: "E", titleEn: "Reassess Combined Risk Assessments", titleFr: "Réévaluer l'évaluation combinée des risques", tier: "core" },
  { code: "E310", section: "E", titleEn: "Laws & Regulations / NOCLAR (ISA 250)", titleFr: "Textes légaux et réglementaires / NOCLAR (ISA 250)" },
  { code: "E320", section: "E", titleEn: "Related Parties (ISA 550)", titleFr: "Parties liées (ISA 550)" },
  { code: "E330", section: "E", titleEn: "Going Concern (ISA 570)", titleFr: "Continuité d'exploitation (ISA 570)" },
  { code: "E350", section: "E", titleEn: "Tests of Journal Entries & Mandatory Fraud Procedures (ISA 240)", titleFr: "Tests des écritures comptables et procédures obligatoires de fraude (ISA 240)" },
  { code: "E360", section: "E", titleEn: "Minutes & Statutory Records", titleFr: "Procès-verbaux et registres légaux" },
  { code: "E370", section: "E", titleEn: "Opening Balances & Comparatives (ISA 510/710)", titleFr: "Soldes d'ouverture et chiffres comparatifs (ISA 510/710)" },
  { code: "E380", section: "E", titleEn: "Subsequent Events (ISA 560)", titleFr: "Événements postérieurs à la clôture (ISA 560)" },
  { code: "E390", section: "E", titleEn: "Accounting Estimates (ISA 540)", titleFr: "Estimations comptables (ISA 540)" },
  // E2 (IT) group of the ST/E/C hierarchy — general and application IT controls.
  { code: "E500", section: "E", titleEn: "ITGC Testing", titleFr: "Tests des contrôles généraux informatiques" },
  { code: "E510", section: "E", titleEn: "Application & IT-Dependent Controls", titleFr: "Contrôles applicatifs et dépendants de l'informatique" },

  // P&L lead schedules — the class 6/7 groupings of the audit file.
  { code: "E600", section: "E", titleEn: "Operating Expenditures", titleFr: "Charges opérationnelles" },
  { code: "E610", section: "E", titleEn: "Administrative Expenditures", titleFr: "Charges administratives" },
  { code: "E620", section: "E", titleEn: "Other Expenses", titleFr: "Autres charges" },
  { code: "E630", section: "E", titleEn: "Finance Cost", titleFr: "Charges financières" },
  { code: "E700", section: "E", titleEn: "Other Income", titleFr: "Autres produits" },
  { code: "E520", section: "E", titleEn: "Update Tests of Controls and ITGCs (post-interim)", titleFr: "Mettre à jour les tests de contrôles et des ITGC (post-intérim)" },

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
  A1: { en: "Final FS Review (ISA 520)", fr: "Revue finale des EF (ISA 520)" },
  B1: { en: "Review & Approval Summary", fr: "Récapitulatif revue & approbation" },
  B2: { en: "Engagement Quality Review", fr: "Revue qualité de la mission" },
  B3: { en: "Consultation Record", fr: "Registre des consultations" },
  B4: { en: "Summary Review Memorandum", fr: "Mémorandum récapitulatif" },
  B5: { en: "Summary of Audit Differences", fr: "Écarts d'audit" },
  B6: { en: "Points Outstanding", fr: "Points en suspens" },
  B7: { en: "Subsequent Events (ISA 560)", fr: "Événements postérieurs (ISA 560)" },
  B8: { en: "Management Rep. Letters (ISA 580)", fr: "Lettres d'affirmation (ISA 580)" },
  B9: { en: "External Confirmation Letter", fr: "Lettre de confirmation externe" },
  B10: { en: "Points Forward (next year)", fr: "Points à reporter (N+1)" },
  B11: { en: "Documentation & Archive", fr: "Documentation & archivage" },
  C1: { en: "Client Communications (ISA 260)", fr: "Communications client (ISA 260)" },
  D1: { en: "Audit Strategies Memorandum", fr: "Mémorandum de stratégie" },
  "D3.1": { en: "Client Acceptance / Continuance", fr: "Acceptation / maintien du client" },
  "D3.2": { en: "Independence & Ethics", fr: "Indépendance & éthique" },
  "D3.3": { en: "Preconditions (ISA 210)", fr: "Conditions préalables (ISA 210)" },
  "D3.4": { en: "Predecessor Auditor", fr: "Auditeur précédent" },
  "D3.5": { en: "Engagement Letter", fr: "Lettre de mission" },
  "D3.6": { en: "EQR Determination", fr: "Détermination revue qualité" },
  "D4.1": { en: "Partner Direction", fr: "Directives de l'associé" },
  "D4.2": { en: "Understand the Business (ISA 315)", fr: "Comprendre l'activité (ISA 315)" },
  "D4.3": { en: "Analytical Risk Procedures", fr: "Procédures analytiques de risque" },
  "D4.4": { en: "Entity-Level Internal Control", fr: "Contrôle interne de l'entité" },
  "D4.5": { en: "Control Environment", fr: "Environnement de contrôle" },
  "D4.6": { en: "IT Environment & IT Involvement", fr: "Environnement & implication IT" },
  "D4.7": { en: "Reliance on Experts (ISA 620)", fr: "Recours à un expert (ISA 620)" },
  "D4.8": { en: "Service Organisations (ISA 402)", fr: "Sociétés de services (ISA 402)" },
  "D4.9": { en: "Internal Audit (ISA 610)", fr: "Audit interne (ISA 610)" },
  "D5.1": { en: "Materiality — PM, TE, SAD (ISA 320)", fr: "Seuil — PM, TE, SAD (ISA 320)" },
  "D5.2": { en: "Commitments & Contingencies", fr: "Engagements et passifs éventuels" },
  "D5.4": { en: "Fraud Risks & Responses (ISA 240)", fr: "Risques de fraude & réponses (ISA 240)" },
  "D5.5": { en: "Going Concern — Prelim (ISA 570)", fr: "Continuité — préliminaire (ISA 570)" },
  "D5.6": { en: "Related Parties (ISA 550)", fr: "Parties liées (ISA 550)" },
  "D5.7": { en: "Estimates — Planning (ISA 540)", fr: "Estimations — planification (ISA 540)" },
  "D5.8": { en: "Significant Accounts & Assertions", fr: "Comptes significatifs & assertions" },
  "D8.1": { en: "SCOTs & Related Applications", fr: "SCOT & applications associées" },
  "D8.2": { en: "Flows, WCGWs & Controls", fr: "Flux, WCGW & contrôles" },
  "D8.3": { en: "Walkthroughs", fr: "Tests de cheminement" },
  "D8.4": { en: "FSCP Evaluation", fr: "Processus d'arrêté (FSCP)" },
  "D8.5": { en: "Select Controls to Test", fr: "Sélection des contrôles" },
  "D8.6": { en: "Design Tests of Controls", fr: "Conception des tests de contrôles" },
  "D9.1": { en: "Planning Review & Approval", fr: "Revue & approbation planification" },
  "D9.2": { en: "TCWG Planning Report", fr: "Rapport TCWG planification" },
  "D6.2": { en: "Scope & Components", fr: "Perimetre & composants" },
  "D6.1": { en: "Team & Specialised Skills", fr: "Equipe & competences specialisees" },
  "D7.1": { en: "Engagement Team Discussion", fr: "Discussion de l'équipe" },
  "D7.2": { en: "Combined Risk Assessments", fr: "Évaluation combinée des risques" },
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
  E300: { en: "Reassess Combined Risks", fr: "Réévaluation des risques" },
  E310: { en: "Laws & NOCLAR (ISA 250)", fr: "Textes légaux / NOCLAR (ISA 250)" },
  E320: { en: "Related Parties (ISA 550)", fr: "Parties liées (ISA 550)" },
  E330: { en: "Going Concern (ISA 570)", fr: "Continuité d'exploitation (ISA 570)" },
  E350: { en: "Journal Entries & Fraud (ISA 240)", fr: "Écritures & fraude (ISA 240)" },
  E360: { en: "Minutes & Statutory Records", fr: "Procès-verbaux et registres légaux" },
  E370: { en: "Opening Balances (ISA 510/710)", fr: "Soldes d'ouverture (ISA 510/710)" },
  E380: { en: "Subsequent Events (ISA 560)", fr: "Événements postérieurs (ISA 560)" },
  E390: { en: "Accounting Estimates (ISA 540)", fr: "Estimations comptables (ISA 540)" },
  E500: { en: "ITGC Testing", fr: "Contrôles généraux informatiques" },
  E510: { en: "Application Controls", fr: "Contrôles applicatifs" },
  E520: { en: "Update ToC & ITGCs (post-interim)", fr: "MAJ tests de contrôles & ITGC" },
  E600: { en: "Operating Expenditures", fr: "Charges opérationnelles" },
  E610: { en: "Administrative Expenditures", fr: "Charges administratives" },
  E620: { en: "Other Expenses", fr: "Autres charges" },
  E630: { en: "Finance Cost", fr: "Charges financières" },
  E700: { en: "Other Income", fr: "Autres produits" },
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
  // Acceptance applies to every engagement whatever its complexity, so the
  // whole D3 family is core. D3.4 stays conditional (initial engagements only).
  "D1", "D3.1", "D3.2", "D3.3", "D3.4", "D3.5", "D3.6",
  "D4.1", "D4.2", "D4.3", "D5.1", "D5.4", "D5.5", "D7.1", "D7.2",
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
