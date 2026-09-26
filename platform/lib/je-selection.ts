// Risk-directed selection of the journal-entry LINE ITEMS an auditor will test.
//
// International Audit Methodology 321.03 and ISA 240 ¶32 are explicit that a
// random sample of twenty-five entries is not an answer for journal-entry
// testing: entries are chosen because something about them is interesting, not
// because a random number generator reached them. This module is that choice
// made explicit — a catalogue of criteria, each carrying its own judgement
// thresholds as parameters rather than as numbers buried in a query, run
// together over one dataset.
//
// The unit of selection is the LINE, not the rule. An auditor tests the item
// and has to be able to say why it was picked, so a line caught by four
// criteria appears once carrying four reasons, never four times.
//
// Division of labour with the database, deliberately the opposite of
// lib/gl-analytics.ts: the analytics engine is aggregate-only and never brings
// a ledger row into Node. Selection cannot be, because the output IS the rows
// and each one has to carry its reasons. So SQL narrows — every selected
// criterion contributes an OR-clause and only lines already flagged by one of
// them come back — and TypeScript decides, holding the single definition of
// what each criterion means. When the narrowed set reaches CANDIDATE_CEILING
// the result says so instead of stating coverage it cannot stand behind:
// criteria that flag twenty thousand lines are not a selection, and the auditor
// needs to tighten them.
//
// Amount convention, as everywhere in the stack: signed = debit - credit.
//
// One test the user will ask for and this module will not pretend to run:
// out-of-hours postings. gl_line carries a posting DATE and no time of day, and
// the import has no batch identifier either, so there is nothing to test the
// hour of entry against. lib/gl-analytics.ts declares its own version of that
// analytic unavailable for exactly this reason; inventing a timestamp would be
// worse than not offering the test.

import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { TOLERANCE } from "@/lib/gl-line";
import { LEAD_INDEX_BY_CODE, leadIndexFor } from "@/lib/lead-classes";
import { assertMutable } from "@/lib/mutability";
import { requireTenant, requireWrite } from "@/lib/tenant";

type Tx = PoolClient;
export type Locale = "en" | "fr";

const t = (locale: Locale, en: string, fr: string): string => (locale === "fr" ? fr : en);

/** Mirrors DRILL_CAP in lib/gl-correlation.ts: a selection is evidence to read, not a ledger to download. */
export const SELECTION_CAP = 500;
export const DEFAULT_SELECTION_LIMIT = 200;

/**
 * How many flagged lines the engine will reason about in one run. This is not a
 * page size — the page is `limit` — it is the point beyond which the criteria
 * are selecting the ledger rather than a sample, and the result says so.
 */
export const CANDIDATE_CEILING = 20_000;

// ---------------------------------------------------------------------------
// account groupings

/**
 * The five groupings the pairing criterion reasons about. They are derived from
 * lib/lead-classes.ts rather than restated here: the SYSCOHADA prefix map is
 * the one place the firm maintains its chart, and a second copy of "revenue is
 * 70" would be wrong the day somebody edits the first one.
 */
export type SelectionClass = "Revenue" | "Cash" | "Expense" | "FixedAssets" | "Inventory";

/** The grouping an account (or an account prefix) belongs to; null when it is none of them. */
export function selectionClassFor(accountOrPrefix: string): SelectionClass | null {
  const index = leadIndexFor(accountOrPrefix);
  if (!index) return null;
  const def = LEAD_INDEX_BY_CODE[index];
  if (!def) return null;
  if (def.accountClass === "Revenue") return "Revenue";
  if (def.accountClass === "Cash") return "Cash";
  if (def.accountClass === "Fixed Assets") return "FixedAssets";
  if (def.accountClass === "Inventory") return "Inventory";
  if (def.accountType === "Expenses") return "Expense";
  return null;
}

export interface ClassPrefix {
  prefix: string;
  klass: SelectionClass | null;
}

/**
 * The prefix → grouping cover the entry-level SQL uses, computed once from
 * selectionClassFor by walking every numeric prefix up to three digits (the
 * longest rule lib/lead-classes.ts holds) and keeping a prefix only where it
 * says something its parent did not. The null entries matter as much as the
 * others: 28 is Fixed Assets but 281 is amortisation of intangibles, and
 * without the longer rule to mask it the shorter one would swallow it.
 */
export const CLASS_PREFIXES: readonly ClassPrefix[] = buildClassCover();

function buildClassCover(): ClassPrefix[] {
  const cover: ClassPrefix[] = [];
  const resolved = new Map<string, SelectionClass | null>();
  for (let length = 1; length <= 3; length += 1) {
    const last = 10 ** length;
    for (let n = length === 1 ? 0 : 10 ** (length - 1); n < last; n += 1) {
      const prefix = String(n).padStart(length, "0");
      const klass = selectionClassFor(prefix);
      const parent = length === 1 ? null : (resolved.get(prefix.slice(0, length - 1)) ?? null);
      resolved.set(prefix, klass);
      if (klass !== parent) cover.push({ prefix, klass });
    }
  }
  return cover;
}

export type PairingKey =
  | "revenue-cash"
  | "expense-cash"
  | "revenue-expense"
  | "fixed-assets-revenue"
  | "fixed-assets-cash"
  | "inventory-cash";

export interface PairingDef {
  key: PairingKey;
  left: SelectionClass;
  right: SelectionClass;
  labelEn: string;
  labelFr: string;
  /** why an auditor looks at this combination; it goes into the working paper */
  whyEn: string;
  whyFr: string;
}

export const PAIRINGS: readonly PairingDef[] = [
  {
    key: "revenue-cash", left: "Revenue", right: "Cash",
    labelEn: "Revenue posted against cash", labelFr: "Produit imputé à la trésorerie",
    whyEn: "revenue recognised straight to a bank or cash account bypasses the receivable, so nothing in the ledger ties the sale to a customer",
    whyFr: "un produit comptabilisé directement en banque ou en caisse contourne le compte client : rien ne rattache la vente à un client",
  },
  {
    key: "expense-cash", left: "Expense", right: "Cash",
    labelEn: "Expense settled directly in cash", labelFr: "Charge réglée directement en trésorerie",
    whyEn: "an expense taken straight against cash never passes through a payable, so there is no supplier account to agree it to",
    whyFr: "une charge imputée directement à la trésorerie ne passe par aucun compte fournisseur auquel la rapprocher",
  },
  {
    key: "revenue-expense", left: "Revenue", right: "Expense",
    labelEn: "Revenue and expense in one entry", labelFr: "Produit et charge dans une même écriture",
    whyEn: "an entry moving revenue and expense together nets two results against each other with no balance-sheet counterpart",
    whyFr: "une écriture qui mouvemente ensemble un produit et une charge compense deux résultats sans contrepartie de bilan",
  },
  {
    key: "fixed-assets-revenue", left: "FixedAssets", right: "Revenue",
    labelEn: "Fixed assets against revenue", labelFr: "Immobilisations en contrepartie d'un produit",
    whyEn: "capitalising against revenue is how a disposal, a self-constructed asset or a reclassification is recorded, and each of those needs reading",
    whyFr: "immobiliser en contrepartie d'un produit correspond à une cession, une production immobilisée ou un reclassement, qui méritent chacun lecture",
  },
  {
    key: "fixed-assets-cash", left: "FixedAssets", right: "Cash",
    labelEn: "Fixed assets against cash", labelFr: "Immobilisations en contrepartie de la trésorerie",
    whyEn: "a capital purchase paid straight out of cash skips the capital-expenditure payable and the approval that sits on it",
    whyFr: "une acquisition réglée directement en trésorerie contourne le compte de dettes sur immobilisations et l'approbation qui s'y rattache",
  },
  {
    key: "inventory-cash", left: "Inventory", right: "Cash",
    labelEn: "Inventory against cash", labelFr: "Stocks en contrepartie de la trésorerie",
    whyEn: "inventory moved directly against cash has neither a purchase nor a consumption account behind it, which is not how the stock cycle records",
    whyFr: "un stock mouvementé directement contre la trésorerie n'a derrière lui ni compte d'achat ni compte de variation, ce qui n'est pas la mécanique du cycle",
  },
] as const;

export const PAIRING_BY_KEY: Record<string, PairingDef> = Object.fromEntries(
  PAIRINGS.map((p) => [p.key, p]),
);

const CLASS_LABEL: Record<SelectionClass, { en: string; fr: string }> = {
  Revenue: { en: "Revenue", fr: "Produits" },
  Cash: { en: "Cash", fr: "Trésorerie" },
  Expense: { en: "Expense", fr: "Charges" },
  FixedAssets: { en: "Fixed assets", fr: "Immobilisations" },
  Inventory: { en: "Inventory", fr: "Stocks" },
};

// ---------------------------------------------------------------------------
// the catalogue

export type CriterionKey =
  | "weekend-posting"
  | "no-description"
  | "public-holiday"
  | "round-amount"
  | "unusual-pairing"
  | "year-end-volume"
  | "incomplete-description"
  | "preparer-is-reviewer"
  | "preparer-is-approver"
  | "user-defined";

export type CriterionCategory =
  | "timing"
  | "documentation"
  | "value"
  | "pattern"
  | "attribution"
  | "custom";

export type ParamKind = "integer" | "number" | "text" | "choice" | "multi";

export interface CriterionParamDef {
  /** the key on SelectionParams this control writes to */
  key: string;
  kind: ParamKind;
  labelEn: string;
  labelFr: string;
  helpEn: string;
  helpFr: string;
  default: number | string | readonly string[];
  min?: number;
  max?: number;
  options?: readonly { value: string; labelEn: string; labelFr: string }[];
}

export interface CriterionDef {
  key: CriterionKey;
  category: CriterionCategory;
  nameEn: string;
  nameFr: string;
  descriptionEn: string;
  descriptionFr: string;
  /** the methodology hook the working paper cites for choosing this criterion */
  rationaleEn: string;
  rationaleFr: string;
  /** true when the criterion selects a whole entry and every line of it */
  entryLevel: boolean;
  params: readonly CriterionParamDef[];
}

