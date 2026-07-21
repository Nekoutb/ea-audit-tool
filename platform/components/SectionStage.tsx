"use client";

import Link from "next/link";
import { useState } from "react";

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
 * The approved variation-A dashboard stage: a vertical rail of the three
 * sections (Planning & Strategy / Execution / Conclusion); selecting one rolls
 * its task groups out to the right. Groups show completion only — detail tasks
 * live on the group page (progressive disclosure per the hierarchy framework).
 */
export function SectionStage({
  sections,
  hint,
  reviewedLabel,
  groupsLabel,
}: {
  sections: StageSection[];
  hint: string;
  reviewedLabel: string;
  groupsLabel: string;
}) {
  const initial = sections.findIndex((s) => s.pct < 100);
  const [current, setCurrent] = useState(initial === -1 ? 0 : initial);
  const sec = sections[current];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[252px_1fr]" data-testid="phase-gauges">
      <div className="flex flex-col gap-2.5" role="tablist" aria-label={groupsLabel}>
        {sections.map((s, i) => {
          const on = i === current;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={on}
              data-testid={`section-${s.key}`}
              onClick={() => setCurrent(i)}
              className={`flex w-full items-center gap-3 rounded-[var(--radius-atlas)] border bg-surface px-4 py-3.5 text-left shadow-atlas-sm backdrop-blur-xl transition duration-200 hover:translate-x-[3px] active:scale-[.98] ${
                on
                  ? "border-emerald-600/45 ring-[3px] ring-emerald-600/12"
                  : "border-glass-border hover:bg-surface-2"
              }`}
            >
              <span
                className="grid h-[52px] w-[52px] flex-shrink-0 place-items-center rounded-full text-[12.5px] font-extrabold tnum"
                style={{
                  background: `radial-gradient(closest-side, var(--color-surface) 74%, transparent 75% 100%), conic-gradient(${s.color} ${s.pct}%, var(--color-line) 0)`,
                  filter: on ? `drop-shadow(0 0 7px color-mix(in srgb, ${s.color} 40%, transparent))` : undefined,
                }}
              >
                {s.pct}%
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-bold tracking-[-0.01em] text-ink">{s.label}</span>
                <span className="block text-[11px] text-muted tnum">
                  {s.done}/{s.total} {reviewedLabel} · {s.deadline}
                </span>
              </span>
              {on ? (
                <span className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-emerald-600 shadow-[0_0_8px_var(--color-emerald-600)]" />
              ) : null}
            </button>
          );
        })}
      </div>

      <section
        key={sec.key}
        className="min-h-[236px] rounded-[var(--radius-atlas)] border border-glass-border bg-surface px-5 py-4 shadow-atlas backdrop-blur-xl"
        aria-live="polite"
        data-testid="group-rollout"
      >
        <h2 className="text-[15px] font-bold tracking-[-0.015em] text-ink">{sec.label}</h2>
        <p className="mb-2 text-[11.5px] text-muted tnum">
          {sec.groups.length} {groupsLabel} · {sec.done}/{sec.total} {reviewedLabel}
        </p>
        {sec.groups.map((g, i) => {
          const pct = g.total > 0 ? Math.round((g.done / g.total) * 100) : 0;
          return (
            <Link
              key={g.id}
              href={g.href}
              data-testid={`group-${g.id}`}
              className="group-row -mx-2.5 flex items-center gap-3 rounded-[var(--radius-atlas-xs)] px-2.5 py-2 transition hover:bg-surface-2 motion-safe:animate-[rollout_.32s_cubic-bezier(.23,1,.32,1)_both]"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-soft">
                {g.code} · {g.title}
              </span>
              <span className="text-[11.5px] text-muted tnum">
                {g.done}/{g.total}
              </span>
              <span className="h-[5px] w-[130px] flex-shrink-0 overflow-hidden rounded-full bg-line max-sm:w-[64px]">
                <span className="block h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                className="flex-shrink-0 text-muted"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          );
        })}
        <p className="pt-2 text-[11px] text-muted">{hint}</p>
      </section>
    </div>
  );
}
