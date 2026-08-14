"use client";

// The analytical-procedures screen: a tight grouped list of lead schedules on
// the left (~40%), each expanding to its Excel-style account grid, and a
// sticky Overall Analytical Review on the right that follows the scroll.
// Commentary auto-saves; a units switch shows bare figures in FCFA, '000 or
// millions.

import { useRef, useState } from "react";
import type { ApLeadSchedule } from "@/lib/analytical-procedures";

type Unit = "fcfa" | "k" | "m";

const CELL = "border border-[color:var(--line-strong,#c9c9c9)] px-1.5 py-[2px] text-[10.8px] whitespace-nowrap";
const NUM = `${CELL} w-px text-right tnum`;
const NUMHEAD = `${NUM} max-w-[76px] whitespace-normal leading-tight align-bottom`;

function useFmt(unit: Unit) {
  return (n: number): string => {
    if (unit === "k") return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n / 1_000);
    if (unit === "m") return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n / 1_000_000);
    return new Intl.NumberFormat("fr-FR").format(n);
  };
}

function useAutoSave(engagementId: string, index: string, fieldKey: string, initial: string) {
  const [state, setState] = useState<"idle" | "pending" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initial);

  async function save() {
    setState("pending");
    const response = await fetch(`/api/engagements/${engagementId}/ap-comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index, key: fieldKey, value: latest.current }),
    }).catch(() => null);
    setState(response?.ok ? "saved" : "error");
    if (response?.ok) setTimeout(() => setState("idle"), 2000);
  }

  return {
    state,
    onChange(value: string) {
      latest.current = value;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(save, 1200);
    },
    onBlur() {
      if (timer.current) clearTimeout(timer.current);
      if (latest.current !== initial || state === "error") void save();
    },
  };
}

function SaveTick({ state, testId }: { state: string; testId: string }) {
  return (
    <span
      className={`w-3 flex-shrink-0 text-[10px] ${state === "saved" ? "text-emerald-600" : state === "error" ? "text-rose" : "text-transparent"}`}
      title={state === "error" ? "Not saved — check the connection" : "Saved"}
      data-testid={testId}
      data-state={state}
      aria-hidden
    >
      {state === "error" ? "!" : "✓"}
    </span>
  );
}

function CommentCell({
  engagementId,
  index,
  fieldKey,
  initial,
  placeholder,
  testId,
}: {
  engagementId: string;
  index: string;
  fieldKey: string;
  initial: string;
  placeholder: string;
  testId: string;
}) {
  const saver = useAutoSave(engagementId, index, fieldKey, initial);
  return (
    <span className="flex items-center gap-1">
      <input
        defaultValue={initial}
        placeholder={placeholder}
        data-testid={testId}
        onChange={(e) => saver.onChange(e.target.value)}
        onBlur={saver.onBlur}
        className="w-full min-w-[90px] bg-[var(--color-warn-soft)] px-1 py-0.5 text-[10.8px] text-ink outline-none placeholder:text-muted/70 focus:ring-1 focus:ring-emerald-600/40"
      />
      <SaveTick state={saver.state} testId={`${testId}-state`} />
    </span>
  );
}

export function ApSchedules({
  engagementId,
  schedules,
  comments,
  locale,
  showOverall = true,
}: {
  engagementId: string;
  schedules: ApLeadSchedule[];
  comments: Record<string, string>;
  locale: "en" | "fr";
  showOverall?: boolean;
}) {
  const fr = locale === "fr";
  const [unit, setUnit] = useState<Unit>("fcfa");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const fmt = useFmt(unit);
  const overall = useAutoSave(engagementId, "OVR", "total", comments["OVR|total"] ?? "");
  // widths anchor to the FCFA rendering so switching units never moves a column
  const numWidth = (() => {
    let longest = 8;
    const fcfa = new Intl.NumberFormat("fr-FR");
    for (const sc of schedules) {
      for (const v of [sc.closing, sc.prior, sc.movement]) longest = Math.max(longest, fcfa.format(v).length);
      for (const a of sc.accounts) for (const v of [a.closing, a.prior, a.movement]) longest = Math.max(longest, fcfa.format(v).length);
    }
    return longest + 2 + "ch";
  })();
  const numStyle = { minWidth: numWidth, width: numWidth } as const;

  const unitBtn = (value: Unit, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setUnit(value)}
      data-testid={`ap-unit-${value}`}
      className={`rounded-full px-3 py-1 text-[11.5px] font-semibold transition ${
        unit === value
          ? "bg-emerald-700 text-white"
          : "border border-line text-ink-soft hover:border-emerald-600 hover:text-emerald-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-2" data-testid="ap-schedules">
      <div className="flex items-center gap-1.5 self-end" data-testid="ap-units">
        <span className="text-[11px] uppercase tracking-wide text-muted">{fr ? "Unités" : "Units"}</span>
        {unitBtn("fcfa", "FCFA")}
        {unitBtn("k", "'000")}
        {unitBtn("m", "Millions")}
      </div>

      <div className="flex items-start gap-4">
        {/* the grouped list — ~40% of the screen, tight lines */}
        <div className="flex w-full min-w-0 flex-1 flex-col gap-1" data-testid="ap-list">
          {schedules.map((schedule) => {
            const isOpen = open[schedule.def.code] ?? false;
            return (
              <div
                key={schedule.def.code}
                className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface shadow-atlas-sm"
                data-testid={`ap-${schedule.def.code}`}
              >
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [schedule.def.code]: !isOpen }))}
                  data-testid={`ap-toggle-${schedule.def.code}`}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-surface-2"
                >
                  <span className={`text-[11px] text-muted transition-transform ${isOpen ? "rotate-90" : ""}`} aria-hidden>▸</span>
                  <span className="w-9 font-mono text-[12.5px] font-extrabold text-emerald-800 dark:text-emerald-300">
                    {schedule.def.code}
                  </span>
                  <span className="min-w-0 truncate text-[12.5px] font-semibold text-ink">
                    {schedule.def.labelEn}
                  </span>
                </button>

                {isOpen ? (
                  <div className="overflow-x-auto border-t border-line p-2">
                    <table className="w-full border-collapse bg-white dark:bg-surface" data-testid={`ap-grid-${schedule.def.code}`}>
                      <thead>
                        <tr className="bg-surface-2 font-bold text-ink">
                          <th className={`${CELL} text-left`}>{fr ? "Compte" : "Account"}</th>
                          <th className={`${CELL} text-left`}>{fr ? "Intitulé" : "Description"}</th>
                          <th className={`${CELL} text-left`}>{fr ? "Classe de compte" : "Account class"}</th>
                          <th className={`${CELL} text-left`}>{fr ? "Type de compte" : "Account type"}</th>
                          <th className={NUMHEAD} style={numStyle}>{fr ? "Exercice N" : "Current Y"}</th>
                          <th className={NUMHEAD} style={numStyle}>{fr ? "Exercice N-1" : "Prior Y"}</th>
                          <th className={NUMHEAD} style={numStyle}>{fr ? "Mouvement" : "Movement"}</th>
                          <th className={NUMHEAD} style={numStyle}>{fr ? "Écart %" : "Variance %"}</th>
                          <th className={`${CELL} text-left`}>{fr ? "Commentaire" : "Commentary"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.accounts.map((row) => (
                          <tr key={row.account}>
                            <td className={`${CELL} font-mono`}>{row.account}</td>
                            <td className={`${CELL} max-w-[170px] truncate`} title={row.name}>{row.name}</td>
                            <td className={CELL}>{schedule.def.accountClass}</td>
                            <td className={CELL}>{schedule.def.accountType}</td>
                            <td className={NUM}>{fmt(row.closing)}</td>
                            <td className={NUM}>{fmt(row.prior)}</td>
                            <td className={`${NUM} ${row.movement < 0 ? "text-rose" : ""}`}>{fmt(row.movement)}</td>
                            <td className={NUM}>
                              {row.variancePct !== null ? `${row.variancePct >= 0 ? "+" : ""}${row.variancePct}%` : "—"}
                            </td>
                            <td className={`${CELL} whitespace-normal p-0 align-top`}>
                              <CommentCell
                                engagementId={engagementId}
                                index={schedule.def.code}
                                fieldKey={row.account}
                                initial={comments[`${schedule.def.code}|${row.account}`] ?? ""}
                                placeholder="—"
                                testId={`ap-comment-${schedule.def.code}-${row.account}`}
                              />
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 font-bold" style={{ borderTopStyle: "double" }}>
                          <td className={`${CELL} font-mono`}>TOTAL</td>
                          <td className={`${CELL} max-w-[170px] truncate`}>
                            {schedule.def.code} — {schedule.def.labelEn}
                          </td>
                          <td className={CELL} />
                          <td className={CELL} />
                          <td className={NUM} data-testid={`ap-total-${schedule.def.code}`}>{fmt(schedule.closing)}</td>
                          <td className={NUM}>{fmt(schedule.prior)}</td>
                          <td className={`${NUM} ${schedule.movement < 0 ? "text-rose" : ""}`}>{fmt(schedule.movement)}</td>
                          <td className={NUM}>
                            {schedule.variancePct !== null ? `${schedule.variancePct >= 0 ? "+" : ""}${schedule.variancePct}%` : "—"}
                          </td>
                          <td className={`${CELL} whitespace-normal p-0 align-top`}>
                            <CommentCell
                              engagementId={engagementId}
                              index={schedule.def.code}
                              fieldKey="total"
                              initial={comments[`${schedule.def.code}|total`] ?? ""}
                              placeholder={fr ? "Commentaire sur le total…" : "Comment on the total…"}
                              testId={`ap-comment-${schedule.def.code}-total`}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* the overall analytical review — sticky, follows the scroll */}
        {showOverall ? (
        <div
          className="sticky top-4 hidden max-h-[80vh] w-[30%] flex-shrink-0 flex-col overflow-y-auto rounded-[var(--radius-atlas)] border border-glass-border bg-surface p-3 shadow-atlas-sm backdrop-blur-xl lg:flex"
          data-testid="ap-overall"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
              {fr ? "Revue analytique globale" : "Overall Analytical Review"}
            </h2>
            <SaveTick state={overall.state} testId="ap-overall-state" />
          </div>
          <textarea
            defaultValue={comments["OVR|total"] ?? ""}
            onChange={(e) => overall.onChange(e.target.value)}
            onBlur={overall.onBlur}
            data-testid="ap-overall-text"
            wrap="soft"
            placeholder={
              fr
                ? "Conclusions de la revue analytique : tendances, écarts inattendus, cohérence entre les feuilles maîtresses…"
                : "Conclusions of the analytical review: trends, unexpected variances, consistency across the lead schedules…"
            }
            className="mt-2 min-h-[420px] w-full flex-1 resize-none rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-input,#f4f4f2)] px-2.5 py-2 text-[12px] leading-relaxed text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-emerald-600/25"
          />
        </div>
        ) : null}
      </div>
    </div>
  );
}
