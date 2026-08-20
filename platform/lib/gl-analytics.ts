// The general-ledger analytics engine.
//
// Thirty declared analytics over the typed line projection (gl_line). Every
// implemented analytic is a SQL aggregate grouped by journal month — the ledger
// is never streamed into Node, whatever its size. The catalogue declares all
// thirty so the auditor sees the complete suite with an honest status against
// their file, rather than a short list that hides what the import cannot
// support.
//
// Wording rule, applied throughout: a result is an EXCEPTION or a RISK
// INDICATOR REQUIRING AUDIT CONSIDERATION. It is never called fraud, an error
// or a misstatement — those are conclusions the auditor reaches, not outputs a
// query produces.
//
// Amount convention: signed = debit - credit (debits positive, credits
// negative), as built by lib/gl-line.ts.

import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { glDataset, mappedFields, TOLERANCE } from "@/lib/gl-line";
import { requireTenant } from "@/lib/tenant";

type Tx = PoolClient;
type Locale = "en" | "fr";
export type Cell = number | string | null;

export interface AnalyticDef {
  id: number;
  key: string;
  titleEn: string;
  titleFr: string;
  category: AnalyticCategory;
  objectiveEn: string;
  objectiveFr: string;
  /** ISA 315 assertions the analytic speaks to: C, E, A, V, P */
  assertions: string[];
  /** dataset mapping keys the analytic needs; "amount" means a signed amount */
  requiredFields: string[];
  exceptionEn: string;
  exceptionFr: string;
  /** declared but not computed in this release; carries its own honest reason */
  unavailableEn?: string;
  unavailableFr?: string;
}

export type AnalyticCategory =
  | "integrity"
  | "completeness"
  | "timing"
  | "value"
  | "pattern"
  | "attribution";

export interface AnalyticColumn {
  key: string;
  label: string;
}

export interface AnalyticRow {
  /** journal month as YYYY-MM, or "n/a" for lines with no readable date */
  month: string;
  cells: Cell[];
}

export interface AnalyticResult {
  key: string;
  title: string;
  objective: string;
  requiredFields: string[];
  /** set when the analytic cannot be computed; rows and columns are then empty */
  unavailable?: string;
  /** describes the cells of each row; the month is the row key, not a cell */
  columns: AnalyticColumn[];
  rows: AnalyticRow[];
  totals?: Cell[];
  /** lines / entries flagged as exceptions requiring audit consideration */
  exceptions: number;
  /** the denominator the exception count is measured against */
  population: number;
  note?: string;
}

export interface AnalyticParams {
  locale?: Locale;
  /** 11 top-value: percentile cut, 0-1. Default 0.99. */
  percentile?: number;
  /** 10 monthly-spikes: standard deviations above the mean. Default 2. */
  sdFactor?: number;
  /** 12 round-numbers: minimum absolute amount. Default 100000. */
  roundMin?: number;
  /** 12 round-numbers: divisor the amount must be a multiple of. Default 100000. */
  roundStep?: number;
  /** 14 repeated-amounts: occurrences before an amount counts as repeated. Default 10. */
  minOccurrences?: number;
  /** 15 rare-accounts: at most this many postings in the year. Default 3. */
  rareMax?: number;
  /** 20 third-party-attribution: in-scope account prefixes. Default 40, 41. */
  prefixes?: string[];
  /** 21/22/23: how many named people get their own column. Default 10. */
  topN?: number;
  /** 9 year-end-concentration: length of the closing window in days. Default 15. */
  yearEndDays?: number;
}

const UNAVAILABLE_EN = "Unavailable — required field not mapped";
const UNAVAILABLE_FR = "Indisponible — champ requis non mappé";
const NOT_BUILT_EN = "Declared but not computed in this release";
const NOT_BUILT_FR = "Déclarée mais non calculée dans cette version";

// ---------------------------------------------------------------------------
// the catalogue