const DATE_BASIS_PARAM: CriterionParamDef = {
  key: "dateBasis", kind: "choice",
  labelEn: "Date tested", labelFr: "Date testée",
  helpEn: "Which of the two dates the ledger carries the test reads. The journal date is the accounting date; the entry date is when the posting was recorded.",
  helpFr: "Laquelle des deux dates portées par le grand livre le test lit. La date de journal est la date comptable ; la date de saisie est celle de l'enregistrement.",
  default: "journal",
  options: [
    { value: "journal", labelEn: "Journal date", labelFr: "Date de journal" },
    { value: "entry", labelEn: "Entry (recording) date", labelFr: "Date de saisie" },
  ],
};

export const JE_CRITERIA: readonly CriterionDef[] = [
  {
    key: "weekend-posting", category: "timing", entryLevel: false,
    nameEn: "Posted on a weekend", nameFr: "Comptabilisée un week-end",
    descriptionEn: "Lines dated on a Saturday or a Sunday.",
    descriptionFr: "Lignes datées d'un samedi ou d'un dimanche.",
    rationaleEn: "A posting made outside the normal working week was made outside the controls that normally surround it (ISA 240 ¶33(b)).",
    rationaleFr: "Une comptabilisation effectuée hors de la semaine ouvrée l'a été hors des contrôles qui l'encadrent normalement (ISA 240 ¶33 b)).",
    params: [DATE_BASIS_PARAM],
  },
  {
    key: "no-description", category: "documentation", entryLevel: false,
    nameEn: "No description at all", nameFr: "Aucun libellé",
    descriptionEn: "Lines carrying neither an entry description nor a line description.",
    descriptionFr: "Lignes ne portant ni libellé d'écriture ni libellé de ligne.",
    rationaleEn: "An entry that does not say what it is cannot be understood from the ledger alone, which is where a review of it starts.",
    rationaleFr: "Une écriture qui ne dit pas ce qu'elle est ne peut être comprise à partir du seul grand livre, point de départ de toute revue.",
    params: [],
  },
  {
    key: "public-holiday", category: "timing", entryLevel: false,
    nameEn: "Posted on a public holiday", nameFr: "Comptabilisée un jour férié",
    descriptionEn: "Lines dated on a public holiday of the client's country, from the seeded national calendar together with any date the firm has added.",
    descriptionFr: "Lignes datées d'un jour férié du pays du client, d'après le calendrier national ensemencé et les dates ajoutées par le cabinet.",
    rationaleEn: "The weekend test's reasoning, applied to the days the client's own country does not work.",
    rationaleFr: "Le raisonnement du test du week-end, appliqué aux jours où le pays du client ne travaille pas.",
    params: [
      DATE_BASIS_PARAM,
      {
        key: "country", kind: "text",
        labelEn: "Country", labelFr: "Pays",
        helpEn: "ISO two-letter code of the calendar to read. CM (Cameroon) is the seeded one.",
        helpFr: "Code ISO à deux lettres du calendrier à lire. CM (Cameroun) est celui qui est ensemencé.",
        default: "CM",
      },
    ],
  },
  {
    key: "round-amount", category: "value", entryLevel: false,
    nameEn: "Round-number amount", nameFr: "Montant rond",
    descriptionEn: "Lines whose absolute amount reaches the floor and is an exact multiple of the step.",
    descriptionFr: "Lignes dont le montant absolu atteint le plancher et constitue un multiple exact du pas.",
    rationaleEn: "An amount that lands on a round figure was decided rather than computed. Same two thresholds as analytic 12 of the GL Correlation Console.",
    rationaleFr: "Un montant qui tombe sur un chiffre rond a été décidé, non calculé. Mêmes seuils que l'analyse 12 de la console de corrélation.",
    params: [
      {
        key: "roundMin", kind: "number",
        labelEn: "Minimum absolute amount", labelFr: "Montant absolu minimal",
        helpEn: "Below this the roundness says nothing: small amounts are round by accident.",
        helpFr: "En deçà, le caractère rond ne signifie rien : les petits montants le sont par hasard.",
        default: 100000, min: 1, max: 1e15,
      },
      {
        key: "roundStep", kind: "number",
        labelEn: "Multiple of", labelFr: "Multiple de",
        helpEn: "The divisor the amount must be an exact multiple of.",
        helpFr: "Le diviseur dont le montant doit être un multiple exact.",
        default: 100000, min: 1, max: 1e15,
      },
    ],
  },
  {
    key: "unusual-pairing", category: "pattern", entryLevel: true,
    nameEn: "Unusual account pairing in one entry", nameFr: "Couple de comptes inhabituel dans une écriture",
    descriptionEn: "Every line of an entry that touches both sides of a selected pairing. The groupings come from the SYSCOHADA lead-schedule map, so a re-mapped chart moves them too.",
    descriptionFr: "Toutes les lignes d'une écriture touchant les deux côtés d'un couple retenu. Les regroupements proviennent de la table de correspondance SYSCOHADA des feuilles maîtresses.",
    rationaleEn: "ISA 240 ¶33(b)(ii): entries containing accounts not normally used together. The whole entry comes back, because the entry is what the auditor reads.",
    rationaleFr: "ISA 240 ¶33 b) ii) : écritures comportant des comptes qui ne sont pas habituellement utilisés ensemble. L'écriture entière est restituée, car c'est elle que l'auditeur lit.",
    params: [
      {
        key: "pairings", kind: "multi",
        labelEn: "Pairings tested", labelFr: "Couples testés",
        helpEn: "Each pairing is independent; all six are on unless the auditor narrows them.",
        helpFr: "Chaque couple est indépendant ; les six sont retenus tant que l'auditeur ne les restreint pas.",
        default: PAIRINGS.map((p) => p.key),
        options: PAIRINGS.map((p) => ({ value: p.key, labelEn: p.labelEn, labelFr: p.labelFr })),
      },
    ],
  },
  {
    key: "year-end-volume", category: "timing", entryLevel: true,
    nameEn: "Largest entries near the year end", nameFr: "Écritures les plus volumineuses près de la clôture",
    descriptionEn: "The largest entries dated inside the closing window, and every line of them.",
    descriptionFr: "Les écritures les plus importantes datées dans la fenêtre de clôture, et toutes leurs lignes.",
    rationaleEn: "ISA 240 ¶33(b)(i): entries made at or near the period end, where a long multi-line entry is the shape a consolidating adjustment takes.",
    rationaleFr: "ISA 240 ¶33 b) i) : écritures passées à la clôture ou peu avant, une écriture longue étant la forme que prend un ajustement de consolidation.",
    params: [
      {
        key: "topEntries", kind: "integer",
        labelEn: "How many entries", labelFr: "Nombre d'écritures",
        helpEn: "Five by default; raise it when the closing window is busy.",
        helpFr: "Cinq par défaut ; à relever lorsque la fenêtre de clôture est chargée.",
        default: 5, min: 1, max: 100,
      },
      {
        key: "yearEndDays", kind: "integer",
        labelEn: "Closing window (days)", labelFr: "Fenêtre de clôture (jours)",
        helpEn: "Days back from the engagement's period end. Fifteen, as in analytic 9.",
        helpFr: "Nombre de jours avant la fin de période de la mission. Quinze, comme dans l'analyse 9.",
        default: 15, min: 1, max: 90,
      },
      {
        key: "volumeBasis", kind: "choice",
        labelEn: "Volume measured by", labelFr: "Volume mesuré par",
        helpEn: "Line count reads as complexity, gross value as size. Neither is the obvious meaning of volume, so it is a choice rather than a number settled inside a query.",
        helpFr: "Le nombre de lignes traduit la complexité, la valeur brute la taille. Aucun des deux ne s'impose comme sens de « volume » : c'est donc un choix, non une valeur arrêtée dans une requête.",
        default: "lines",
        options: [
          { value: "lines", labelEn: "Number of lines", labelFr: "Nombre de lignes" },
          { value: "value", labelEn: "Gross value", labelFr: "Valeur brute" },
        ],
      },
    ],
  },
  {
    key: "incomplete-description", category: "documentation", entryLevel: false,
    nameEn: "Incomplete description", nameFr: "Libellé incomplet",
    descriptionEn: "Lines that do carry a description, but one too short, of too few words, or made only of filler terms and figures. Distinct from the blank-description test, which it never overlaps.",
    descriptionFr: "Lignes qui portent un libellé, mais trop court, comptant trop peu de mots, ou composé uniquement de termes passe-partout et de chiffres. Distinct du test des libellés vides, qu'il ne recoupe jamais.",
    rationaleEn: "\"Divers\", \"OD\" and \"régularisation\" are descriptions in form only: a reviewer learns nothing from them, so in substance the entry went unreviewed.",
    rationaleFr: "« Divers », « OD » ou « régularisation » ne sont des libellés que par la forme : le réviseur n'en apprend rien, l'écriture est donc en substance non revue.",
    params: [
      {
        key: "minDescriptionChars", kind: "integer",
        labelEn: "Minimum characters", labelFr: "Nombre minimal de caractères",
        helpEn: "A description shorter than this counts as incomplete. Ten clears \"Facture 4471\" and catches \"OD\".",
        helpFr: "Un libellé plus court est réputé incomplet. Dix laisse passer « Facture 4471 » et retient « OD ».",
        default: 10, min: 1, max: 200,
      },
      {
        key: "minDescriptionWords", kind: "integer",
        labelEn: "Minimum words", labelFr: "Nombre minimal de mots",
        helpEn: "A single word rarely says what an entry does.",
        helpFr: "Un mot unique dit rarement ce que fait une écriture.",
        default: 2, min: 1, max: 20,
      },
      {
        key: "uninformativeTerms", kind: "multi",
        labelEn: "Filler terms", labelFr: "Termes passe-partout",
        helpEn: "A description built only from these terms, figures and punctuation is incomplete however long it runs. Accented and unaccented spellings both count.",
        helpFr: "Un libellé composé uniquement de ces termes, de chiffres et de ponctuation est incomplet quelle que soit sa longueur. Les orthographes accentuées et non accentuées comptent toutes deux.",
        default: [
          "divers", "diverses", "various", "misc", "miscellaneous", "od", "ods",
          "ajustement", "ajustements", "adjustment", "adjustments",
          "régularisation", "régularisations", "correction", "corrections",
          "écriture", "écritures", "entry", "journal", "reclassement", "reclass",
          "provision", "test", "na", "rien", "autre", "autres", "other", "tbd",
        ],
      },
    ],
  },
  {
    key: "preparer-is-reviewer", category: "attribution", entryLevel: false,
    nameEn: "Preparer and reviewer are the same person", nameFr: "Préparateur et réviseur identiques",
    descriptionEn: "Lines where both names are recorded and they are the same, compared on the trimmed, lower-cased name.",
    descriptionFr: "Lignes où les deux noms sont renseignés et identiques, comparés sur le nom en minuscules et sans espaces de bord.",
    rationaleEn: "Nobody reviews their own work: the control the file leans on did not operate, whatever the posting itself turns out to be.",
    rationaleFr: "Nul ne revoit son propre travail : le contrôle sur lequel s'appuie le dossier n'a pas fonctionné, quelle que soit la comptabilisation elle-même.",
    params: [],
  },
  {
    // Self-approval is the other half of the same failure (UAT B141): a
    // ledger that records who validated an entry can show it was the person
    // who recorded it, which the reviewer test alone never catches.
    key: "preparer-is-approver", category: "attribution", entryLevel: false,
    nameEn: "Preparer and approver are the same person", nameFr: "Préparateur et approbateur identiques",
    descriptionEn: "Lines where both names are recorded and the person who recorded the entry is the one who approved it, compared on the trimmed, lower-cased name.",
    descriptionFr: "Lignes où les deux noms sont renseignés et où la personne qui a saisi l'écriture est celle qui l'a approuvée, comparés sur le nom en minuscules et sans espaces de bord.",
    rationaleEn: "ISA 240 ¶33(a): an entry its author approved passed no independent check — the segregation the control relies on did not exist for that posting.",
    rationaleFr: "ISA 240 ¶33 a) : une écriture approuvée par son auteur n'a subi aucun contrôle indépendant — la séparation des tâches sur laquelle repose le contrôle n'existait pas pour cette comptabilisation.",
    params: [],
  },
  {
    key: "user-defined", category: "custom", entryLevel: false,
    nameEn: "Auditor's own rule", nameFr: "Règle propre à l'auditeur",
    descriptionEn: "Rules the auditor builds from a ledger column, an operator and a value. They run alongside the built-in criteria, and a line caught by both carries both reasons.",
    descriptionFr: "Règles construites par l'auditeur à partir d'une colonne du grand livre, d'un opérateur et d'une valeur. Elles s'exécutent avec les critères intégrés ; une ligne retenue par les deux porte les deux motifs.",
    rationaleEn: "The client's own risks are in no catalogue. What the auditor learned during planning has to be expressible here, or the selection is only as good as somebody else's list.",
    rationaleFr: "Les risques propres au client ne figurent dans aucun catalogue. Ce que l'auditeur a appris en planification doit pouvoir s'exprimer ici, faute de quoi la sélection ne vaut que la liste d'un autre.",
    params: [],
  },
] as const;

