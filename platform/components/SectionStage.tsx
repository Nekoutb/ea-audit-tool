"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

export interface StageGroup {
  id: string;
  code: string;
  title: string;
  done: number;
  total: number;
  href: string;
}

export interface StageSection {
  key: string;
  label: string;
  done: number;
  total: number;
  pct: number;
  deadline: string;
  /** ring color css value */
  color: string;
  groups: StageGroup[];
}

/**
 * The engagement band (Canvas structure, unbranded): Scope & Strategy and
 * Execution rings, the selected section's Task Status panel, the Conclusion
 * ring, then the reference-documents rail. Selecting a ring swaps the panel;
 * groups show completion only — detail tasks live on the group pages.
 */
export function SectionStage({
  sections,
  hint,
  reviewedLabel,
  groupsLabel,
  taskStatusLabel,
  refDocs,
}: {
  sections: StageSection[];
  hint: string;
  reviewedLabel: string;
  groupsLabel: string;
  taskStatusLabel: string;
  refDocs?: ReactNode;
}) {
  const initial = sections.findIndex((s) => s.pct < 100);
  const [current, setCurrent] = useState(initial === -1 ? 0 : initial);
  const sec = sections[current];

  const ringCard = (s: StageSection, i: number) => {
    const on = i === current;
    return (
      <button
        key={s.key}
        type="button"
        role="tab"
        aria-selected={on}
        data-testid={`section-${s.key}`}
        onClick={() => setCurrent(i)}
        className={`flex min-w-[150px] flex-1 flex-col items-center gap-2 rounded-[var(--radius-atlas)] border bg-surface px-3 py-4 text-center shadow-atlas-sm backdrop-blur-xl transition duration-200 active:scale-[.98] lg:flex-none ${
          on ? "border-emerald-600/45 ring-[3px] ring-emerald-600/12" : "border-glass-border hover:bg-surface-2"
        }`}
      >
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-muted">{s.label}</span>
        <span
          className="grid h-[74px] w-[74px] place-items-center rounded-full text-[16px] font-extrabold tnum"
          style={{
            background: `radial-gradient(closest-side, var(--color-surface) 78%, transparent 79% 100%), conic-gradient(${s.color} ${s.pct}%, var(--color-line) 0)`,
            filter: on ? `drop-shadow(0 0 8px color-mix(in srgb, ${s.color} 40%, transparent))` : undefined,
          }}
        >
          {s.pct}%
        </span>
        <span className="text-[10.5px] text-muted tnum">
          {s.done}/{s.total} {reviewedLabel}
          <span className="block">{s.deadline}</span>
        </span>
      </button>
    );
  };

  return (
    <div
      className="flex flex-col gap-3 lg:grid lg:grid-cols-[168px_168px_1fr_168px_236px] lg:items-stretch"
      data-testid="phase-gauges"
      role="tablist"
      aria-label={groupsLabel}
    >
      {ringCard(sections[0], 0)}
      {ringCard(sections[1], 1)}

      <section
        key={sec.key}
        className="min-h-[196px] rounded-[var(--radius-atlas)] border border-glass-border bg-surface px-5 py-3.5 shadow-atlas backdrop-blur-xl"
        aria-live="polite"
        data-testid="group-rollout"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] font-bold tracking-[-0.01em] text-ink">{taskStatusLabel}</h2>
          <span className="text-[11px] text-muted tnum">
            {sec.label} · {sec.done}/{sec.total} {reviewedLabel}
          </span>
        </div>
        <div className="mt-1.5">
          {sec.groups.map((g, i) => {
            const pct = g.total > 0 ? Math.round((g.done / g.total) * 100) : 0;
            return (
              <Link
                key={g.id}
                href={g.href}
                data-testid={`group-${g.id}`}
                className="-mx-2 flex items-center gap-3 rounded-[var(--radius-atlas-xs)] px-2 py-[5px] transition hover:bg-surface-2 motion-safe:animate-[rollout_.32s_cubic-bezier(.23,1,.32,1)_both]"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="min-w-0 w-[42%] truncate text-[12.5px] font-semibold text-ink-soft">
                  {g.code} · {g.title}
                </span>
                <span className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-12 flex-shrink-0 text-right text-[11px] text-muted tnum">
                  {g.done}/{g.total}
                </span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="flex-shrink-0 text-muted">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            );
          })}
        </div>
        <p className="pt-1.5 text-[10.5px] text-muted">{hint}</p>
      </section>

      {ringCard(sections[2], 2)}

      <aside className="rounded-[var(--radius-atlas)] border border-glass-border bg-surface px-4 py-3.5 shadow-atlas-sm backdrop-blur-xl">
        {refDocs}
      </aside>
    </div>
  );
}