export const ANALYTICS: AnalyticDef[] = [
  {
    id: 1, key: "ledger-reconciliation", category: "integrity",
    titleEn: "Ledger reconciliation", titleFr: "Rapprochement du grand livre",
    objectiveEn: "Confirm the ledger is internally coherent: total debits equal total credits, month by month and in total.",
    objectiveFr: "Confirmer la cohérence interne du grand livre : total des débits égal au total des crédits, mois par mois et au total.",
    assertions: ["C", "A"], requiredFields: ["account", "amount", "journalDate"],
    exceptionEn: "A month whose debits and credits do not agree.",
    exceptionFr: "Un mois dont les débits et les crédits ne concordent pas.",
  },
  {
    id: 2, key: "unbalanced-entries", category: "integrity",
    titleEn: "Unbalanced journal entries", titleFr: "Écritures déséquilibrées",
    objectiveEn: "Identify journal entries whose lines do not net to nil, which double-entry posting should make impossible.",
    objectiveFr: "Identifier les écritures dont les lignes ne se soldent pas à zéro, ce que la partie double devrait rendre impossible.",
    assertions: ["C", "A"], requiredFields: ["jeNumber", "amount", "journalDate"],
    exceptionEn: "A journal entry with a non-nil net balance.",
    exceptionFr: "Une écriture dont le solde net n'est pas nul.",
  },
  {
    id: 3, key: "exact-duplicates", category: "integrity",
    titleEn: "Exact duplicate lines", titleFr: "Lignes en double exact",
    objectiveEn: "Detect ledger lines repeated identically on account, entry, date, reference, amount and description.",
    objectiveFr: "Détecter les lignes répétées à l'identique sur le compte, l'écriture, la date, la référence, le montant et le libellé.",
    assertions: ["E", "A"], requiredFields: ["account", "jeNumber", "amount", "journalDate"],
    exceptionEn: "Each repeat beyond the first occurrence of an identical line.",
    exceptionFr: "Chaque répétition au-delà de la première occurrence d'une ligne identique.",
  },
  {
    id: 4, key: "near-duplicates", category: "integrity",
    titleEn: "Near-duplicate entries", titleFr: "Écritures quasi identiques",
    objectiveEn: "Detect entries repeating the same counterparty and amount under a different reference or date.",
    objectiveFr: "Détecter les écritures répétant le même tiers et le même montant sous une référence ou une date différente.",
    assertions: ["E", "A"], requiredFields: ["account", "reference", "amount", "thirdPartyCode"],
    exceptionEn: "A pair of entries matching on amount and counterparty but not on reference.",
    exceptionFr: "Un couple d'écritures concordant sur le montant et le tiers mais pas sur la référence.",
    unavailableEn: NOT_BUILT_EN, unavailableFr: NOT_BUILT_FR,
  },
  {
    id: 5, key: "zero-value", category: "integrity",
    titleEn: "Nil-value lines", titleFr: "Lignes de valeur nulle",
    objectiveEn: "Isolate lines posted with neither a debit nor a credit, which carry no accounting effect.",
    objectiveFr: "Isoler les lignes comptabilisées sans débit ni crédit, sans effet comptable.",
    assertions: ["E"], requiredFields: ["amount", "journalDate"],
    exceptionEn: "A line whose debit and credit are both nil.",
    exceptionFr: "Une ligne dont le débit et le crédit sont tous deux nuls.",
  },
  {
    id: 6, key: "invalid-debit-credit", category: "integrity",
    titleEn: "Invalid debit/credit presentation", titleFr: "Présentation débit/crédit invalide",
    objectiveEn: "Find lines carrying a debit and a credit at once, or a negative value on either side, instead of one positive side.",
    objectiveFr: "Repérer les lignes portant à la fois un débit et un crédit, ou une valeur négative d'un côté, au lieu d'un seul côté positif.",
    assertions: ["A"], requiredFields: ["debit", "credit", "journalDate"],
    exceptionEn: "A line with both sides populated, or a negative debit or credit.",
    exceptionFr: "Une ligne dont les deux côtés sont servis, ou un débit ou crédit négatif.",
  },
  {
    id: 7, key: "weekend-postings", category: "timing",
    titleEn: "Weekend and weekday profile", titleFr: "Profil des jours de la semaine",
    objectiveEn: "Profile postings by day of the week and measure the share dated on a Saturday or Sunday.",
    objectiveFr: "Profiler les comptabilisations par jour de la semaine et mesurer la part datée du samedi ou du dimanche.",
    assertions: ["E", "P"], requiredFields: ["journalDate"],
    exceptionEn: "A line dated on a Saturday or Sunday.",
    exceptionFr: "Une ligne datée d'un samedi ou d'un dimanche.",
  },
  {
    id: 8, key: "entry-date-lag", category: "timing",
    titleEn: "Entry date lag", titleFr: "Décalage de la date de saisie",
    objectiveEn: "Measure the delay between the effective journal date of an entry and the date it was actually recorded.",
    objectiveFr: "Mesurer le délai entre la date d'effet de l'écriture et sa date de saisie effective.",
    assertions: ["C", "E"], requiredFields: ["jeNumber", "journalDate", "jeDate"],
    exceptionEn: "An entry recorded more than three days after its journal date, or before it.",
    exceptionFr: "Une écriture saisie plus de trois jours après sa date de journal, ou avant celle-ci.",
  },
  {
    id: 9, key: "year-end-concentration", category: "timing",
    titleEn: "Year-end concentration", titleFr: "Concentration de fin d'exercice",
    objectiveEn: "Show how ledger value is spread across the year and how much of it lands in the closing days of the period.",
    objectiveFr: "Montrer la répartition de la valeur sur l'exercice et la part comptabilisée dans les derniers jours de la période.",
    assertions: ["C", "E"], requiredFields: ["amount", "journalDate"],
    exceptionEn: "A line dated inside the closing window of the period.",
    exceptionFr: "Une ligne datée dans la fenêtre de clôture de la période.",
  },
  {
    id: 10, key: "monthly-spikes", category: "pattern",
    titleEn: "Monthly volume spikes", titleFr: "Pics d'activité mensuels",
    objectiveEn: "Flag months whose posted value exceeds the mean of all months by more than the chosen number of standard deviations.",
    objectiveFr: "Signaler les mois dont la valeur comptabilisée dépasse la moyenne de plus du nombre d'écarts-types retenu.",
    assertions: ["C", "E"], requiredFields: ["amount", "journalDate"],
    exceptionEn: "A month above the mean-plus-n-standard-deviations threshold.",
    exceptionFr: "Un mois au-dessus du seuil moyenne plus n écarts-types.",
  },
  {
    id: 11, key: "top-value", category: "value",
    titleEn: "Highest-value lines", titleFr: "Lignes de plus forte valeur",
    objectiveEn: "Isolate the largest postings in the ledger by absolute amount, above a percentile cut of the population.",
    objectiveFr: "Isoler les comptabilisations les plus élevées en valeur absolue, au-delà d'un centile de la population.",
    assertions: ["V", "A"], requiredFields: ["amount", "journalDate"],
    exceptionEn: "A line at or above the percentile threshold.",
    exceptionFr: "Une ligne égale ou supérieure au seuil de centile.",
  },
  {
    id: 12, key: "round-numbers", category: "pattern",
    titleEn: "Round-amount postings", titleFr: "Montants ronds",
    objectiveEn: "Isolate large postings that are exact multiples of a round base, a pattern more typical of estimates than of transactions.",
    objectiveFr: "Isoler les comptabilisations élevées correspondant à des multiples exacts d'une base ronde, plus typiques d'estimations que de transactions.",
    assertions: ["V", "A"], requiredFields: ["amount", "journalDate"],
    exceptionEn: "A line at or above the floor and an exact multiple of the round base.",
    exceptionFr: "Une ligne atteignant le plancher et multiple exact de la base ronde.",
  },
  {
    id: 13, key: "benford", category: "pattern",
    titleEn: "Benford first-digit profile", titleFr: "Profil de Benford (premier chiffre)",
    objectiveEn: "Compare the distribution of leading digits with Benford's law and report the mean absolute deviation per month.",
    objectiveFr: "Comparer la distribution des premiers chiffres à la loi de Benford et reporter l'écart absolu moyen par mois.",
    assertions: ["A", "V"], requiredFields: ["amount", "journalDate"],
    exceptionEn: "A month whose mean absolute deviation exceeds 1.5 percentage points.",
    exceptionFr: "Un mois dont l'écart absolu moyen dépasse 1,5 point de pourcentage.",
  },
  {
    id: 14, key: "repeated-amounts", category: "pattern",
    titleEn: "Repeated amounts", titleFr: "Montants répétés",
    objectiveEn: "Identify amounts posted many times over the year and show where in the year they cluster.",
    objectiveFr: "Identifier les montants comptabilisés de nombreuses fois dans l'année et montrer leur regroupement.",
    assertions: ["A", "V"], requiredFields: ["amount", "journalDate"],
    exceptionEn: "A line whose amount recurs at or above the occurrence threshold.",
    exceptionFr: "Une ligne dont le montant se répète au moins au seuil d'occurrences.",
  },
  {
    id: 15, key: "rare-accounts", category: "pattern",
    titleEn: "Rarely used accounts", titleFr: "Comptes rarement utilisés",
    objectiveEn: "Surface accounts posted to only a handful of times in the year, whose few movements carry disproportionate weight.",
    objectiveFr: "Faire ressortir les comptes mouvementés seulement quelques fois dans l'année, dont les rares mouvements pèsent d'autant plus.",
    assertions: ["E", "A"], requiredFields: ["account", "journalDate"],
    exceptionEn: "A line posted to an account used at most the threshold number of times.",
    exceptionFr: "Une ligne imputée à un compte utilisé au plus le nombre de fois du seuil.",
  },
  {
    id: 16, key: "normal-side-exceptions", category: "integrity",
    titleEn: "Postings against the normal side", titleFr: "Comptabilisations à contre-sens",
    objectiveEn: "Flag postings on the side opposite to the normal balance of the SYSCOHADA account class.",
    objectiveFr: "Signaler les comptabilisations du côté opposé au sens normal de la classe de compte SYSCOHADA.",
    assertions: ["A", "C"], requiredFields: ["account", "amount", "journalDate"],
    exceptionEn: "A class 2, 3, 5 or 6 account credited, or a class 1 or 7 account debited.",
    exceptionFr: "Un compte de classe 2, 3, 5 ou 6 crédité, ou un compte de classe 1 ou 7 débité.",
  },
  {
    id: 17, key: "unusual-account-combinations", category: "pattern",
    titleEn: "Unusual account combinations", titleFr: "Combinaisons de comptes inhabituelles",
    objectiveEn: "Score account pairings by how rarely they appear together in the same entry.",
    objectiveFr: "Noter les couples de comptes selon la rareté de leur présence conjointe dans une même écriture.",
    assertions: ["A", "C"], requiredFields: ["account", "jeNumber"],
    exceptionEn: "An entry pairing accounts that rarely appear together.",
    exceptionFr: "Une écriture associant des comptes rarement réunis.",
    unavailableEn: NOT_BUILT_EN, unavailableFr: NOT_BUILT_FR,
  },
  {
    id: 18, key: "missing-mandatory-fields", category: "completeness",
    titleEn: "Missing mandatory fields", titleFr: "Champs obligatoires manquants",
    objectiveEn: "Count lines missing an account, an entry number, a description, a readable date or an amount.",
    objectiveFr: "Compter les lignes sans compte, numéro d'écriture, libellé, date lisible ou montant.",
    assertions: ["C", "A"], requiredFields: ["account", "jeNumber", "journalDate"],
    exceptionEn: "A line missing any mandatory field.",
    exceptionFr: "Une ligne à laquelle manque un champ obligatoire.",
  },
  {
    id: 19, key: "missing-references", category: "completeness",
    titleEn: "Missing supporting reference", titleFr: "Référence justificative manquante",
    objectiveEn: "Count lines posted without a document reference tying them to supporting evidence.",
    objectiveFr: "Compter les lignes comptabilisées sans référence de pièce les reliant à un justificatif.",
    assertions: ["C", "E"], requiredFields: ["reference", "journalDate"],
    exceptionEn: "A line with no reference.",
    exceptionFr: "Une ligne sans référence.",
  },
  {
    id: 20, key: "third-party-attribution", category: "attribution",
    titleEn: "Third-party attribution", titleFr: "Attribution des tiers",
    objectiveEn: "Within receivable and payable accounts only, measure how many postings carry the counterparty they belong to.",
    objectiveFr: "Sur les seuls comptes clients et fournisseurs, mesurer la part des comptabilisations portant le tiers auquel elles se rattachent.",
    assertions: ["C", "A"], requiredFields: ["account", "thirdPartyCode", "journalDate"],
    exceptionEn: "An in-scope line with no third-party code.",
    exceptionFr: "Une ligne dans le périmètre sans code tiers.",
  },
  {
    id: 21, key: "preparer-volume", category: "attribution",
    titleEn: "Preparer volume", titleFr: "Volume par préparateur",
    objectiveEn: "Show how the posting workload is distributed across the people who recorded the entries.",
    objectiveFr: "Montrer la répartition de la charge de comptabilisation entre les personnes ayant saisi les écritures.",
    assertions: ["E", "P"], requiredFields: ["preparer", "journalDate"],
    exceptionEn: "A line with no identified preparer.",
    exceptionFr: "Une ligne sans préparateur identifié.",
  },
  {
    id: 22, key: "preparer-value", category: "attribution",
    titleEn: "Preparer value", titleFr: "Valeur par préparateur",
    objectiveEn: "Show how posted value, not merely line count, is distributed across preparers.",
    objectiveFr: "Montrer la répartition de la valeur comptabilisée, et non du seul nombre de lignes, entre les préparateurs.",
    assertions: ["V", "P"], requiredFields: ["preparer", "amount", "journalDate"],
    exceptionEn: "Value posted by a preparer with no identity recorded.",
    exceptionFr: "Valeur comptabilisée par un préparateur non identifié.",
  },
  {
    id: 23, key: "reviewer-workload", category: "attribution",
    titleEn: "Reviewer workload", titleFr: "Charge de revue",
    objectiveEn: "Show how review coverage is distributed and how many postings carry no reviewer at all.",
    objectiveFr: "Montrer la répartition de la revue et le nombre de comptabilisations sans réviseur.",
    assertions: ["P", "E"], requiredFields: ["reviewer", "journalDate"],
    exceptionEn: "A line with no reviewer recorded.",
    exceptionFr: "Une ligne sans réviseur enregistré.",
  },
  {
    id: 24, key: "self-review", category: "attribution",
    titleEn: "Preparer equals approver", titleFr: "Préparateur identique à l'approbateur",
    objectiveEn: "Identify entries recorded and approved by the same person, defeating the segregation of duties.",
    objectiveFr: "Identifier les écritures saisies et approuvées par la même personne, annulant la séparation des tâches.",
    assertions: ["P"], requiredFields: ["preparer", "approvedBy"],
    exceptionEn: "An entry whose preparer and approver are the same person.",
    exceptionFr: "Une écriture dont le préparateur et l'approbateur sont la même personne.",
    unavailableEn: NOT_BUILT_EN, unavailableFr: NOT_BUILT_FR,
  },
  {
    id: 25, key: "out-of-hours-postings", category: "timing",
    titleEn: "Out-of-hours postings", titleFr: "Comptabilisations hors heures ouvrées",
    objectiveEn: "Profile postings by the hour of day they were recorded, outside normal working hours.",
    objectiveFr: "Profiler les comptabilisations selon l'heure de saisie, en dehors des heures ouvrées.",
    // the import carries a posting DATE but no time of day, so the analytic can
    // never run against this projection — its own reason says so plainly
    assertions: ["E", "P"], requiredFields: ["jeDate"],
    exceptionEn: "A posting recorded outside working hours.",
    exceptionFr: "Une comptabilisation saisie hors des heures ouvrées.",
    unavailableEn: "Unavailable — the import carries no posting timestamp",
    unavailableFr: "Indisponible — l'import ne comporte pas d'horodatage de saisie",
  },
  {
    id: 26, key: "sequence-gaps", category: "completeness",
    titleEn: "Entry numbering gaps", titleFr: "Ruptures de séquence des écritures",
    objectiveEn: "Test the journal numbering sequence for gaps and repeats within each journal code.",
    objectiveFr: "Tester la séquence de numérotation des écritures pour détecter ruptures et doublons par code journal.",
    assertions: ["C"], requiredFields: ["jeNumber", "journalCode"],
    exceptionEn: "A missing or repeated number in a journal sequence.",
    exceptionFr: "Un numéro manquant ou répété dans une séquence de journal.",
    unavailableEn: NOT_BUILT_EN, unavailableFr: NOT_BUILT_FR,
  },
  {
    id: 27, key: "manual-vs-automated", category: "pattern",
    titleEn: "Manual versus system-generated", titleFr: "Écritures manuelles ou générées",
    objectiveEn: "Split the ledger between entries raised by hand and those generated by a source module.",
    objectiveFr: "Répartir le grand livre entre écritures saisies à la main et écritures générées par un module source.",
    assertions: ["E", "P"], requiredFields: ["jeNumber"],
    exceptionEn: "A manual entry in a population expected to be system-generated.",
    exceptionFr: "Une écriture manuelle dans une population censée être générée par le système.",
    unavailableEn: "Unavailable — the import carries no entry-source indicator",
    unavailableFr: "Indisponible — l'import ne comporte pas d'indicateur de source d'écriture",
  },
  {
    id: 28, key: "post-period-postings", category: "timing",
    titleEn: "Postings after the period end", titleFr: "Comptabilisations après la clôture",
    objectiveEn: "Identify entries recorded after the period end but dated inside it.",
    objectiveFr: "Identifier les écritures saisies après la clôture mais datées à l'intérieur de la période.",
    assertions: ["C", "E"], requiredFields: ["journalDate", "jeDate"],
    exceptionEn: "An entry recorded after the period end and dated before it.",
    exceptionFr: "Une écriture saisie après la clôture et datée avant celle-ci.",
    unavailableEn: NOT_BUILT_EN, unavailableFr: NOT_BUILT_FR,
  },
  {
    id: 29, key: "debit-credit-correlation", category: "integrity",
    titleEn: "Debit and credit co-movement", titleFr: "Co-évolution des débits et crédits",
    objectiveEn: "Track monthly debit and credit totals side by side and measure how closely they move together.",
    objectiveFr: "Suivre les totaux mensuels de débits et de crédits côte à côte et mesurer leur corrélation.",
    assertions: ["A", "C"], requiredFields: ["amount", "journalDate"],
    exceptionEn: "A month whose debit and credit totals diverge.",
    exceptionFr: "Un mois dont les totaux de débits et de crédits divergent.",
  },
  {
    id: 30, key: "account-frequency-value", category: "value",
    titleEn: "Account frequency and value", titleFr: "Fréquence et valeur par compte",
    objectiveEn: "Describe the shape of ledger activity month by month: accounts touched, lines posted and value moved.",
    objectiveFr: "Décrire la forme de l'activité mois par mois : comptes mouvementés, lignes comptabilisées et valeur déplacée.",
    assertions: ["C", "V"], requiredFields: ["account", "amount", "journalDate"],
    exceptionEn: "Informational — no exception condition; the profile supports scoping decisions.",
    exceptionFr: "Informatif — pas de condition d'exception ; le profil oriente le cadrage.",
  },
];

