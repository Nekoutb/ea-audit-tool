"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

/**
 * An assignment applied as soon as it is chosen (F084), with an Undo toast: no
 * OK button to forget, and a wrong pick is one click from being put back. The
 * server action records it in the activity log either way. `stay` asks the
 * action not to navigate on success: a redirect remounted the page behind its
 * loading screen, and the toast went with it. A server refusal comes back as a
 * new ?error=…, which puts the select back and drops the toast.
 */
export function AssignSelect({
  action,
  current,
  options,
  selectClass,
  testId,
  ariaLabel,
  labels,
  hidden,
  prefix,
  onChosen,
}: {
  action: (formData: FormData) => void | Promise<void>;
  current: string;
  options: { value: string; label: string }[];
  selectClass?: string;
  testId?: string;
  ariaLabel?: string;
  labels: { saved: string; undo: string };
  /** extra fields the action reads (the role, on the Forms tool) */
  hidden?: Record<string, string>;
  prefix?: ReactNode;
  onChosen?: (value: string) => void;
}) {
  const [value, setValue] = useState(current);
  const [undoTo, setUndoTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lastCurrent = useRef(current);

  useEffect(() => {
    // the page moved on (another save, a refresh): follow the stored value
    if (lastCurrent.current !== current) {
      lastCurrent.current = current;
      setValue(current);
    }
  }, [current]);

  useEffect(() => {
    if (undoTo === null) return;
    const timer = setTimeout(() => setUndoTo(null), 8000);
    return () => clearTimeout(timer);
  }, [undoTo]);

  function apply(next: string, previous: string | null) {
    setValue(next);
    setUndoTo(previous);
    onChosen?.(next);
    const data = new FormData();
    data.set("assignee", next);
    data.set("stay", "1");
    for (const [k, v] of Object.entries(hidden ?? {})) data.set(k, v);
    const before = window.location.search;
    startTransition(async () => {
      await action(data);
      const after = window.location.search;
      if (after !== before && new URLSearchParams(after).has("error")) {
        setValue(lastCurrent.current);
        setUndoTo(null);
        onChosen?.(lastCurrent.current);
      }
    });
  }

  return (
    <>
      {prefix}
      <select
        name="assignee"
        value={value}
        disabled={pending}
        onChange={(e) => apply(e.target.value, value)}
        className={selectClass}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {undoTo !== null ? (
        <span
          role="status"
          className="fixed bottom-4 right-4 z-[70] flex items-center gap-3 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface-pop px-3 py-2 text-[12.5px] text-ink shadow-atlas-sm"
          data-testid={testId ? `${testId}-toast` : undefined}
        >
          {labels.saved}
          <button
            type="button"
            onClick={() => apply(undoTo, null)}
            className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            data-testid={testId ? `${testId}-undo` : undefined}
          >
            {labels.undo}
          </button>
        </span>
      ) : null}
    </>
  );
}
