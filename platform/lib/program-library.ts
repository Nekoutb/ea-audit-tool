// Default audit-program library (spec §5.4): suggested steps per cycle mapped
// to assertions (C/E/A/V/P). This is the v1 core set — the library is
// data-driven and grows with the automation engines in Phases 4–5 (DECISIONS.md).

import type { Assertion } from "@/lib/risks";

export interface LibraryStep {
  descEn: string;
  descFr: string;
  assertions: Assertion[];
}

const S = (descEn: string, descFr: string, assertions: Assertion[]): LibraryStep => ({
  descEn,
  descFr,
  assertions,
});

export const PROGRAM_LIBRARY: Record<string, LibraryStep[]> = {
  "E4.1": [
    S("Agree revenue per the TB to the lead schedule and prior year; investigate significant variances.", "Rapprocher le chiffre d'affaires de la balance au tableau de synthèse et à N-1 ; analyser les écarts significatifs.", ["C", "A"]),
    S("Perform cut-off testing on sales around period end.", "Tester la séparation des exercices sur les ventes autour de la clôture.", ["A", "E"]),
    S("Circularise a sample of trade receivables (positive confirmations).", "Circulariser un échantillon de clients (confirmations positives).", ["E", "V"]),
    S("Test subsequent cash receipts for uncircularised / non-replying balances.", "Tester les encaissements postérieurs pour les soldes non circularisés ou sans réponse.", ["E", "V"]),
    S("Assess the ECL/doubtful-debt provision methodology and recompute.", "Apprécier la méthodologie de dépréciation des créances douteuses et recalculer.", ["V"]),
    S("Review credit notes issued after period end for unrecorded returns.", "Revoir les avoirs émis après la clôture pour retours non comptabilisés.", ["C", "A"]),
  ],
  "E4.2": [
    S("Reconcile the AP sub-ledger to the 40-accounts in the TB.", "Rapprocher la balance auxiliaire fournisseurs des comptes 40 de la balance générale.", ["C", "A"]),
    S("Perform the unrecorded-liability search over post-period payments and invoices.", "Rechercher les passifs non comptabilisés sur les paiements et factures postérieurs.", ["C"]),
    S("Reconcile supplier statements for a sample of major suppliers.", "Rapprocher les relevés fournisseurs pour un échantillon de fournisseurs majeurs.", ["C", "E", "A"]),
    S("Test cut-off of goods received around period end.", "Tester la séparation des exercices sur les réceptions autour de la clôture.", ["A", "C"]),
  ],
  "E4.3": [
    S("Reconcile payroll register totals to accounts 42/66.", "Rapprocher le journal de paie des comptes 42/66.", ["C", "A"]),
    S("Recompute payroll taxes and social contributions (≈ one month's payroll-type check).", "Recalculer les charges sociales et taxes sur salaires.", ["A", "V"]),
    S("Test a sample of employees to contracts and payment evidence.", "Tester un échantillon de salariés (contrats, preuves de paiement).", ["E", "A"]),
  ],
  "E4.4": [
    S("Attend the physical inventory count and perform test counts (ISA 501).", "Assister à l'inventaire physique et effectuer des comptages tests (ISA 501).", ["E", "C"]),
    S("Reconcile the final inventory listing to class 3 in the TB.", "Rapprocher l'état d'inventaire final de la classe 3 de la balance.", ["C", "A"]),
    S("Test valuation at FIFO or weighted-average cost (only methods permitted).", "Tester la valorisation au FIFO ou au CMP (seules méthodes admises).", ["V"]),
    S("Assess net realisable value / obsolescence provisions.", "Apprécier la valeur nette de réalisation et les dépréciations d'obsolescence.", ["V"]),
  ],
  "E4.5": [
    S("Reconcile the fixed-asset register to accounts 21–24 / 28 (movements schedule).", "Rapprocher le fichier des immobilisations des comptes 21–24 / 28 (tableau des mouvements).", ["C", "E", "A"]),
    S("Vouch significant additions to supporting documentation.", "Contrôler les acquisitions significatives sur pièces.", ["E", "A", "V"]),
    S("Test disposals: proceeds, derecognition and gain/loss (accounts 81/82).", "Tester les cessions : produits, sortie d'actif et résultat (comptes 81/82).", ["E", "A"]),
    S("Recompute depreciation (mandatory even in loss years) and tie the charge to 681/68.", "Recalculer les amortissements (obligatoires même en cas de perte) et rapprocher la dotation des comptes 681/68.", ["V", "A"]),
    S("Physically inspect a sample of assets.", "Inspecter physiquement un échantillon d'immobilisations.", ["E"]),
  ],
  "E4.6": [
    S("Verify no charges immobilisées remain (account 20 abolished; legacy 475 released ≤ 5 years).", "Vérifier l'absence de charges immobilisées (compte 20 supprimé ; 475 résorbé sur 5 ans max).", ["P", "V"]),
    S("Test amortisation/impairment of intangibles and goodwill.", "Tester l'amortissement/la dépréciation des incorporels et du fonds commercial.", ["V"]),
  ],
  "E4.7": [
    S("Confirm investments held and test valuation/impairment.", "Confirmer les titres détenus et tester la valorisation/dépréciation.", ["E", "V"]),
  ],
  "E4.8": [
    S("Obtain bank confirmations for all banking relationships (including nil/closed accounts).", "Obtenir des confirmations bancaires pour toutes les relations (y compris comptes soldés/clôturés).", ["C", "E", "V"]),
    S("Re-perform bank reconciliations; age outstanding items and flag window-dressing.", "Refaire les rapprochements bancaires ; analyser l'ancienneté des suspens et détecter l'habillage de bilan.", ["E", "A", "C"]),
    S("Test borrowings: agreements, covenants, interest recomputation, current/non-current split.", "Tester les emprunts : contrats, covenants, recalcul des intérêts, ventilation court/long terme.", ["C", "V", "P"]),
  ],
  "E4.9": [
    S("Recompute the current tax charge and prepare the tax-rate reconciliation.", "Recalculer l'impôt exigible et préparer la preuve d'impôt.", ["A", "V"]),
    S("Assess deferred tax positions and recoverability.", "Apprécier les impôts différés et leur recouvrabilité.", ["V", "P"]),
  ],
  "E4.10": [
    S("Reconcile VAT declared to revenue and to account 44 balances.", "Rapprocher la TVA déclarée du chiffre d'affaires et des comptes 44.", ["C", "A"]),
  ],
  "E4.11": [
    S("Test provisions for risks & charges: basis, movements, reversals (class 19/499).", "Tester les provisions pour risques et charges : fondement, mouvements, reprises (19/499).", ["C", "V"]),
    S("Verify pension obligations are provisioned (SYSCOHADA art. 48; note 16B actuarial).", "Vérifier la provision des engagements de retraite (art. 48 ; note 16B actuarielle).", ["C", "V"]),
  ],
  "E4.12": [
    S("Test location-acquisition contracts: capitalisation, liability (17) and amortisation.", "Tester les contrats de location-acquisition : immobilisation, dette (17) et amortissement.", ["C", "V", "P"]),
  ],
  "E4.13": [
    S("Test HAO classification (classes 8/48): AO vs HAO nature of items.", "Tester le classement HAO (classes 8/48) : caractère AO ou HAO des éléments.", ["P", "A"]),
  ],
  "E4.14": [
    S("Tie the TFT to the underlying balance movements; control ZH = trésorerie actif − passif.", "Rapprocher le TFT des variations de bilan ; contrôle ZH = trésorerie actif − passif.", ["A", "P"]),
  ],
  "E4.15": [
    S("Update the commitments & contingencies assessment received from S4.1; obtain legal letters.", "Mettre à jour l'évaluation des engagements et passifs éventuels (reçue de S4.1) ; obtenir les lettres d'avocats.", ["C", "V", "P"]),
  ],
  "E4.16": [
    S("Agree share capital and reserves to statutory records; test movements and appropriations.", "Rapprocher capital et réserves des registres légaux ; tester mouvements et affectations.", ["E", "A", "P"]),
    S("Monitor equity vs half of share capital (statutory workflow if below — C5.8).", "Suivre capitaux propres vs moitié du capital social (procédure légale si inférieur — C5.8).", ["V", "P"]),
  ],
  "E6.1": [
    S("Inquire into compliance with laws and regulations; inspect correspondence with authorities (ISA 250).", "S'enquérir du respect des textes ; examiner la correspondance avec les autorités (ISA 250).", ["C", "P"]),
  ],
  "E6.2": [
    S("Test completeness of the related-party register and disclosure of transactions (ISA 550).", "Tester l'exhaustivité du registre des parties liées et l'information donnée (ISA 550).", ["C", "P"]),
  ],
  "E6.3": [
    S("Evaluate going concern over ≥ 12 months; link to procédure d'alerte state (ISA 570).", "Évaluer la continuité d'exploitation sur ≥ 12 mois ; lien avec la procédure d'alerte (ISA 570).", ["V", "P"]),
  ],
  "E2.1": [
    S("Test journal entries with unpredictable selection criteria (period-end, round amounts, unusual users/accounts).", "Tester les écritures avec des critères imprévisibles (clôture, montants ronds, utilisateurs/comptes inhabituels).", ["C", "E", "A"]),
    S("Review accounting estimates for management bias (retrospective review).", "Revoir les estimations comptables pour détecter un biais de la direction (revue rétrospective).", ["V"]),
    S("Evaluate significant transactions outside the normal course of business.", "Évaluer les transactions significatives hors du cours normal des affaires.", ["E", "P"]),
  ],
  "E6.4": [
    S("Read minutes and statutory registers; verify court-stamping of legal books (arts. 19, 66).", "Lire les procès-verbaux et registres légaux ; vérifier la cote et le paraphe des livres (art. 19, 66).", ["C", "P"]),
  ],
  "E6.5": [
    S("Agree opening balances to prior-year closing (bilan d'ouverture intangibility, art. 34).", "Rapprocher les soldes d'ouverture de la clôture N-1 (intangibilité du bilan d'ouverture, art. 34).", ["A", "C"]),
  ],
  "E6.6": [
    S("Review subsequent events up to the report date (ISA 560).", "Revoir les événements postérieurs jusqu'à la date du rapport (ISA 560).", ["C", "V", "P"]),
  ],
  "E6.7": [
    S("For each estimate in the S4.4 inventory: test method, data and assumptions (ISA 540).", "Pour chaque estimation de l'inventaire S4.4 : tester méthode, données et hypothèses (ISA 540).", ["V"]),
  ],
};

/** Extended procedures auto-suggested when a section carries a significant risk. */
export const SIGNIFICANT_RISK_EXTENSIONS: LibraryStep[] = [
  S(
    "EXTENDED (significant risk): perform at least one test of detail specifically responsive to the significant risk — analytics alone are not permitted.",
    "ÉTENDU (risque important) : réaliser au moins un test de détail répondant spécifiquement au risque important — les procédures analytiques seules sont interdites.",
    ["E", "A"],
  ),
  S(
    "EXTENDED (significant risk): increase sample sizes / lower testing thresholds for this area and introduce unpredictability.",
    "ÉTENDU (risque important) : augmenter les tailles d'échantillon / abaisser les seuils de test et introduire de l'imprévisibilité.",
    ["C", "E", "A", "V"],
  ),
];
