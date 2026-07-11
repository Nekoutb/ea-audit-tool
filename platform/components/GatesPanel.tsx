import type { GateResult } from "@/lib/gates";
import { getMessages, type Locale } from "@/lib/i18n";

export function GatesPanel({ gates, locale }: { gates: GateResult[]; locale: Locale }) {
  const t = getMessages(locale).planning;
  return (
    <ul className="mt-3 flex flex-col gap-1.5" data-testid="gates-panel">
      {gates.map((gate) => (
        <li key={gate.key} className="flex items-center gap-2 text-sm" data-testid={`gate-${gate.key}`}>
          <span
            className={
              gate.ok
                ? "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-rose-soft)] px-1 text-xs font-bold text-rose"
            }
          >
            {gate.ok ? "✓" : "✗"}
          </span>
          <span className={gate.ok ? "text-ink-soft" : "font-medium text-ink"}>
            {t.gateNames[gate.key as keyof typeof t.gateNames] ?? gate.key}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ErrorBanner({
  error,
  failed,
  locale,
}: {
  error?: string;
  failed?: string;
  locale: Locale;
}) {
  if (!error) return null;
  const t = getMessages(locale).planning;
  const message = t.errors[error as keyof typeof t.errors] ?? error;
  const failedKeys = (failed ?? "").split(",").filter(Boolean);
  return (
    <div
      role="alert"
      data-testid="planning-error"
      className="mt-4 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-[var(--color-rose-soft)] px-4 py-3 text-sm text-rose"
    >
      <p>{message}</p>
      {failedKeys.length > 0 ? (
        <ul className="mt-1 list-inside list-disc">
          {failedKeys.map((key) => (
            <li key={key}>{t.gateNames[key as keyof typeof t.gateNames] ?? key}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
