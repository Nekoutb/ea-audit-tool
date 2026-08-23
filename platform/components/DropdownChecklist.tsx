/**
 * A dropdown that holds a checklist — server-renderable, no client JS: a
 * <details> whose summary reads like a select ("Inherent risk factors · 2")
 * and whose panel carries ordinary named checkboxes, so it drops into any
 * server-action form. Built for the risk register, reusable anywhere a row
 * of checkbox pills used to sprawl.
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
  const count = options.filter((o) => defaultChecked.includes(o.value)).length;
  return (
    <details className="relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink marker:hidden [&::-webkit-details-marker]:hidden"
        data-testid={testIdPrefix ? `${testIdPrefix}-summary` : undefined}
      >
        <span className="text-muted">{label}</span>
        <span className="rounded-full bg-surface-2 px-1.5 font-semibold tnum">{count}</span>
        <span aria-hidden className="text-[9px] text-muted">▾</span>
      </summary>
      <div className="absolute left-0 top-full z-20 mt-1 flex min-w-[230px] flex-col gap-1 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface p-2.5 shadow-atlas-sm">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-xs text-ink-soft hover:text-ink">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={defaultChecked.includes(option.value)}
              data-testid={testIdPrefix ? `${testIdPrefix}-${option.value}` : undefined}
            />
            {option.label}
          </label>
        ))}
      </div>
    </details>
  );
}