export const CRITERION_BY_KEY: Record<string, CriterionDef> = Object.fromEntries(
  JE_CRITERIA.map((c) => [c.key, c]),
);

// ---------------------------------------------------------------------------
// user-defined rules

export type RuleFieldType = "text" | "number" | "date";

export interface RuleFieldDef {
  key: string;
  /** the gl_line expression the rule compares, with the table aliased l */
  column: string;
  type: RuleFieldType;
  labelEn: string;
  labelFr: string;
}

export const RULE_FIELDS: readonly RuleFieldDef[] = [
  { key: "account", column: "l.account", type: "text", labelEn: "Account", labelFr: "Compte" },
  { key: "accountName", column: "l.account_name", type: "text", labelEn: "Account name", labelFr: "Libellé du compte" },
  { key: "jeNumber", column: "l.je_number", type: "text", labelEn: "Entry number", labelFr: "Numéro d'écriture" },
  { key: "journalCode", column: "l.journal_code", type: "text", labelEn: "Journal code", labelFr: "Code journal" },
  { key: "jeDescription", column: "l.je_description", type: "text", labelEn: "Entry description", labelFr: "Libellé d'écriture" },
  { key: "lineDescription", column: "l.line_description", type: "text", labelEn: "Line description", labelFr: "Libellé de ligne" },
  { key: "reference", column: "l.reference", type: "text", labelEn: "Reference", labelFr: "Référence" },
  { key: "thirdPartyCode", column: "l.third_party_code", type: "text", labelEn: "Third-party code", labelFr: "Code tiers" },
  { key: "thirdPartyName", column: "l.third_party_name", type: "text", labelEn: "Third-party name", labelFr: "Nom du tiers" },
  { key: "preparer", column: "l.preparer", type: "text", labelEn: "Preparer", labelFr: "Préparateur" },
  { key: "reviewer", column: "l.reviewer", type: "text", labelEn: "Reviewer", labelFr: "Réviseur" },
  { key: "approver", column: "l.approver", type: "text", labelEn: "Approver", labelFr: "Approbateur" },
  { key: "costCenter", column: "l.cost_center", type: "text", labelEn: "Cost centre", labelFr: "Centre de coût" },
  { key: "journalDate", column: "l.journal_date", type: "date", labelEn: "Journal date", labelFr: "Date de journal" },
  { key: "entryDate", column: "l.entry_date", type: "date", labelEn: "Entry date", labelFr: "Date de saisie" },
  { key: "debit", column: "l.debit", type: "number", labelEn: "Debit", labelFr: "Débit" },
  { key: "credit", column: "l.credit", type: "number", labelEn: "Credit", labelFr: "Crédit" },
  { key: "signed", column: "l.signed", type: "number", labelEn: "Signed amount", labelFr: "Montant signé" },
  { key: "absAmount", column: "abs(l.signed)", type: "number", labelEn: "Absolute amount", labelFr: "Montant absolu" },
  { key: "lineNo", column: "l.line_no", type: "number", labelEn: "Line number", labelFr: "Numéro de ligne" },
] as const;

export const RULE_FIELD_BY_KEY: Record<string, RuleFieldDef> = Object.fromEntries(
  RULE_FIELDS.map((f) => [f.key, f]),
);

export type RuleOperator =
  | "equals" | "notEquals"
  | "contains" | "notContains" | "startsWith" | "endsWith"
  | "greaterThan" | "greaterOrEqual" | "lessThan" | "lessOrEqual" | "between"
  | "before" | "after"
  | "isEmpty" | "isNotEmpty";

export const RULE_OPERATORS: Record<RuleFieldType, readonly RuleOperator[]> = {
  text: ["equals", "notEquals", "contains", "notContains", "startsWith", "endsWith", "isEmpty", "isNotEmpty"],
  number: ["equals", "notEquals", "greaterThan", "greaterOrEqual", "lessThan", "lessOrEqual", "between"],
  date: ["equals", "before", "after", "between", "isEmpty", "isNotEmpty"],
};

export const RULE_OPERATOR_LABELS: Record<RuleOperator, { en: string; fr: string }> = {
  equals: { en: "is", fr: "est" },
  notEquals: { en: "is not", fr: "n'est pas" },
  contains: { en: "contains", fr: "contient" },
  notContains: { en: "does not contain", fr: "ne contient pas" },
  startsWith: { en: "starts with", fr: "commence par" },
  endsWith: { en: "ends with", fr: "se termine par" },
  greaterThan: { en: "is greater than", fr: "est supérieur à" },
  greaterOrEqual: { en: "is at least", fr: "est au moins égal à" },
  lessThan: { en: "is less than", fr: "est inférieur à" },
  lessOrEqual: { en: "is at most", fr: "est au plus égal à" },
  between: { en: "is between", fr: "est compris entre" },
  before: { en: "is before", fr: "est antérieure au" },
  after: { en: "is after", fr: "est postérieure au" },
  isEmpty: { en: "is empty", fr: "est vide" },
  isNotEmpty: { en: "is not empty", fr: "n'est pas vide" },
};

export interface UserRule {
  /** stable within one run; the criterion key becomes `user:<id>` */
  id?: string;
  field: string;
  operator: RuleOperator;
  value?: string | number | null;
  /** the second bound of `between` */
  value2?: string | number | null;
  labelEn?: string;
  labelFr?: string;
}

export interface NormalisedUserRule {
  key: string;
  field: RuleFieldDef;
  operator: RuleOperator;
  /** lower-cased text, a finite number, or an ISO date */
  value: string | number | null;
  value2: string | number | null;
  labelEn: string;
  labelFr: string;
}

const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const NO_VALUE: readonly RuleOperator[] = ["isEmpty", "isNotEmpty"];

/**
 * Turn one rule the auditor built into something the engine will run, or refuse
 * it. Refusing is the point: a rule whose operator does not fit its field would
 * otherwise select nothing, and a working paper that says "no exceptions"
 * because the rule was nonsense is worse than an error message.
 */
