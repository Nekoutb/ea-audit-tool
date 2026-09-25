"use client";

// The candidate materiality bases derived from the ingested trial balance.
// "Use" fills the benchmark, amount and suggested percentage into the version
// form below, so PM is computed from the file rather than typed from memory.

import { PERFORMANCE_PCT_RANGE, TRIVIAL_PCT_RANGE } from "@/lib/materiality-model";

const RANGES: Record<string, { min: number; max: number }> = {
  pbt: { min: 5, max: 10 },
  revenue: { min: 0.5, max: 2 },
  total_assets: { min: 0.5, max: 2 },
  equity: { min: 1, max: 5 },
  expenses: { min: 0.5, max: 2 },
};

const LABELS: Record<string, { en: string; fr: string }> = {
  pbt: { en: "Profit before tax", fr: "Résultat avant impôt" },
  revenue: { en: "Revenue", fr: "Chiffre d'affaires" },
  total_assets: { en: "Total assets", fr: "Total de l'actif" },
  equity: { en: "Equity", fr: "Capitaux propres" },
  expenses: { en: "Total expenses", fr: "Total des charges" },
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export function MaterialityBasis({
  locale,
  bases,
}: {
  locale: "en" | "fr";
  bases: Record<string, number>;
}) {
  const fr = locale === "fr";

  function use(key: string) {
    const benchmark = document.querySelector<HTMLSelectElement>('[data-testid="materiality-benchmark"]');
    const amount = document.querySelector<HTMLInputElement>('[data-testid="materiality-amount"]');
    const pct = document.querySelector<HTMLInputElement>('[data-testid="materiality-pct"]');
    const just = document.querySelector<HTMLInputElement>('[data-testid="materiality-justification"]');
    if (benchmark) benchmark.value = key;
    if (amount) amount.value = String(Math.abs(bases[key]));
    const range = RANGES[key];
    if (pct && range) pct.value = String((range.min + range.max) / 2);
    if (just && !just.value)
      just.value = fr
        ? `Base ${LABELS[key].fr} issue de la balance ingérée`
        : `${LABELS[key].en} basis taken from the ingested trial balance`;
    amount?.focus();
  }

  return (
    <div className="mt-4" data-testid="materiality-bases">
      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
        {fr ? "Bases issues de la balance" : "Bases from the trial balance"}
      </h3>
      <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {Object.keys(LABELS).map((key) => (
          <div
            key={key}
            className="flex flex-col gap-1 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2/60 px-3 py-2"
            data-testid={`basis-${key}`}
          >
            <span className="text-[11px] text-muted">{fr ? LABELS[key].fr : LABELS[key].en}</span>
            <span className="text-[15px] font-bold text-ink tnum">{fmt(bases[key] ?? 0)}</span>
            <span className="text-[10.5px] text-muted tnum">
              {RANGES[key].min}–{RANGES[key].max} %
            </span>
            <button
              type="button"
              onClick={() => use(key)}
              data-testid={`use-basis-${key}`}
              className="mt-0.5 self-start rounded-[var(--radius-atlas-xs)] border border-emerald-700/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-700 hover:text-white dark:text-emerald-400"
            >
              {fr ? "Utiliser" : "Use"}
            </button>
          </div>
        ))}
      </div>
      {/* the hint quotes the ranges the server enforces — one constant, never a second copy */}
      <p className="mt-1.5 text-[11px] text-muted" data-testid="materiality-ranges-hint">
        {fr
          ? `PM = base × % · TE (seuil de travail) = ${PERFORMANCE_PCT_RANGE.min}–${PERFORMANCE_PCT_RANGE.max} % de PM · Seuil SAD = ${String(TRIVIAL_PCT_RANGE.min).replace(".", ",")}–${TRIVIAL_PCT_RANGE.max} % de PM.`
          : `PM = basis × % · TE (tolerable error) = ${PERFORMANCE_PCT_RANGE.min}–${PERFORMANCE_PCT_RANGE.max}% of PM · SAD nominal = ${TRIVIAL_PCT_RANGE.min}–${TRIVIAL_PCT_RANGE.max}% of PM.`}
      </p>
    </div>
  );
}
