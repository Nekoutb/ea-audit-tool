"use client";

import Link from "next/link";
import { useState } from "react";

export interface StageGroup {
  id: string;
  title: string;
  done: number;
  total: number;
  href: string;
}

export interface StageSection {
  key: string;
  label: string;
  pct: number;
  /** ring color css value */
  color: string;
  groups: StageGroup[];
}

/**
 * The approved console band: four phase cards filling the row — phase name and
 * a large progress ring, nothing else. Clicking a phase opens its grouped
 * tasks as a plain list (title and percentage) in a slot that slides open to
 * the phase's right; the other cards shift as rigid objects and nothing is
 * covered or wrapped. Gutters are margins, not flex gap, so a closed
 * (zero-width) slot leaves no seam.
 */
export function SectionStage({ sections, initialOpen = null }: { sections: StageSection[]; initialOpen?: number | null }) {
  const [open, setOpen] = useState<number | null>(initialOpen);

  return (
    <div className="flex min-h-[236px] items-stretch" data-testid="phase-gauges" role="tablist">
      {sections.map((s, i) => {
        const on = open === i;
        return (
          <div key={s.key} className="contents">
            <button
              type="button"
              role="tab"
              aria-selected={on}
              data-testid={`section-card-${s.key}`}
              onClick={() => setOpen(on ? null : i)}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-3.5 rounded-[var(--radius-atlas)] border bg-surface px-3 py-4 shadow-atlas-sm backdrop-blur-xl transition-[border-color,box-shadow] duration-200 active:scale-[.985] ${
                i > 0 ? "ml-3" : ""
              } ${
                on
                  ? "border-emerald-600/45 ring-[3px] ring-emerald-600/12"
                  : "border-glass-border hover:border-line-strong"
              }`}
            >
              <span className="whitespace-nowrap text-[11.5px] font-extrabold uppercase tracking-[0.08em] text-muted">
                {s.label}
              </span>
              <span
                className="grid h-[140px] w-[140px] place-items-center rounded-full text-[24px] font-extrabold tnum"
                style={{
                  background: `radial-gradient(closest-side, var(--color-surface) 80%, transparent 81% 100%), conic-gradient(${s.color} ${s.pct}%, var(--color-line) 0)`,
                  filter: on ? `drop-shadow(0 0 8px color-mix(in srgb, ${s.color} 40%, transparent))` : undefined,
                }}
              >
                {s.pct}%
              </span>
            </button>
            <div
              className={`overflow-hidden transition-[flex-basis,margin-left] duration-300 ease-[cubic-bezier(.23,1,.32,1)] motion-reduce:transition-none ${
                on ? "ml-3 basis-[310px]" : "ml-0 basis-0"
              }`}
              style={{ flexGrow: 0, flexShrink: 0 }}
              aria-hidden={!on}
            >
              <div
                className="flex h-full w-[310px] flex-col justify-center gap-0.5 rounded-[var(--radius-atlas)] border border-emerald-600/40 bg-surface px-3.5 py-3 shadow-atlas-sm backdrop-blur-xl"
                role="tabpanel"
                data-testid={on ? "stage-open-panel" : undefined}
              >
                {s.groups.map((g) => (
                  <Link
                    key={g.id}
                    href={g.href}
                    tabIndex={on ? 0 : -1}
                    data-testid={`stage-group-${g.id}`}
                    className="flex items-center gap-2.5 rounded-[var(--radius-atlas-xs)] px-2 py-[7px] transition hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.8px] font-semibold text-ink-soft">
                      {g.title}
                    </span>
                    <span className="w-9 flex-shrink-0 text-right text-[11.5px] text-muted tnum">{g.done}/{g.total}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
