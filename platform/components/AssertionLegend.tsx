import { ASSERTIONS, ASSERTION_LABELS } from "@/lib/assertions";

/**
 * The six assertions spelled out, shown beside every board that works per
 * assertion — the risk console, the CRA matrix and the procedure design
 * (F041). Pure markup: server and client components alike render it.
 */
export function AssertionLegend({ locale, className }: { locale: "en" | "fr"; className?: string }) {
  const fr = locale === "fr";
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-1.5 text-[11px] text-ink-soft ${className ?? ""}`}
      data-testid="assertion-legend"
    >
      <b className="text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted">{fr ? "Assertions" : "Assertions"}</b>
      {ASSERTIONS.map((code) => (
        <span key={code} className="inline-flex items-center gap-1" data-testid={`assertion-legend-${code}`}>
          <span className="font-mono text-[11px] font-bold text-ink">{code}</span>
          <span>{fr ? ASSERTION_LABELS[code].fr : ASSERTION_LABELS[code].en}</span>
        </span>
      ))}
    </div>
  );
}
