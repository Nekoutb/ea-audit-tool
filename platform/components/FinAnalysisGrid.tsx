"use client";

// The Financial Analysis grid: Excel-style, compact, one page — grouped
// sections in two halves, each ratio on one dense row with Current Y, Prior Y,
// variance, variance % and an auto-saving commentary cell.

import { useRef, useState } from "react";
import type { RatioGroup, RatioRow } from "@/lib/financial-analysis";

const CELL = "border border-[color:var(--line-strong,#c9c9c9)] px-1.5 py-[2px] text-[10.8px] whitespace-nowrap";
const NUM = `${CELL} w-px text-right tnum`;

const LEFT: RatioGroup[] = ["Liquidity", "Activity"];
const RIGHT: RatioGroup[] = ["Profitability", "Leverage", "Investment"];

function fmtValue(row: RatioRow, value: number | null): string {
  if (value === null) return "—";
  if (row.unit === "FCFA") return new Intl.NumberFormat("fr-FR").format(value);
  if (row.unit === "%") return `${value}%`;
  if (row.unit === "days") return `${value}`;
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
        className="w-full min-w-[110px] bg-transparent px-1 py-0.5 text-[10.8px] text-ink outline-none placeholder:text-muted focus:bg-[var(--color-warn-soft)]"
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

function GroupTable({
  group,
  rows,
  comments,
  engagementId,
  fr,
}: {
  group: RatioGroup;
  rows: RatioRow[];
  comments: Record<string, string>;
  engagementId: string;
  fr: boolean;
}) {
  const variance = (row: RatioRow): { amount: number | null; pct: number | null } => {
    if (row.current === null || row.prior === null) return { amount: null, pct: null };
    const amount = Math.round((row.current - row.prior) * 100) / 100;
    const pct = row.prior !== 0 ? Math.round(((row.current - row.prior) / Math.abs(row.prior)) * 1000) / 10 : null;
    return { amount, pct };
  };
  const GROUP_LABEL: Record<RatioGroup, { en: string; fr: string }> = {
    Liquidity: { en: "Liquidity ratios", fr: "Ratios de liquidité" },
    Activity: { en: "Activity ratios", fr: "Ratios d'activité" },
    Profitability: { en: "Profitability ratios", fr: "Ratios de rentabilité" },
    Leverage: { en: "Leverage ratios", fr: "Ratios d'endettement" },
    Investment: { en: "Investment ratios", fr: "Ratios d'investissement" },
  };
  return (
    <div data-testid={`fa-group-${group.toLowerCase()}`}>
      <h2 className="mb-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-emerald-800 dark:text-emerald-300">
        {fr ? GROUP_LABEL[group].fr : GROUP_LABEL[group].en}
      </h2>
      <table className="w-full border-collapse bg-white dark:bg-surface">
        <thead>
          <tr className="bg-surface-2 font-bold text-ink">
            <th className={`${CELL} text-left`}>{fr ? "Ratio" : "Ratio"}</th>
            <th className={NUM}>{fr ? "Exercice N" : "Current Y"}</th>
            <th className={NUM}>{fr ? "Exercice N-1" : "Prior Y"}</th>
            <th className={NUM}>{fr ? "Écart" : "Variance"}</th>
            <th className={NUM}>%</th>
            <th className={`${CELL} text-left`}>{fr ? "Commentaire" : "Commentary"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const v = variance(row);
            return (
              <tr key={row.key} data-testid={`ratio-${row.key}`}>
                <td className={`${CELL} max-w-[190px] truncate`} title={row.note ?? row.label}>
                  {row.label}
                  {row.unit !== "x" && row.unit !== "FCFA" ? "" : ""}
                </td>
                <td className={NUM}>{fmtValue(row, row.current)}</td>
                <td className={NUM}>{fmtValue(row, row.prior)}</td>
                <td className={`${NUM} ${v.amount !== null && v.amount < 0 ? "text-rose" : ""}`}>
                  {v.amount !== null ? fmtValue(row, v.amount) : "—"}
                </td>
                <td className={`${NUM} ${v.pct !== null && v.pct < 0 ? "text-rose" : "text-muted"}`}>
                  {v.pct !== null ? `${v.pct >= 0 ? "+" : ""}${v.pct}%` : "—"}
                </td>
                <td className={`${CELL} p-0`}>
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
  const half = (groups: RatioGroup[]) =>
    groups.map((group) => (
      <GroupTable
        key={group}
        group={group}
        rows={rows.filter((r) => r.group === group)}
        comments={comments}
        engagementId={engagementId}
        fr={fr}
      />
    ));
  return (
    <div className="grid grid-cols-1 items-start gap-x-4 gap-y-3 lg:grid-cols-2" data-testid="finanalysis">
      <div className="flex flex-col gap-3">{half(LEFT)}</div>
      <div className="flex flex-col gap-3">{half(RIGHT)}</div>
    </div>
  );
}
