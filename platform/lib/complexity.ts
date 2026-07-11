// Engagement complexity assessment (ISA for LCE-inspired). Fifteen yes/no
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
