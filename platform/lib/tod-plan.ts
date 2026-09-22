// The tests-of-details sampling plan, pure: no database, no session. One
// account's ledger lines in, the key items and the representative sample out.
//
//   key items      = lines at or above the threshold, examined in full
//   base sample    = (population − key items) ÷ TE
//   sample size    = base × the audit-risk-table factor for the CRA, the
//                    assurance from other substantive procedures and the
//                    coverage the key items achieved
//   selection      = systematic (MUS) over the remaining population, random
//                    start, one hook every `interval`
//
// The screen, the one-account preview and the workbook-per-index export all
// run this same function, so a sample never differs by the door it came in.

export type TodCra = "minimal" | "low" | "low_sr" | "moderate" | "high" | "high_sr";
export type TodAssurance = "little" | "some" | "corroborative" | "persuasive";

export const TOD_CRAS: readonly TodCra[] = ["minimal", "low", "low_sr", "moderate", "high", "high_sr"];
export const TOD_ASSURANCES: readonly TodAssurance[] = ["little", "some", "corroborative", "persuasive"];

/** Key-item coverage columns of the audit-risk table (percent of population value). */
export const ART_COLS = [0, 10, 30, 50, 70, 90, 100];
const N = null;
/** MUS factors: CRA × assurance × coverage column; null = no representative sample required. */
export const ART_MUS: Record<TodCra, Record<TodAssurance, (number | null)[]>> = {
  minimal:  { little: [0.5, 0.4, 0.1, N, N, N, N], some: [0.2, 0.1, N, N, N, N, N], corroborative: [N, N, N, N, N, N, N], persuasive: [N, N, N, N, N, N, N] },
  low:      { little: [1.0, 0.9, 0.7, 0.3, N, N, N], some: [0.7, 0.6, 0.4, N, N, N, N], corroborative: [0.3, 0.2, N, N, N, N, N], persuasive: [N, N, N, N, N, N, N] },
  low_sr:   { little: [1.4, 1.3, 1.0, 0.7, 0.2, N, N], some: [1.1, 1.0, 0.7, 0.4, N, N, N], corroborative: [0.7, 0.6, 0.3, N, N, N, N], persuasive: [N, N, N, N, N, N, N] },
  moderate: { little: [2.1, 2.0, 1.7, 1.4, 0.9, N, N], some: [1.8, 1.7, 1.4, 1.1, 0.6, N, N], corroborative: [1.4, 1.3, 1.0, 0.7, 0.2, N, N], persuasive: [N, N, N, N, N, N, N] },
  high:     { little: [2.6, 2.5, 2.3, 1.9, 1.4, 0.3, N], some: [2.4, 2.2, 2.0, 1.7, 1.1, N, N], corroborative: [1.9, 1.8, 1.6, 1.3, 0.7, N, N], persuasive: [0.3, 0.2, N, N, N, N, N] },
  high_sr:  { little: [3.0, 2.9, 2.6, 2.3, 1.8, 0.7, N], some: [2.7, 2.6, 2.4, 2.0, 1.5, 0.4, N], corroborative: [2.3, 2.2, 1.9, 1.6, 1.1, N, N], persuasive: [0.7, 0.6, 0.3, N, N, N, N] },
};

export interface GlLine {
  /** the entry the line belongs to */
  ref: string;
  account: string;
  /** absolute value of the line */
  amount: number;
  /** what the ledger says the line is, when the caller has it */
  description?: string | null;
  date?: string | null;
}

export interface TodPlanInput {
  lines: GlLine[];
  /** tolerable error (performance materiality) */
  te: number;
  /** key-item threshold; defaults to TE */
  threshold?: number | null;
  cra: TodCra;
  assurance: TodAssurance;
  /** the random start as a fraction of the interval, for a reproducible draw; random when absent */
  startFraction?: number;
}

export interface TodPlan {
  populationValue: number;
  populationCount: number;
  te: number;
  threshold: number;
  keyItems: GlLine[];
  keyItemValue: number;
  /** percent of population value the key items cover */
  coveragePct: number;
  /** the coverage column the factor was read from */
  coverageColumn: number;
  remainingValue: number;
  remainingCount: number;
  baseSize: number;
  factor: number | null;
  sampleSize: number;
  interval: number | null;
  sample: GlLine[];
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

export function planTod(input: TodPlanInput): TodPlan {
  const te = input.te;
  const threshold = input.threshold && input.threshold > 0 ? Math.round(input.threshold) : te;
  const lines = input.lines.filter((l) => Number.isFinite(l.amount) && l.amount > 0);
  const populationValue = lines.reduce((s, l) => s + l.amount, 0);
  const keyItems = lines.filter((l) => l.amount >= threshold);
  const rest = lines.filter((l) => l.amount < threshold);
  const keyItemValue = keyItems.reduce((s, l) => s + l.amount, 0);
  const remaining = populationValue - keyItemValue;
  const coveragePct = populationValue > 0 ? (keyItemValue / populationValue) * 100 : 0;
  // nearest coverage column at or below the achieved coverage (conservative)
  let col = 0;
  for (let i = 0; i < ART_COLS.length; i += 1) if (coveragePct >= ART_COLS[i]) col = i;
  const factor = ART_MUS[input.cra][input.assurance][col];
  const baseSize = te > 0 ? remaining / te : 0;
  const sampleSize = factor === null || remaining <= 0 ? 0 : Math.ceil(baseSize * factor);
  const interval = sampleSize > 0 ? Math.max(1, Math.round(remaining / sampleSize)) : null;

  // systematic (MUS) selection over the remaining population, random start
  const sample: GlLine[] = [];
  if (interval && sampleSize > 0) {
    const fraction = input.startFraction !== undefined ? Math.min(0.999, Math.max(0, input.startFraction)) : Math.random();
    const start = Math.floor(fraction * interval) + 1;
    let cumulative = 0;
    let nextHook = start;
    for (const l of rest) {
      cumulative += l.amount;
      while (cumulative >= nextHook && sample.length < sampleSize) {
        // one line is selected once, however many hooks fall inside it
        if (sample[sample.length - 1] !== l) sample.push(l);
        nextHook += interval;
      }
      if (sample.length >= sampleSize) break;
    }
  }

  return {
    populationValue: round2(populationValue),
    populationCount: lines.length,
    te,
    threshold,
    keyItems,
    keyItemValue: round2(keyItemValue),
    coveragePct: Math.round(coveragePct * 10) / 10,
    coverageColumn: ART_COLS[col],
    remainingValue: round2(remaining),
    remainingCount: rest.length,
    baseSize: Math.round(baseSize * 10) / 10,
    factor,
    sampleSize,
    interval,
    sample,
  };
}
