// Wave 4 of the ISA engine build prompt (§06 derivation, §07 annexes A–E):
// the substantive procedure library as data. Each entry is one annex row —
// cycle-coded WP reference (R.110 …), assertion-tagged with the §02 canonical
// codes, and tiered B/H/S. Tiers are cumulative (baseline ⊂ heightened ⊂
// significant): requesting a higher tier returns every lower tier's entries.
// Covered cycles: R (E4.1) · B (E4.8) · P (E4.2) · I (E4.4) · F (E4.5).

import type { Assertion } from "@/lib/risks";

export type ProcedureTier = "baseline" | "heightened" | "significant";

/** §02 canonical assertion codes (ISA 315 (Revised 2019), A190). */
export type CanonicalAssertion =
  | "O" // Occurrence
  | "C" // Completeness
  | "A" // Accuracy
  | "CO" // Cutoff
  | "CL" // Classification
  | "E" // Existence
  | "RO" // Rights and obligations
  | "AVA" // Accuracy, valuation and allocation
  | "P"; // Presentation

export interface ProcedureLibraryEntry {
  /** WP reference: <cycle letter>.<sequence>, e.g. "R.120". */
  code: string;
  titleEn: string;
  titleFr: string;
  /** §02 canonical assertion codes. */
  assertions: CanonicalAssertion[];
  tier: ProcedureTier;
  /** E-section internal codes this procedure applies to. */
  sectionCodes: string[];
}

const TIER_RANK: Record<ProcedureTier, number> = {
  baseline: 0,
  heightened: 1,
  significant: 2,
};

const E = (
  code: string,
  sectionCodes: string[],
  tier: ProcedureTier,
  assertions: CanonicalAssertion[],
  titleEn: string,
  titleFr: string,
): ProcedureLibraryEntry => ({ code, titleEn, titleFr, assertions, tier, sectionCodes });

