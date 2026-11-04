"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A dropdown that holds a checklist: a <details> whose summary reads like a
 * select ("Inherent risk factors · 2") and whose panel carries ordinary named
 * checkboxes, so it drops into any server-action form. The panel is opaque and
 * closes on an outside press, Escape or leaving it with the keyboard (F077): an
 * open panel left over the fields below once ticked a factor nobody meant to.
 * The ticked options show as chips under the summary.
 */
export function DropdownChecklist({
  label,
  name,
  options,
  defaultChecked = [],
  testIdPrefix,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultChecked?: string[];
  testIdPrefix?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [checked, setChecked] = useState<string[]>(() => options.filter((o) => defaultChecked.includes(o.value)).map((o) => o.value));

  useEffect(() => {
    const close = () => {
      if (ref.current) ref.current.open = false;
    };
    const onPointer = (event: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) close();
    };
    const onFocus = (event: FocusEvent) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
    };
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <details ref={ref} className="relative">
        <summary
          className="flex cursor-pointer list-none items-center gap-1.5 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink marker:hidden [&::-webkit-details-marker]:hidden"
          data-testid={testIdPrefix ? `${testIdPrefix}-summary` : undefined}
        >
          <span className="text-muted">{label}</span>
          <span className="rounded-full bg-surface-2 px-1.5 font-semibold tnum">{checked.length}</span>
          <span aria-hidden className="text-[9px] text-muted">▾</span>
        </summary>
        <div className="absolute left-0 top-full z-30 mt-1 flex min-w-[230px] flex-col gap-1 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface-pop p-2.5 shadow-atlas-sm">
          {options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-xs text-ink-soft hover:text-ink">
              <input
                type="checkbox"
                name={name}
                value={option.value}
                defaultChecked={defaultChecked.includes(option.value)}
                onChange={(e) =>
                  setChecked((list) => (e.target.checked ? [...list, option.value] : list.filter((v) => v !== option.value)))
                }
                data-testid={testIdPrefix ? `${testIdPrefix}-${option.value}` : undefined}
              />
              {option.label}
            </label>
          ))}
        </div>
      </details>
      {checked.length > 0 ? (
        <span className="flex flex-wrap gap-1" data-testid={testIdPrefix ? `${testIdPrefix}-chips` : undefined}>
          {options
            .filter((o) => checked.includes(o.value))
            .map((o) => (
              <span key={o.value} className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-soft">
                {o.label}
              </span>
            ))}
        </span>
      ) : null}
    </div>
  );
}
