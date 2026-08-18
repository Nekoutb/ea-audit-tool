// The default audit file index (master spec §3), instantiated per engagement.
// The numbering gaps are INTENTIONAL and follow the methodology's convention:
// there is no D2 and no D5.3; S6.1 jumps to P1.1. Do not "normalize" them.

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
    code: "C2.1",
    section: "A",
    titleEn: "Final Overall Financial Statement Review (ISA 520)",
    titleFr: "Revue finale globale des états financiers (ISA 520)",
  },

  // B — Completion
  { code: "C4.1", section: "B", titleEn: "Review and Approval Summary", titleFr: "Récapitulatif de revue et d'approbation" },
  { code: "C4.2", section: "B", titleEn: "Engagement Quality Review", titleFr: "Revue de qualité de la mission" },
  { code: "C1.3", section: "B", titleEn: "Consultation Record", titleFr: "Registre des consultations" },
  { code: "C1.2", section: "B", titleEn: "Summary Review Memorandum", titleFr: "Mémorandum récapitulatif de revue" },
  { code: "C1.1", section: "B", titleEn: "Summary of Audit Differences", titleFr: "Récapitulatif des écarts d'audit" },
  { code: "C4.3", section: "B", titleEn: "Points Outstanding", titleFr: "Points en suspens" },
  { code: "C2.2", section: "B", titleEn: "Subsequent Events Review (ISA 560)", titleFr: "Revue des événements postérieurs (ISA 560)" },
  { code: "C3.1", section: "B", titleEn: "Management Representation Letter(s) (ISA 580)", titleFr: "Lettre(s) d'affirmation de la direction (ISA 580)" },
  { code: "C3.2", section: "B", titleEn: "External Confirmation Letter", titleFr: "Lettre de confirmation externe" },
  { code: "C6.1", section: "B", titleEn: "Points Forward (next year)", titleFr: "Points à reporter (exercice suivant)" },

  { code: "C6.2", section: "B", titleEn: "Complete Documentation and Archive Engagement", titleFr: "Finaliser la documentation et archiver la mission", tier: "core" },

  // C — Communication
  {
    code: "C5.1",
    section: "C",
    titleEn: "Client Communications — Those Charged with Governance and Management (ISA 260/265)",
    titleFr: "Communications avec les responsables de la gouvernance et la direction (ISA 260/265)",
  },

  // D — Acceptance & Planning (no D2; no D5.3 — intentional gaps)
  { code: "S6.1", section: "D", titleEn: "Prepare Audit Strategies Memorandum", titleFr: "Préparer le mémorandum de stratégie d'audit" },
  { code: "P1.1", section: "D", titleEn: "Consider Client Acceptance / Continuance Results", titleFr: "Examiner l'acceptation / le maintien du client" },
  // P2.1–P1.5 complete the acceptance phase: the ISA 210 / ISQM requirements
  // that previously had no working paper of their own.
  { code: "P2.1", section: "D", titleEn: "Independence and Ethics Conclusion (IESBA Code)", titleFr: "Conclusion sur l'indépendance et l'éthique (Code IESBA)" },
  { code: "P1.3", section: "D", titleEn: "Preconditions for an Audit (ISA 210)", titleFr: "Conditions préalables à l'audit (ISA 210)" },
  { code: "P1.2", section: "D", titleEn: "Predecessor Auditor Communication (ISA 300 / IESBA §320)", titleFr: "Communication avec l'auditeur précédent (ISA 300 / IESBA §320)", conditional: true },
  { code: "P1.4", section: "D", titleEn: "Engagement Letter (ISA 210)", titleFr: "Lettre de mission (ISA 210)" },
  { code: "P1.5", section: "D", titleEn: "Engagement Quality Review Determination (ISQM 1/2)", titleFr: "Détermination de la revue de qualité (ISQM 1/2)" },
  { code: "S6.2", section: "D", titleEn: "Direction from the Engagement Partner", titleFr: "Directives de l'associé responsable de la mission" },
  { code: "P3.1", section: "D", titleEn: "Understand the Business — the Entity, its Environment and the Applicable Framework (ISA 315)", titleFr: "Connaissance de l'entité, de son environnement et du référentiel comptable applicable (ISA 315)" },
  { code: "P3.2", section: "D", titleEn: "Analytical Risk Assessment Procedures", titleFr: "Procédures analytiques d'évaluation des risques" },
  { code: "P4.1", section: "D", titleEn: "Assess Internal Control at the Entity Level", titleFr: "Évaluer le contrôle interne au niveau de l'entité" },
  { code: "P4.2", section: "D", titleEn: "Control Environment Assessment", titleFr: "Évaluation de l'environnement de contrôle", conditional: true },
  { code: "P4.3", section: "D", titleEn: "Understand the IT Environment and Determine IT Involvement", titleFr: "Comprendre l'environnement informatique et déterminer l'implication IT", conditional: true },
  { code: "S5.1", section: "D", titleEn: "Reliance on Experts (ISA 620)", titleFr: "Utilisation des travaux d'un expert (ISA 620)", conditional: true },
  { code: "S5.2", section: "D", titleEn: "Service Organisations (ISA 402)", titleFr: "Sociétés de services (ISA 402)", conditional: true },
  { code: "S5.3", section: "D", titleEn: "Internal Audit (ISA 610)", titleFr: "Audit interne (ISA 610)", conditional: true },
  { code: "P6.1", section: "D", titleEn: "Determine Materiality — PM, TE and SAD Nominal Amount (ISA 320)", titleFr: "Déterminer le seuil de signification — PM, TE et seuil SAD (ISA 320)" },
  { code: "S4.1", section: "D", titleEn: "Commitments & Contingencies", titleFr: "Engagements et passifs éventuels" },
  { code: "P5.1", section: "D", titleEn: "Identify Fraud Risks and Determine Responses (ISA 240)", titleFr: "Identifier les risques de fraude et déterminer les réponses (ISA 240)" },
  { code: "S4.2", section: "D", titleEn: "Going Concern — Preliminary (ISA 570)", titleFr: "Continuité d'exploitation — préliminaire (ISA 570)" },
  { code: "S4.3", section: "D", titleEn: "Related Parties (ISA 550)", titleFr: "Parties liées (ISA 550)" },
  { code: "S4.4", section: "D", titleEn: "Accounting Estimates — Planning (ISA 540)", titleFr: "Estimations comptables — planification (ISA 540)" },
  { code: "P6.2", section: "D", titleEn: "Identify Significant Accounts, Disclosures and Relevant Assertions", titleFr: "Identifier les comptes significatifs, informations à fournir et assertions pertinentes", tier: "core" },
  { code: "S1.1", section: "D", titleEn: "Identify Significant Classes of Transactions and Related Applications", titleFr: "Identifier les catégories significatives de transactions et applications associées" },
  { code: "S1.2", section: "D", titleEn: "Understand Flows of Transactions, WCGWs and Controls", titleFr: "Comprendre les flux de transactions, les WCGW et les contrôles" },
  { code: "S1.3", section: "D", titleEn: "Perform Walkthroughs", titleFr: "Réaliser les tests de cheminement" },
  { code: "S1.4", section: "D", titleEn: "Understand and Evaluate the FSCP", titleFr: "Comprendre et évaluer le processus d'arrêté des comptes (FSCP)" },
  { code: "S2.1", section: "D", titleEn: "Select Controls to Test", titleFr: "Sélectionner les contrôles à tester" },
  { code: "S2.2", section: "D", titleEn: "Design Tests of Controls", titleFr: "Concevoir les tests de contrôles" },
  { code: "S2.3", section: "D", titleEn: "Understand ITGCs (IT General Controls)", titleFr: "Comprendre les contrôles généraux informatiques (ITGC)" },
  { code: "S2.4", section: "D", titleEn: "Design & Execute Tests of ITGCs", titleFr: "Concevoir et exécuter les tests des ITGC" },
  { code: "S2.5", section: "D", titleEn: "Evaluate ITGCs", titleFr: "Évaluer les ITGC" },
  { code: "S5.4", section: "D", titleEn: "Design Tests of Journal Entries and Other Mandatory Fraud Procedures", titleFr: "Concevoir les tests d'écritures et autres procédures obligatoires de fraude" },
  { code: "S5.5", section: "D", titleEn: "Design Substantive Procedures", titleFr: "Concevoir les procédures substantives" },
  { code: "S5.6", section: "D", titleEn: "Plan General Audit Procedures", titleFr: "Planifier les procédures générales d'audit" },
  { code: "P7.2", section: "D", titleEn: "Planning Review and Approval Summary", titleFr: "Revue et approbation de la planification", tier: "core" },
  { code: "P7.1", section: "D", titleEn: "Report to Those Charged with Governance - Audit Planning", titleFr: "Rapport aux responsables de la gouvernance - planification de l'audit", tier: "core" },
  { code: "P2.2", section: "D", titleEn: "Assess the Team and Determine Need for Specialised Skills", titleFr: "Evaluer l'equipe et determiner le besoin de competences specialisees" },
  { code: "P2.3", section: "D", titleEn: "Audit Scope and Components (ISA 600)", titleFr: "Perimetre d'audit et composants (ISA 600)", tier: "extended" },
  { code: "P5.2", section: "D", titleEn: "Engagement Team Discussion", titleFr: "Discussion de l'équipe de mission" },
  { code: "S3.1", section: "D", titleEn: "Make Combined Risk Assessments (Risk Register)", titleFr: "Établir l'évaluation combinée des risques (registre des risques)" },

  // E — Execution: default audit cycles (E4.1…) then standard cross-cutting
  // sections with pre-built programs (E4.15–E6.7).
  // One account working paper per lead index — the task IS the index.
  { code: "E4.1", section: "E", titleEn: "Trade Receivables (E)", titleFr: "Créances clients (E)" },
  { code: "E4.2", section: "E", titleEn: "Trade Payables (N)", titleFr: "Dettes fournisseurs (N)" },
  { code: "E4.3", section: "E", titleEn: "Inventories (F)", titleFr: "Stocks (F)" },
  { code: "E4.4", section: "E", titleEn: "Property, Plant & Equipment (K)", titleFr: "Immobilisations corporelles (K)" },
  { code: "E4.5", section: "E", titleEn: "Intangible Assets (L)", titleFr: "Immobilisations incorporelles (L)" },
  { code: "E4.6", section: "E", titleEn: "Financial Assets (J)", titleFr: "Actifs financiers (J)" },
  { code: "E4.7", section: "E", titleEn: "Cash & Cash Equivalents (C)", titleFr: "Trésorerie (C)" },
  { code: "E4.8", section: "E", titleEn: "Borrowings (Q)", titleFr: "Emprunts (Q)" },
  { code: "E4.9", section: "E", titleEn: "Share Capital & Reserves (T)", titleFr: "Capital et réserves (T)" },
  { code: "E4.10", section: "E", titleEn: "Provisions for Risks & Charges (P1)", titleFr: "Provisions pour risques et charges (P1)" },
  { code: "E4.11", section: "E", titleEn: "Social & Payroll Liabilities (P2)", titleFr: "Dettes sociales (P2)" },
  { code: "E4.12", section: "E", titleEn: "Suspense & Deferred Income (P3)", titleFr: "Comptes d'attente et PCA (P3)" },
  { code: "E4.13", section: "E", titleEn: "Translation Difference — Liabilities (P4)", titleFr: "Écarts de conversion — passif (P4)" },
  { code: "E4.14", section: "E", titleEn: "Tax Receivables (O1)", titleFr: "Créances fiscales (O1)" },
  { code: "E4.15", section: "E", titleEn: "Tax Payables (O2)", titleFr: "Dettes fiscales (O2)" },
  { code: "E4.16", section: "E", titleEn: "Group & Associates — Short Term (I1)", titleFr: "Groupe et associés — court terme (I1)" },
  { code: "E4.17", section: "E", titleEn: "Group & Associates (I2)", titleFr: "Groupe et associés (I2)" },
  { code: "E4.18", section: "E", titleEn: "Other Current Assets (G2)", titleFr: "Autres actifs courants (G2)" },
  { code: "E4.19", section: "E", titleEn: "Translation Difference — Assets (G3)", titleFr: "Écarts de conversion — actif (G3)" },
  { code: "E4.20", section: "E", titleEn: "Revenue (UA)", titleFr: "Chiffre d'affaires (UA)" },
  { code: "E4.21", section: "E", titleEn: "Other Income (UB2)", titleFr: "Autres produits (UB2)" },
  { code: "E4.22", section: "E", titleEn: "Finance Income (UC)", titleFr: "Produits financiers (UC)" },
  { code: "E4.23", section: "E", titleEn: "Exceptional Income (U1)", titleFr: "Produits HAO (U1)" },
  { code: "E4.24", section: "E", titleEn: "Purchases (VA1)", titleFr: "Achats (VA1)" },
  { code: "E4.25", section: "E", titleEn: "Change in Inventories (VA2)", titleFr: "Variation de stocks (VA2)" },
  { code: "E4.26", section: "E", titleEn: "Personnel Costs (VB)", titleFr: "Charges de personnel (VB)" },
  { code: "E4.27", section: "E", titleEn: "Taxes & Duties (VO)", titleFr: "Impôts et taxes (VO)" },
  { code: "E4.28", section: "E", titleEn: "External Services (VD1)", titleFr: "Services extérieurs (VD1)" },
  { code: "E4.29", section: "E", titleEn: "Depreciation & Provisions (VD2)", titleFr: "Dotations amortissements et provisions (VD2)" },
  { code: "E4.30", section: "E", titleEn: "Provision Reversals (VD3)", titleFr: "Reprises de provisions (VD3)" },
  { code: "E4.31", section: "E", titleEn: "Other Expenses (VD4)", titleFr: "Autres charges (VD4)" },
  { code: "E4.32", section: "E", titleEn: "Finance Costs (VD5)", titleFr: "Charges financières (VD5)" },
  { code: "E4.33", section: "E", titleEn: "Exceptional Expenses (V1)", titleFr: "Charges HAO (V1)" },
  { code: "E4.34", section: "E", titleEn: "Income Tax (O4)", titleFr: "Impôt sur le résultat (O4)" },
  { code: "E4.35", section: "E", titleEn: "Leases", titleFr: "Contrats de location" },
  { code: "E4.36", section: "E", titleEn: "Cash Flow (TFT) Tie-out", titleFr: "Concordance du TFT" },
  { code: "E6.8", section: "E", titleEn: "Reassess Combined Risk Assessments", titleFr: "Réévaluer l'évaluation combinée des risques", tier: "core" },
  { code: "E6.1", section: "E", titleEn: "Laws & Regulations / NOCLAR (ISA 250)", titleFr: "Textes légaux et réglementaires / NOCLAR (ISA 250)" },
  { code: "E6.2", section: "E", titleEn: "Related Parties (ISA 550)", titleFr: "Parties liées (ISA 550)" },
  { code: "E6.3", section: "E", titleEn: "Going Concern (ISA 570)", titleFr: "Continuité d'exploitation (ISA 570)" },
  { code: "E3.1", section: "E", titleEn: "Tests of Journal Entries & Mandatory Fraud Procedures (ISA 240)", titleFr: "Tests des écritures comptables et procédures obligatoires de fraude (ISA 240)" },
  { code: "E6.4", section: "E", titleEn: "Minutes & Statutory Records", titleFr: "Procès-verbaux et registres légaux" },
  { code: "E6.5", section: "E", titleEn: "Opening Balances & Comparatives (ISA 510/710)", titleFr: "Soldes d'ouverture et chiffres comparatifs (ISA 510/710)" },
  { code: "E6.6", section: "E", titleEn: "Subsequent Events (ISA 560)", titleFr: "Événements postérieurs à la clôture (ISA 560)" },
  { code: "E6.7", section: "E", titleEn: "Accounting Estimates (ISA 540)", titleFr: "Estimations comptables (ISA 540)" },
  // E2 (IT) group of the ST/E/C hierarchy — general and application IT controls.
  { code: "E1.1", section: "E", titleEn: "ITGC Testing", titleFr: "Tests des contrôles généraux informatiques" },
  { code: "E1.2", section: "E", titleEn: "Application & IT-Dependent Controls", titleFr: "Contrôles applicatifs et dépendants de l'informatique" },

  // P&L lead schedules — the class 6/7 groupings of the audit file.
  { code: "E5.1", section: "E", titleEn: "Operating Expenditures", titleFr: "Charges opérationnelles" },
  { code: "E5.2", section: "E", titleEn: "Administrative Expenditures", titleFr: "Charges administratives" },
  { code: "E5.3", section: "E", titleEn: "Other Expenses", titleFr: "Autres charges" },
  { code: "E5.4", section: "E", titleEn: "Finance Cost", titleFr: "Charges financières" },
  { code: "E5.5", section: "E", titleEn: "Other Income", titleFr: "Autres produits" },
  { code: "E2.1", section: "E", titleEn: "Update Tests of Controls and ITGCs (post-interim)", titleFr: "Mettre à jour les tests de contrôles et des ITGC (post-intérim)" },

  // F — OHADA statutory section
  { code: "C5.2", section: "F", titleEn: "Statutory Deadlines Calendar", titleFr: "Calendrier des échéances légales" },
  { code: "C5.3", section: "F", titleEn: "Conventions Réglementées Register & Rapport Spécial", titleFr: "Registre des conventions réglementées et rapport spécial" },
  { code: "C5.4", section: "F", titleEn: "Article 715 Report to the Board", titleFr: "Rapport article 715 au conseil d'administration" },
  { code: "C5.5", section: "F", titleEn: "Procédure d'Alerte File", titleFr: "Dossier de procédure d'alerte" },
  { code: "C5.6", section: "F", titleEn: "Révélation des Faits Délictueux", titleFr: "Révélation des faits délictueux" },
  { code: "C5.7", section: "F", titleEn: "Registres de Titres Nominatifs Attestation", titleFr: "Attestation sur les registres de titres nominatifs" },
  { code: "C5.8", section: "F", titleEn: "Equity vs Half-of-Share-Capital Monitoring", titleFr: "Suivi capitaux propres / moitié du capital social" },
  { code: "C5.9", section: "F", titleEn: "Co-CAC Coordination File", titleFr: "Dossier de coordination co-commissariat" },
] as const;

