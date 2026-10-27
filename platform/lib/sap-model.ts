// Substantive analytical procedures (F038, decision of 2026-10-27), the pure
// part: the threshold a difference is measured against and the evaluation of
// expected against recorded. Client-safe — no server dependencies.
//
// ISA 520 ¶5: the auditor builds an expectation precise enough to identify a
// misstatement that, alone or in aggregate, could be material, and sets the
// amount of difference from the expectation that is acceptable without
// further investigation (¶5(d)). The firm expresses that amount as a share of
// performance materiality scaled by the CRA level of the account and
// assertion (S3.1): the more risk, the smaller the acceptable difference.

import type { CraLevel } from "@/lib/cra-model";

/** Percentage of performance materiality per CRA level (a minimal CRA takes the low percentage). */
export interface SapThresholds {
  low: number;
  moderate: number;
  high: number;
}

export const DEFAULT_SAP_THRESHOLDS: SapThresholds = { low: 75, moderate: 50, high: 25 };

export const SAP_PCT_MIN = 1;
export const SAP_PCT_MAX = 100;

/** The assertions a procedure may address — the S3.1 vocabulary. */
export const SAP_ASSERTIONS = ["C", "E", "A", "V", "P"] as const;
export type SapAssertion = (typeof SAP_ASSERTIONS)[number];

export function sapAssertionLabel(a: SapAssertion, locale: "en" | "fr"): string {
  const en: Record<SapAssertion, string> = { C: "Completeness", E: "Existence / occurrence", A: "Accuracy / cut-off", V: "Valuation", P: "Presentation" };
  const fr: Record<SapAssertion, string> = { C: "Exhaustivité", E: "Existence / réalité", A: "Exactitude / séparation", V: "Évaluation", P: "Présentation" };
  return locale === "fr" ? fr[a] : en[a];
}

export function isSapAssertion(v: unknown): v is SapAssertion {
  return typeof v === "string" && (SAP_ASSERTIONS as readonly string[]).includes(v);
}

export function isSapPct(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= SAP_PCT_MIN && v <= SAP_PCT_MAX;
}

/**
 * The firm's percentage for a CRA level. An account with no CRA recorded is
 * treated as high: the tightest threshold until S3.1 says otherwise.
 */
export function thresholdPctFor(level: CraLevel | null, thresholds: SapThresholds): number {
  if (level === "minimal" || level === "low") return thresholds.low;
  if (level === "moderate") return thresholds.moderate;
  return thresholds.high;
}

export interface SapEvaluation {
  /** performance materiality × percentage, null without an approved materiality */
  threshold: number | null;
  /** actual − expected, null without an actual */
  difference: number | null;
  /** |difference| > threshold; null when either side is unknown */
  exceeds: boolean | null;
}

export function evaluateSap(args: {
  expected: number;
  actual: number | null;
  performanceMateriality: number | null;
  pct: number;
}): SapEvaluation {
  const threshold = args.performanceMateriality === null ? null : Math.round((args.performanceMateriality * args.pct) / 100);
  const difference = args.actual === null ? null : Math.round(args.actual - args.expected);
  const exceeds = threshold === null || difference === null ? null : Math.abs(difference) > threshold;
  return { threshold, difference, exceeds };
}
