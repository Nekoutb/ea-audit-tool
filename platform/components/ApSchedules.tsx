"use client";

// The analytical-procedures grids: collapsible per lead schedule (the header
// line always shows the totals), auto-saved commentary, compact Excel-style
// cells, and a units switch (FCFA / '000 / millions).

import { useRef, useState } from "react";
import type { ApLeadSchedule } from "@/lib/analytical-procedures";

type Unit = "fcfa" | "k" | "m";

const CELL = "border border-[color:var(--line-strong,#c9c9c9)] px-2 py-[3px] text-[11.5px]";
const NUM = `${CELL} w-px whitespace-nowrap text-right tnum`;

function useFmt(unit: Unit) {
  return (n: number): string => {
    if (unit === "k") return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n / 1_000);
    if (unit === "m") return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n / 1_000_000) + " M";
    return new Intl.NumberFormat("fr-FR").format(n);
  };
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

  return (
    <span className="flex items-center gap-1">
      <input
        defaultValue={initial}
        placeholder={placeholder}
        data-testid={testId}
        onChange={(e) => {
          latest.current = e.target.value;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(save, 1200);
        }}
        onBlur={() => {
          if (timer.current) clearTimeout(timer.current);
          if (latest.current !== initial || state === "error") void save();
        }}
        className="w-full min-w-[160px] bg-transparent px-1 py-0.5 text-[11.5px] text-ink outline-none placeholder:text-muted focus:bg-[var(--color-warn-soft)]"
      />
      <span
        className={`w-3 flex-shrink-0 text-[10px] ${state === "saved" ? "text-emerald-600" : state === "error" ? "text-rose" : "text-transparent"}`}
        title={state === "error" ? "Not saved — check the connection" : "Saved"}
        data-testid={`${testId}-state`}
        data-state={state}
        aria-hidden
      >
        {state === "error" ? "!" : "✓"}
      </span>
    </span>
  );
}

export function ApSchedules({
  engagementId,
  schedules,
  comments,
  locale,
}: {
  engagementId: string;
  schedules: ApLeadSchedule[];
  comments: Record<string, string>;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const [unit, setUnit] = useState<Unit>("fcfa");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const fmt = useFmt(unit);

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
        {unitBtn("m", fr ? "Millions" : "Millions")}
      </div>

      {schedules.map((schedule) => {
        const isOpen = open[schedule.def.code] ?? false;
        return (
          <div
            key={schedule.def.code}
            className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface shadow-atlas-sm"
            data-testid={`ap-${schedule.def.code}`}
          >
            {/* the grouped line: always shows the totals; click reveals the accounts */}
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [schedule.def.code]: !isOpen }))}
              data-testid={`ap-toggle-${schedule.def.code}`}
              aria-expanded={isOpen}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left transition hover:bg-surface-2"
            >
              <span className={`text-[11px] text-muted transition-transform ${isOpen ? "rotate-90" : ""}`} aria-hidden>▸</span>
              <span className="font-mono text-[13px] font-extrabold text-emerald-800 dark:text-emerald-300">
                {schedule.def.code}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                {schedule.def.labelEn}
                <span className="ml-2 hidden text-[10.5px] font-normal text-muted lg:inline">
                  {schedule.def.accountType} · {schedule.def.accountClass}
                </span>
              </span>
              <span className="text-[12px] font-bold text-ink tnum" data-testid={`ap-total-${schedule.def.code}`}>
                {fmt(schedule.closing)}
              </span>
              <span className="hidden text-[11px] text-muted tnum sm:inline">{fmt(schedule.prior)}</span>
              <span className={`text-[11px] tnum ${schedule.movement < 0 ? "text-rose" : "text-emerald-700 dark:text-emerald-400"}`}>
                {schedule.movement >= 0 ? "+" : ""}{fmt(schedule.movement)}
                {schedule.variancePct !== null ? ` (${schedule.variancePct >= 0 ? "+" : ""}${schedule.variancePct}%)` : ""}
              </span>
            </button>

            {isOpen ? (
              <div className="overflow-x-auto border-t border-line p-2">
                <table className="w-full border-collapse bg-white dark:bg-surface" data-testid={`ap-grid-${schedule.def.code}`}>
                  <thead>
                    <tr className="bg-surface-2 font-bold text-ink">
                      <th className={`${CELL} w-px whitespace-nowrap text-left`}>{fr ? "Compte" : "Account"}</th>
                      <th className={`${CELL} text-left`}>{fr ? "Intitulé" : "Description"}</th>
                      <th className={NUM}>{fr ? "Solde de clôture" : "Closing balance"}</th>
                      <th className={NUM}>{fr ? "Solde antérieur" : "Prior year balance"}</th>
                      <th className={NUM}>{fr ? "Mouvement" : "Movement"}</th>
                      <th className={NUM}>{fr ? "Écart %" : "Variance %"}</th>
                      <th className={`${CELL} text-left`}>{fr ? "Commentaire" : "Commentary"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.accounts.map((row) => (
                      <tr key={row.account}>
                        <td className={`${CELL} w-px whitespace-nowrap font-mono`}>{row.account}</td>
                        <td className={`${CELL} max-w-[260px] truncate`} title={row.name}>{row.name}</td>
                        <td className={NUM}>{fmt(row.closing)}</td>
                        <td className={NUM}>{fmt(row.prior)}</td>
                        <td className={`${NUM} ${row.movement < 0 ? "text-rose" : ""}`}>{fmt(row.movement)}</td>
                        <td className={NUM}>
                          {row.variancePct !== null ? `${row.variancePct >= 0 ? "+" : ""}${row.variancePct}%` : "—"}
                        </td>
                        <td className={`${CELL} p-0`}>
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
                      <td className={`${CELL} w-px whitespace-nowrap font-mono`}>TOTAL</td>
                      <td className={`${CELL} max-w-[260px] truncate`}>
                        {schedule.def.code} — {schedule.def.labelEn}
                      </td>
                      <td className={NUM}>{fmt(schedule.closing)}</td>
                      <td className={NUM}>{fmt(schedule.prior)}</td>
                      <td className={`${NUM} ${schedule.movement < 0 ? "text-rose" : ""}`}>{fmt(schedule.movement)}</td>
                      <td className={NUM}>
                        {schedule.variancePct !== null ? `${schedule.variancePct >= 0 ? "+" : ""}${schedule.variancePct}%` : "—"}
                      </td>
                      <td className={`${CELL} p-0`}>
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
  );
}