export function normaliseUserRule(rule: UserRule, index: number): NormalisedUserRule {
  const field = RULE_FIELD_BY_KEY[String(rule.field ?? "")];
  if (!field) throw new Error("invalid-rule-field");
  const operator = rule.operator;
  if (!RULE_OPERATORS[field.type].includes(operator)) throw new Error("invalid-rule-operator");

  let value: string | number | null = null;
  let value2: string | number | null = null;
  if (!NO_VALUE.includes(operator)) {
    value = coerceRuleValue(field.type, rule.value);
    if (value === null) throw new Error("invalid-rule-value");
    if (operator === "between") {
      value2 = coerceRuleValue(field.type, rule.value2);
      if (value2 === null) throw new Error("invalid-rule-value");
    }
  }

  const cleanedId = String(rule.id ?? "").trim().slice(0, 40).replace(/[^A-Za-z0-9_-]/g, "");
  const id = cleanedId || `r${index + 1}`;
  const shown = (v: string | number | null): string => (v === null ? "" : String(v));
  const tail = operator === "between" ? `${shown(value)} … ${shown(value2)}` : shown(value);
  return {
    key: `user:${id}`,
    field,
    operator,
    value,
    value2,
    labelEn: (rule.labelEn ?? "").trim() || `${field.labelEn} ${RULE_OPERATOR_LABELS[operator].en} ${tail}`.trim(),
    labelFr: (rule.labelFr ?? "").trim() || `${field.labelFr} ${RULE_OPERATOR_LABELS[operator].fr} ${tail}`.trim(),
  };
}

