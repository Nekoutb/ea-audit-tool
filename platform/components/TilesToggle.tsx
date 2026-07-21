"use client";

import { useState } from "react";
import type { DashboardStats } from "@/lib/engagement-dashboard";

/** Summary tiles with the "My engagement / All engagements" scope toggle. */
export function TilesToggle({
  my,
  all,
  labels,
}: {
  my: DashboardStats;
  all: DashboardStats;
  labels: {
    mySummary: string;
    allSummary: string;
    myTasks: string;
    myTasksHint: string;
    forMyReview: string;
    forMyReviewHint: string;
    toDo: string;
    toDoHint: string;
    reviewNotes: string;
    forMe: string;
    byMe: string;
  };
}) {
  const [scope, setScope] = useState<"my" | "all">("my");
  const s = scope === "my" ? my : all;

  const tile =
    "flex flex-col gap-0.5 rounded-[var(--radius-atlas-sm)] border border-glass-border bg-surface px-4 py-3 shadow-atlas-sm backdrop-blur-xl";
  const lab = "text-[11px] font-bold uppercase tracking-[0.06em] text-muted";
  const num = "text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-ink tnum";
  const hint = "text-[11.5px] text-muted";

  return (
    <div className="flex flex-col gap-3">
      <div
        className="inline-flex self-start rounded-full border border-glass-border bg-surface p-1 shadow-atlas-sm backdrop-blur-xl"
        role="tablist"
        aria-label={labels.mySummary}
      >
        {(
          [
            ["my", labels.mySummary],
            ["all", labels.allSummary],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={scope === key}
            data-testid={`summary-${key}`}
            onClick={() => setScope(key)}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition ${
              scope === key ? "bg-surface-2 text-ink shadow-atlas-sm" : "text-muted hover:text-ink-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" data-testid="summary-tiles">
        <div className={tile}>
          <span className={lab}>{labels.myTasks}</span>
          <span className={num}>{s.myTasks}</span>
          <span className={hint}>{labels.myTasksHint}</span>
        </div>
        <div className={tile}>
          <span className={lab}>{labels.forMyReview}</span>
          <span className={num}>{s.forMyReview}</span>
          <span className={hint}>{labels.forMyReviewHint}</span>
        </div>
        <div className={tile}>
          <span className={lab}>{labels.toDo}</span>
          <span className={num}>{s.toDo}</span>
          <span className={hint}>{labels.toDoHint}</span>
        </div>
        <div className={tile}>
          <span className={lab}>{labels.reviewNotes}</span>
          <span className="flex gap-5">
            <span>
              <span className="text-[20px] font-extrabold tracking-[-0.02em] text-ink tnum">{s.notesForMe}</span>
              <span className="block text-[10.5px] font-semibold text-muted">{labels.forMe}</span>
            </span>
            <span>
              <span className="text-[20px] font-extrabold tracking-[-0.02em] text-ink tnum">{s.notesByMe}</span>
              <span className="block text-[10.5px] font-semibold text-muted">{labels.byMe}</span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
