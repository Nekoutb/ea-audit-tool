// Atlas shared UI primitives. Server components (no client state) so any page —
// server or client — can compose them. Styling uses the Atlas design tokens from
// globals.css (canvas / surface / ink / line / radius / shadow) with the accent on
// Tailwind's emerald scale, which BrandStyle re-themes per firm.

import type { ReactNode } from "react";

type Div = React.HTMLAttributes<HTMLDivElement>;

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Elevated surface. `flush` removes padding for tables / lists that manage their own. */
export function Panel({
  className,
  flush,
  children,
  ...rest
}: Div & { flush?: boolean }) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-atlas)] border border-line bg-surface shadow-[var(--shadow-atlas)]",
        !flush && "p-5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Section title with an optional trailing slot (count, action). */
export function PanelHeader({
  title,
  hint,
  right,
}: {
  title: ReactNode;
  hint?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

type Tone = "good" | "warn" | "rose" | "muted" | "accent";

const CHIP_TONE: Record<Tone, string> = {
  good: "text-good bg-[var(--color-good-soft)]",
  warn: "text-warn bg-[var(--color-warn-soft)]",
  rose: "text-rose bg-[var(--color-rose-soft)]",
  muted: "text-muted bg-surface-2",
  accent: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40",
};

export function Chip({
  tone = "muted",
  pulse,
  children,
}: {
  tone?: Tone;
  pulse?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.03em]",
        CHIP_TONE[tone],
      )}
    >
      {pulse ? <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" /> : null}
      {children}
    </span>
  );
}

/** A label/value cell used across dashboards and status panels. */
export function StatCell({
  label,
  value,
  sub,
  right,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[15px] font-semibold tracking-[-0.015em] text-ink tnum">{value}</span>
        {right}
      </div>
      {sub ? <p className="mt-0.5 text-xs text-muted tnum">{sub}</p> : null}
    </div>
  );
}

export function Avatar({
  initials,
  className,
  color,
}: {
  initials: string;
  className?: string;
  color?: string;
}) {
  return (
    <span
      className={cx(
        "inline-grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white",
        !color && "bg-emerald-700",
        className,
      )}
      style={color ? { background: color } : undefined}
    >
      {initials}
    </span>
  );
}

export type GaugeStatus = "complete" | "current" | "upcoming";

/**
 * Radial phase gauge: donut arc filled to the phase %, task count (done/total) in
 * the centre, and a "remaining" line. The current phase carries an accent ring and
 * a pulsing chip. Pure SVG, no client JS — reduced-motion safe by construction.
 */
export function PhaseGauge({
  index,
  name,
  done,
  total,
  status,
  lead,
  note,
}: {
  index: string;
  name: string;
  done: number;
  total: number;
  status: GaugeStatus;
  lead?: string | null;
  note?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : status === "complete" ? 100 : 0;
  const remaining = Math.max(0, total - done);
  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;
  const arcColor = status === "upcoming" ? "var(--color-line-strong)" : "var(--color-emerald-600)";
  const chip =
    status === "complete" ? (
      <Chip tone="good">Complete</Chip>
    ) : status === "current" ? (
      <Chip tone="warn" pulse>
        In progress
      </Chip>
    ) : (
      <Chip tone="muted">Not started</Chip>
    );

  return (
    <div
      className={cx(
        "relative flex flex-col rounded-[var(--radius-atlas)] border bg-surface p-4 shadow-[var(--shadow-atlas)] transition-transform duration-200",
        status === "current"
          ? "border-emerald-600/45 shadow-[var(--shadow-atlas-lg)]"
          : "border-line",
      )}
    >
      {status === "current" ? (
        <span className="absolute inset-x-0 top-0 h-[3px] rounded-t-[var(--radius-atlas)] bg-gradient-to-r from-emerald-600 to-emerald-400" />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-extrabold text-emerald-700/55 tnum dark:text-emerald-400/55">
            {index}
          </span>
          <span className="text-[13.5px] font-semibold tracking-[-0.015em] text-ink">{name}</span>
        </div>
        {chip}
      </div>

      <div className="grid place-items-center py-1">
        <div className="relative aspect-square w-full max-w-[108px]">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-line)" strokeWidth="9" />
            {pct > 0 ? (
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={arcColor}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${C}`}
              />
            ) : null}
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center leading-none">
              <div className="text-[22px] font-extrabold tracking-[-0.03em] text-ink tnum">
                {done}
                <span className="text-muted">/{total}</span>
              </div>
              <div className="mt-1 text-[11px] font-semibold text-muted tnum">{pct}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between border-t border-line pt-2.5 text-[11px]">
        <span className="flex items-center gap-1.5 text-ink-soft">
          {lead ? <Avatar initials={lead} className="h-[18px] w-[18px] bg-emerald-700/90 text-[8px]" /> : null}
          {remaining > 0 ? `${remaining} remaining` : "All done"}
        </span>
        {note ? <span className="text-muted">{note}</span> : null}
      </div>
    </div>
  );
}

/** Primary action styling reused across pages (buttons, links styled as buttons). */
export const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 text-[13.5px] font-semibold text-white shadow-[var(--shadow-atlas-sm)] transition hover:bg-emerald-800 active:scale-[0.98] motion-reduce:active:scale-100";

export const btnGhost =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-4 text-[13.5px] font-semibold text-ink-soft transition hover:bg-surface-2 active:scale-[0.98] motion-reduce:active:scale-100";