function coerceRuleValue(type: RuleFieldType, raw: unknown): string | number | null {
  if (raw === null || raw === undefined) return null;
  if (type === "number") {
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  const text = String(raw).trim();
  if (!text) return null;
  if (type === "date") return ISO_DATE_RE.test(text) ? text : null;
  return text.slice(0, 200).toLowerCase();
}

// ---------------------------------------------------------------------------
// parameters

export interface SelectionParams {
  locale?: Locale;
  dateBasis?: "journal" | "entry";
  country?: string;
  roundMin?: number;
  roundStep?: number;
  pairings?: string[];
  topEntries?: number;
  yearEndDays?: number;
  volumeBasis?: "lines" | "value";
  minDescriptionChars?: number;
  minDescriptionWords?: number;
  uninformativeTerms?: string[];
}

export interface SelectionSettings {
  dateBasis: "journal" | "entry";
  country: string;
  roundMin: number;
  roundStep: number;
  pairings: PairingKey[];
  topEntries: number;
  yearEndDays: number;
  volumeBasis: "lines" | "value";
  minDescriptionChars: number;
  minDescriptionWords: number;
  /** lower-cased, with the unaccented spelling of every accented term alongside it */
  uninformativeTerms: string[];
}

const DEFAULT_TERMS = CRITERION_BY_KEY["incomplete-description"].params
  .find((p) => p.key === "uninformativeTerms")!.default as readonly string[];

/** Every threshold clamped to a range it can be defended in, never taken raw from the request. */
export function resolveSettings(params: SelectionParams = {}): SelectionSettings {
  const pairings = Array.isArray(params.pairings)
    ? params.pairings.filter((k): k is PairingKey => k in PAIRING_BY_KEY)
    : [];
  const country = String(params.country ?? "");
  const terms = Array.isArray(params.uninformativeTerms) && params.uninformativeTerms.length > 0
    ? params.uninformativeTerms
    : DEFAULT_TERMS;
  return {
    dateBasis: params.dateBasis === "entry" ? "entry" : "journal",
    country: /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : "CM",
    roundMin: clampNumber(params.roundMin, 1, 1e15, 100000),
    roundStep: clampNumber(params.roundStep, 1, 1e15, 100000),
    pairings: pairings.length > 0 ? [...new Set(pairings)] : PAIRINGS.map((p) => p.key),
    topEntries: clampInt(params.topEntries, 1, 100, 5),
    yearEndDays: clampInt(params.yearEndDays, 1, 90, 15),
    volumeBasis: params.volumeBasis === "value" ? "value" : "lines",
    minDescriptionChars: clampInt(params.minDescriptionChars, 1, 200, 10),
    minDescriptionWords: clampInt(params.minDescriptionWords, 1, 20, 2),
    uninformativeTerms: expandTerms(terms),
  };
}

/**
 * Accented and unaccented spellings both count, and the pair is built here
 * rather than by folding accents at comparison time so that the narrowing SQL
 * and this module test exactly the same list. One of them normalising more than
 * the other is how a line gets flagged in Node that SQL never returned.
 */
function expandTerms(terms: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of terms) {
    const term = String(raw).trim().toLowerCase().slice(0, 40);
    if (!/^[\p{L}\p{N}'-]{1,40}$/u.test(term)) continue;
    out.add(term);
    out.add(term.normalize("NFD").replace(/[̀-ͯ]/g, ""));
  }
  return [...out].slice(0, 200);
}

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

// ---------------------------------------------------------------------------
// the pure core
//
// Everything from here to the database section decides; nothing in it queries.
// That is what makes each criterion testable against a fixture rather than
// against a live ledger.

export interface HolidayLabel {
  labelEn: string;
  labelFr: string;
  /** 'national' for the seeded calendar, 'firm' for a date the firm added itself */
  origin: "national" | "firm";
}

export interface EntryFacts {
  /** lines in the whole entry, not only the ones selected */
  lines: number;
  grossValue: number;
  classes: SelectionClass[];
  /** 1-based place among the closing-window entries, or null when it is not one of them */
  yearEndRank: number | null;
}

/** One ledger line as the criteria read it, with the facts about the entry it belongs to. */
export interface SelectionCandidate {
  id: string;
  lineNo: number;
  jeNumber: string;
  journalCode: string | null;
  journalDate: string | null;
  entryDate: string | null;
  account: string;
  accountName: string | null;
  jeDescription: string | null;
  lineDescription: string | null;
  debit: number;
  credit: number;
  signed: number;
  preparer: string | null;
  reviewer: string | null;
  approver: string | null;
  reference: string | null;
  thirdPartyCode: string | null;
  thirdPartyName: string | null;
  costCenter: string | null;
  entry: EntryFacts;
}

export interface SelectionReason {
  /** the criterion key, or `user:<id>` for a rule the auditor wrote */
  criterion: string;
  label: string;
  /** what, on this line, satisfied it — the sentence the working paper carries */
  detail: string;
}

export interface SelectedLine extends Omit<SelectionCandidate, "entry"> {
  accountClass: SelectionClass | null;
  entryLines: number;
  entryGrossValue: number;
  reasons: SelectionReason[];
}

export interface EvaluationContext {
  locale: Locale;
  settings: SelectionSettings;
  criteria: CriterionKey[];
  userRules: NormalisedUserRule[];
  /**
   * "any" (default): a line matching any auditor rule is selected; "all": only
   * a line matching every auditor rule (UAT run 2 B67). Built-in criteria stay
   * OR-ed with the rules either way.
   */
  userRulesMode?: "any" | "all";
  /** ISO date → label, the national calendar merged with the firm's own dates */
  holidays: Map<string, HolidayLabel>;
}

const DAY_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** ISO weekday (1 = Monday … 7 = Sunday) of a YYYY-MM-DD date, or null. */
export function isoWeekday(date: string | null): number | null {
  if (!date || !ISO_DATE_RE.test(date)) return null;
  const stamp = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  if (Number.isNaN(stamp)) return null;
  const day = new Date(stamp).getUTCDay();
  return day === 0 ? 7 : day;
}

/** The description the documentation criteria read: the line's own, falling back to the entry's. */
export function descriptionOf(line: Pick<SelectionCandidate, "jeDescription" | "lineDescription">): string {
  const own = (line.lineDescription ?? "").trim();
  return own || (line.jeDescription ?? "").trim();
}

/** The words of a description, with figures and punctuation treated as separators. */
function informativeTokens(description: string): string[] {
  return description.toLowerCase().split(/[^\p{L}]+/u).filter((w) => w.length > 0);
}

/**
 * Present but uninformative, on three independent grounds: too short, too few
 * words, or nothing but filler. Each is a stated threshold rather than a number
 * inside a query, because each is a judgement the engagement partner may want
 * to move.
 */
export function isIncompleteDescription(description: string, settings: SelectionSettings): boolean {
  if (!description) return false;
  if (description.length < settings.minDescriptionChars) return true;
  if (description.split(/\s+/).filter(Boolean).length < settings.minDescriptionWords) return true;
  const tokens = informativeTokens(description);
  if (tokens.length === 0) return true;
  return tokens.every((token) => settings.uninformativeTerms.includes(token));
}

/** An amount is round when it clears the floor and divides exactly by the step. */
export function isRoundAmount(signed: number, settings: SelectionSettings): boolean {
  const amount = Math.abs(signed);
  if (amount < settings.roundMin) return false;
  // amounts are numeric(30,6) in the projection, so the remainder is judged at
  // six decimals rather than as a raw binary float
  return Math.round((amount % settings.roundStep) * 1e6) / 1e6 === 0;
}

const normalisePerson = (value: string | null): string => (value ?? "").trim().toLowerCase();

/** Test one rule the auditor wrote against one line. */
export function matchesUserRule(line: SelectionCandidate, rule: NormalisedUserRule): boolean {
  const raw = ruleValueOf(line, rule.field.key);
  if (rule.operator === "isEmpty") return raw === null || String(raw).trim() === "";
  if (rule.operator === "isNotEmpty") return raw !== null && String(raw).trim() !== "";
  if (raw === null) return false;

  if (rule.field.type === "number") {
    const actual = Number(raw);
    const expected = Number(rule.value);
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
    switch (rule.operator) {
      case "equals": return Math.abs(actual - expected) <= TOLERANCE;
      case "notEquals": return Math.abs(actual - expected) > TOLERANCE;
      case "greaterThan": return actual > expected;
      case "greaterOrEqual": return actual >= expected;
      case "lessThan": return actual < expected;
      case "lessOrEqual": return actual <= expected;
      case "between": {
        const other = Number(rule.value2);
        if (!Number.isFinite(other)) return false;
        return actual >= Math.min(expected, other) && actual <= Math.max(expected, other);
      }
      default: return false;
    }
  }

  if (rule.field.type === "date") {
    const actual = String(raw);
    const expected = String(rule.value);
    switch (rule.operator) {
      case "equals": return actual === expected;
      case "before": return actual < expected;
      case "after": return actual > expected;
      case "between": {
        const other = String(rule.value2 ?? "");
        const low = expected <= other ? expected : other;
        const high = expected <= other ? other : expected;
        return actual >= low && actual <= high;
      }
      default: return false;
    }
  }

  const actual = String(raw).trim().toLowerCase();
  const expected = String(rule.value);
  switch (rule.operator) {
    case "equals": return actual === expected;
    case "notEquals": return actual !== expected;
    case "contains": return actual.includes(expected);
    case "notContains": return !actual.includes(expected);
    case "startsWith": return actual.startsWith(expected);
    case "endsWith": return actual.endsWith(expected);
    default: return false;
  }
}

function ruleValueOf(line: SelectionCandidate, field: string): string | number | null {
  switch (field) {
    case "account": return line.account;
    case "accountName": return line.accountName;
    case "jeNumber": return line.jeNumber;
    case "journalCode": return line.journalCode;
    case "jeDescription": return line.jeDescription;
    case "lineDescription": return line.lineDescription;
    case "reference": return line.reference;
    case "thirdPartyCode": return line.thirdPartyCode;
    case "thirdPartyName": return line.thirdPartyName;
    case "preparer": return line.preparer;
    case "reviewer": return line.reviewer;
    case "approver": return line.approver;
    case "costCenter": return line.costCenter;
    case "journalDate": return line.journalDate;
    case "entryDate": return line.entryDate;
    case "debit": return line.debit;
    case "credit": return line.credit;
    case "signed": return line.signed;
    case "absAmount": return Math.abs(line.signed);
    case "lineNo": return line.lineNo;
    default: return null;
  }
}

/**
 * Every reason one line was selected, in catalogue order. This function is the
 * only definition of what each criterion means: the SQL that fetched the line
 * narrowed the ledger, it did not decide.
 */
export function reasonsFor(line: SelectionCandidate, ctx: EvaluationContext): SelectionReason[] {
  const { locale, settings } = ctx;
  const chosen = new Set<string>(ctx.criteria);
  const reasons: SelectionReason[] = [];
  const name = (key: CriterionKey): string => t(locale, CRITERION_BY_KEY[key].nameEn, CRITERION_BY_KEY[key].nameFr);
  const tested = settings.dateBasis === "entry" ? line.entryDate : line.journalDate;
  const dateWord = t(locale,
    settings.dateBasis === "entry" ? "entry date" : "journal date",
    settings.dateBasis === "entry" ? "date de saisie" : "date de journal");

  if (chosen.has("weekend-posting")) {
    const day = isoWeekday(tested);
    if (day === 6 || day === 7) {
      reasons.push({
        criterion: "weekend-posting",
        label: name("weekend-posting"),
        detail: t(locale,
          `${dateWord} ${tested} falls on a ${DAY_EN[day - 1]}`,
          `${dateWord} ${tested} : un ${DAY_FR[day - 1]}`),
      });
    }
  }

  const description = descriptionOf(line);

  if (chosen.has("no-description") && description === "") {
    reasons.push({
      criterion: "no-description",
      label: name("no-description"),
      detail: t(locale,
        "neither the entry nor the line carries a description",
        "ni l'écriture ni la ligne ne portent de libellé"),
    });
  }

  if (chosen.has("public-holiday") && tested) {
    const holiday = ctx.holidays.get(tested);
    if (holiday) {
      const origin = holiday.origin === "firm"
        ? t(locale, "firm calendar", "calendrier du cabinet")
        : t(locale, "national calendar", "calendrier national");
      reasons.push({
        criterion: "public-holiday",
        label: name("public-holiday"),
        detail: t(locale,
          `${dateWord} ${tested} is ${holiday.labelEn} in ${settings.country} (${origin})`,
          `${dateWord} ${tested} : ${holiday.labelFr} au ${settings.country} (${origin})`),
      });
    }
  }

  if (chosen.has("round-amount") && isRoundAmount(line.signed, settings)) {
    reasons.push({
      criterion: "round-amount",
      label: name("round-amount"),
      detail: t(locale,
        `${Math.abs(line.signed)} is an exact multiple of ${settings.roundStep}`,
        `${Math.abs(line.signed)} est un multiple exact de ${settings.roundStep}`),
    });
  }

  if (chosen.has("unusual-pairing")) {
    const present = new Set(line.entry.classes);
    for (const key of settings.pairings) {
      const pairing = PAIRING_BY_KEY[key];
      if (!pairing || !present.has(pairing.left) || !present.has(pairing.right)) continue;
      reasons.push({
        criterion: "unusual-pairing",
        label: t(locale, pairing.labelEn, pairing.labelFr),
        detail: t(locale,
          `entry ${line.jeNumber} touches ${CLASS_LABEL[pairing.left].en} and ${CLASS_LABEL[pairing.right].en} together — ${pairing.whyEn}`,
          `l'écriture ${line.jeNumber} mouvemente ensemble ${CLASS_LABEL[pairing.left].fr} et ${CLASS_LABEL[pairing.right].fr} — ${pairing.whyFr}`),
      });
    }
  }

  if (chosen.has("year-end-volume") && line.entry.yearEndRank !== null) {
    const measure = settings.volumeBasis === "value"
      ? t(locale, `gross value ${line.entry.grossValue}`, `valeur brute ${line.entry.grossValue}`)
      : t(locale, `${line.entry.lines} lines`, `${line.entry.lines} lignes`);
    reasons.push({
      criterion: "year-end-volume",
      label: name("year-end-volume"),
      detail: t(locale,
        `entry ${line.jeNumber} ranks ${line.entry.yearEndRank} of the ${settings.topEntries} largest in the last ${settings.yearEndDays} days of the period (${measure})`,
        `l'écriture ${line.jeNumber} occupe le rang ${line.entry.yearEndRank} des ${settings.topEntries} plus importantes des ${settings.yearEndDays} derniers jours de la période (${measure})`),
    });
  }

  if (chosen.has("incomplete-description") && isIncompleteDescription(description, settings)) {
    reasons.push({
      criterion: "incomplete-description",
      label: name("incomplete-description"),
      detail: t(locale,
        `"${description}" does not meet the stated minimum of ${settings.minDescriptionChars} characters and ${settings.minDescriptionWords} informative words`,
        `« ${description} » n'atteint pas le minimum retenu de ${settings.minDescriptionChars} caractères et ${settings.minDescriptionWords} mots porteurs de sens`),
    });
  }

  if (chosen.has("preparer-is-reviewer")) {
    const preparer = normalisePerson(line.preparer);
    if (preparer !== "" && preparer === normalisePerson(line.reviewer)) {
      reasons.push({
        criterion: "preparer-is-reviewer",
        label: name("preparer-is-reviewer"),
        detail: t(locale,
          `${line.preparer} both recorded and reviewed this line`,
          `${line.preparer} a saisi et revu cette ligne`),
      });
    }
  }

  if (chosen.has("preparer-is-approver")) {
    const preparer = normalisePerson(line.preparer);
    if (preparer !== "" && preparer === normalisePerson(line.approver)) {
      reasons.push({
        criterion: "preparer-is-approver",
        label: name("preparer-is-approver"),
        detail: t(locale,
          `${line.preparer} both recorded and approved this line`,
          `${line.preparer} a saisi et approuvé cette ligne`),
      });
    }
  }

  const allRules = ctx.userRulesMode === "all";
  const everyRule = allRules && ctx.userRules.every((rule) => matchesUserRule(line, rule));
  for (const rule of ctx.userRules) {
    if (allRules ? !everyRule : !matchesUserRule(line, rule)) continue;
    reasons.push({
      criterion: rule.key,
      label: t(locale, rule.labelEn, rule.labelFr),
      detail: t(locale,
        `the auditor's own rule: ${rule.labelEn}`,
        `règle propre à l'auditeur : ${rule.labelFr}`),
    });
  }

  return reasons;
}

export interface CriterionCoverage {
  key: string;
  name: string;
  description: string;
  /** the thresholds this run actually used, so the working paper can state them */
  settings: Record<string, string | number | readonly string[]>;
  matchedLines: number;
  matchedEntries: number;
}

export interface SelectionCore {
  lines: SelectedLine[];
  /** distinct lines and entries selected, before the page cap */
  selectedLines: number;
  selectedEntries: number;
  coverage: Map<string, { lines: number; entries: number }>;
}

/**
 * Attach the reasons, drop the candidates no criterion actually claims, and
 * order the survivors by how many criteria caught each one. A line flagged four
 * ways is the one to read first, and it appears once.
 */
export function selectFromCandidates(
  candidates: SelectionCandidate[],
  ctx: EvaluationContext,
): SelectionCore {
  const lines: SelectedLine[] = [];
  const coverage = new Map<string, { lines: number; entries: number }>();
  const entriesByCriterion = new Map<string, Set<string>>();
  const selectedEntries = new Set<string>();

  for (const candidate of candidates) {
    const reasons = reasonsFor(candidate, ctx);
    if (reasons.length === 0) continue;
    const { entry, ...rest } = candidate;
    lines.push({
      ...rest,
      accountClass: selectionClassFor(candidate.account),
      entryLines: entry.lines,
      entryGrossValue: entry.grossValue,
      reasons,
    });
    selectedEntries.add(candidate.jeNumber);

    // a line counts once against a criterion even when two of its pairings
    // caught it, or the count would exceed the number of lines selected
    const seenHere = new Set<string>();
    for (const reason of reasons) {
      if (seenHere.has(reason.criterion)) continue;
      seenHere.add(reason.criterion);
      const tally = coverage.get(reason.criterion) ?? { lines: 0, entries: 0 };
      tally.lines += 1;
      coverage.set(reason.criterion, tally);
      const entrySet = entriesByCriterion.get(reason.criterion) ?? new Set<string>();
      entrySet.add(candidate.jeNumber);
      entriesByCriterion.set(reason.criterion, entrySet);
    }
  }

  for (const [key, entrySet] of entriesByCriterion) {
    coverage.get(key)!.entries = entrySet.size;
  }

  lines.sort((a, b) =>
    b.reasons.length - a.reasons.length
    || Math.abs(b.signed) - Math.abs(a.signed)
    || (a.journalDate ?? "9999-12-31").localeCompare(b.journalDate ?? "9999-12-31")
    || a.jeNumber.localeCompare(b.jeNumber)
    || a.lineNo - b.lineNo);

  return { lines, selectedLines: lines.length, selectedEntries: selectedEntries.size, coverage };
}

// ---------------------------------------------------------------------------
// the database side

export interface SelectionRequest {
  criteria?: string[];
  params?: SelectionParams;
  userRules?: UserRule[];
  /** how the auditor rules combine: "any" (default) or "all" (UAT run 2 B67) */
  userRulesMode?: "any" | "all";
  limit?: number;
  offset?: number;
}

export interface SelectionPopulation {
  lines: number;
  entries: number;
  /** lines the timing criteria can speak about at all */
  datedLines: number;
}

export interface SelectionResult {
  criteria: CriterionCoverage[];
  population: SelectionPopulation;
  selectedLines: number;
  selectedEntries: number;
  lines: SelectedLine[];
  limit: number;
  offset: number;
  /** true when the page shows fewer lines than were selected */
  truncated: boolean;
  /** true when the criteria flagged more lines than the engine will reason about */
  ceilingHit: boolean;
  notes: string[];
}

const SCOPE = "l.dataset_id = $1 AND l.engagement_id = $2";

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Run the chosen criteria over one projected dataset and return the line items
 * to test. Nothing here decides anything: it assembles the SQL that narrows the
 * ledger, then hands what comes back to selectFromCandidates.
 */
export async function runSelection(
  engagementId: string,
  datasetId: string,
  request: SelectionRequest = {},
): Promise<SelectionResult> {
  const params = request.params ?? {};
  const locale: Locale = params.locale === "fr" ? "fr" : "en";
  const settings = resolveSettings(params);
  const criteria = (Array.isArray(request.criteria) ? request.criteria : [])
    .filter((k): k is CriterionKey => k in CRITERION_BY_KEY && k !== "user-defined");
  const userRules = (Array.isArray(request.userRules) ? request.userRules : [])
    .slice(0, 20)
    .map((rule, index) => normaliseUserRule(rule, index));
  if (criteria.length === 0 && userRules.length === 0) throw new Error("no-criteria");

  const requested = Math.floor(Number(request.limit ?? DEFAULT_SELECTION_LIMIT));
  const limit = Math.min(SELECTION_CAP, Math.max(1, requested || DEFAULT_SELECTION_LIMIT));
  const offset = Math.max(0, Math.floor(Number(request.offset ?? 0)) || 0);

  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const holidays = criteria.includes("public-holiday")
      ? await loadHolidays(tx, engagementId, settings.country)
      : new Map<string, HolidayLabel>();

    const population = await loadPopulation(tx, engagementId, datasetId, settings.dateBasis);
    const userRulesMode = request.userRulesMode === "all" ? "all" : "any";
    const candidates = await loadCandidates(tx, engagementId, datasetId, criteria, userRules, settings, holidays, userRulesMode);

    const core = selectFromCandidates(candidates, { locale, settings, criteria, userRules, userRulesMode, holidays });

    const notes: string[] = [];
    if (criteria.includes("public-holiday") && holidays.size === 0) {
      notes.push(t(locale,
        `No public holiday is recorded for ${settings.country}. The criterion selected nothing because the calendar is empty, not because the ledger is clean.`,
        `Aucun jour férié n'est enregistré pour ${settings.country}. Le critère n'a rien retenu parce que le calendrier est vide, non parce que le grand livre l'est.`));
    }
    if (candidates.length >= CANDIDATE_CEILING) {
      notes.push(t(locale,
        `The criteria flagged at least ${CANDIDATE_CEILING} lines, the ceiling this engine reasons about. Tighten the thresholds before citing coverage: the counts below are floors, not totals.`,
        `Les critères ont retenu au moins ${CANDIDATE_CEILING} lignes, plafond que ce moteur traite. Resserrez les seuils avant de citer une couverture : les nombres ci-dessous sont des minorants, non des totaux.`));
    }
    notes.push(t(locale,
      "Selection is risk-directed, not random. International Audit Methodology 321.03 and ISA 240 rule out a random sample of 25 entries for journal-entry testing; every line below was chosen by a stated criterion and carries the reason it was chosen.",
      "La sélection est orientée par le risque, non aléatoire. La méthodologie d'audit internationale 321.03 et la norme ISA 240 excluent un échantillon aléatoire de 25 écritures pour le test des écritures ; chaque ligne ci-dessous a été retenue par un critère énoncé et porte le motif de sa sélection."));

    return {
      criteria: coverageOf(criteria, userRules, settings, core, locale),
      population,
      selectedLines: core.selectedLines,
      selectedEntries: core.selectedEntries,
      lines: core.lines.slice(offset, offset + limit),
      limit,
      offset,
      truncated: core.selectedLines > offset + limit,
      ceilingHit: candidates.length >= CANDIDATE_CEILING,
      notes,
    };
  });
}

