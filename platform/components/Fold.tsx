"use client";

import { useState, type ReactNode } from "react";

// A section that folds behind an arrow. The body stays mounted when closed
// (hidden, not removed), so a board or a wizard inside it keeps its state
// and its measurements when it comes back. `grow` lets an open body take the
// rest of a flex column — the paper's questionnaire wants the room a folded
// board gives up.

export function Fold({
  title,
  hint,
  defaultOpen = true,
  grow = false,
  className = "",
  testId,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  grow?: boolean;
  className?: string;
  testId?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`flex min-h-0 flex-col ${open && grow ? "flex-1" : ""} ${className}`} data-testid={testId} data-open={open ? "1" : "0"}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-1.5 text-left transition hover:bg-surface-3"
        data-testid={testId ? `${testId}-toggle` : undefined}
      >
        <span className={`inline-block text-[11px] text-emerald-700 transition-transform dark:text-emerald-400 ${open ? "rotate-90" : ""}`} aria-hidden>
          ▶
        </span>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-ink">{title}</span>
        {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
        <span className="ml-auto text-[10.5px] font-semibold text-muted">{open ? "−" : "+"}</span>
      </button>
      <div hidden={!open} className={open ? `mt-2 flex min-h-0 flex-col ${grow ? "flex-1" : ""}` : undefined}>
        {children}
      </div>
    </div>
  );
}

/** Folds only when asked: the same JSX serves the tasks that fold and those that do not. */
export function MaybeFold({ when, children, ...rest }: { when: boolean; children: ReactNode } & Omit<Parameters<typeof Fold>[0], "children">) {
  return when ? <Fold {...rest}>{children}</Fold> : <>{children}</>;
}
