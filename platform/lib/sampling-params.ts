// A2 sampling parameters — the §04 "arithmetic spine" as data + pure functions.
// MUS for tests of details, attribute plans for tests of controls (ISA 530).
// Sample size is computed, not typed (R17); every exception projects (R18).

/** §4.1 — required confidence → MUS confidence factor. */
export const CONFIDENCE_FACTORS = {
  99: 4.6,
  98: 3.7,
  95: 3.0,
  90: 2.3,
  85: 1.9,
  80: 1.6,
  75: 1.4,
  70: 1.2,
  65: 1.1,
  60: 0.9,
  55: 0.8,
  50: 0.7,
} as const;

export type ConfidenceLevel = keyof typeof CONFIDENCE_FACTORS;

/** Risk-reduction bands (§4.1): High = significant/elevated risk with no
 *  controls reliance; Moderate = some reliance from controls or analytics;
 *  Low = substantial assurance from other sources. */
export type RiskBand = "high" | "moderate" | "low";

export const RISK_BAND_CONFIDENCE: Record<RiskBand, ConfidenceLevel> = {
  high: 95,
  moderate: 85,
  low: 70,
};

export function riskBandToConfidence(band: RiskBand): ConfidenceLevel {
  return RISK_BAND_CONFIDENCE[band];
}

export interface MusPlanInput {
  /** Population to be tested — EXCLUDES high-value/key items examined 100%. */
  populationValue: number;
  /** Tolerable misstatement (performance materiality from the approved set). */
  tolerable: number;
  /** Expected misstatement — recorded with the plan; must stay below tolerable. */
  expected?: number;
  confidence: ConfidenceLevel;
}

export interface MusPlan {
  /** Sampling interval = tolerable ÷ confidence factor. */
  interval: number;
  /** Sample size = population ÷ interval, rounded up. */
  sampleSize: number;
  factor: number;
}

/** §4.1 MUS extent computation. Throws kebab-case codes the action layer
 *  surfaces in the error banner. */
export function musPlan(input: MusPlanInput): MusPlan {
  if (!(input.tolerable > 0)) throw new Error("tolerable-required");
  if (!(input.populationValue > 0)) throw new Error("empty-population");
  const factor = CONFIDENCE_FACTORS[input.confidence];
  if (!factor) throw new Error("invalid-confidence");
  if ((input.expected ?? 0) >= input.tolerable) throw new Error("expected-exceeds-tolerable");
  const interval = input.tolerable / factor;
  return { interval, sampleSize: Math.max(1, Math.ceil(input.populationValue / interval)), factor };
}

// ---- §4.2 attribute plans — tests of controls ----

export type ControlFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "annual"
  | "automated";

/** Minimum sample by control frequency. Many-times-daily controls use the
 *  10/30/60 plans — 30 items is the default plan; monthly band is 2–4 (we take
 *  4); automated = 1 only while GITC is effective (else R10 fires upstream).
 *  Sample size does not scale with population size. */
export const ATTRIBUTE_SAMPLE_SIZES: Record<ControlFrequency, number> = {
  daily: 30,
  weekly: 10,
  monthly: 4,
  quarterly: 2,
  annual: 1,
  automated: 1,
};

export function attributePlan(frequency: ControlFrequency): { sampleSize: number } {
  return { sampleSize: ATTRIBUTE_SAMPLE_SIZES[frequency] };
}

export type AttributeReliance = "high" | "moderate" | "none";

/** §4.2 deviation evaluation at 95%:
 *  60 items — ≤1 → high · 2 → moderate · >2 → none;
 *  30 items — 0 → high · 1 → moderate · >1 → none;
 *  10 items — 0 → moderate · any deviation → none (fires R11 upstream). */
export function evaluateAttribute(sampleSize: number, deviations: number): AttributeReliance {
  if (sampleSize >= 60) return deviations <= 1 ? "high" : deviations === 2 ? "moderate" : "none";
  if (sampleSize >= 30) return deviations === 0 ? "high" : deviations === 1 ? "moderate" : "none";
  return deviations === 0 ? "moderate" : "none";
}

// ---- §4.1 projection — most likely error (MLE) ----

export interface MleItem {
  bookValue: number;
  auditedValue: number;
}

/** Per-item misstatement percentage, averaged across sampled items, applied to
 *  the represented population = MLE. Items without a book value fall back to
 *  the ratio method over the sampled value. */
export function projectMLE(
  items: MleItem[],
  populationValue: number,
  sampledValue: number,
): { mle: number; percentMisstated: number } {
  const rated = items.filter((item) => item.bookValue !== 0);
  if (rated.length > 0) {
    const avg =
      rated.reduce((sum, item) => sum + (item.bookValue - item.auditedValue) / item.bookValue, 0) /
      rated.length;
    return { mle: Math.round(avg * populationValue), percentMisstated: avg * 100 };
  }
  if (!(sampledValue > 0)) return { mle: 0, percentMisstated: 0 };
  const ratio = items.reduce((sum, item) => sum + (item.bookValue - item.auditedValue), 0) / sampledValue;
  return { mle: Math.round(ratio * populationValue), percentMisstated: ratio * 100 };
}
