// Materiality arithmetic with no database behind it, so client components and
// route handlers can share one definition of the thresholds.

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
