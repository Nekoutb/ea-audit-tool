"use client";

// The receivables / payables aging: the same fixed Excel geometry as every
// other grid in the tool, collapsible, with a units switch that never moves a
// column.

import { useState } from "react";
import type { AgingResult } from "@/lib/aging";
import { GRID_CELL, GRID_HEAD, GRID_NUM } from "@/components/ui/grid";

type Unit = "fcfa" | "k" | "m";

const cols = (withTerms: boolean) => [
  { width: "110px" }, // party
  { width: "220px" }, // name
  ...(withTerms ? [{ width: "130px" }] : []), // payment terms
  { width: "110px" },
  { width: "110px" },
  { width: "110px" },
  { width: "110px" },
  { width: "120px" },
];

export function AgingGrid({
  aging,
  title,
  partyLabel,
  locale,
}: {
  aging: AgingResult;
  title: string;
  partyLabel: string;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const [unit, setUnit] = useState<Unit>("fcfa");
  const [open, setOpen] = useState(true);
  const fmt = (n: number) => {
    const v = unit === "k" ? n / 1_000 : unit === "m" ? n / 1_000_000 : n;
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: unit === "m" ? 2 : 0 }).format(v);
  };
  const unitBtn = (value: Unit, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setUnit(value)}
      data-testid={`aging-unit-${value}`}
      className={`rounded-full px-2.5 py-[3px] text-[11px] font-semibold transition ${
        unit === value ? "bg-emerald-700 text-white" : "border border-line text-ink-soft hover:border-emerald-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface" data-testid="aging">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          data-testid="aging-toggle"
          aria-expanded={open}
          className="flex items-center gap-2 text-left"
        >
          <span className={`text-[11px] text-muted transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>▸</span>
          <span className="text-[13px] font-semibold text-ink">{title}</span>
        </button>
        <span className="text-[11px] text-muted tnum">
          {aging.rows.length} {fr ? "comptes" : "accounts"} · {aging.transactionCount} {fr ? "transactions" : "transactions"}
          {aging.undated > 0 ? ` · ${aging.undated} ${fr ? "sans date" : "undated"}` : ""}
          {" · "}
          {fr ? "au" : "as at"} {aging.periodEnd}
        </span>
        <span className="ml-auto flex items-center gap-1.5">{unitBtn("fcfa", "FCFA")}{unitBtn("k", "'000")}{unitBtn("m", "Millions")}</span>
      </div>

      {open ? (
        <div className="overflow-x-auto border-t border-line p-2">
          <table className="w-full table-fixed border-collapse bg-white dark:bg-surface" data-testid="aging-grid">
            <colgroup>
              {cols(aging.hasTerms).map((c, i) => (
                <col key={i} style={c} />
              ))}
            </colgroup>
            <thead>
              <tr className={GRID_HEAD}>
                <th className={`${GRID_CELL} text-left`}>{partyLabel}</th>
                <th className={`${GRID_CELL} text-left`}>{fr ? "Nom" : "Name"}</th>
                {aging.hasTerms ? <th className={`${GRID_CELL} text-left`}>{fr ? "Conditions" : "Terms"}</th> : null}
                <th className={GRID_NUM}>{fr ? "Courant 0–30" : "Current 0–30"}</th>
                <th className={GRID_NUM}>31–60</th>
                <th className={GRID_NUM}>61–90</th>
                <th className={GRID_NUM}>{fr ? "> 90" : "Over 90"}</th>
                <th className={GRID_NUM}>{fr ? "Total" : "Total"}</th>
              </tr>
            </thead>
            <tbody>
              {aging.rows.map((row) => (
                <tr key={row.party} data-testid={`aging-row-${row.party}`}>
                  <td className={`${GRID_CELL} overflow-hidden text-ellipsis font-mono`}>{row.party}</td>
                  <td className={`${GRID_CELL} overflow-hidden text-ellipsis`} title={row.name}>{row.name}</td>
                  {aging.hasTerms ? (
                    <td className={`${GRID_CELL} overflow-hidden text-ellipsis`} title={row.terms ?? undefined}>{row.terms ?? "—"}</td>
                  ) : null}
                  <td className={GRID_NUM}>{fmt(row.current)}</td>
                  <td className={GRID_NUM}>{fmt(row.d31_60)}</td>
                  <td className={GRID_NUM}>{fmt(row.d61_90)}</td>
                  <td className={`${GRID_NUM} ${row.over90 !== 0 ? "text-rose" : ""}`}>{fmt(row.over90)}</td>
                  <td className={`${GRID_NUM} font-semibold`}>{fmt(row.total)}</td>
                </tr>
              ))}
              <tr className="font-bold" style={{ borderTopStyle: "double" }} data-testid="aging-total">
                <td className={GRID_CELL}>TOTAL</td>
                <td className={GRID_CELL} />
                {aging.hasTerms ? <td className={GRID_CELL} /> : null}
                <td className={GRID_NUM}>{fmt(aging.totals.current)}</td>
                <td className={GRID_NUM}>{fmt(aging.totals.d31_60)}</td>
                <td className={GRID_NUM}>{fmt(aging.totals.d61_90)}</td>
                <td className={GRID_NUM}>{fmt(aging.totals.over90)}</td>
                <td className={GRID_NUM}>{fmt(aging.totals.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
