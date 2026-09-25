// Pure, client-safe helper for the E1.2 test-of-controls grid. No imports:
// the board (a client component) and lib/scots.ts (server) both use it, so
// the "effective" conclusion is disabled and refused on the same rule.

export interface TocGridLike {
  attributes: string[];
  rows: { results: Record<string, string> }[];
}

/**
 * Rows of a test-of-controls grid that are fully tested: every attribute
 * answered (pass, fail or n/a). Zero when the grid or its attributes are
 * missing (UAT B84).
 */
/**
 * Rows the "effective" conclusion needs on the grid: the planned sample size.
 * Zero when no sample was planned (null or 0) — and "effective" is then
 * refused outright ("toc-no-sample"): nothing planned is nothing tested
 * (UAT run 2 B15).
 */
export function tocRowsPlanned(sampleSize: number | null | undefined): number {
  return typeof sampleSize === "number" && Number.isFinite(sampleSize) && sampleSize > 0 ? Math.round(sampleSize) : 0;
}

export function tocRowsTested(grid: TocGridLike | null | undefined): number {
  if (!grid || !Array.isArray(grid.rows)) return 0;
  const attributes = Array.isArray(grid.attributes) ? grid.attributes : [];
  if (attributes.length === 0) return 0;
  return grid.rows.filter((r) => attributes.every((a) => (r.results?.[a] ?? "") !== "")).length;
}
