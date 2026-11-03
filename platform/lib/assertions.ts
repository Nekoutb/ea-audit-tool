// The platform's assertion set, pure and client-safe: the six codes the risk
// register, the CRA matrix (S3.1) and the procedure design (S5.5) share, with
// the full label each one is shown under (F041, 2026-10-27: a bare "C" or
// "RO" in a drop-down is not a label — every option and chip spells the
// assertion out, and a legend sits beside each board).
//
// lib/risks.ts and lib/design-procedures-model.ts re-export from here so the
// existing import paths keep working; nothing in this file touches the
// database, so a client component may import the values.

export const ASSERTIONS = ["C", "E", "A", "V", "P", "RO"] as const;
export type Assertion = (typeof ASSERTIONS)[number];

export const ASSERTION_LABELS: Record<Assertion, { en: string; fr: string }> = {
  C: { en: "Completeness", fr: "Exhaustivité" },
  E: { en: "Existence / occurrence", fr: "Existence / réalité" },
  A: { en: "Accuracy / cut-off", fr: "Exactitude / séparation" },
  V: { en: "Valuation", fr: "Évaluation" },
  P: { en: "Presentation / disclosure", fr: "Présentation / information" },
  RO: { en: "Rights and obligations", fr: "Droits et obligations" },
};

export function isAssertion(v: unknown): v is Assertion {
  return typeof v === "string" && (ASSERTIONS as readonly string[]).includes(v);
}

/** Keep only the platform codes, in the order given, without duplicates. */
export function cleanAssertions(values: unknown): Assertion[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(isAssertion))];
}

/** The long name alone: "Completeness" / "Exhaustivité". Unknown codes come back as typed. */
export function assertionName(code: string, locale: "en" | "fr"): string {
  const pair = isAssertion(code) ? ASSERTION_LABELS[code] : undefined;
  return pair ? pair[locale] : code;
}

/** The full label every select, option and chip shows: "C — Completeness". */
export function assertionLabel(code: string, locale: "en" | "fr"): string {
  return isAssertion(code) ? `${code} — ${ASSERTION_LABELS[code][locale]}` : code;
}

/** Several codes as full labels, for a chip: "C — Completeness · E — Existence / occurrence". */
export function assertionLabels(codes: readonly string[], locale: "en" | "fr"): string {
  return codes.map((c) => assertionLabel(c, locale)).join(" · ");
}
