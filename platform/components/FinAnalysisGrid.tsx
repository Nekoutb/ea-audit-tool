"use client";

// Financial Analysis: every ratio group is the SAME fixed-width grid, so the
// Current Y column of one group sits exactly above the Current Y column of the
// next. All five groups stack in the left half; the right half is reserved for
// the analyses to come. A units switch reformats amount rows without moving a
// single column.

import { useRef, useState } from "react";
import type { RatioGroup, RatioRow } from "@/lib/financial-analysis";
import { GRID_CELL, GRID_COMMENT_INPUT, GRID_HEAD, GRID_NUM } from "@/components/ui/grid";

type Unit = "fcfa" | "k" | "m";

/** The single geometry every group table repeats. */
const COLS = [
  { width: "200px" }, // ratio
  { width: "88px" },  // current
  { width: "88px" },  // prior
  { width: "88px" },  // variance
  { width: "62px" },  // %
  { width: undefined }, // commentary takes the rest
];

const GROUPS: RatioGroup[] = ["Liquidity", "Activity", "Profitability", "Leverage", "Investment"];

const GROUP_LABEL: Record<RatioGroup, { en: string; fr: string }> = {
  Liquidity: { en: "Liquidity ratios", fr: "Ratios de liquidité" },
  Activity: { en: "Activity ratios", fr: "Ratios d'activité" },
  Profitability: { en: "Profitability ratios", fr: "Ratios de rentabilité" },
  Leverage: { en: "Leverage ratios", fr: "Ratios d'endettement" },
  Investment: { en: "Investment ratios", fr: "Ratios d'investissement" },
};

function fmtValue(row: RatioRow, value: number | null, unit: Unit): string {
  if (value === null) return "—";
  if (row.unit === "FCFA") {
    const scaled = unit === "k" ? value / 1_000 : unit === "m" ? value / 1_000_000 : value;
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: unit === "m" ? 2 : 0 }).format(scaled);
  }
  if (row.unit === "%") return `${value}%`;
  return `${value}`;
}

function CommentCell({
  engagementId,
  fieldKey,
  initial,
}: {
  engagementId: string;
  fieldKey: string;
  initial: string;
}) {
  const [state, setState] = useState<"idle" | "pending" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initial);

  async function save() {
    setState("pending");
    const response = await fetch(`/api/engagements/${engagementId}/ap-comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index: "FA", key: fieldKey, value: latest.current }),
    }).catch(() => null);
    setState(response?.ok ? "saved" : "error");
    if (response?.ok) setTimeout(() => setState("idle"), 2000);
  }

  return (
    <span className="flex items-center gap-1">
      <input
        defaultValue={initial}
        placeholder="—"
        data-testid={`fa-comment-${fieldKey}`}
        onChange={(e) => {
          latest.current = e.target.value;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(save, 1200);
        }}
        onBlur={() => {
          if (timer.current) clearTimeout(timer.current);
          if (latest.current !== initial || state === "error") void save();
        }}
        className={GRID_COMMENT_INPUT}
      />
      <span
        className={`w-2.5 flex-shrink-0 text-[9px] ${state === "saved" ? "text-emerald-600" : state === "error" ? "text-rose" : "text-transparent"}`}
        data-testid={`fa-comment-${fieldKey}-state`}
        data-state={state}
        aria-hidden
      >
        {state === "error" ? "!" : "✓"}
      </span>
    </span>
  );
}

export function FinAnalysisGrid({
  engagementId,
  rows,
  comments,
  locale,
}: {
  engagementId: string;
  rows: RatioRow[];
  comments: Record<string, string>;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const [unit, setUnit] = useState<Unit>("fcfa");

  const variance = (row: RatioRow) => {
    if (row.current === null || row.prior === null) return { amount: null as number | null, pct: null as number | null };
    const amount = Math.round((row.current - row.prior) * 100) / 100;
    const pct = row.prior !== 0 ? Math.round(((row.current - row.prior) / Math.abs(row.prior)) * 1000) / 10 : null;
    return { amount, pct };
  };

  const unitBtn = (value: Unit, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setUnit(value)}
      data-testid={`fa-unit-${value}`}
      className={`rounded-full px-2.5 py-[3px] text-[11px] font-semibold transition ${
        unit === value
          ? "bg-emerald-700 text-white"
          : "border border-line text-ink-soft hover:border-emerald-600 hover:text-emerald-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-x-4 lg:grid-cols-2" data-testid="finanalysis">
      <div className="flex flex-col gap-1">

        {GROUPS.map((group, gi) => {
          const groupRows = rows.filter((r) => r.group === group);
          if (groupRows.length === 0) return null;
          return (
            <div key={group} data-testid={`fa-group-${group.toLowerCase()}`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[10.5px] font-extrabold uppercase leading-tight tracking-[0.07em] text-emerald-800 dark:text-emerald-300">
                  {fr ? GROUP_LABEL[group].fr : GROUP_LABEL[group].en}
                </h2>
                {gi === 0 ? (
                  <span className="flex items-center gap-1.5" data-testid="fa-units">
                    {unitBtn("fcfa", "FCFA")}
                    {unitBtn("k", "'000")}
                    {unitBtn("m", "Millions")}
                  </span>
                ) : null}
              </div>
              {/* identical geometry in every group — columns line up across tables */}
              <table className="w-full table-fixed border-collapse bg-white dark:bg-surface">
                <colgroup>
                  {COLS.map((col, i) => (
                    <col key={i} style={col} />
                  ))}
                </colgroup>
                <thead>
                  <tr className={GRID_HEAD}>
                    <th className={`${GRID_CELL} text-left`}>{fr ? "Ratio" : "Ratio"}</th>
                    <th className={GRID_NUM}>{fr ? "Exercice N" : "Current Y"}</th>
                    <th className={GRID_NUM}>{fr ? "Exercice N-1" : "Prior Y"}</th>
                    <th className={GRID_NUM}>{fr ? "Écart" : "Variance"}</th>
                    <th className={GRID_NUM}>%</th>
                    <th className={`${GRID_CELL} text-left`}>{fr ? "Commentaire" : "Commentary"}</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((row) => {
                    const v = variance(row);
                    return (
                      <tr key={row.key} data-testid={`ratio-${row.key}`}>
                        <td className={`${GRID_CELL} overflow-hidden text-ellipsis`} title={row.note ?? row.label}>
                          {row.label}
                        </td>
                        <td className={GRID_NUM}>{fmtValue(row, row.current, unit)}</td>
                        <td className={GRID_NUM}>{fmtValue(row, row.prior, unit)}</td>
                        <td className={`${GRID_NUM} ${v.amount !== null && v.amount < 0 ? "text-rose" : ""}`}>
                          {v.amount !== null ? fmtValue(row, v.amount, unit) : "—"}
                        </td>
                        <td className={`${GRID_NUM} ${v.pct !== null && v.pct < 0 ? "text-rose" : "text-muted"}`}>
                          {v.pct !== null ? `${v.pct >= 0 ? "+" : ""}${v.pct}%` : "—"}
                        </td>
                        <td className={`${GRID_CELL} p-0`}>
                          <CommentCell
                            engagementId={engagementId}
                            fieldKey={row.key}
                            initial={comments[`FA|${row.key}`] ?? ""}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* right half: reserved for the analyses to come */}
      <div className="hidden lg:block" data-testid="fa-right" aria-hidden />
    </div>
  );
}