// Concise task labels for the dashboard/phase task lists, keyed by the stable
// item code so they apply to existing and new engagements without a data
// migration. Kept short (<= ~36 chars) so no task name is cut off in the task
// column. The full titles above still drive documents, exports and workpapers.
const SHORT_TITLES: Record<string, { en: string; fr: string }> = {
  "C2.1": { en: "Final FS Review (ISA 520)", fr: "Revue finale des EF (ISA 520)" },
  "C4.1": { en: "Review & Approval Summary", fr: "Récapitulatif revue & approbation" },
  "C4.2": { en: "Engagement Quality Review", fr: "Revue qualité de la mission" },
  "C1.3": { en: "Consultation Record", fr: "Registre des consultations" },
  "C1.2": { en: "Summary Review Memorandum", fr: "Mémorandum récapitulatif" },
  "C1.1": { en: "Summary of Audit Differences", fr: "Écarts d'audit" },
  "C4.3": { en: "Points Outstanding", fr: "Points en suspens" },
  "C2.2": { en: "Subsequent Events (ISA 560)", fr: "Événements postérieurs (ISA 560)" },
  "C3.1": { en: "Management Rep. Letters (ISA 580)", fr: "Lettres d'affirmation (ISA 580)" },
  "C3.2": { en: "External Confirmation Letter", fr: "Lettre de confirmation externe" },
  "C6.1": { en: "Points Forward (next year)", fr: "Points à reporter (N+1)" },
  "C6.2": { en: "Documentation & Archive", fr: "Documentation & archivage" },
  "C5.1": { en: "Client Communications (ISA 260)", fr: "Communications client (ISA 260)" },
  "S6.1": { en: "Audit Strategies Memorandum", fr: "Mémorandum de stratégie" },
  "P1.1": { en: "Client Acceptance / Continuance", fr: "Acceptation / maintien du client" },
  "P2.1": { en: "Independence & Ethics", fr: "Indépendance & éthique" },
  "P1.3": { en: "Preconditions (ISA 210)", fr: "Conditions préalables (ISA 210)" },
  "P1.2": { en: "Predecessor Auditor", fr: "Auditeur précédent" },
  "P1.4": { en: "Engagement Letter", fr: "Lettre de mission" },
  "P1.5": { en: "EQR Determination", fr: "Détermination revue qualité" },
  "S6.2": { en: "Partner Direction", fr: "Directives de l'associé" },
  "P3.1": { en: "Understand the Business (ISA 315)", fr: "Comprendre l'activité (ISA 315)" },
  "P3.2": { en: "Analytical Risk Procedures", fr: "Procédures analytiques de risque" },
  "P4.1": { en: "Entity-Level Internal Control", fr: "Contrôle interne de l'entité" },
  "P4.2": { en: "Control Environment", fr: "Environnement de contrôle" },
  "P4.3": { en: "IT Environment & IT Involvement", fr: "Environnement & implication IT" },
  "S5.1": { en: "Reliance on Experts (ISA 620)", fr: "Recours à un expert (ISA 620)" },
  "S5.2": { en: "Service Organisations (ISA 402)", fr: "Sociétés de services (ISA 402)" },
  "S5.3": { en: "Internal Audit (ISA 610)", fr: "Audit interne (ISA 610)" },
  "P6.1": { en: "Materiality — PM, TE, SAD (ISA 320)", fr: "Seuil — PM, TE, SAD (ISA 320)" },
  "S4.1": { en: "Commitments & Contingencies", fr: "Engagements et passifs éventuels" },
  "P5.1": { en: "Fraud Risks & Responses (ISA 240)", fr: "Risques de fraude & réponses (ISA 240)" },
  "S4.2": { en: "Going Concern — Prelim (ISA 570)", fr: "Continuité — préliminaire (ISA 570)" },
  "S4.3": { en: "Related Parties (ISA 550)", fr: "Parties liées (ISA 550)" },
  "S4.4": { en: "Estimates — Planning (ISA 540)", fr: "Estimations — planification (ISA 540)" },
  "P6.2": { en: "Significant Accounts & Assertions", fr: "Comptes significatifs & assertions" },
  "S1.1": { en: "SCOTs & Related Applications", fr: "SCOT & applications associées" },
  "S1.2": { en: "Flows, WCGWs & Controls", fr: "Flux, WCGW & contrôles" },
  "S1.3": { en: "Walkthroughs", fr: "Tests de cheminement" },
  "S1.4": { en: "FSCP Evaluation", fr: "Processus d'arrêté (FSCP)" },
  "S2.1": { en: "Select Controls to Test", fr: "Sélection des contrôles" },
  "S2.2": { en: "Design Tests of Controls", fr: "Conception des tests de contrôles" },
  "S2.3": { en: "Understand ITGCs", fr: "Comprendre les ITGC" },
  "S2.4": { en: "Design & Execute ITGC Tests", fr: "Tests des ITGC" },
  "S2.5": { en: "Evaluate ITGCs", fr: "Évaluer les ITGC" },
  "S5.4": { en: "Design JE & Fraud Tests", fr: "Tests écritures & fraude" },
  "S5.5": { en: "Design Substantive Procedures", fr: "Procédures substantives" },
  "S5.6": { en: "Plan General Procedures", fr: "Procédures générales" },
  "P7.2": { en: "Planning Review & Approval", fr: "Revue & approbation planification" },
  "P7.1": { en: "TCWG Planning Report", fr: "Rapport TCWG planification" },
  "P2.3": { en: "Scope & Components", fr: "Perimetre & composants" },
  "P2.2": { en: "Team & Specialised Skills", fr: "Equipe & competences specialisees" },
  "P5.2": { en: "Engagement Team Discussion", fr: "Discussion de l'équipe" },
  "S3.1": { en: "Combined Risk Assessments", fr: "Évaluation combinée des risques" },
  "E4.1": { en: "Receivables (E)", fr: "Créances clients (E)" },
  "E4.2": { en: "Payables (N)", fr: "Dettes fournisseurs (N)" },
  "E4.3": { en: "Inventories (F)", fr: "Stocks (F)" },
  "E4.4": { en: "PP&E (K)", fr: "Immobilisations corporelles (K)" },
  "E4.5": { en: "Intangibles (L)", fr: "Incorporelles (L)" },
  "E4.6": { en: "Financial Assets (J)", fr: "Actifs financiers (J)" },
  "E4.7": { en: "Cash (C)", fr: "Trésorerie (C)" },
  "E4.8": { en: "Borrowings (Q)", fr: "Emprunts (Q)" },
  "E4.9": { en: "Equity (T)", fr: "Capital et réserves (T)" },
  "E4.10": { en: "Provisions (P1)", fr: "Provisions (P1)" },
  "E4.11": { en: "Social Liabilities (P2)", fr: "Dettes sociales (P2)" },
  "E4.12": { en: "Suspense & Deferred (P3)", fr: "Comptes d'attente (P3)" },
  "E4.13": { en: "Translation Diff — Liab. (P4)", fr: "Écarts conversion — passif (P4)" },
  "E4.14": { en: "Tax Receivables (O1)", fr: "Créances fiscales (O1)" },
  "E4.15": { en: "Tax Payables (O2)", fr: "Dettes fiscales (O2)" },
  "E4.16": { en: "Group — Short Term (I1)", fr: "Groupe — court terme (I1)" },
  "E4.17": { en: "Group & Associates (I2)", fr: "Groupe et associés (I2)" },
  "E4.18": { en: "Other Current Assets (G2)", fr: "Autres actifs courants (G2)" },
  "E4.19": { en: "Translation Diff — Assets (G3)", fr: "Écarts conversion — actif (G3)" },
  "E4.20": { en: "Revenue (UA)", fr: "Chiffre d'affaires (UA)" },
  "E4.21": { en: "Other Income (UB2)", fr: "Autres produits (UB2)" },
  "E4.22": { en: "Finance Income (UC)", fr: "Produits financiers (UC)" },
  "E4.23": { en: "Exceptional Income (U1)", fr: "Produits HAO (U1)" },
  "E4.24": { en: "Purchases (VA1)", fr: "Achats (VA1)" },
  "E4.25": { en: "Change in Inventories (VA2)", fr: "Variation de stocks (VA2)" },
  "E4.26": { en: "Personnel Costs (VB)", fr: "Charges de personnel (VB)" },
  "E4.27": { en: "Taxes & Duties (VO)", fr: "Impôts et taxes (VO)" },
  "E4.28": { en: "External Services (VD1)", fr: "Services extérieurs (VD1)" },
  "E4.29": { en: "Depreciation & Provisions (VD2)", fr: "Dotations et provisions (VD2)" },
  "E4.30": { en: "Provision Reversals (VD3)", fr: "Reprises de provisions (VD3)" },
  "E4.31": { en: "Other Expenses (VD4)", fr: "Autres charges (VD4)" },
  "E4.32": { en: "Finance Costs (VD5)", fr: "Charges financières (VD5)" },
  "E4.33": { en: "Exceptional Expenses (V1)", fr: "Charges HAO (V1)" },
  "E4.34": { en: "Income Tax (O4)", fr: "Impôt sur le résultat (O4)" },
  "E4.35": { en: "Leases", fr: "Contrats de location" },
  "E4.36": { en: "TFT Tie-out", fr: "Concordance du TFT" },
  "E6.8": { en: "Reassess Combined Risks", fr: "Réévaluation des risques" },
  "E6.1": { en: "Laws & NOCLAR (ISA 250)", fr: "Textes légaux / NOCLAR (ISA 250)" },
  "E6.2": { en: "Related Parties (ISA 550)", fr: "Parties liées (ISA 550)" },
  "E6.3": { en: "Going Concern (ISA 570)", fr: "Continuité d'exploitation (ISA 570)" },
  "E3.1": { en: "Journal Entries & Fraud (ISA 240)", fr: "Écritures & fraude (ISA 240)" },
  "E6.4": { en: "Minutes & Statutory Records", fr: "Procès-verbaux et registres légaux" },
  "E6.5": { en: "Opening Balances (ISA 510/710)", fr: "Soldes d'ouverture (ISA 510/710)" },
  "E6.6": { en: "Subsequent Events (ISA 560)", fr: "Événements postérieurs (ISA 560)" },
  "E6.7": { en: "Accounting Estimates (ISA 540)", fr: "Estimations comptables (ISA 540)" },
  "E1.1": { en: "ITGC Testing", fr: "Contrôles généraux informatiques" },
  "E1.2": { en: "Application Controls", fr: "Contrôles applicatifs" },
  "E2.1": { en: "Update ToC & ITGCs (post-interim)", fr: "MAJ tests de contrôles & ITGC" },
  "E5.1": { en: "Operating Expenditures", fr: "Charges opérationnelles" },
  "E5.2": { en: "Administrative Expenditures", fr: "Charges administratives" },
  "E5.3": { en: "Other Expenses", fr: "Autres charges" },
  "E5.4": { en: "Finance Cost", fr: "Charges financières" },
  "E5.5": { en: "Other Income", fr: "Autres produits" },
  "C5.2": { en: "Statutory Deadlines Calendar", fr: "Calendrier des échéances légales" },
  "C5.3": { en: "Conventions Réglementées", fr: "Conventions réglementées" },
  "C5.4": { en: "Article 715 Board Report", fr: "Rapport article 715" },
  "C5.5": { en: "Procédure d'Alerte", fr: "Procédure d'alerte" },
  "C5.6": { en: "Révélation des Faits Délictueux", fr: "Révélation des faits délictueux" },
  "C5.7": { en: "Titres Nominatifs Attestation", fr: "Attestation titres nominatifs" },
  "C5.8": { en: "Equity vs Half-Capital", fr: "Capitaux propres / demi-capital" },
  "C5.9": { en: "Co-CAC Coordination", fr: "Coordination co-commissariat" },
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
  "C2.1",
  "C4.1", "C1.2", "C1.1", "C4.3", "C2.2", "C3.1", "C6.1",
  "C5.1",
  // Acceptance applies to every engagement whatever its complexity, so the
  // whole D3 family is core. P1.2 stays conditional (initial engagements only).
  "S6.1", "P1.1", "P2.1", "P1.3", "P1.2", "P1.4", "P1.5",
  "S6.2", "P3.1", "P3.2", "P6.1", "P5.1", "S4.2", "P5.2", "S3.1",
  "E4.1", "E4.2", "E4.3", "E4.8", "E4.9", "E6.3", "E6.4", "E6.5", "E6.6",
  "C5.2",
]);

/** Only instantiated on complex engagements. */
const EXTENDED_CODES = new Set(["C4.2", "E4.6", "E4.7", "E4.12", "E4.13", "C5.5", "C5.9"]);

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
