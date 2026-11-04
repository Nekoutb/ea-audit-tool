// Materiality arithmetic with no database behind it, so client components and
// route handlers can share one definition of the thresholds.

/**
 * The firm's ranges for the two derived thresholds, as a percentage of overall
 * materiality [seuil de signification global]: performance materiality [seuil
 * de travail] and the clearly trivial threshold [seuil des anomalies
 * manifestement négligeables — the SAD nominal amount of the older papers].
 * ONE definition — the server validation, the form inputs and the on-screen
 * hint all read it, so they cannot disagree. F033 (firm decision 2026-10-27)
 * narrowed the clearly trivial range to 3–5%: only NEW versions are
 * constrained, a stored value outside the range keeps displaying.
 */
export const PERFORMANCE_PCT_RANGE = { min: 60, max: 85, default: 75 } as const;
export const TRIVIAL_PCT_RANGE = { min: 3, max: 5, default: 5 } as const;

/**
 * Uncorrected Misstatements Threshold: the margin performance materiality
 * leaves below overall materiality, UMT = overall − performance. Uncorrected
 * misstatements accumulated on the SAD are measured against this, never
 * against performance materiality itself — that is the tolerance the
 * procedures consume, not the room left over. Returns null when the
 * engagement has no materiality set.
 */
export function uncorrectedMisstatementThreshold(
  mat: { overall: number; performance: number } | null | undefined,
): number | null {
  if (!mat) return null;
  return Math.max(0, mat.overall - mat.performance);
}

/** A materiality benchmark's name in the reader's language (UAT B74 / B134). */
export function benchmarkLabel(benchmark: string, fr: boolean): string {
  const L: Record<string, [string, string]> = {
    pbt: ["Profit before tax", "Résultat avant impôt"],
    revenue: ["Revenue", "Chiffre d'affaires"],
    total_assets: ["Total assets", "Total de l'actif"],
    equity: ["Equity", "Capitaux propres"],
    expenses: ["Total expenses", "Total des charges"],
  };
  const pair = L[benchmark];
  return pair ? (fr ? pair[1] : pair[0]) : benchmark;
}