function coverageOf(
  criteria: CriterionKey[],
  userRules: NormalisedUserRule[],
  settings: SelectionSettings,
  core: SelectionCore,
  locale: Locale,
): CriterionCoverage[] {
  const thresholds = (def: CriterionDef): Record<string, string | number | readonly string[]> => {
    const out: Record<string, string | number | readonly string[]> = {};
    for (const param of def.params) {
      out[param.key] = settings[param.key as keyof SelectionSettings] as string | number | readonly string[];
    }
    return out;
  };
  const rows: CriterionCoverage[] = criteria.map((key) => {
    const def = CRITERION_BY_KEY[key];
    const tally = core.coverage.get(key) ?? { lines: 0, entries: 0 };
    return {
      key,
      name: t(locale, def.nameEn, def.nameFr),
      description: t(locale, def.descriptionEn, def.descriptionFr),
      settings: thresholds(def),
      matchedLines: tally.lines,
      matchedEntries: tally.entries,
    };
  });
  const custom = CRITERION_BY_KEY["user-defined"];
  for (const rule of userRules) {
    const tally = core.coverage.get(rule.key) ?? { lines: 0, entries: 0 };
    rows.push({
      key: rule.key,
      name: t(locale, rule.labelEn, rule.labelFr),
      description: t(locale, custom.descriptionEn, custom.descriptionFr),
      settings: { field: rule.field.key, operator: rule.operator },
      matchedLines: tally.lines,
      matchedEntries: tally.entries,
    });
  }
  return rows;
}

async function loadPopulation(
  tx: Tx,
  engagementId: string,
  datasetId: string,
  dateBasis: "journal" | "entry",
): Promise<SelectionPopulation> {
  const column = dateBasis === "entry" ? "entry_date" : "journal_date";
  const q = await tx.query<{ lines: number; entries: number; dated: number }>(
    `SELECT count(*)::int AS lines,
            count(DISTINCT l.je_number)::int AS entries,
            count(*) FILTER (WHERE l.${column} IS NOT NULL)::int AS dated
       FROM gl_line l WHERE ${SCOPE}`,
    [datasetId, engagementId],
  );
  const row = q.rows[0];
  return { lines: row?.lines ?? 0, entries: row?.entries ?? 0, datedLines: row?.dated ?? 0 };
}

/**
 * The national calendar merged with whatever the firm added. A firm row with no
 * engagement applies to every file the firm runs; one carrying an engagement is
 * that file's own closure, and it takes precedence over the national row for
 * the same date.
 */
async function loadHolidays(
  tx: Tx,
  engagementId: string,
  country: string,
): Promise<Map<string, HolidayLabel>> {
  const q = await tx.query<{ d: string; label_en: string; label_fr: string; origin: string }>(
    `SELECT to_char(holiday_date, 'YYYY-MM-DD') AS d, label_en, label_fr, 'national' AS origin
       FROM public_holiday WHERE country = $1
      UNION ALL
     SELECT to_char(holiday_date, 'YYYY-MM-DD') AS d, label_en, label_fr, 'firm' AS origin
       FROM firm_holiday
      WHERE country = $1 AND (engagement_id IS NULL OR engagement_id = $2)`,
    [country, engagementId],
  );
  const map = new Map<string, HolidayLabel>();
  for (const row of q.rows) {
    const origin: HolidayLabel["origin"] = row.origin === "firm" ? "firm" : "national";
    if (origin === "national" && map.has(row.d)) continue;
    map.set(row.d, { labelEn: row.label_en, labelFr: row.label_fr, origin });
  }
  return map;
}

interface CandidateRow {
  id: string;
  line_no: number;
  je_number: string;
  journal_code: string | null;
  journal_date: string | null;
  entry_date: string | null;
  account: string;
  account_name: string | null;
  je_description: string | null;
  line_description: string | null;
  debit: number;
  credit: number;
  signed: number;
  preparer: string | null;
  reviewer: string | null;
  approver: string | null;
  reference: string | null;
  third_party_code: string | null;
  third_party_name: string | null;
  cost_center: string | null;
  entry_lines: number;
  entry_gross: number;
  entry_classes: string[] | null;
  year_end_rank: number | null;
}

/**
 * The narrowing query. Each selected criterion contributes one OR-clause, and
 * the entry-level ones reach the whole entry through a CTE that is only built
 * when they are selected: classifying every account is the one expensive thing
 * this file does, and a run that tests no pairings should not pay for it.
 */