export const ANALYTIC_BY_KEY = new Map(ANALYTICS.map((a) => [a.key, a]));

// ---------------------------------------------------------------------------
// helpers

const MONTH = "coalesce(to_char(journal_date, 'YYYY-MM'), 'n/a')";
const SCOPE = "dataset_id = $1 AND engagement_id = $2";

interface Body {
  columns: AnalyticColumn[];
  rows: AnalyticRow[];
  totals?: Cell[];
  exceptions: number;
  population: number;
  note?: string;
}

const t = (locale: Locale, en: string, fr: string): string => (locale === "fr" ? fr : en);

/** Sum a numeric column across the result rows, for the totals line. */
const sum = (rows: AnalyticRow[], index: number): number =>
  rows.reduce((acc, r) => acc + (typeof r.cells[index] === "number" ? (r.cells[index] as number) : 0), 0);

const round2 = (v: number): number => Math.round(v * 100) / 100;

const pct = (part: number, whole: number): number | null =>
  whole === 0 ? null : round2((part / whole) * 100);

/** Pearson correlation; null when either series is flat (r is undefined then). */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const my = ys.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i += 1) {
    cov += (xs[i] - mx) * (ys[i] - my);
    vx += (xs[i] - mx) ** 2;
    vy += (ys[i] - my) ** 2;
  }
  if (vx === 0 || vy === 0) return null;
  return round2(cov / Math.sqrt(vx * vy));
}

/** Benford expected share of each leading digit, in percent. */
const BENFORD = Array.from({ length: 9 }, (_, i) => Math.log10(1 + 1 / (i + 1)) * 100);

// ---------------------------------------------------------------------------
// the implementations
//
// Each takes the transaction and the scope parameters and returns the body of
// the result. Every one of them is a GROUP BY over gl_line.

type Impl = (tx: Tx, args: ImplArgs) => Promise<Body>;

interface ImplArgs {
  datasetId: string;
  engagementId: string;
  locale: Locale;
  params: AnalyticParams;
}

