// Nature-of-entity assessment (ISA for LCE-inspired). Seventeen yes/no
// questions answered at engagement creation classify the entity as complex,
// non-complex or very simple. Certain answers (listing, public interest, group
// consolidation) disqualify the LCE route outright and force "complex"; the rest
// accumulate weighted points. The classification drives the nature, timing and
// extent of the work: lib/file-index.ts instantiates a heavier or lighter audit
// file per level. Pure data + pure functions — safe to import client-side for
// the live preview in the creation wizard.

export type EngagementComplexity = "complex" | "non_complex" | "very_simple";

export interface ComplexityQuestion {
  key: string;
  /** A "yes" forces the complex classification regardless of score. */
  autoComplex?: boolean;
  /** Points a "yes" adds toward complexity (ignored when autoComplex). */
  weight: number;
}

export const COMPLEXITY_QUESTIONS: readonly ComplexityQuestion[] = [
  { key: "listed", autoComplex: true, weight: 0 },
  { key: "publicInterest", autoComplex: true, weight: 0 },
  { key: "group", autoComplex: true, weight: 0 },
  { key: "jointAudit", weight: 2 },
  { key: "foreignOps", weight: 2 },
  { key: "complexFinancing", weight: 2 },
  { key: "complexRevenue", weight: 2 },
  { key: "estimates", weight: 2 },
  { key: "controlsReliance", weight: 1 },
  { key: "complexIt", weight: 1 },
  { key: "multiLocation", weight: 1 },
  { key: "largeSize", weight: 2 },
  { key: "firstAudit", weight: 1 },
  { key: "goingConcern", weight: 2 },
  { key: "relatedParties", weight: 1 },
  { key: "restructuring", weight: 2 },
  { key: "litigation", weight: 2 },
] as const;

/** Score at or above which the engagement is complex even without a knock-out. */
const COMPLEX_THRESHOLD = 8;
/** Score at or above which the engagement is at least non-complex. */
const NON_COMPLEX_THRESHOLD = 3;

export type ComplexityAnswers = Record<string, boolean>;

export function classifyComplexity(answers: ComplexityAnswers): {
  level: EngagementComplexity;
  score: number;
  knockouts: string[];
} {
  const knockouts = COMPLEXITY_QUESTIONS.filter((q) => q.autoComplex && answers[q.key]).map(
    (q) => q.key,
  );
  const score = COMPLEXITY_QUESTIONS.reduce(
    (sum, q) => sum + (!q.autoComplex && answers[q.key] ? q.weight : 0),
    0,
  );
  const level: EngagementComplexity =
    knockouts.length > 0 || score >= COMPLEX_THRESHOLD
      ? "complex"
      : score >= NON_COMPLEX_THRESHOLD
        ? "non_complex"
        : "very_simple";
  return { level, score, knockouts };
}

/** Parse checkbox form data (q_<key>=on) into an answers record. */
export function answersFromForm(get: (name: string) => unknown): ComplexityAnswers {
  const answers: ComplexityAnswers = {};
  for (const q of COMPLEXITY_QUESTIONS) {
    answers[q.key] = get(`q_${q.key}`) === "on";
  }
  return answers;
}

/** Default engagement naming convention; {CLIENT} and {YEAR} are substituted. */
export const DEFAULT_ENGAGEMENT_NAMING = "{CLIENT} AUDIT {YEAR}";

export function applyNamingConvention(pattern: string, clientName: string, fiscalYear: number | string): string {
  return (pattern || DEFAULT_ENGAGEMENT_NAMING)
    .replaceAll("{CLIENT}", clientName)
    .replaceAll("{YEAR}", String(fiscalYear))
    .trim();
}

/* ---- engagement identity profile (creation wizard) ---- */

/** Year-end period options: month-day, with display month names. */
export const YEAR_END_OPTIONS = [
  { value: "06-30", en: "June 30", fr: "30 juin" },
  { value: "07-31", en: "July 31", fr: "31 juillet" },
  { value: "12-31", en: "December 31", fr: "31 décembre" },
  { value: "03-31", en: "March 31", fr: "31 mars" },
] as const;

export const DURATION_OPTIONS = [6, 12] as const;

export const NATURE_OPTIONS = [
  { value: "statutory_audit", en: "Statutory audit", fr: "Commissariat aux comptes" },
  { value: "agreed_procedures", en: "Agreed-upon procedures", fr: "Procédures convenues" },
  { value: "other", en: "Other", fr: "Autre" },
] as const;

export const ENGAGEMENT_PHASE_OPTIONS = [
  { value: "interim", en: "Interim", fr: "Intérimaire" },
  { value: "year_end", en: "Year end", fr: "Clôture" },
] as const;

export const FRAMEWORK_OPTIONS = [
  { value: "syscohada", en: "SYSCOHADA", fr: "SYSCOHADA" },
  { value: "ifrs", en: "IFRS", fr: "IFRS" },
] as const;

/**
 * The generated engagement name: CLIENT_PERIOD END_NATURE, uppercase — e.g.
 * "ZOEDEN_DECEMBER 31 2026_STATUTORY AUDIT". The tool generates it; the user
 * does not type it.
 */
export function generateEngagementName(
  clientName: string,
  yearEnd: string,
  fiscalYear: number | string,
  nature: string,
): string {
  const period = YEAR_END_OPTIONS.find((o) => o.value === yearEnd);
  // a known option renders its English label; free text passes through as typed
  return [
    clientName.trim().toUpperCase(),
    `${(period?.en ?? "").toUpperCase()} ${fiscalYear}`,
    (NATURE_OPTIONS.find((o) => o.value === nature)?.en ?? nature.replaceAll("_", " ")).toUpperCase(),
  ]
    .filter(Boolean)
    .join("_")
    .slice(0, 120);
}
