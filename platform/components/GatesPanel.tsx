import type { GateResult } from "@/lib/gates";
import { getMessages, type Locale } from "@/lib/i18n";

/**
 * Planning gates live under planning.gateNames, completion (C4.1) gates under
 * planning.conclusion.gateNames; a panel used on both pages looks in both, so a
 * raw key such as sections_concluded never reaches the screen (UAT B118).
 */
function gateLabel(
  t: ReturnType<typeof getMessages>["planning"],
  key: string,
  scope: "planning" | "conclusion" = "planning",
): string {
  const planning = t.gateNames as Record<string, string>;
  const conclusion = (t.conclusion?.gateNames ?? {}) as Record<string, string>;
  const archive = ((t.conclusion as { archiveGateNames?: Record<string, string> } | undefined)?.archiveGateNames ?? {});
  // on the conclusion page the completion and archive wording wins over the
  // planning gate of the same key (UAT run 2 B84: review_notes_cleared)
  if (scope === "conclusion") return conclusion[key] ?? archive[key] ?? planning[key] ?? key;
  return planning[key] ?? conclusion[key] ?? archive[key] ?? key;
}

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
            {gateLabel(t, gate.key)}
          </span>
          {!gate.ok && gate.detail ? (
            <span className="text-xs text-muted" data-testid={`gate-detail-${gate.key}`}>
              ({gate.detail})
              {gate.href ? (
                <>
                  {" "}
                  <a href={gate.href} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                    {locale === "fr" ? "Voir" : "Open"}
                  </a>
                </>
              ) : null}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ErrorBanner({
  error,
  failed,
  locale,
  scope = "planning",
  details,
}: {
  error?: string;
  failed?: string;
  locale: Locale;
  /** which gate wording wins for a key both lists share */
  scope?: "planning" | "conclusion";
  /** per failed key, the tasks it names (e.g. "P3.2, C4.3") */
  details?: Record<string, string>;
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
            <li key={key}>
              {gateLabel(t, key, scope)}
              {details?.[key] ? <span className="ml-1 font-semibold tnum">({details[key]})</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