const IMPL: Record<string, Impl> = {
  // 1 ------------------------------------------------------------------
  "ledger-reconciliation": async (tx, { datasetId, engagementId, locale }) => {
    const q = await tx.query<{ m: string; lines: number; d: number; c: number; diff: number }>(
      `SELECT ${MONTH} AS m, count(*)::int AS lines,
              coalesce(sum(debit), 0)::float8 AS d,
              coalesce(sum(credit), 0)::float8 AS c,
              coalesce(sum(debit) - sum(credit), 0)::float8 AS diff
         FROM gl_line WHERE ${SCOPE} GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId],
    );
    const rows = q.rows.map((r) => ({ month: r.m, cells: [r.lines, round2(r.d), round2(r.c), round2(r.diff)] as Cell[] }));
    const exceptions = q.rows.filter((r) => Math.abs(r.diff) > TOLERANCE).length;
    return {
      columns: [
        { key: "lines", label: t(locale, "Lines", "Lignes") },
        { key: "debit", label: t(locale, "Debit", "Débit") },
        { key: "credit", label: t(locale, "Credit", "Crédit") },
        { key: "difference", label: t(locale, "Difference", "Écart") },
      ],
      rows,
      totals: [sum(rows, 0), round2(sum(rows, 1)), round2(sum(rows, 2)), round2(sum(rows, 3))],
      exceptions,
      population: q.rows.length,
      note: t(locale,
        "Population is the months in the ledger; an exception is a month whose debits and credits differ by more than 0.005.",
        "La population est constituée des mois du grand livre ; une exception est un mois dont les débits et crédits diffèrent de plus de 0,005."),
    };
  },

  // 2 ------------------------------------------------------------------
  "unbalanced-entries": async (tx, { datasetId, engagementId, locale }) => {
    const q = await tx.query<{ m: string; entries: number; unbalanced: number; diff: number }>(
      `WITH je AS (
         SELECT je_number, min(journal_date) AS jd, sum(signed) AS net
           FROM gl_line WHERE ${SCOPE} GROUP BY je_number)
       SELECT coalesce(to_char(jd, 'YYYY-MM'), 'n/a') AS m,
              count(*)::int AS entries,
              count(*) FILTER (WHERE abs(net) > $3::numeric)::int AS unbalanced,
              coalesce(sum(abs(net)) FILTER (WHERE abs(net) > $3::numeric), 0)::float8 AS diff
         FROM je GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId, TOLERANCE],
    );
    const rows = q.rows.map((r) => ({
      month: r.m,
      cells: [r.entries, r.unbalanced, round2(r.diff), pct(r.unbalanced, r.entries)] as Cell[],
    }));
    return {
      columns: [
        { key: "entries", label: t(locale, "Entries", "Écritures") },
        { key: "unbalanced", label: t(locale, "Unbalanced", "Déséquilibrées") },
        { key: "netDifference", label: t(locale, "Net difference", "Écart net") },
        { key: "sharePct", label: t(locale, "% of entries", "% des écritures") },
      ],
      rows,
      totals: [sum(rows, 0), sum(rows, 1), round2(sum(rows, 2)), pct(sum(rows, 1), sum(rows, 0))],
      exceptions: sum(rows, 1),
      population: sum(rows, 0),
      note: t(locale,
        "An entry is grouped under the earliest journal date of its lines.",
        "Une écriture est rattachée à la date de journal la plus ancienne de ses lignes."),
    };
  },

  // 3 ------------------------------------------------------------------
  "exact-duplicates": async (tx, { datasetId, engagementId, locale }) => {
    const q = await tx.query<{ m: string; groups: number; lines: number; extra: number; value: number }>(
      `WITH d AS (
         SELECT ${MONTH} AS m, count(*) AS n, sum(abs(signed)) AS v
           FROM gl_line WHERE ${SCOPE}
          GROUP BY ${MONTH}, account, je_number, journal_date,
                   coalesce(reference, ''), signed, coalesce(je_description, '')
         HAVING count(*) > 1)
       SELECT m, count(*)::int AS groups, sum(n)::int AS lines,
              sum(n - 1)::int AS extra, coalesce(sum(v), 0)::float8 AS value
         FROM d GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId],
    );
    const pop = await tx.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM gl_line WHERE ${SCOPE}`, [datasetId, engagementId],
    );
    const rows = q.rows.map((r) => ({
      month: r.m, cells: [r.groups, r.lines, r.extra, round2(r.value)] as Cell[],
    }));
    return {
      columns: [
        { key: "groups", label: t(locale, "Duplicate groups", "Groupes de doublons") },
        { key: "lines", label: t(locale, "Lines involved", "Lignes concernées") },
        { key: "extra", label: t(locale, "Repeat lines", "Lignes répétées") },
        { key: "value", label: t(locale, "Gross value", "Valeur brute") },
      ],
      rows,
      totals: [sum(rows, 0), sum(rows, 1), sum(rows, 2), round2(sum(rows, 3))],
      exceptions: sum(rows, 2),
      population: pop.rows[0]?.n ?? 0,
      note: t(locale,
        "Identity is account, entry number, journal date, reference, signed amount and description. The first occurrence of each group is not counted as an exception.",
        "L'identité porte sur le compte, le numéro d'écriture, la date, la référence, le montant signé et le libellé. La première occurrence de chaque groupe n'est pas comptée comme exception."),
    };
  },

  // 5 ------------------------------------------------------------------
  "zero-value": async (tx, { datasetId, engagementId, locale }) => {
    const q = await tx.query<{ m: string; lines: number; nil: number }>(
      `SELECT ${MONTH} AS m, count(*)::int AS lines,
              count(*) FILTER (WHERE debit = 0 AND credit = 0)::int AS nil
         FROM gl_line WHERE ${SCOPE} GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId],
    );
    const rows = q.rows.map((r) => ({
      month: r.m, cells: [r.lines, r.nil, pct(r.nil, r.lines)] as Cell[],
    }));
    return {
      columns: [
        { key: "lines", label: t(locale, "Lines", "Lignes") },
        { key: "nil", label: t(locale, "Nil-value lines", "Lignes de valeur nulle") },
        { key: "sharePct", label: t(locale, "% of lines", "% des lignes") },
      ],
      rows,
      totals: [sum(rows, 0), sum(rows, 1), pct(sum(rows, 1), sum(rows, 0))],
      exceptions: sum(rows, 1),
      population: sum(rows, 0),
    };
  },

  // 6 ------------------------------------------------------------------
  "invalid-debit-credit": async (tx, { datasetId, engagementId, locale }) => {
    const q = await tx.query<{ m: string; lines: number; both: number; negative: number; neither: number }>(
      `SELECT ${MONTH} AS m, count(*)::int AS lines,
              count(*) FILTER (WHERE debit <> 0 AND credit <> 0)::int AS both,
              count(*) FILTER (WHERE debit < 0 OR credit < 0)::int AS negative,
              count(*) FILTER (WHERE debit = 0 AND credit = 0)::int AS neither
         FROM gl_line WHERE ${SCOPE} GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId],
    );
    const rows = q.rows.map((r) => ({
      month: r.m,
      cells: [r.lines, r.both, r.negative, r.neither, r.both + r.negative + r.neither] as Cell[],
    }));
    return {
      columns: [
        { key: "lines", label: t(locale, "Lines", "Lignes") },
        { key: "both", label: t(locale, "Both sides posted", "Deux côtés servis") },
        { key: "negative", label: t(locale, "Negative side", "Côté négatif") },
        { key: "neither", label: t(locale, "Neither side posted", "Aucun côté servi") },
        { key: "exceptions", label: t(locale, "Exceptions", "Exceptions") },
      ],
      rows,
      totals: [sum(rows, 0), sum(rows, 1), sum(rows, 2), sum(rows, 3), sum(rows, 4)],
      exceptions: sum(rows, 4),
      population: sum(rows, 0),
      note: t(locale,
        "A well-formed line carries a positive value on exactly one side.",
        "Une ligne bien formée porte une valeur positive d'un seul côté."),
    };
  },

  // 7 ------------------------------------------------------------------
  "weekend-postings": async (tx, { datasetId, engagementId, locale }) => {
    const q = await tx.query<Record<string, number | string>>(
      `SELECT ${MONTH} AS m,
              count(*) FILTER (WHERE extract(isodow FROM journal_date) = 1)::int AS d1,
              count(*) FILTER (WHERE extract(isodow FROM journal_date) = 2)::int AS d2,
              count(*) FILTER (WHERE extract(isodow FROM journal_date) = 3)::int AS d3,
              count(*) FILTER (WHERE extract(isodow FROM journal_date) = 4)::int AS d4,
              count(*) FILTER (WHERE extract(isodow FROM journal_date) = 5)::int AS d5,
              count(*) FILTER (WHERE extract(isodow FROM journal_date) = 6)::int AS d6,
              count(*) FILTER (WHERE extract(isodow FROM journal_date) = 7)::int AS d7,
              count(*)::int AS lines
         FROM gl_line WHERE ${SCOPE} GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId],
    );
    const names = locale === "fr"
      ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const rows = q.rows.map((r) => {
      const days = [1, 2, 3, 4, 5, 6, 7].map((i) => Number(r[`d${i}`] ?? 0));
      const weekend = days[5] + days[6];
      return { month: String(r.m), cells: [...days, weekend, pct(weekend, Number(r.lines))] as Cell[] };
    });
    const weekendTotal = sum(rows, 7);
    const lineTotal = [0, 1, 2, 3, 4, 5, 6].reduce((acc, i) => acc + sum(rows, i), 0);
    return {
      columns: [
        ...names.map((label, i) => ({ key: `d${i + 1}`, label })),
        { key: "weekend", label: t(locale, "Weekend", "Week-end") },
        { key: "weekendPct", label: t(locale, "% weekend", "% week-end") },
      ],
      rows,
      totals: [...[0, 1, 2, 3, 4, 5, 6].map((i) => sum(rows, i)), weekendTotal, pct(weekendTotal, lineTotal)],
      exceptions: weekendTotal,
      population: lineTotal,
      note: t(locale,
        "Lines with no readable journal date fall outside every weekday column and are shown in the n/a row.",
        "Les lignes sans date de journal lisible ne figurent dans aucune colonne de jour et apparaissent dans la ligne n/a."),
    };
  },

  // 8 ------------------------------------------------------------------
  "entry-date-lag": async (tx, { datasetId, engagementId, locale }) => {
    const q = await tx.query<{
      m: string; entries: number; same: number; one: number; short: number;
      long: number; negative: number; avg: number | null; max: number | null;
    }>(
      `WITH je AS (
         SELECT je_number, min(journal_date) AS jd, min(entry_date) AS ed
           FROM gl_line
          WHERE ${SCOPE} AND journal_date IS NOT NULL AND entry_date IS NOT NULL
          GROUP BY je_number)
       SELECT to_char(jd, 'YYYY-MM') AS m, count(*)::int AS entries,
              count(*) FILTER (WHERE ed - jd = 0)::int AS same,
              count(*) FILTER (WHERE ed - jd = 1)::int AS one,
              count(*) FILTER (WHERE ed - jd BETWEEN 2 AND 3)::int AS short,
              count(*) FILTER (WHERE ed - jd > 3)::int AS long,
              count(*) FILTER (WHERE ed - jd < 0)::int AS negative,
              avg(ed - jd)::float8 AS avg, max(ed - jd)::float8 AS max
         FROM je GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId],
    );
    const rows = q.rows.map((r) => ({
      month: r.m,
      cells: [r.entries, r.same, r.one, r.short, r.long, r.negative,
        r.avg === null ? null : round2(r.avg), r.max === null ? null : Math.round(r.max)] as Cell[],
    }));
    const exceptions = sum(rows, 4) + sum(rows, 5);
    const totalEntries = sum(rows, 0);
    const weightedAvg = totalEntries === 0 ? null
      : round2(rows.reduce((acc, r) => acc + (Number(r.cells[6] ?? 0) * Number(r.cells[0] ?? 0)), 0) / totalEntries);
    const maxAll = rows.reduce((acc, r) => Math.max(acc, Number(r.cells[7] ?? 0)), 0);
    return {
      columns: [
        { key: "entries", label: t(locale, "Entries", "Écritures") },
        { key: "sameDay", label: t(locale, "Same day", "Le jour même") },
        { key: "oneDay", label: t(locale, "1 day", "1 jour") },
        { key: "twoThree", label: t(locale, "2–3 days", "2–3 jours") },
        { key: "overThree", label: t(locale, "Over 3 days", "Plus de 3 jours") },
        { key: "negative", label: t(locale, "Recorded before", "Saisie antérieure") },
        { key: "avgDays", label: t(locale, "Average days", "Moyenne (jours)") },
        { key: "maxDays", label: t(locale, "Longest lag", "Décalage maximal") },
      ],
      rows,
      totals: [totalEntries, sum(rows, 1), sum(rows, 2), sum(rows, 3), sum(rows, 4), sum(rows, 5), weightedAvg, maxAll],
      exceptions,
      population: totalEntries,
      note: t(locale,
        "Measured per journal entry, using the earliest journal date and earliest entry date of its lines. Entries missing either date are outside the population.",
        "Mesuré par écriture, à partir de la date de journal et de la date de saisie les plus anciennes de ses lignes. Les écritures dépourvues de l'une des dates sont hors population."),
    };
  },

  // 9 ------------------------------------------------------------------
  "year-end-concentration": async (tx, { datasetId, engagementId, locale, params }) => {
    const days = clampInt(params.yearEndDays, 1, 90, 15);
    const q = await tx.query<{ m: string; lines: number; value: number; wlines: number; wvalue: number }>(
      `WITH p AS (SELECT period_end AS pe FROM engagement WHERE id = $2),
       scoped AS (
         SELECT ${MONTH} AS m, l.signed,
                (l.journal_date IS NOT NULL
                 AND l.journal_date > p.pe - ($3::int)
                 AND l.journal_date <= p.pe) AS in_window
           FROM gl_line l CROSS JOIN p
          WHERE l.dataset_id = $1 AND l.engagement_id = $2)
       SELECT m, count(*)::int AS lines,
              coalesce(sum(abs(signed)), 0)::float8 AS value,
              count(*) FILTER (WHERE in_window)::int AS wlines,
              coalesce(sum(abs(signed)) FILTER (WHERE in_window), 0)::float8 AS wvalue
         FROM scoped GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId, days],
    );
    const totalValue = q.rows.reduce((acc, r) => acc + r.value, 0);
    const rows = q.rows.map((r) => ({
      month: r.m,
      cells: [r.lines, round2(r.value), pct(r.value, totalValue), r.wlines, round2(r.wvalue)] as Cell[],
    }));
    return {
      columns: [
        { key: "lines", label: t(locale, "Lines", "Lignes") },
        { key: "value", label: t(locale, "Gross value", "Valeur brute") },
        { key: "sharePct", label: t(locale, "% of year value", "% de la valeur annuelle") },
        { key: "closingLines", label: t(locale, `Lines in last ${days} days`, `Lignes des ${days} derniers jours`) },
        { key: "closingValue", label: t(locale, "Closing-window value", "Valeur de la fenêtre de clôture") },
      ],
      rows,
      totals: [sum(rows, 0), round2(sum(rows, 1)), pct(totalValue, totalValue), sum(rows, 3), round2(sum(rows, 4))],
      exceptions: sum(rows, 3),
      population: sum(rows, 0),
      note: t(locale,
        `The closing window is the last ${days} days of the engagement period. Concentration there is a risk indicator requiring audit consideration, not a finding in itself.`,
        `La fenêtre de clôture correspond aux ${days} derniers jours de la période. Une concentration à cet endroit est un indicateur de risque à examiner, non un constat en soi.`),
    };
  },

  // 10 -----------------------------------------------------------------
  "monthly-spikes": async (tx, { datasetId, engagementId, locale, params }) => {
    const factor = clampNumber(params.sdFactor, 0.5, 6, 2);
    const q = await tx.query<{ m: string; lines: number; value: number; mu: number; sd: number }>(
      `WITH mth AS (
         SELECT to_char(journal_date, 'YYYY-MM') AS m, count(*)::int AS lines,
                coalesce(sum(abs(signed)), 0)::float8 AS value
           FROM gl_line WHERE ${SCOPE} AND journal_date IS NOT NULL GROUP BY 1),
       s AS (SELECT avg(value)::float8 AS mu, coalesce(stddev_samp(value), 0)::float8 AS sd FROM mth)
       SELECT mth.m, mth.lines, mth.value, s.mu, s.sd FROM mth, s ORDER BY mth.m`,
      [datasetId, engagementId],
    );
    const rows = q.rows.map((r) => {
      const threshold = r.mu + factor * r.sd;
      return {
        month: r.m,
        cells: [r.lines, round2(r.value), round2(r.mu), round2(r.sd), round2(threshold),
          r.value > threshold ? 1 : 0] as Cell[],
      };
    });
    return {
      columns: [
        { key: "lines", label: t(locale, "Lines", "Lignes") },
        { key: "value", label: t(locale, "Gross value", "Valeur brute") },
        { key: "mean", label: t(locale, "Mean month", "Moyenne mensuelle") },
        { key: "sd", label: t(locale, "Standard deviation", "Écart-type") },
        { key: "threshold", label: t(locale, `Mean + ${factor} sd`, `Moyenne + ${factor} écarts-types`) },
        { key: "flag", label: t(locale, "Above threshold", "Au-dessus du seuil") },
      ],
      rows,
      totals: [sum(rows, 0), round2(sum(rows, 1)), null, null, null, sum(rows, 5)],
      exceptions: sum(rows, 5),
      population: rows.length,
      note: t(locale,
        "Undated lines are excluded: they cannot belong to a month, and including them would distort the mean.",
        "Les lignes non datées sont exclues : elles n'appartiennent à aucun mois et fausseraient la moyenne."),
    };
  },

  // 11 -----------------------------------------------------------------
  "top-value": async (tx, { datasetId, engagementId, locale, params }) => {
    const p = clampNumber(params.percentile, 0.5, 0.9999, 0.99);
    const q = await tx.query<{ m: string; lines: number; value: number; hits: number; hitValue: number; threshold: number }>(
      `WITH thr AS (
         SELECT coalesce(percentile_cont($3::float8) WITHIN GROUP (ORDER BY abs(signed)::float8), 0)::float8 AS p
           FROM gl_line WHERE ${SCOPE}),
       scoped AS (
         SELECT ${MONTH} AS m, abs(l.signed)::float8 AS a, thr.p
           FROM gl_line l CROSS JOIN thr
          WHERE l.dataset_id = $1 AND l.engagement_id = $2)
       SELECT m, count(*)::int AS lines,
              coalesce(sum(a), 0)::float8 AS value,
              count(*) FILTER (WHERE a >= p)::int AS "hits",
              coalesce(sum(a) FILTER (WHERE a >= p), 0)::float8 AS "hitValue",
              min(p)::float8 AS threshold
         FROM scoped GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId, p],
    );
    const rows = q.rows.map((r) => ({
      month: r.m,
      cells: [r.lines, r.hits, round2(r.hitValue), pct(r.hitValue, r.value)] as Cell[],
    }));
    const threshold = q.rows[0]?.threshold ?? 0;
    return {
      columns: [
        { key: "lines", label: t(locale, "Lines", "Lignes") },
        { key: "hits", label: t(locale, "Lines above threshold", "Lignes au-dessus du seuil") },
        { key: "hitValue", label: t(locale, "Their gross value", "Leur valeur brute") },
        { key: "sharePct", label: t(locale, "% of month value", "% de la valeur du mois") },
      ],
      rows,
      totals: [sum(rows, 0), sum(rows, 1), round2(sum(rows, 2)), null],
      exceptions: sum(rows, 1),
      population: sum(rows, 0),
      note: t(locale,
        `Threshold: the ${round2(p * 100)}th percentile of absolute line amounts, ${round2(threshold)}.`,
        `Seuil : ${round2(p * 100)}e centile des montants absolus, soit ${round2(threshold)}.`),
    };
  },

  // 12 -----------------------------------------------------------------
  "round-numbers": async (tx, { datasetId, engagementId, locale, params }) => {
    const min = clampNumber(params.roundMin, 1, 1e15, 100000);
    const step = clampNumber(params.roundStep, 1, 1e15, 100000);
    const q = await tx.query<{ m: string; lines: number; hits: number; value: number }>(
      `SELECT ${MONTH} AS m, count(*)::int AS lines,
              count(*) FILTER (WHERE abs(signed) >= $3::numeric AND mod(abs(signed), $4::numeric) = 0)::int AS hits,
              coalesce(sum(abs(signed)) FILTER (WHERE abs(signed) >= $3::numeric AND mod(abs(signed), $4::numeric) = 0), 0)::float8 AS value
         FROM gl_line WHERE ${SCOPE} GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId, min, step],
    );
    const rows = q.rows.map((r) => ({
      month: r.m, cells: [r.lines, r.hits, round2(r.value), pct(r.hits, r.lines)] as Cell[],
    }));
    return {
      columns: [
        { key: "lines", label: t(locale, "Lines", "Lignes") },
        { key: "hits", label: t(locale, "Round-amount lines", "Lignes à montant rond") },
        { key: "value", label: t(locale, "Their gross value", "Leur valeur brute") },
        { key: "sharePct", label: t(locale, "% of lines", "% des lignes") },
      ],
      rows,
      totals: [sum(rows, 0), sum(rows, 1), round2(sum(rows, 2)), pct(sum(rows, 1), sum(rows, 0))],
      exceptions: sum(rows, 1),
      population: sum(rows, 0),
      note: t(locale,
        `Criteria: absolute amount at least ${min} and an exact multiple of ${step}.`,
        `Critères : montant absolu d'au moins ${min} et multiple exact de ${step}.`),
    };
  },

  // 13 -----------------------------------------------------------------
  benford: async (tx, { datasetId, engagementId, locale }) => {
    const q = await tx.query<{ m: string; digit: string; n: number }>(
      `SELECT ${MONTH} AS m,
              substring(regexp_replace(abs(signed)::text, '[^1-9]', '', 'g') FROM 1 FOR 1) AS digit,
              count(*)::int AS n
         FROM gl_line WHERE ${SCOPE} AND signed <> 0
        GROUP BY 1, 2 ORDER BY 1, 2`,
      [datasetId, engagementId],
    );
    const byMonth = new Map<string, number[]>();
    for (const r of q.rows) {
      const digit = Number(r.digit);
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) continue;
      const arr = byMonth.get(r.m) ?? Array.from({ length: 9 }, () => 0);
      arr[digit - 1] += r.n;
      byMonth.set(r.m, arr);
    }
    const madOf = (counts: number[]): number | null => {
      const total = counts.reduce((s, v) => s + v, 0);
      if (total === 0) return null;
      const dev = counts.reduce((s, v, i) => s + Math.abs((v / total) * 100 - BENFORD[i]), 0);
      return round2(dev / 9);
    };
    const rows: AnalyticRow[] = [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, counts]) => {
        const total = counts.reduce((s, v) => s + v, 0);
        return {
          month,
          cells: [...counts.map((v) => pct(v, total)), total, madOf(counts)] as Cell[],
        };
      });
    const overall = Array.from({ length: 9 }, (_, i) =>
      [...byMonth.values()].reduce((s, arr) => s + arr[i], 0));
    const overallTotal = overall.reduce((s, v) => s + v, 0);
    const exceptions = rows.filter((r) => typeof r.cells[10] === "number" && (r.cells[10] as number) > 1.5).length;
    return {
      columns: [
        ...Array.from({ length: 9 }, (_, i) => ({ key: `d${i + 1}`, label: `${i + 1} %` })),
        { key: "lines", label: t(locale, "Lines", "Lignes") },
        { key: "mad", label: t(locale, "MAD (pts)", "EAM (pts)") },
      ],
      rows,
      totals: [...overall.map((v) => pct(v, overallTotal)), overallTotal, madOf(overall)],
      exceptions,
      population: rows.length,
      note: t(locale,
        `Expected first-digit shares: ${BENFORD.map((v, i) => `${i + 1}=${round2(v)}%`).join(", ")}. A mean absolute deviation above 1.5 points is a risk indicator requiring audit consideration, not a conclusion; nil amounts are outside the population.`,
        `Parts attendues du premier chiffre : ${BENFORD.map((v, i) => `${i + 1}=${round2(v)} %`).join(", ")}. Un écart absolu moyen supérieur à 1,5 point est un indicateur de risque à examiner, non une conclusion ; les montants nuls sont hors population.`),
    };
  },

  // 14 -----------------------------------------------------------------
  "repeated-amounts": async (tx, { datasetId, engagementId, locale, params }) => {
    const minOcc = clampInt(params.minOccurrences, 2, 10000, 10);
    const q = await tx.query<{ m: string; amounts: number; lines: number; value: number }>(
      `WITH rep AS (
         SELECT abs(signed) AS a FROM gl_line
          WHERE ${SCOPE} AND signed <> 0
          GROUP BY 1 HAVING count(*) >= $3::int)
       SELECT ${MONTH} AS m, count(DISTINCT abs(l.signed))::int AS amounts,
              count(*)::int AS lines, coalesce(sum(abs(l.signed)), 0)::float8 AS value
         FROM gl_line l JOIN rep ON rep.a = abs(l.signed)
        WHERE l.dataset_id = $1 AND l.engagement_id = $2
        GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId, minOcc],
    );
    const pop = await tx.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM gl_line WHERE ${SCOPE}`, [datasetId, engagementId],
    );
    const rows = q.rows.map((r) => ({
      month: r.m, cells: [r.amounts, r.lines, round2(r.value)] as Cell[],
    }));
    return {
      columns: [
        { key: "amounts", label: t(locale, "Distinct repeated amounts", "Montants répétés distincts") },
        { key: "lines", label: t(locale, "Lines", "Lignes") },
        { key: "value", label: t(locale, "Gross value", "Valeur brute") },
      ],
      rows,
      totals: [null, sum(rows, 1), round2(sum(rows, 2))],
      exceptions: sum(rows, 1),
      population: pop.rows[0]?.n ?? 0,
      note: t(locale,
        `An amount counts as repeated when it appears at least ${minOcc} times across the year; the monthly distinct count is not additive, so no total is shown for it.`,
        `Un montant est réputé répété lorsqu'il apparaît au moins ${minOcc} fois dans l'année ; le nombre mensuel de montants distincts n'est pas additif, aucun total n'est donc affiché.`),
    };
  },

  // 15 -----------------------------------------------------------------
  "rare-accounts": async (tx, { datasetId, engagementId, locale, params }) => {
    const maxPostings = clampInt(params.rareMax, 1, 100, 3);
    const q = await tx.query<{ m: string; accounts: number; lines: number; value: number }>(
      `WITH rare AS (
         SELECT account FROM gl_line WHERE ${SCOPE}
          GROUP BY account HAVING count(*) <= $3::int)
       SELECT ${MONTH} AS m, count(DISTINCT l.account)::int AS accounts,
              count(*)::int AS lines, coalesce(sum(abs(l.signed)), 0)::float8 AS value
         FROM gl_line l JOIN rare ON rare.account = l.account
        WHERE l.dataset_id = $1 AND l.engagement_id = $2
        GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId, maxPostings],
    );
    const pop = await tx.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM gl_line WHERE ${SCOPE}`, [datasetId, engagementId],
    );
    const rows = q.rows.map((r) => ({
      month: r.m, cells: [r.accounts, r.lines, round2(r.value)] as Cell[],
    }));
    return {
      columns: [
        { key: "accounts", label: t(locale, "Rare accounts touched", "Comptes rares mouvementés") },
        { key: "lines", label: t(locale, "Lines", "Lignes") },
        { key: "value", label: t(locale, "Gross value", "Valeur brute") },
      ],
      rows,
      totals: [null, sum(rows, 1), round2(sum(rows, 2))],
      exceptions: sum(rows, 1),
      population: pop.rows[0]?.n ?? 0,
      note: t(locale,
        `An account is rare when it carries at most ${maxPostings} postings in the whole ledger. The monthly account count is not additive across months.`,
        `Un compte est rare lorsqu'il porte au plus ${maxPostings} comptabilisations sur l'ensemble du grand livre. Le nombre mensuel de comptes n'est pas additif.`),
    };
  },

  // 16 -----------------------------------------------------------------
  "normal-side-exceptions": async (tx, { datasetId, engagementId, locale }) => {
    const q = await tx.query<{ m: string; inScope: number; credited: number; debited: number; value: number }>(
      `WITH sided AS (
         SELECT ${MONTH} AS m, signed,
                CASE WHEN left(account, 1) IN ('2','3','5','6') THEN 1
                     WHEN left(account, 1) IN ('1','7') THEN -1
                     ELSE 0 END AS side
           FROM gl_line WHERE ${SCOPE})
       SELECT m, count(*) FILTER (WHERE side <> 0)::int AS "inScope",
              count(*) FILTER (WHERE side = 1 AND signed < 0)::int AS credited,
              count(*) FILTER (WHERE side = -1 AND signed > 0)::int AS debited,
              coalesce(sum(abs(signed)) FILTER (
                WHERE (side = 1 AND signed < 0) OR (side = -1 AND signed > 0)), 0)::float8 AS value
         FROM sided GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId],
    );
    const rows = q.rows.map((r) => ({
      month: r.m,
      cells: [r.inScope, r.credited, r.debited, r.credited + r.debited, round2(r.value)] as Cell[],
    }));
    return {
      columns: [
        { key: "inScope", label: t(locale, "Lines in scope", "Lignes dans le périmètre") },
        { key: "credited", label: t(locale, "Debit-side accounts credited", "Comptes débiteurs crédités") },
        { key: "debited", label: t(locale, "Credit-side accounts debited", "Comptes créditeurs débités") },
        { key: "exceptions", label: t(locale, "Exceptions", "Exceptions") },
        { key: "value", label: t(locale, "Their gross value", "Leur valeur brute") },
      ],
      rows,
      totals: [sum(rows, 0), sum(rows, 1), sum(rows, 2), sum(rows, 3), round2(sum(rows, 4))],
      exceptions: sum(rows, 3),
      population: sum(rows, 0),
      note: t(locale,
        "SYSCOHADA normal sides: classes 2, 3, 5 and 6 are debit accounts; classes 1 and 7 are credit accounts. Class 4 (third parties) and classes 8–9 are two-sided by design and are outside the population. A contra posting is often a legitimate reversal — it is an exception to explain, not an error.",
        "Sens normaux SYSCOHADA : les classes 2, 3, 5 et 6 sont débitrices ; les classes 1 et 7 sont créditrices. La classe 4 (tiers) et les classes 8–9 sont bilatérales par nature et hors population. Une comptabilisation à contre-sens est souvent une contrepassation légitime : c'est une exception à expliquer, non une erreur."),
    };
  },

  // 18 -----------------------------------------------------------------
  "missing-mandatory-fields": async (tx, { datasetId, engagementId, locale }) => {
    const q = await tx.query<{ m: string; lines: number; noAccount: number; noJe: number; noDesc: number; noDate: number; noAmount: number }>(
      `SELECT ${MONTH} AS m, count(*)::int AS lines,
              count(*) FILTER (WHERE coalesce(trim(account), '') = '')::int        AS "noAccount",
              count(*) FILTER (WHERE coalesce(trim(je_number), '') = '')::int      AS "noJe",
              count(*) FILTER (WHERE coalesce(trim(je_description), '') = '')::int AS "noDesc",
              count(*) FILTER (WHERE journal_date IS NULL)::int                    AS "noDate",
              count(*) FILTER (WHERE debit = 0 AND credit = 0)::int                AS "noAmount"
         FROM gl_line WHERE ${SCOPE} GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId],
    );
    const rows = q.rows.map((r) => ({
      month: r.m,
      cells: [r.lines, r.noAccount, r.noJe, r.noDesc, r.noDate, r.noAmount,
        r.noAccount + r.noJe + r.noDesc + r.noDate + r.noAmount] as Cell[],
    }));
    return {
      columns: [
        { key: "lines", label: t(locale, "Lines", "Lignes") },
        { key: "noAccount", label: t(locale, "No account", "Sans compte") },
        { key: "noJe", label: t(locale, "No JE number", "Sans numéro d'écriture") },
        { key: "noDesc", label: t(locale, "No description", "Sans libellé") },
        { key: "noDate", label: t(locale, "No readable date", "Date illisible") },
        { key: "noAmount", label: t(locale, "No amount", "Sans montant") },
        { key: "exceptions", label: t(locale, "Field gaps", "Champs manquants") },
      ],
      rows,
      totals: [0, 1, 2, 3, 4, 5, 6].map((i) => sum(rows, i)),
      exceptions: sum(rows, 6),
      population: sum(rows, 0),
      note: t(locale,
        "The exception column counts field gaps, not lines: one line missing two fields contributes twice.",
        "La colonne des exceptions compte les champs manquants, non les lignes : une ligne à laquelle manquent deux champs compte deux fois."),
    };
  },

  // 19 -----------------------------------------------------------------
  "missing-references": async (tx, { datasetId, engagementId, locale }) => {
    const q = await tx.query<{ m: string; lines: number; missing: number; value: number }>(
      `SELECT ${MONTH} AS m, count(*)::int AS lines,
              count(*) FILTER (WHERE coalesce(trim(reference), '') = '')::int AS missing,
              coalesce(sum(abs(signed)) FILTER (WHERE coalesce(trim(reference), '') = ''), 0)::float8 AS value
         FROM gl_line WHERE ${SCOPE} GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId],
    );
    const rows = q.rows.map((r) => ({
      month: r.m, cells: [r.lines, r.missing, round2(r.value), pct(r.missing, r.lines)] as Cell[],
    }));
    return {
      columns: [
        { key: "lines", label: t(locale, "Lines", "Lignes") },
        { key: "missing", label: t(locale, "No reference", "Sans référence") },
        { key: "value", label: t(locale, "Their gross value", "Leur valeur brute") },
        { key: "sharePct", label: t(locale, "% of lines", "% des lignes") },
      ],
      rows,
      totals: [sum(rows, 0), sum(rows, 1), round2(sum(rows, 2)), pct(sum(rows, 1), sum(rows, 0))],
      exceptions: sum(rows, 1),
      population: sum(rows, 0),
    };
  },

  // 20 -----------------------------------------------------------------
  "third-party-attribution": async (tx, { datasetId, engagementId, locale, params }) => {
    const prefixes = cleanPrefixes(params.prefixes);
    const q = await tx.query<{ m: string; inScope: number; attributed: number; value: number; unattributedValue: number }>(
      `WITH scoped AS (
         SELECT ${MONTH} AS m, signed, third_party_code
           FROM gl_line
          WHERE ${SCOPE}
            AND EXISTS (SELECT 1 FROM unnest($3::text[]) p WHERE account LIKE p || '%'))
       SELECT m, count(*)::int AS "inScope",
              count(*) FILTER (WHERE coalesce(trim(third_party_code), '') <> '')::int AS attributed,
              coalesce(sum(abs(signed)), 0)::float8 AS value,
              coalesce(sum(abs(signed)) FILTER (WHERE coalesce(trim(third_party_code), '') = ''), 0)::float8 AS "unattributedValue"
         FROM scoped GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId, prefixes],
    );
    const rows = q.rows.map((r) => ({
      month: r.m,
      cells: [r.inScope, r.attributed, r.inScope - r.attributed,
        pct(r.attributed, r.inScope), round2(r.unattributedValue)] as Cell[],
    }));
    return {
      columns: [
        { key: "inScope", label: t(locale, "Lines in scope", "Lignes dans le périmètre") },
        { key: "attributed", label: t(locale, "With third party", "Avec tiers") },
        { key: "unattributed", label: t(locale, "Without third party", "Sans tiers") },
        { key: "attributedPct", label: t(locale, "% attributed", "% attribuées") },
        { key: "unattributedValue", label: t(locale, "Unattributed value", "Valeur non attribuée") },
      ],
      rows,
      totals: [sum(rows, 0), sum(rows, 1), sum(rows, 2), pct(sum(rows, 1), sum(rows, 0)), round2(sum(rows, 4))],
      exceptions: sum(rows, 2),
      population: sum(rows, 0),
      note: t(locale,
        `Population restricted to accounts beginning ${prefixes.join(", ")} — receivables and payables, the only balances a counterparty code is meaningful for. Percentages are measured against that in-scope population, never the whole ledger.`,
        `Population limitée aux comptes commençant par ${prefixes.join(", ")} — clients et fournisseurs, seuls soldes pour lesquels un code tiers a un sens. Les pourcentages sont rapportés à cette population, jamais au grand livre entier.`),
    };
  },

  // 21 -----------------------------------------------------------------
  "preparer-volume": (tx, args) => byPerson(tx, args, "preparer", "count"),
  // 22 -----------------------------------------------------------------
  "preparer-value": (tx, args) => byPerson(tx, args, "preparer", "value"),
  // 23 -----------------------------------------------------------------
  "reviewer-workload": (tx, args) => byPerson(tx, args, "reviewer", "count"),

  // 29 -----------------------------------------------------------------
  "debit-credit-correlation": async (tx, { datasetId, engagementId, locale }) => {
    const q = await tx.query<{ m: string; d: number; c: number }>(
      `SELECT ${MONTH} AS m, coalesce(sum(debit), 0)::float8 AS d, coalesce(sum(credit), 0)::float8 AS c
         FROM gl_line WHERE ${SCOPE} GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId],
    );
    const rows = q.rows.map((r) => ({
      month: r.m,
      cells: [round2(r.d), round2(r.c), round2(r.d - r.c),
        r.c === 0 ? null : round2(r.d / r.c)] as Cell[],
    }));
    const r = pearson(q.rows.map((x) => x.d), q.rows.map((x) => x.c));
    const exceptions = q.rows.filter((x) => Math.abs(x.d - x.c) > TOLERANCE).length;
    return {
      columns: [
        { key: "debit", label: t(locale, "Debit", "Débit") },
        { key: "credit", label: t(locale, "Credit", "Crédit") },
        { key: "difference", label: t(locale, "Difference", "Écart") },
        { key: "ratio", label: t(locale, "Debit / credit", "Débit / crédit") },
      ],
      rows,
      totals: [round2(sum(rows, 0)), round2(sum(rows, 1)), round2(sum(rows, 2)), null],
      exceptions,
      population: rows.length,
      note: t(locale,
        `Pearson correlation of monthly debit and credit totals: ${r === null ? "not computable (a series has no variance or too few months)" : r}. The ratio is null where the month has no credits, never infinity.`,
        `Corrélation de Pearson des totaux mensuels de débits et de crédits : ${r === null ? "non calculable (série sans variance ou trop peu de mois)" : String(r).replace(".", ",")}. Le ratio est nul lorsque le mois ne comporte aucun crédit, jamais infini.`),
    };
  },

  // 30 -----------------------------------------------------------------
  "account-frequency-value": async (tx, { datasetId, engagementId, locale }) => {
    const q = await tx.query<{ m: string; accounts: number; entries: number; lines: number; value: number }>(
      `SELECT ${MONTH} AS m, count(DISTINCT account)::int AS accounts,
              count(DISTINCT je_number)::int AS entries, count(*)::int AS lines,
              coalesce(sum(abs(signed)), 0)::float8 AS value
         FROM gl_line WHERE ${SCOPE} GROUP BY 1 ORDER BY 1`,
      [datasetId, engagementId],
    );
    const rows = q.rows.map((r) => ({
      month: r.m,
      cells: [r.accounts, r.entries, r.lines, round2(r.value),
        r.accounts === 0 ? null : round2(r.lines / r.accounts),
        r.lines === 0 ? null : round2(r.value / r.lines)] as Cell[],
    }));
    const totalLines = sum(rows, 2);
    const totalValue = sum(rows, 3);
    return {
      columns: [
        { key: "accounts", label: t(locale, "Accounts touched", "Comptes mouvementés") },
        { key: "entries", label: t(locale, "Entries", "Écritures") },
        { key: "lines", label: t(locale, "Lines", "Lignes") },
        { key: "value", label: t(locale, "Gross value", "Valeur brute") },
        { key: "linesPerAccount", label: t(locale, "Lines per account", "Lignes par compte") },
        { key: "valuePerLine", label: t(locale, "Value per line", "Valeur par ligne") },
      ],
      rows,
      totals: [null, sum(rows, 1), totalLines, round2(totalValue), null,
        totalLines === 0 ? null : round2(totalValue / totalLines)],
      exceptions: 0,
      population: totalLines,
      note: t(locale,
        "Informational profile — it carries no exception condition. Account and entry counts are per month and are not additive across months, so no total is shown for accounts.",
        "Profil informatif — sans condition d'exception. Les nombres de comptes et d'écritures sont mensuels et non additifs ; aucun total n'est donc affiché pour les comptes."),
    };
  },
};

/**
 * Shared shape for the attribution analytics (21, 22, 23): months down the
 * side, the busiest named people across the top, everything else folded into
 * "Other", and unattributed lines given their own column so the gap in the
 * audit trail is visible rather than averaged away.
 */
async function byPerson(
  tx: Tx,
  { datasetId, engagementId, locale, params }: ImplArgs,
  column: "preparer" | "reviewer",
  measure: "count" | "value",
): Promise<Body> {
  const topN = clampInt(params.topN, 1, 30, 10);
  const metric = measure === "count" ? "count(*)::float8" : "coalesce(sum(abs(signed)), 0)::float8";

  const top = await tx.query<{ person: string; v: number }>(
    `SELECT trim(${column}) AS person, ${metric} AS v
       FROM gl_line
      WHERE ${SCOPE} AND coalesce(trim(${column}), '') <> ''
      GROUP BY 1 ORDER BY v DESC, 1 LIMIT $3::int`,
    [datasetId, engagementId, topN],
  );
  const named = top.rows.map((r) => r.person);

  const grid = await tx.query<{ m: string; person: string | null; v: number }>(
    `SELECT ${MONTH} AS m, nullif(trim(${column}), '') AS person, ${metric} AS v
       FROM gl_line WHERE ${SCOPE} GROUP BY 1, 2 ORDER BY 1`,
    [datasetId, engagementId],
  );

  const months = [...new Set(grid.rows.map((r) => r.m))].sort();
  const index = new Map(named.map((n, i) => [n, i]));
  const width = named.length + 2; // named people + Other + Unattributed
  const byMonth = new Map<string, number[]>(months.map((m) => [m, Array.from({ length: width }, () => 0)]));
  for (const r of grid.rows) {
    const arr = byMonth.get(r.m)!;
    if (r.person === null) {
      arr[width - 1] += r.v;
    } else {
      const i = index.get(r.person);
      arr[i === undefined ? width - 2 : i] += r.v;
    }
  }

  const rows: AnalyticRow[] = months.map((m) => {
    const arr = byMonth.get(m)!;
    const cells = arr.map((v) => (measure === "count" ? v : round2(v))) as Cell[];
    cells.push(round2(arr.reduce((s, v) => s + v, 0)));
    return { month: m, cells };
  });

  const otherLabel = t(locale, "Other", "Autres");
  const unLabel = t(locale, "Unattributed", "Non attribué");
  const columns: AnalyticColumn[] = [
    ...named.map((n, i) => ({ key: `p${i}`, label: n })),
    { key: "other", label: otherLabel },
    { key: "unattributed", label: unLabel },
    { key: "total", label: t(locale, "Total", "Total") },
  ];
  const totals = columns.map((_, i) => round2(sum(rows, i)));

  // exceptions are always lines with nobody recorded, whichever measure is shown
  const gap = await tx.query<{ missing: number; lines: number }>(
    `SELECT count(*) FILTER (WHERE coalesce(trim(${column}), '') = '')::int AS missing,
            count(*)::int AS lines
       FROM gl_line WHERE ${SCOPE}`,
    [datasetId, engagementId],
  );

  const measureNote = measure === "count"
    ? t(locale, "Cells are line counts.", "Les cellules sont des nombres de lignes.")
    : t(locale, "Cells are gross posted value.", "Les cellules sont des valeurs brutes comptabilisées.");
  return {
    columns,
    rows,
    totals,
    exceptions: gap.rows[0]?.missing ?? 0,
    population: gap.rows[0]?.lines ?? 0,
    note: `${measureNote} ${t(locale,
      `The ${named.length} busiest people have their own column; everyone else is folded into "${otherLabel}". Lines with nobody recorded are shown under "${unLabel}" and are the exception count.`,
      `Les ${named.length} personnes les plus actives ont leur propre colonne ; les autres sont regroupées sous « ${otherLabel} ». Les lignes sans personne enregistrée figurent sous « ${unLabel} » et constituent le nombre d'exceptions.`)}`,
  };
}

// ---------------------------------------------------------------------------
// input guards

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Account prefixes are pasted into a LIKE pattern, so they must be digits only. */
function cleanPrefixes(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];
  const cleaned = raw
    .map((p) => String(p).trim())
    .filter((p) => /^[0-9]{1,6}$/.test(p))
    .slice(0, 12);
  return cleaned.length > 0 ? [...new Set(cleaned)] : ["40", "41"];
}

// ---------------------------------------------------------------------------
// entry point

/** Is every mapping key this analytic needs actually present on the dataset? */
export function missingFields(def: AnalyticDef, fields: Set<string>): string[] {
  return def.requiredFields.filter((f) => {
    if (f === "amount") return !fields.has("signedAmount");
    if (f === "preparer") return !fields.has("preparer");
    return !fields.has(f);
  });
}

/**
 * Run one analytic against the projected ledger. Returns an honest
 * `unavailable` result — never a partial or misleading table — when the
 * dataset's mapping cannot support it or the analytic is declared but not yet
 * computed.
 */
export async function runAnalytic(
  engagementId: string,
  datasetId: string,
  key: string,
  params: AnalyticParams = {},
): Promise<AnalyticResult> {
  const def = ANALYTIC_BY_KEY.get(key);
  if (!def) throw new Error("unknown-analytic");
  const locale: Locale = params.locale === "fr" ? "fr" : "en";
  const title = t(locale, def.titleEn, def.titleFr);
  const objective = t(locale, def.objectiveEn, def.objectiveFr);
  const shell = {
    key: def.key, title, objective, requiredFields: def.requiredFields,
    columns: [], rows: [], exceptions: 0, population: 0,
  };

  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const dataset = await glDataset(tx, engagementId, datasetId);
    if (!dataset) throw new Error("no-dataset");
    const fields = mappedFields(dataset.mapping);

    const missing = missingFields(def, fields);
    if (missing.length > 0) {
      return { ...shell, unavailable: `${t(locale, UNAVAILABLE_EN, UNAVAILABLE_FR)}: ${missing.join(", ")}` };
    }
    const impl = IMPL[def.key];
    if (!impl) {
      return {
        ...shell,
        unavailable: def.unavailableEn
          ? t(locale, def.unavailableEn, def.unavailableFr ?? def.unavailableEn)
          : t(locale, NOT_BUILT_EN, NOT_BUILT_FR),
      };
    }
    const body = await impl(tx, { datasetId, engagementId, locale, params });
    return { key: def.key, title, objective, requiredFields: def.requiredFields, ...body };
  });
}

export interface CatalogueEntry {
  id: number;
  key: string;
  title: string;
  category: AnalyticCategory;
  objective: string;
  assertions: string[];
  requiredFields: string[];
  exception: string;
  /** null when the analytic can be run against this dataset */
  unavailable: string | null;
}

/** All thirty analytics with their status against one dataset's mapping. */
export async function catalogue(
  engagementId: string,
  datasetId: string,
  locale: Locale = "en",
): Promise<CatalogueEntry[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const dataset = await glDataset(tx, engagementId, datasetId);
    if (!dataset) throw new Error("no-dataset");
    const fields = mappedFields(dataset.mapping);
    return ANALYTICS.map((def) => {
      const missing = missingFields(def, fields);
      let unavailable: string | null = null;
      if (missing.length > 0) {
        unavailable = `${t(locale, UNAVAILABLE_EN, UNAVAILABLE_FR)}: ${missing.join(", ")}`;
      } else if (!IMPL[def.key]) {
        unavailable = def.unavailableEn
          ? t(locale, def.unavailableEn, def.unavailableFr ?? def.unavailableEn)
          : t(locale, NOT_BUILT_EN, NOT_BUILT_FR);
      }
      return {
        id: def.id,
        key: def.key,
        title: t(locale, def.titleEn, def.titleFr),
        category: def.category,
        objective: t(locale, def.objectiveEn, def.objectiveFr),
        assertions: def.assertions,
        requiredFields: def.requiredFields,
        exception: t(locale, def.exceptionEn, def.exceptionFr),
        unavailable,
      };
    });
  });
}
