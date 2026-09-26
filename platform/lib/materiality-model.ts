// Materiality arithmetic with no database behind it, so client components and
// route handlers can share one definition of the thresholds.

/**
 * The firm's ranges for the two derived thresholds, as a percentage of overall
 * materiality: tolerable error (TE, "performance materiality") and the clearly
 * trivial SAD nominal amount. ONE definition — the server validation, the
 * form inputs and the on-screen hint all read it, so they cannot disagree.
 */
export const PERFORMANCE_PCT_RANGE = { min: 60, max: 85, default: 75 } as const;
export const TRIVIAL_PCT_RANGE = { min: 0.5, max: 10, default: 5 } as const;

/**
 * Uncorrected Misstatements Threshold: the margin performance materiality
 * leaves below overall materiality, UMT = PM − TE. Uncorrected misstatements
 * accumulated on the SAD are measured against this, never against TE itself —
 * TE is the tolerance the procedures consume, not the room left over. Returns
 * null when the engagement has no materiality set.
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
