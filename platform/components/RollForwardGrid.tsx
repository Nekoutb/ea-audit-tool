"use client";

// The trial-balance roll-forward: opening per TB + net GL movements = expected
// closing, against closing per TB. Collapsed to its result line until clicked;
// the same fixed Excel geometry as every other grid.

import { useState } from "react";
import type { RollForwardResult } from "@/lib/tb-rollforward";
import { GRID_CELL, GRID_HEAD, GRID_NUM } from "@/components/ui/grid";

type Unit = "fcfa" | "k" | "m";

const COLS = [
  { width: "100px" },
  { width: "200px" },
  { width: "120px" },
  { width: "120px" },
  { width: "120px" },
  { width: "120px" },
  { width: "110px" },
];

export function RollForwardGrid({ result, locale }: { result: RollForwardResult; locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<Unit>("fcfa");
  const fmt = (n: number) => {
    const v = unit === "k" ? n / 1_000 : unit === "m" ? n / 1_000_000 : n;
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: unit === "m" ? 2 : 0 }).format(v);
  };
  const unitBtn = (value: Unit, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setUnit(value)}
      data-testid={`rf-unit-${value}`}
      className={`rounded-full px-2.5 py-[3px] text-[11px] font-semibold transition ${
        unit === value ? "bg-emerald-700 text-white" : "border border-line text-ink-soft hover:border-emerald-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-3 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2/40" data-testid="rollforward">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          data-testid="rf-toggle"
          aria-expanded={open}
          className="flex items-center gap-2 text-left"
        >
          <span className={`text-[11px] text-muted transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>▸</span>
          <span className="text-[12.5px] font-semibold text-ink">
            {fr ? "Réconciliation / roll-forward de la balance" : "Trial balance roll-forward reconciliation"}
          </span>
        </button>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            result.reconciled
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-[var(--color-rose-soft)] text-rose"
          }`}
          data-testid="rf-status"
        >
          {result.reconciled
            ? fr ? "Rapproché — écart nul" : "Reconciled — nil variance"
            : fr ? `${result.exceptions} écart(s)` : `${result.exceptions} exception(s)`}
        </span>
        <span className="text-[11px] text-muted tnum">
          {result.glRowCount} {fr ? "écritures du grand livre" : "general-ledger entries"}
        </span>
        <span className="ml-auto flex items-center gap-1.5">{unitBtn("fcfa", "FCFA")}{unitBtn("k", "'000")}{unitBtn("m", "Millions")}</span>
      </div>

      {open ? (
        <div className="overflow-x-auto border-t border-line p-2">
          <table className="w-full table-fixed border-collapse bg-white dark:bg-surface" data-testid="rf-grid">
            <colgroup>
              {COLS.map((c, i) => (
                <col key={i} style={c} />
              ))}
            </colgroup>
            <thead>
              <tr className={GRID_HEAD}>
                <th className={`${GRID_CELL} text-left`}>{fr ? "Compte" : "Account"}</th>
                <th className={`${GRID_CELL} text-left`}>{fr ? "Intitulé" : "Description"}</th>
                <th className={GRID_NUM}>{fr ? "Ouverture (BG)" : "Opening per TB"}</th>
                <th className={GRID_NUM}>{fr ? "Mouvements (GL)" : "GL movements"}</th>
                <th className={GRID_NUM}>{fr ? "Clôture attendue" : "Expected closing"}</th>
                <th className={GRID_NUM}>{fr ? "Clôture (BG)" : "Closing per TB"}</th>
                <th className={GRID_NUM}>{fr ? "Écart" : "Variance"}</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.account} data-testid={`rf-row-${row.account}`} className={Math.abs(row.variance) > 0.5 ? "bg-[var(--color-warn-soft)]" : ""}>
                  <td className={`${GRID_CELL} font-mono`}>{row.account}</td>
                  <td className={`${GRID_CELL} overflow-hidden text-ellipsis`} title={row.name}>{row.name}</td>
                  <td className={GRID_NUM}>{fmt(row.opening)}</td>
                  <td className={GRID_NUM}>{fmt(row.glMovement)}</td>
                  <td className={GRID_NUM}>{fmt(row.expected)}</td>
                  <td className={GRID_NUM}>{fmt(row.closing)}</td>
                  <td className={`${GRID_NUM} ${Math.abs(row.variance) > 0.5 ? "font-bold text-rose" : ""}`}>{fmt(row.variance)}</td>
                </tr>
              ))}
              <tr className="font-bold" style={{ borderTopStyle: "double" }} data-testid="rf-total">
                <td className={GRID_CELL}>TOTAL</td>
                <td className={GRID_CELL} />
                <td className={GRID_NUM}>{fmt(result.totals.opening)}</td>
                <td className={GRID_NUM}>{fmt(result.totals.glMovement)}</td>
                <td className={GRID_NUM}>{fmt(result.totals.expected)}</td>
                <td className={GRID_NUM}>{fmt(result.totals.closing)}</td>
                <td className={`${GRID_NUM} ${Math.abs(result.totals.variance) > 0.5 ? "text-rose" : ""}`}>{fmt(result.totals.variance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
