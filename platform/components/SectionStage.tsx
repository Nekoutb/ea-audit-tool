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

export type StageTaskStatus = "reviewed" | "in_review" | "in_progress" | "not_started";

export interface StageTask {
  code: string;
  display: string;
  title: string;
  status: StageTaskStatus;
  statusLabel: string;
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
  tasks: StageTask[];
}

const DOT: Record<StageTaskStatus, string> = {
  reviewed: "bg-emerald-600",
  in_review: "bg-[var(--color-warn)]",
  in_progress: "bg-[#34467f] dark:bg-[#93a4dd]",
  not_started: "border-[1.5px] border-line-strong bg-transparent",
};

/**
 * The four phases, once. Nothing below them until a phase is clicked; on click
 * the other phase cards slide out (flex-basis + opacity transition) and the
 * phase's tasks are disclosed in performance order. Clicking the open phase
 * again, or the "all phases" control, slides the four cards back in.
 */
export function SectionStage({
  sections,
  hint,
  reviewedLabel,
  tasksLabel,
  allPhasesLabel,
  refDocs,
}: {
  sections: StageSection[];
  /** shown under the cards while no phase is open */
  hint: string;
  reviewedLabel: string;
  tasksLabel: string;
  allPhasesLabel: string;
  refDocs?: ReactNode;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const sec = open === null ? null : sections[open];

  return (
    <div className="flex flex-col gap-3" data-testid="phase-gauges">
      <div className="flex gap-3" role="tablist" aria-label={tasksLabel}>
        {sections.map((s, i) => {
          const on = i === open;
          const shrunk = open !== null && !on;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={on}
              aria-hidden={shrunk}
              tabIndex={shrunk ? -1 : 0}
              data-testid={`section-card-${s.key}`}
              onClick={() => setOpen(on ? null : i)}
              style={{ flexGrow: shrunk ? 0.0001 : 1, flexBasis: 0 }}
              className={`flex min-w-0 flex-col items-center gap-2 overflow-hidden rounded-[var(--radius-atlas)] border bg-surface text-center shadow-atlas-sm backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(.23,1,.32,1)] active:scale-[.98] ${
                shrunk ? "pointer-events-none border-transparent p-0 opacity-0" : "px-3 py-4"
              } ${on ? "border-emerald-600/45 ring-[3px] ring-emerald-600/12" : "border-glass-border hover:bg-surface-2"}`}
            >
              <span className="whitespace-nowrap text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-muted">
                {s.label}
              </span>
              <span
                className="grid h-[74px] w-[74px] flex-shrink-0 place-items-center rounded-full text-[16px] font-extrabold tnum"
                style={{
                  background: `radial-gradient(closest-side, var(--color-surface) 78%, transparent 79% 100%), conic-gradient(${s.color} ${s.pct}%, var(--color-line) 0)`,
                  filter: on ? `drop-shadow(0 0 8px color-mix(in srgb, ${s.color} 40%, transparent))` : undefined,
                }}
              >
                {s.pct}%
              </span>
              <span className="mt-auto whitespace-nowrap text-[10.5px] text-muted tnum">
                {s.done}/{s.total} {reviewedLabel}
                <span className="block">{s.deadline}</span>
              </span>
            </button>
          );
        })}
      </div>

      {sec === null ? (
        <p className="text-center text-[11.5px] text-muted">{hint}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_268px] lg:items-start">
          <section
            key={sec.key}
            className="flex flex-col rounded-[var(--radius-atlas)] border border-glass-border bg-surface px-5 py-4 shadow-atlas backdrop-blur-xl motion-safe:animate-[rollout_.32s_cubic-bezier(.23,1,.32,1)_both]"
            aria-live="polite"
            data-testid="phase-task-rollout"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[13px] font-bold tracking-[-0.01em] text-ink">
                {sec.label} · {tasksLabel}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(null)}
                data-testid="stage-show-all"
                className="inline-flex min-h-[24px] items-center gap-1 rounded-full bg-surface-2 px-3 py-0.5 text-[11.5px] font-semibold text-ink-soft transition hover:bg-line/60"
              >
                ← {allPhasesLabel}
              </button>
            </div>
            <ul className="mt-2 divide-y divide-line">
              {sec.tasks.map((task, i) => (
                <li key={task.code}>
                  <Link
                    href={task.href}
                    data-testid={`stage-task-${task.code}`}
                    className="flex items-center gap-3 py-2 transition hover:bg-surface-2 motion-safe:animate-[rollout_.32s_cubic-bezier(.23,1,.32,1)_both]"
                    style={{ animationDelay: `${Math.min(i * 30, 360)}ms` }}
                  >
                    <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-surface-2 font-mono text-[11px] font-semibold text-muted tnum">
                      {i + 1}
                    </span>
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${DOT[task.status]}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{task.title}</span>
                      <span className="block truncate font-mono text-[10.5px] text-muted">{task.display}</span>
                    </span>
                    <span className="flex-shrink-0 text-[11px] text-muted">{task.statusLabel}</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="flex-shrink-0 text-muted">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <aside className="rounded-[var(--radius-atlas)] border border-glass-border bg-surface px-4 py-4 shadow-atlas-sm backdrop-blur-xl">
            {refDocs}
          </aside>
        </div>
      )}
    </div>
  );
}
