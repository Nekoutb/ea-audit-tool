// The edition of the ISAs an engagement is audited under (F045, firm decision
// 2026-10-27). ISA 240 (Revised) and ISA 570 (Revised 2024) apply to audits of
// financial statements for periods beginning on or after 15 December 2026;
// until then the editions in force apply. An engagement opened for a period
// starting before that date therefore reads "ISA 570 (Revised) ¶13 — twelve
// months from the date of the financial statements", one starting after it
// reads "ISA 570 (Revised 2024) ¶13 — twelve months from the approval".
//
// The paper definitions carry {{tokens}} where a reference or a wording
// depends on the edition; `resolvePaper` substitutes them for the engagement's
// edition. Nothing here touches the database: lib/engagements.ts stores the
// edition, this module only derives and renders it.

import { getMessages, type Locale } from "@/lib/i18n";
import type { PaperDef } from "@/lib/papers/types";

export const STANDARDS_EDITIONS = ["current", "revised_2026"] as const;
export type StandardsEdition = (typeof STANDARDS_EDITIONS)[number];

/** Periods beginning on or after this date apply the revised standards. */
export const REVISED_2026_FROM = "2026-12-15";

export function isStandardsEdition(value: unknown): value is StandardsEdition {
  return typeof value === "string" && (STANDARDS_EDITIONS as readonly string[]).includes(value);
}

/**
 * The first day of the period: the day after the period end, less the duration
 * (twelve months when the engagement never said) — so a six-month period ending
 * 30 June begins on 1 January, not 31 December. Pure calendar arithmetic on ISO
 * dates, the same formula as the SQL backfill of 20261103000001
 * (`period_end + 1 - make_interval(months => …)`), so the two never disagree.
 */