export const PROCEDURE_LIBRARY: ProcedureLibraryEntry[] = [
  // ---- Annex A · Revenue & receivables (R → E4.1) ----
  E("R.110", ["E4.1"], "baseline", ["E", "C", "AVA"],
    "Agree the receivables subledger to the general ledger and aged listing; test the ageing's arithmetic and bucket allocation on a sample.",
    "Rapprocher la balance auxiliaire clients du grand livre et de la balance âgée ; tester l'arithmétique et la ventilation par ancienneté."),
  E("R.120", ["E4.1"], "baseline", ["E", "RO", "AVA", "C"],
    "Circularise customer balances: positive requests on the sample plus all key items; investigate differences; alternatives for non-response.",
    "Circulariser les soldes clients : demandes positives sur l'échantillon et éléments clés ; investiguer les écarts ; procédures alternatives."),
  E("R.130", ["E4.1"], "baseline", ["CO", "C", "O"],
    "Sales cut-off: test last despatches/first returns to invoice period; scan post-period credit notes for reversal of pre-year-end sales.",
    "Séparation des ventes : tester dernières expéditions/premiers retours ; examiner les avoirs postérieurs annulant des ventes de l'exercice."),
  E("R.140", ["E4.1"], "baseline", ["AVA", "P"],
    "Impairment of receivables: test loss-allowance inputs (ageing, loss rates, forward adjustments); test subsequent receipts on overdue strata.",
    "Dépréciation des créances : tester les données du modèle de pertes (ancienneté, taux, ajustements) ; tester les encaissements postérieurs."),
  E("R.150", ["E4.1"], "heightened", ["AVA", "CO", "P"],
    "Deferred/accrued revenue and rebate accruals: recompute period allocation from contracts; test post-period credit memos against accrual.",
    "Produits différés/à recevoir et remises : recalculer l'allocation par période selon les contrats ; tester les avoirs postérieurs."),
  E("R.160", ["E4.1"], "heightened", ["E", "C", "CL"],
    "Credit balances in receivables and unusual sales-ledger entries (journal source, round sums, period-end postings): corroborate to source.",
    "Soldes créditeurs clients et écritures inhabituelles des ventes (montants ronds, écritures de clôture) : corroborer aux pièces sources."),
  E("R.170", ["E4.1"], "significant", ["O", "CO", "A"],
    "Revenue fraud response: disaggregated analytics vs expectation; test manual revenue journals; inquire into side agreements; confirm terms.",
    "Réponse au risque de fraude sur les produits : analyses désagrégées ; tester les écritures manuelles ; rechercher les accords parallèles."),

  // ---- Annex B · Cash & borrowings (B → E4.8) ----
  E("B.110", ["E4.8"], "baseline", ["E", "C", "RO", "AVA", "P"],
    "Bank confirmations for all accounts and facilities: balances, restrictions, guarantees, signatories, undisclosed accounts.",
    "Confirmations bancaires pour tous les comptes et facilités : soldes, restrictions, garanties, signataires, comptes non déclarés."),
  E("B.120", ["E4.8"], "baseline", ["E", "C", "AVA"],
    "Test period-end bank reconciliations: trace reconciling items both ways to post-closing evidence; review every bank-side unrecorded item.",
    "Tester les rapprochements bancaires de clôture : pointer les suspens dans les deux sens ; revoir tout élément bancaire non comptabilisé."),
  E("B.130", ["E4.8"], "baseline", ["CO", "C", "E"],
    "Cash cut-off: last receipts/payments of the period and first of the new period traced to correct-period recording.",
    "Séparation de trésorerie : derniers encaissements/décaissements et premiers du nouvel exercice tracés à la bonne période."),
  E("B.140", ["E4.8"], "baseline", ["C", "AVA", "CL", "P", "RO"],
    "Borrowings: confirm balances and terms with lenders; recompute interest and amortisation; test covenants and current/non-current split.",
    "Emprunts : confirmer soldes et conditions auprès des prêteurs ; recalculer intérêts et amortissement ; tester covenants et ventilation."),
  E("B.150", ["E4.8"], "heightened", ["AVA", "A"],
    "Foreign-currency balances: recompute closing translation at the closing rate; test realised/unrealised difference postings.",
    "Soldes en devises : recalculer la conversion au cours de clôture ; tester les écarts de change réalisés et latents."),

  // ---- Annex C · Purchases & payables (P → E4.2) ----
  E("P.110", ["E4.2"], "baseline", ["E", "C", "AVA"],
    "Agree the payables subledger to the general ledger and aged listing; investigate debit balances and stale items.",
    "Rapprocher la balance auxiliaire fournisseurs du grand livre et de la balance âgée ; investiguer soldes débiteurs et éléments anciens."),
  E("P.120", ["E4.2"], "baseline", ["C", "AVA", "CO"],
    "Search for unrecorded liabilities: trace subsequent payments and post-closing invoices to receipt date; verify accrual or exclusion.",
    "Recherche de passifs non comptabilisés : tracer paiements et factures postérieurs à la date de réception ; vérifier le rattachement."),
  E("P.130", ["E4.2"], "baseline", ["CO", "C", "RO"],
    "Purchases cut-off: goods-received records around period end matched to invoice recording period; accruals raised for received-not-invoiced.",
    "Séparation des achats : réceptions autour de la clôture rapprochées de la période de facturation ; provision pour factures non parvenues."),
  E("P.140", ["E4.2"], "heightened", ["E", "C", "AVA", "RO"],
    "Supplier statement reconciliation on the sample plus key suppliers; investigate differences; circularise where statements unavailable.",
    "Rapprochement des relevés fournisseurs sur l'échantillon et fournisseurs clés ; investiguer les écarts ; circulariser à défaut de relevés."),
  E("P.150", ["E4.2"], "heightened", ["CL", "O", "C"],
    "Expense classification and unusual-vendor review: analytics by nature; scan new/one-time vendors, round sums, splits under approval limits.",
    "Classement des charges et revue des fournisseurs inhabituels : analyses par nature ; fournisseurs nouveaux, montants ronds, fractionnements."),

  // ---- Annex D · Inventory (I → E4.4) ----
  E("I.110", ["E4.4"], "baseline", ["E", "C", "AVA", "RO"],
    "Attend the physical count (ISA 501): evaluate instructions beforehand; observe, test counts in both directions, capture cut-off data.",
    "Assister à l'inventaire physique (ISA 501) : évaluer les instructions ; observer, comptages tests dans les deux sens, saisir le cut-off."),
  E("I.120", ["E4.4"], "baseline", ["E", "C", "RO"],
    "Confirm inventories held by third parties; where significant, attend their count or inspect.",
    "Confirmer les stocks détenus par des tiers ; si significatifs, assister à leur inventaire ou inspecter."),
  E("I.130", ["E4.4"], "baseline", ["E", "C", "AVA"],
    "Reconcile the final compilation to count records and to the general ledger; test quantity roll-ups and unit-of-measure conversions.",
    "Rapprocher l'état final des feuilles de comptage et du grand livre ; tester les totalisations et les conversions d'unités."),
  E("I.140", ["E4.4"], "baseline", ["E", "C", "AVA", "CO"],
    "Roll-forward from count date to period end: test movements in the gap; recompute the bridge.",
    "Roll-forward de la date d'inventaire à la clôture : tester les mouvements de la période intercalaire ; recalculer le pont."),
  E("I.150", ["E4.4"], "baseline", ["AVA", "A"],
    "Cost testing: components of cost (materials, labour, absorbed overheads) to source; absorption basis reasonableness against normal capacity.",
    "Test des coûts : composantes (matières, main-d'œuvre, frais imputés) aux pièces ; base d'imputation vs capacité normale."),
  E("I.160", ["E4.4"], "baseline", ["AVA", "P"],
    "Net realisable value: post-period selling prices vs carrying cost on the sample; slow-moving/obsolete analysis and write-down adequacy.",
    "Valeur nette de réalisation : prix de vente postérieurs vs coût sur l'échantillon ; stocks à rotation lente et dépréciations."),

  // ---- Annex E · Fixed assets & intangibles (F → E4.5) ----
  E("F.110", ["E4.5"], "baseline", ["E", "C", "AVA", "P"],
    "Movement schedule: opening to prior-year closing; additions, disposals, transfers to support; closing to GL; depreciation mirrored.",
    "Tableau des mouvements : ouverture = clôture N-1 ; acquisitions, cessions, virements justifiés ; clôture au GL ; amortissements en miroir."),
  E("F.120", ["E4.5"], "baseline", ["E", "RO", "AVA", "O", "CL"],
    "Test additions to invoices/contracts (capitalisable nature, ownership, date in service); disposals to proceeds and gain/loss recomputation.",
    "Tester les acquisitions sur factures/contrats (nature, propriété, mise en service) ; cessions : produits et résultat recalculé."),
  E("F.130", ["E4.5"], "baseline", ["AVA", "A", "P"],
    "Recompute depreciation on a sample; assess useful lives and residual values against use and policy; components identified where material.",
    "Recalculer les amortissements sur échantillon ; apprécier durées d'utilité et valeurs résiduelles ; composants si significatif."),
  E("F.140", ["E4.5"], "heightened", ["AVA", "P"],
    "Impairment indicators review; where present, test the recoverable-amount estimate under the estimates module (ISA 540 (Revised)).",
    "Revue des indices de perte de valeur ; le cas échéant, tester l'estimation de la valeur recouvrable (ISA 540 révisée)."),
  E("F.150", ["E4.5"], "heightened", ["C", "CL", "P"],
    "Repairs & maintenance scan for items that should be capitalised; capital-commitments and pledged-asset disclosure completeness.",
    "Revue des charges d'entretien pour éléments à immobiliser ; exhaustivité des engagements donnés et des actifs nantis."),
];

/**
 * Annex entries applicable to a section at the requested risk tier. Tiers are
 * cumulative per §06 ("risk_level_applicability <= tier"): baseline entries
 * appear at every tier, heightened from H up, significant only at S.
 */
export function libraryForSection(sectionCode: string, tier: ProcedureTier): ProcedureLibraryEntry[] {
  const max = TIER_RANK[tier];
  return PROCEDURE_LIBRARY.filter(
    (entry) => entry.sectionCodes.includes(sectionCode) && TIER_RANK[entry.tier] <= max,
  );
}

/**
 * Roll the §02 canonical codes up to the platform's stored display set
 * (C/E/A/V/P) for the program_step.assertions column — §02's combined-view
 * rule: E subsumes occurrence and rights & obligations; AVA maps to V;
 * cutoff rides with accuracy; classification with presentation.
 */
const LEGACY_OF: Record<CanonicalAssertion, Assertion> = {
  O: "E",
  C: "C",
  A: "A",
  CO: "A",
  CL: "P",
  E: "E",
  RO: "E",
  AVA: "V",
  P: "P",
};

export function toLegacyAssertions(codes: CanonicalAssertion[]): Assertion[] {
  return [...new Set(codes.map((code) => LEGACY_OF[code]))];
}