async function loadCandidates(
  tx: Tx,
  engagementId: string,
  datasetId: string,
  criteria: CriterionKey[],
  userRules: NormalisedUserRule[],
  settings: SelectionSettings,
  holidays: Map<string, HolidayLabel>,
  userRulesMode: "any" | "all" = "any",
): Promise<SelectionCandidate[]> {
  const params: unknown[] = [datasetId, engagementId];
  const add = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  const wantsPairing = criteria.includes("unusual-pairing");
  const wantsYearEnd = criteria.includes("year-end-volume");
  const dateColumn = settings.dateBasis === "entry" ? "entry_date" : "journal_date";
  const descriptionSql = "coalesce(nullif(trim(l.line_description), ''), nullif(trim(l.je_description), ''), '')";

  // Classification is done once per DISTINCT account, not once per line (UAT
  // B77): the correlated prefix lookup ran against every line of the ledger
  // and, with the array aggregation on top, pushed the pairing criterion past
  // the statement timeout on a ledger of a few hundred lines. `entry` is
  // materialised so the planner cannot inline the aggregate into the join.
  const ctes: string[] = [];
  if (wantsPairing) {
    ctes.push(`account_class AS (
       SELECT a.account,
              (SELECT c.klass
                 FROM unnest(${add(CLASS_PREFIXES.map((c) => c.prefix))}::text[],
                             ${add(CLASS_PREFIXES.map((c) => c.klass))}::text[]) AS c(prefix, klass)
                WHERE a.account LIKE c.prefix || '%'
                ORDER BY length(c.prefix) DESC LIMIT 1) AS klass
         FROM (SELECT DISTINCT l.account FROM gl_line l WHERE ${SCOPE}) a)`);
  }
  ctes.push(
    `base AS (
       SELECT l.je_number, l.journal_date, l.signed, ${wantsPairing ? "ac.klass" : "NULL::text"} AS klass
         FROM gl_line l
         ${wantsPairing ? "LEFT JOIN account_class ac ON ac.account = l.account" : ""}
        WHERE ${SCOPE})`,
    `entry AS MATERIALIZED (
       SELECT je_number, count(*)::int AS lines,
              coalesce(sum(abs(signed)), 0)::float8 AS gross,
              min(journal_date) AS jd,
              coalesce(array_agg(DISTINCT klass) FILTER (WHERE klass IS NOT NULL), ARRAY[]::text[]) AS classes
         FROM base GROUP BY je_number)`,
  );

  if (wantsYearEnd) {
    const measure = settings.volumeBasis === "value" ? "gross" : "lines";
    ctes.push(`top_entry AS (
       SELECT je_number, row_number() OVER (ORDER BY ${measure} DESC, je_number)::int AS rank
         FROM entry, (SELECT period_end AS pe FROM engagement WHERE id = $2) p
        WHERE jd IS NOT NULL AND jd > p.pe - ${add(settings.yearEndDays)}::int AND jd <= p.pe
        ORDER BY ${measure} DESC, je_number
        LIMIT ${add(settings.topEntries)})`);
  }

  const clauses: string[] = [];
  for (const key of criteria) {
    switch (key) {
      case "weekend-posting":
        clauses.push(`extract(isodow FROM l.${dateColumn}) IN (6, 7)`);
        break;
      case "no-description":
        clauses.push(`${descriptionSql} = ''`);
        break;
      case "public-holiday":
        // an empty calendar must not degrade into "every date matches"
        if (holidays.size > 0) {
          clauses.push(`l.${dateColumn} = ANY(${add([...holidays.keys()])}::date[])`);
        }
        break;
      case "round-amount":
        clauses.push(`(abs(l.signed) >= ${add(settings.roundMin)}::numeric
                       AND mod(abs(l.signed), ${add(settings.roundStep)}::numeric) = 0)`);
        break;
      case "unusual-pairing": {
        const pairs = settings.pairings
          .map((p) => PAIRING_BY_KEY[p])
          .map((p) => `e.classes @> ${add([p.left, p.right])}::text[]`);
        if (pairs.length > 0) clauses.push(`(${pairs.join(" OR ")})`);
        break;
      }
      case "year-end-volume":
        clauses.push("te.rank IS NOT NULL");
        break;
      case "incomplete-description":
        clauses.push(`(${descriptionSql} <> '' AND (
             char_length(${descriptionSql}) < ${add(settings.minDescriptionChars)}::int
             OR coalesce(array_length(regexp_split_to_array(${descriptionSql}, '\\s+'), 1), 0) < ${add(settings.minDescriptionWords)}::int
             OR ${descriptionSql} !~ '[[:alpha:]]'
             OR ${descriptionSql} ~* ${add(fillerRegex(settings.uninformativeTerms))}))`);
        break;
      case "preparer-is-reviewer":
        clauses.push(`(nullif(lower(trim(l.preparer)), '') IS NOT NULL
                       AND lower(trim(l.preparer)) = lower(trim(l.reviewer)))`);
        break;
      case "preparer-is-approver":
        clauses.push(`(nullif(lower(trim(l.preparer)), '') IS NOT NULL
                       AND lower(trim(l.preparer)) = lower(trim(l.approver)))`);
        break;
      default:
        break;
    }
  }
  if (userRulesMode === "all" && userRules.length > 0) {
    clauses.push(`(${userRules.map((rule) => userRuleSql(rule, add)).join(" AND ")})`);
  } else {
    for (const rule of userRules) clauses.push(userRuleSql(rule, add));
  }
  if (clauses.length === 0) return [];

  const q = await tx.query<CandidateRow>(
    `WITH ${ctes.join(",\n")}
     SELECT l.id::text AS id, l.line_no, l.je_number, l.journal_code,
            to_char(l.journal_date, 'YYYY-MM-DD') AS journal_date,
            to_char(l.entry_date, 'YYYY-MM-DD') AS entry_date,
            l.account, l.account_name, l.je_description, l.line_description,
            l.debit::float8 AS debit, l.credit::float8 AS credit, l.signed::float8 AS signed,
            l.preparer, l.reviewer, l.approver, l.reference,
            l.third_party_code, l.third_party_name, l.cost_center,
            e.lines AS entry_lines, e.gross AS entry_gross, e.classes AS entry_classes,
            ${wantsYearEnd ? "te.rank" : "NULL::int"} AS year_end_rank
       FROM gl_line l
       JOIN entry e ON e.je_number = l.je_number
       ${wantsYearEnd ? "LEFT JOIN top_entry te ON te.je_number = l.je_number" : ""}
      WHERE ${SCOPE} AND (${clauses.join(" OR ")})
      ORDER BY l.journal_date NULLS LAST, l.je_number, l.line_no
      LIMIT ${CANDIDATE_CEILING}`,
    params,
  );

  return q.rows.map((r) => ({
    id: r.id,
    lineNo: r.line_no,
    jeNumber: r.je_number,
    journalCode: r.journal_code,
    journalDate: r.journal_date,
    entryDate: r.entry_date,
    account: r.account,
    accountName: r.account_name,
    jeDescription: r.je_description,
    lineDescription: r.line_description,
    debit: round2(r.debit),
    credit: round2(r.credit),
    signed: round2(r.signed),
    preparer: r.preparer,
    reviewer: r.reviewer,
    approver: r.approver,
    reference: r.reference,
    thirdPartyCode: r.third_party_code,
    thirdPartyName: r.third_party_name,
    costCenter: r.cost_center,
    entry: {
      lines: r.entry_lines,
      grossValue: round2(r.entry_gross),
      classes: (r.entry_classes ?? []).filter((c): c is SelectionClass => c in CLASS_LABEL),
      yearEndRank: r.year_end_rank,
    },
  }));
}

/**
 * A description made of nothing but filler terms, figures and punctuation,
 * however long it runs. The terms arrive from a parameter, so they are escaped
 * before they reach the pattern.
 */
function fillerRegex(terms: string[]): string {
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&")).join("|");
  const gap = "[^[:alpha:]]";
  return `^${gap}*(${escaped})(${gap}+(${escaped}))*${gap}*$`;
}

function userRuleSql(rule: NormalisedUserRule, add: (value: unknown) => string): string {
  const column = rule.field.column;
  if (rule.operator === "isEmpty") return `coalesce(trim(${column}::text), '') = ''`;
  if (rule.operator === "isNotEmpty") return `coalesce(trim(${column}::text), '') <> ''`;

  if (rule.field.type === "number") {
    const value = add(rule.value);
    switch (rule.operator) {
      case "equals": return `abs(${column} - ${value}::numeric) <= ${add(TOLERANCE)}::numeric`;
      case "notEquals": return `abs(${column} - ${value}::numeric) > ${add(TOLERANCE)}::numeric`;
      case "greaterThan": return `${column} > ${value}::numeric`;
      case "greaterOrEqual": return `${column} >= ${value}::numeric`;
      case "lessThan": return `${column} < ${value}::numeric`;
      case "lessOrEqual": return `${column} <= ${value}::numeric`;
      case "between": {
        const other = add(rule.value2);
        return `${column} BETWEEN least(${value}::numeric, ${other}::numeric) AND greatest(${value}::numeric, ${other}::numeric)`;
      }
      default: throw new Error("invalid-rule-operator");
    }
  }

  if (rule.field.type === "date") {
    const value = add(rule.value);
    switch (rule.operator) {
      case "equals": return `${column} = ${value}::date`;
      case "before": return `${column} < ${value}::date`;
      case "after": return `${column} > ${value}::date`;
      case "between": {
        const other = add(rule.value2);
        return `${column} BETWEEN least(${value}::date, ${other}::date) AND greatest(${value}::date, ${other}::date)`;
      }
      default: throw new Error("invalid-rule-operator");
    }
  }

  // text comparisons are case-insensitive on both sides — the value arrived
  // lower-cased from normaliseUserRule — and % and _ are LIKE wildcards, which
  // a user typing them means literally
  const literal = String(rule.value ?? "").replace(/([%_\\])/g, "\\$1");
  const actual = `lower(trim(coalesce(${column}::text, '')))`;
  switch (rule.operator) {
    case "equals": return `${actual} = ${add(rule.value)}`;
    case "notEquals": return `${actual} <> ${add(rule.value)}`;
    case "contains": return `${actual} LIKE '%' || ${add(literal)} || '%' ESCAPE '\\'`;
    case "notContains": return `${actual} NOT LIKE '%' || ${add(literal)} || '%' ESCAPE '\\'`;
    case "startsWith": return `${actual} LIKE ${add(literal)} || '%' ESCAPE '\\'`;
    case "endsWith": return `${actual} LIKE '%' || ${add(literal)} ESCAPE '\\'`;
    default: throw new Error("invalid-rule-operator");
  }
}