export function periodStartOf(periodEnd: string, durationMonths?: number | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(periodEnd);
  if (!m) throw new Error("invalid-period-end");
  const months = durationMonths && durationMonths > 0 ? Math.floor(durationMonths) : 12;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  // Postgres `date - interval 'n months'` clamps to the last day of the target
  // month (31 March − 1 month = 28 February); mirror it.
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

/** The edition a period beginning on `periodStart` falls under. */
export function defaultStandardsEdition(periodStart: string | Date | null | undefined): StandardsEdition {
  if (!periodStart) return "current";
  const iso = typeof periodStart === "string" ? periodStart.slice(0, 10) : periodStart.toISOString().slice(0, 10);
  return iso >= REVISED_2026_FROM ? "revised_2026" : "current";
}

/** Convenience for the creation path, which knows the period end and the duration. */
export function editionForPeriod(periodEnd: string, durationMonths?: number | null): StandardsEdition {
  return defaultStandardsEdition(periodStartOf(periodEnd, durationMonths));
}

/** "Standards edition: ISA in force" — the header line of a paper, a workbook, a document. */
export function editionLabel(edition: StandardsEdition, locale: Locale): string {
  const m = getMessages(locale).standardsEdition;
  return m[edition];
}
export function editionLine(edition: StandardsEdition, locale: Locale): string {
  const m = getMessages(locale).standardsEdition;
  return `${m.label}${locale === "fr" ? " : " : ": "}${m[edition]}`;
}

/* ------------------------------------------------------------------ refs --- */

type Pair = readonly [en: string, fr: string];
interface RefEntry {
  current: Pair;
  revised_2026: Pair;
}

/**
 * Every edition-dependent reference or wording, keyed the way the papers cite
 * it. `current` is the text in force today (ISA 240 of 2009 as amended, ISA 570
 * (Revised) of 2015).
 *
 * TO VERIFY — ISA 240 (Revised) and ISA 570 (Revised 2024) renumber their
 * requirements, and the final paragraph numbers were not checked against the
 * published texts when this table was written (2026-11-03). Every
 * `revised_2026` entry below therefore keeps the current paragraph number
 * under the revised title until the firm's technical desk confirms the
 * mapping; correcting a number here corrects every paper, workbook and
 * narrative at once.
 */
const REFS = {
  /* ---- names ---- */
  ISA240: { current: ["ISA 240", "ISA 240"], revised_2026: ["ISA 240 (Revised)", "ISA 240 révisée"] },
  ISA570: {
    current: ["ISA 570 (Revised)", "ISA 570 révisée"],
    revised_2026: ["ISA 570 (Revised 2024)", "ISA 570 révisée 2024"],
  },

  /* ---- ISA 240 — the paper anchors ---- */
  "ISA240.std.P51": {
    current: ["ISA 240 ¶12–27, ¶31–33, ¶40–43", "ISA 240 ¶12–27, ¶31–33, ¶40–43"],
    revised_2026: ["ISA 240 (Revised) ¶12–27, ¶31–33, ¶40–43", "ISA 240 révisée ¶12–27, ¶31–33, ¶40–43"], // to verify
  },
  "ISA240.std.E31": {
    current: ["ISA 240 ¶31–34, ¶36–37 · ISA 240 ¶29(c)", "ISA 240 ¶31–34, ¶36–37 · ISA 240 ¶29 c)"],
    revised_2026: ["ISA 240 (Revised) ¶31–34, ¶36–37 · ISA 240 (Revised) ¶29(c)", "ISA 240 révisée ¶31–34, ¶36–37 · ISA 240 révisée ¶29 c)"], // to verify
  },
  /* ---- ISA 240 — requirements ---- */
  "ISA240.records": { current: ["ISA 240 ¶13", "ISA 240 ¶13"], revised_2026: ["ISA 240 (Revised) ¶13", "ISA 240 révisée ¶13"] }, // to verify
  "ISA240.discussion": { current: ["ISA 240 ¶16", "ISA 240 ¶16"], revised_2026: ["ISA 240 (Revised) ¶16", "ISA 240 révisée ¶16"] }, // to verify
  "ISA240.assess": { current: ["ISA 240 ¶25", "ISA 240 ¶25"], revised_2026: ["ISA 240 (Revised) ¶25", "ISA 240 révisée ¶25"] }, // to verify
  "ISA240.revenue": { current: ["ISA 240 ¶26, ¶47", "ISA 240 ¶26, ¶47"], revised_2026: ["ISA 240 (Revised) ¶26, ¶47", "ISA 240 révisée ¶26, ¶47"] }, // to verify
  "ISA240.unpredictability": { current: ["ISA 240 ¶29(c)", "ISA 240 ¶29 c)"], revised_2026: ["ISA 240 (Revised) ¶29(c)", "ISA 240 révisée ¶29 c)"] }, // to verify
  "ISA240.override": { current: ["ISA 240 ¶31", "ISA 240 ¶31"], revised_2026: ["ISA 240 (Revised) ¶31", "ISA 240 révisée ¶31"] }, // to verify
  "ISA240.overrideResponses": { current: ["ISA 240 ¶31–33", "ISA 240 ¶31–33"], revised_2026: ["ISA 240 (Revised) ¶31–33", "ISA 240 révisée ¶31–33"] }, // to verify
  "ISA240.jeTesting": { current: ["ISA 240 ¶32", "ISA 240 ¶32"], revised_2026: ["ISA 240 (Revised) ¶32", "ISA 240 révisée ¶32"] }, // to verify
  "ISA240.jeInquiry": { current: ["ISA 240 ¶33(a)", "ISA 240 ¶33 a)"], revised_2026: ["ISA 240 (Revised) ¶33(a)", "ISA 240 révisée ¶33 a)"] }, // to verify
  "ISA240.jeCriteria": { current: ["ISA 240 ¶33(b)", "ISA 240 ¶33 b)"], revised_2026: ["ISA 240 (Revised) ¶33(b)", "ISA 240 révisée ¶33 b)"] }, // to verify
  "ISA240.unusual": { current: ["ISA 240 ¶33(c)", "ISA 240 ¶33 c)"], revised_2026: ["ISA 240 (Revised) ¶33(c)", "ISA 240 révisée ¶33 c)"] }, // to verify
  "ISA240.evaluate": { current: ["ISA 240 ¶35–36", "ISA 240 ¶35-36"], revised_2026: ["ISA 240 (Revised) ¶35–36", "ISA 240 révisée ¶35-36"] }, // to verify
  "ISA240.representations": { current: ["ISA 240 ¶39", "ISA 240 ¶39"], revised_2026: ["ISA 240 (Revised) ¶39", "ISA 240 révisée ¶39"] }, // to verify
  "ISA240.commMgmt": { current: ["ISA 240 ¶40", "ISA 240 ¶40"], revised_2026: ["ISA 240 (Revised) ¶40", "ISA 240 révisée ¶40"] }, // to verify
  "ISA240.commTcwg": { current: ["ISA 240 ¶41", "ISA 240 ¶41"], revised_2026: ["ISA 240 (Revised) ¶41", "ISA 240 révisée ¶41"] }, // to verify
  "ISA240.commOther": { current: ["ISA 240 ¶42", "ISA 240 ¶42"], revised_2026: ["ISA 240 (Revised) ¶42", "ISA 240 révisée ¶42"] }, // to verify
  "ISA240.authorities": { current: ["ISA 240 ¶43", "ISA 240 ¶43"], revised_2026: ["ISA 240 (Revised) ¶43", "ISA 240 révisée ¶43"] }, // to verify

  /* ---- ISA 570 — the paper anchors ---- */
  "ISA570.std.S42": { current: ["ISA 570 (Revised) ¶10–12", "ISA 570 révisée ¶10–12"], revised_2026: ["ISA 570 (Revised 2024) ¶10–12", "ISA 570 révisée 2024 ¶10–12"] }, // to verify
  "ISA570.std.E63": { current: ["ISA 570 (Revised) ¶12–20, ¶25", "ISA 570 révisée ¶12–20, ¶25"], revised_2026: ["ISA 570 (Revised 2024) ¶12–20, ¶25", "ISA 570 révisée 2024 ¶12–20, ¶25"] }, // to verify
  "ISA570.std.C22": { current: ["ISA 570 (Revised) ¶21–24", "ISA 570 révisée ¶21–24"], revised_2026: ["ISA 570 (Revised 2024) ¶21–24", "ISA 570 révisée 2024 ¶21–24"] }, // to verify
  /* ---- ISA 570 — requirements ---- */
  "ISA570.riskAssessment": { current: ["ISA 570 (Revised) ¶10–11", "ISA 570 révisée ¶10–11"], revised_2026: ["ISA 570 (Revised 2024) ¶10–11", "ISA 570 révisée 2024 ¶10–11"] }, // to verify
  "ISA570.period": { current: ["ISA 570 (Revised) ¶13", "ISA 570 révisée ¶13"], revised_2026: ["ISA 570 (Revised 2024) ¶13", "ISA 570 révisée 2024 ¶13"] }, // to verify
  "ISA570.plans": { current: ["ISA 570 (Revised) ¶16", "ISA 570 révisée ¶16"], revised_2026: ["ISA 570 (Revised 2024) ¶16", "ISA 570 révisée 2024 ¶16"] }, // to verify
  "ISA570.representation": { current: ["ISA 570 (Revised) ¶16(e)", "ISA 570 révisée ¶16 e)"], revised_2026: ["ISA 570 (Revised 2024) ¶16(e)", "ISA 570 révisée 2024 ¶16 e)"] }, // to verify
  "ISA570.muDisclosure": { current: ["ISA 570 (Revised) ¶19", "ISA 570 révisée ¶19"], revised_2026: ["ISA 570 (Revised 2024) ¶19", "ISA 570 révisée 2024 ¶19"] }, // to verify
  "ISA570.closeCall": { current: ["ISA 570 (Revised) ¶20", "ISA 570 révisée ¶20"], revised_2026: ["ISA 570 (Revised 2024) ¶20", "ISA 570 révisée 2024 ¶20"] }, // to verify
  "ISA570.conclusions": { current: ["ISA 570 (Revised) ¶21–24", "ISA 570 révisée ¶21–24"], revised_2026: ["ISA 570 (Revised 2024) ¶21–24", "ISA 570 révisée 2024 ¶21–24"] }, // to verify
  "ISA570.basis": { current: ["ISA 570 (Revised) ¶21", "ISA 570 révisée ¶21"], revised_2026: ["ISA 570 (Revised 2024) ¶21", "ISA 570 révisée 2024 ¶21"] }, // to verify
  "ISA570.muSection": { current: ["ISA 570 (Revised) ¶22", "ISA 570 révisée ¶22"], revised_2026: ["ISA 570 (Revised 2024) ¶22", "ISA 570 révisée 2024 ¶22"] }, // to verify
  "ISA570.muModified": { current: ["ISA 570 (Revised) ¶23", "ISA 570 révisée ¶23"], revised_2026: ["ISA 570 (Revised 2024) ¶23", "ISA 570 révisée 2024 ¶23"] }, // to verify
  "ISA570.communicate": { current: ["ISA 570 (Revised) ¶25", "ISA 570 révisée ¶25"], revised_2026: ["ISA 570 (Revised 2024) ¶25", "ISA 570 révisée 2024 ¶25"] }, // to verify

  /* ---- ISA 570 — the wording that changed in 2024 ---- */
  /** the assessment period, as a phrase: "covers {{ISA570.horizon}}" */
  "ISA570.horizon": {
    current: [
      "at least twelve months from the date of the financial statements (ISA 570 (Revised) ¶13)",
      "au moins douze mois à compter de la date de clôture des états financiers (ISA 570 révisée ¶13)",
    ],
    revised_2026: [
      "at least twelve months from the date of approval of the financial statements (ISA 570 (Revised 2024) ¶13)",
      "au moins douze mois à compter de la date d'approbation des états financiers (ISA 570 révisée 2024 ¶13)",
    ],
  },
  /** where the clock starts, as a clause after a dash */
  "ISA570.horizonClock": {
    current: [
      "under the edition in force the period is measured from the balance sheet date; ISA 570 (Revised 2024), which measures it from the approval of the financial statements, applies to periods beginning on or after 15 December 2026, and a longer horizon is still examined where the facts call for it (¶15)",
      "selon l'édition en vigueur la période se mesure à partir de la date de clôture ; l'ISA 570 révisée 2024, qui la mesure à compter de l'approbation des états financiers, s'applique aux exercices ouverts à partir du 15 décembre 2026, et un horizon plus long reste examiné lorsque les faits l'exigent (¶15)",
    ],
    revised_2026: [
      "the clock starts at approval, not at the period end, so a SYSCOHADA entity approving its accounts four to six months after the year end needs a forecast reaching sixteen to eighteen months past the balance sheet date",
      "le délai court à partir de l'approbation, non de la clôture, de sorte qu'une entité SYSCOHADA qui approuve ses comptes quatre à six mois après la clôture a besoin d'une prévision atteignant seize à dix-huit mois au-delà de la date du bilan",
    ],
  },
  /** the date the twelve months run from, as a noun phrase */
  "ISA570.horizonFrom": {
    current: ["the date of the financial statements", "la date de clôture des états financiers"],
    revised_2026: ["the date of approval of the financial statements", "la date d'approbation des états financiers"],
  },
} as const satisfies Record<string, RefEntry>;

export type IsaRefKey = keyof typeof REFS;

/** The reference string for one requirement under one edition: isaRef('current', 'ISA240.jeTesting') → "ISA 240 ¶32". */
export function isaRef(edition: StandardsEdition, key: IsaRefKey, locale: Locale = "en"): string {
  const entry: RefEntry = REFS[key];
  const pair = entry[edition];
  return locale === "fr" ? pair[1] : pair[0];
}

export const ISA_REF_KEYS = Object.keys(REFS) as IsaRefKey[];

/* ------------------------------------------------------------ resolution --- */

const TOKEN = /\{\{([A-Za-z0-9_.]+)\}\}/g;

/** Substitute every {{key}} in one string for the edition and language given. Unknown keys are left visible. */
export function resolveText(text: string, edition: StandardsEdition, locale: Locale): string {
  if (!text.includes("{{")) return text;
  return text.replace(TOKEN, (whole, key: string) =>
    key in REFS ? isaRef(edition, key as IsaRefKey, locale) : whole,
  );
}

/** Which language a paper property is written in, from its name: `fr`, `srcFr`, `tipFr`, `reqFr`… */
function langOf(key: string): Locale {
  return key === "fr" || key.endsWith("Fr") ? "fr" : "en";
}

function resolveValue(value: unknown, edition: StandardsEdition, locale: Locale): unknown {
  if (typeof value === "string") return resolveText(value, edition, locale);
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, edition, locale));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveValue(v, edition, langOf(k));
    }
    return out;
  }
  return value;
}

const CACHE: Record<StandardsEdition, WeakMap<PaperDef, PaperDef>> = {
  current: new WeakMap(),
  revised_2026: new WeakMap(),
};

/**
 * The paper as the engagement reads it: every {{token}} replaced by the
 * reference or wording of its edition. The result is cached per definition
 * and edition, so the wizard's useMemo sees one stable object.
 */
export function resolvePaper(def: PaperDef, edition: StandardsEdition): PaperDef {
  const hit = CACHE[edition].get(def);
  if (hit) return hit;
  const resolved = resolveValue(def, edition, "en") as PaperDef;
  CACHE[edition].set(def, resolved);
  return resolved;
}

/** True when a paper still carries an unresolved token — the test that guards the catalogue. */
export function hasUnresolvedToken(text: string): boolean {
  return /\{\{[A-Za-z0-9_.]+\}\}/.test(text);
}
