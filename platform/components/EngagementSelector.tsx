"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { startPageLoad } from "@/components/PageLoader";

export interface SelectorItem {
  id: string;
  title: string;
  meta: string;
  pct?: number;
  active?: boolean;
}

/**
 * Top-right engagement switcher. Selecting an engagement fires the page loader and
 * routes to that engagement's dashboard. Placed in the shell next to the user block.
 */
export function EngagementSelector({
  current,
  items,
  labels,
}: {
  current: string | null;
  items: SelectorItem[];
  labels: { engagement: string; recent: string; browseAll: string; none: string };
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  function go(id: string) {
    setOpen(false);
    startPageLoad();
    startTransition(() => router.push(`/engagements/${id}/dashboard`));
  }

  return (
    <div ref={ref} className="relative" data-testid="engagement-selector">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2.5 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 text-left transition hover:bg-surface-2"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${pending ? "animate-pulse bg-warn" : "bg-emerald-600"}`}
        />
        <span className="min-w-0">
          <span className="block text-[9px] font-bold uppercase tracking-[0.09em] text-muted leading-tight">
            {labels.engagement}
          </span>
          <span className="block max-w-[190px] truncate text-[13px] font-semibold text-ink leading-tight">
            {current ?? labels.none}
          </span>
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[320px] rounded-[var(--radius-atlas)] border border-line-strong bg-surface-pop p-1.5 shadow-[var(--shadow-atlas-lg)]">
          <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
            {labels.recent}
          </p>
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => go(it.id)}
              className={`flex w-full items-center gap-2.5 rounded-[var(--radius-atlas-xs)] px-2.5 py-2 text-left transition hover:bg-surface-2 ${
                it.active ? "bg-emerald-50 dark:bg-emerald-950/30" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{it.title}</span>
                <span className="block truncate text-[11px] text-muted">{it.meta}</span>
              </span>
              {typeof it.pct === "number" ? (
                <span className="text-[13px] font-bold text-emerald-700 tnum dark:text-emerald-400">
                  {it.pct}%
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