// ---------------------------------------------------------------------------
// the firm's own holiday dates

export interface FirmHolidayInput {
  country: string;
  /** YYYY-MM-DD */
  holidayDate: string;
  labelEn: string;
  labelFr: string;
  /** null applies the date to every engagement the firm runs */
  engagementId?: string | null;
}

/**
 * Add a date the seeded calendar does not carry. Two of Cameroon's public
 * holidays — Eid al-Fitr and Eid al-Adha — are declared each year by the
 * authorities rather than falling on a fixed date, and the migration seeds only
 * dates that could be verified. This is how the year in front of the auditor
 * gets its own, from the official announcement rather than from a computation.
 */
export async function addFirmHoliday(input: FirmHolidayInput): Promise<string> {
  const country = String(input.country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new Error("invalid-country");
  const date = String(input.holidayDate ?? "").trim();
  if (!ISO_DATE_RE.test(date)) throw new Error("invalid-date");
  const labelEn = String(input.labelEn ?? "").trim().slice(0, 120);
  const labelFr = String(input.labelFr ?? "").trim().slice(0, 120);
  if (!labelEn || !labelFr) throw new Error("label-required");
  const engagementId = input.engagementId ?? null;
  if (engagementId) await assertMutable(engagementId);

  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const q = await tx.query<{ id: string }>(
      `INSERT INTO firm_holiday
         (tenant_id, engagement_id, country, holiday_date, label_en, label_fr, created_by)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7)
       RETURNING id::text AS id`,
      [tenantId, engagementId, country, date, labelEn, labelFr, userId],
    );
    return q.rows[0].id;
  });
}

/** Remove one of the firm's own dates. The seeded national calendar is not writable from here. */
export async function removeFirmHoliday(id: string, engagementId?: string | null): Promise<void> {
  if (engagementId) await assertMutable(engagementId);
  const { tenantId } = await requireWrite();
  await withTenant(tenantId, async (tx) => {
    await tx.query("DELETE FROM firm_holiday WHERE id = $1", [id]);
  });
}

/** The calendar one engagement is tested against, national dates and firm dates together. */
export async function listHolidays(
  engagementId: string,
  country = "CM",
): Promise<{ date: string; labelEn: string; labelFr: string; origin: "national" | "firm" }[]> {
  const code = /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : "CM";
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const map = await loadHolidays(tx, engagementId, code);
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, label]) => ({ date, labelEn: label.labelEn, labelFr: label.labelFr, origin: label.origin }));
  });
}

/**
 * Record the selection design on S5.4 (UAT B76): the criteria, thresholds and
 * rules the auditor chose, with who ran them and when, so the paper shows how
 * the sample was directed before the testing starts.
 *
 * UAT run 2 B16: only on the auditor's explicit instruction (recordDesign), by
 * a team member who can write, on an open file. The design it replaces is
 * kept as dated history (je_design_history) rather than overwritten, a run
 * that selected nothing is not recorded, and the S5.4 sign-offs given over the
 * previous design are voided and reported.
 */
export async function recordSelectionDesign(
  engagementId: string,
  design: { datasetId: string; criteria: string[]; params: SelectionParams; userRules: UserRule[]; userRulesMode?: "any" | "all"; selectedLines: number; populationLines: number },
): Promise<void> {
  if (design.populationLines === 0 || design.selectedLines === 0) throw new Error("je-design-empty");
  await assertMutable(engagementId);
  const { tenantId, userId } = await requireWrite();
  const { invalidateStaleSignoffs, reportInvalidatedSignoffs } = await import("@/lib/working-papers");
  const invalidated = await withTenant(tenantId, async (tx) => {
    const who = await tx.query<{ name: string }>("SELECT coalesce(name, email) AS name FROM app_user WHERE id = $1", [userId]);
    const record = { ...design, recordedBy: who.rows[0]?.name ?? userId, recordedAt: new Date().toISOString() };
    const prior = await tx.query<{ field_key: string; value: string }>(
      `SELECT field_key, value #>> '{}' AS value FROM form_response
        WHERE engagement_id = $1 AND code = 'wp:S5.4' AND field_key IN ('je_design', 'je_design_history')
        FOR UPDATE`,
      [engagementId],
    );
    const current = prior.rows.find((r) => r.field_key === "je_design")?.value;
    let history: unknown[] = [];
    try {
      const parsed = JSON.parse(prior.rows.find((r) => r.field_key === "je_design_history")?.value ?? "[]");
      if (Array.isArray(parsed)) history = parsed;
    } catch {
      history = [];
    }
    if (current) {
      try {
        history.push(JSON.parse(current));
      } catch {
        history.push(current);
      }
    }
    const upsert = (key: string, value: string) =>
      tx.query(
        `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by, carried_forward)
         VALUES ($1, $2, 'wp:S5.4', $3, to_jsonb($4::text), $5, false)
         ON CONFLICT (engagement_id, code, field_key)
         DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, carried_forward = false, updated_at = now()`,
        [tenantId, engagementId, key, value, userId],
      );
    if (current) await upsert("je_design_history", JSON.stringify(history));
    await upsert("je_design", JSON.stringify(record));
    return invalidateStaleSignoffs(tx, engagementId, "S5.4");
  });
  await reportInvalidatedSignoffs(tenantId, engagementId, "S5.4", invalidated, userId);
}

/** A recorded S5.4 design, as stored in form_response (je_design / je_design_history). */
export interface RecordedSelectionDesign {
  criteria?: string[];
  params?: SelectionParams;
  userRules?: UserRule[];
  userRulesMode?: "any" | "all";
  selectedLines?: number;
  populationLines?: number;
  recordedBy?: string;
  recordedAt?: string;
}

/**
 * One design as the S5.4 paper prints it, in the reader's language: criteria by
 * name with the thresholds they ran with (defaults when none were set), the
 * user rules, the size of the selection and who recorded it when, in the firm's
 * zone (UAT B133 / run 3 B11: slugs, no thresholds, UTC time).
 */
export function describeSelectionDesign(d: RecordedSelectionDesign, locale: Locale): string {
  const fr = locale === "fr";
  const settings = resolveSettings(d.params ?? {});
  const num = new Intl.NumberFormat(fr ? "fr-FR" : "en-GB");
  const colon = fr ? " : " : ": ";
  const criteria = (d.criteria ?? []).map((key) => {
    const def = CRITERION_BY_KEY[key];
    if (!def) return key;
    const name = fr ? def.nameFr : def.nameEn;
    const parts = def.params.map((param) => {
      const label = fr ? param.labelFr : param.labelEn;
      if (param.kind === "multi") {
        const raw = (d.params as unknown as Record<string, unknown> | undefined)?.[param.key];
        const list = Array.isArray(raw) && raw.length > 0 ? raw : (param.default as readonly string[]);
        if (param.key === "pairings") {
          const names = settings.pairings.map((k) => (fr ? PAIRING_BY_KEY[k]?.labelFr : PAIRING_BY_KEY[k]?.labelEn) ?? k);
          return `${label}${colon}${names.join(", ")}`;
        }
        return `${label}${colon}${list.join(", ")}`;
      }
      const value = (settings as unknown as Record<string, unknown>)[param.key];
      if (param.kind === "choice") {
        const option = param.options?.find((o) => o.value === value);
        return `${label}${colon}${option ? (fr ? option.labelFr : option.labelEn) : String(value)}`;
      }
      if (typeof value === "number") return `${label}${colon}${num.format(value)}`;
      return `${label}${colon}${String(value ?? "")}`;
    });
    return parts.length > 0 ? `${name} (${parts.join(" ; ")})` : name;
  });
  const rules = (d.userRules ?? []).map((rule, i) => {
    try {
      const r = normaliseUserRule(rule, i);
      return fr ? r.labelFr : r.labelEn;
    } catch {
      return fr ? "règle invalide" : "invalid rule";
    }
  });
  let when = "";
  if (d.recordedAt) {
    const at = new Date(d.recordedAt);
    when = Number.isNaN(at.getTime())
      ? d.recordedAt
      : new Intl.DateTimeFormat(fr ? "fr-FR" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Africa/Douala",
        }).format(at) + " WAT";
  }
  const criteriaText = criteria.join(" · ") || "—";
  const joined = d.userRulesMode === "all" && rules.length > 1
    ? (fr ? " (toutes les conditions)" : " (all conditions)")
    : "";
  const rulesText = rules.length > 0 ? `${rules.length}${joined} — ${rules.join(" ; ")}` : "0";
  return fr
    ? `Critères : ${criteriaText} · règles : ${rulesText} · ${d.selectedLines ?? 0} ligne(s) sélectionnée(s) sur ${d.populationLines ?? 0} · par ${d.recordedBy ?? "—"} le ${when}`
    : `Criteria: ${criteriaText} · rules: ${rulesText} · ${d.selectedLines ?? 0} line(s) selected of ${d.populationLines ?? 0} · by ${d.recordedBy ?? "—"} on ${when}`;
}
