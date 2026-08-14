"use client";

// P6.2 — the significance decision per lead schedule, in the tool's Excel
// grid: closing balance (highlighted when it exceeds tolerable error), the
// general-ledger line volume, and the status. Above TE is significant by
// default; departing from the default demands a justification, and the grid
// says so until one is written.

import { useState } from "react";
import type { SignificantAccountsView } from "@/lib/significant-accounts";
import { GRID_CELL, GRID_COMMENT_INPUT, GRID_HEAD, GRID_NUM } from "@/components/ui/grid";

type Unit = "fcfa" | "k" | "m";

const COLS = [
  { width: "56px" },  // index
  { width: "210px" }, // description
  { width: "120px" }, // closing
  { width: "78px" },  // volume
  { width: "128px" }, // status
  { width: undefined }, // justification
];

export function SignificantAccounts({
  engagementId,
  view,
  locale,
}: {
  engagementId: string;
  view: SignificantAccountsView;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const [unit, setUnit] = useState<Unit>("fcfa");
  const [rows, setRows] = useState(view.rows);
  const [saving, setSaving] = useState<Record<string, "pending" | "saved" | "error">>({});

  const fmt = (n: number) => {
    const v = unit === "k" ? n / 1_000 : unit === "m" ? n / 1_000_000 : n;
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: unit === "m" ? 2 : 0 }).format(v);
  };

  async function save(index: string, status: "significant" | "not_significant", justification: string) {
    setSaving((s) => ({ ...s, [index]: "pending" }));
    const response = await fetch(`/api/engagements/${engagementId}/significance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index, status, justification }),
    }).catch(() => null);
    setSaving((s) => ({ ...s, [index]: response?.ok ? "saved" : "error" }));
    if (response?.ok) setTimeout(() => setSaving((s) => ({ ...s, [index]: undefined as never })), 2000);
  }

  const unjustified = rows.filter((r) => r.status !== r.defaultStatus && r.justification.trim() === "").length;

  const unitBtn = (value: Unit, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setUnit(value)}
      data-testid={`sa-unit-${value}`}
      className={`rounded-full px-2.5 py-[3px] text-[11px] font-semibold transition ${
        unit === value ? "bg-emerald-700 text-white" : "border border-line text-ink-soft hover:border-emerald-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-1.5" data-testid="sig-accounts">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11px] text-muted">
          {fr ? "Erreur tolérable" : "Tolerable error"}:{" "}
          <b className="text-ink tnum">
            {view.tolerableError !== null ? fmt(view.tolerableError) : fr ? "non approuvée" : "not approved yet"}
          </b>
        </span>
        <span className="text-[11px] text-muted">
          {fr ? "Comptes significatifs" : "Significant"}: <b className="text-ink tnum">{rows.filter((r) => r.status === "significant").length}</b>/{rows.length}
        </span>
        {!view.glAvailable ? (
          <span className="text-[11px] text-warn">
            {fr ? "Volumes indisponibles — importer le grand livre" : "Volumes need the general ledger"}
          </span>
        ) : null}
        {unjustified > 0 ? (
          <span className="text-[11px] font-semibold text-rose" data-testid="sa-unjustified">
            {unjustified} {fr ? "dérogation(s) à justifier" : "override(s) awaiting justification"}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1.5">{unitBtn("fcfa", "FCFA")}{unitBtn("k", "'000")}{unitBtn("m", "Millions")}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse bg-white dark:bg-surface" data-testid="sa-grid">
          <colgroup>
            {COLS.map((c, i) => (
              <col key={i} style={c} />
            ))}
          </colgroup>
          <thead>
            <tr className={GRID_HEAD}>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Indice" : "Index"}</th>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Libellé de l'indice" : "Index description"}</th>
              <th className={GRID_NUM}>{fr ? "Solde de clôture" : "Closing balance"}</th>
              <th className={GRID_NUM}>{fr ? "Volume" : "Volume"}</th>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Statut" : "Account status"}</th>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Justification" : "Justification"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const needsWhy = row.status !== row.defaultStatus && row.justification.trim() === "";
              return (
                <tr key={row.index} data-testid={`sa-row-${row.index}`}>
                  <td className={`${GRID_CELL} font-mono font-bold`}>{row.index}</td>
                  <td className={`${GRID_CELL} overflow-hidden text-ellipsis`} title={`${row.accountType} · ${row.accountClass}`}>
                    {row.label}
                  </td>
                  <td
                    className={`${GRID_NUM} ${row.aboveTe ? "bg-[var(--color-warn-soft)] font-bold" : ""}`}
                    title={row.aboveTe ? (fr ? "Supérieur à l'erreur tolérable" : "Above tolerable error") : undefined}
                    data-testid={`sa-closing-${row.index}`}
                    data-above-te={String(row.aboveTe)}
                  >
                    {fmt(row.closing)}
                  </td>
                  <td className={GRID_NUM} data-testid={`sa-volume-${row.index}`}>{row.volume || "—"}</td>
                  <td className={`${GRID_CELL} p-0`}>
                    <select
                      value={row.status}
                      data-testid={`sa-status-${row.index}`}
                      onChange={(e) => {
                        const status = e.target.value as "significant" | "not_significant";
                        setRows((rs) => rs.map((r) => (r.index === row.index ? { ...r, status, overridden: status !== r.defaultStatus } : r)));
                        void save(row.index, status, row.justification);
                      }}
                      className={`w-full bg-transparent px-1 py-0.5 text-[10.6px] outline-none ${
                        row.status === "significant" ? "font-semibold text-ink" : "text-muted"
                      }`}
                    >
                      <option value="significant">{fr ? "Significatif" : "Significant"}</option>
                      <option value="not_significant">{fr ? "Non significatif" : "Not significant"}</option>
                    </select>
                  </td>
                  <td className={`${GRID_CELL} p-0`}>
                    <span className="flex items-center gap-1">
                      <input
                        defaultValue={row.justification}
                        placeholder={
                          needsWhy
                            ? row.status === "not_significant"
                              ? fr ? "Au-dessus du seuil — justifier l'exclusion" : "Above TE — justify excluding it"
                              : fr ? "Sous le seuil — justifier l'inclusion" : "Below TE — justify including it"
                            : "—"
                        }
                        data-testid={`sa-why-${row.index}`}
                        onChange={(e) => {
                          const justification = e.target.value;
                          setRows((rs) => rs.map((r) => (r.index === row.index ? { ...r, justification } : r)));
                        }}
                        onBlur={(e) => void save(row.index, row.status, e.target.value)}
                        className={`${GRID_COMMENT_INPUT} ${needsWhy ? "ring-1 ring-rose/60" : ""}`}
                      />
                      <span
                        className={`w-2.5 flex-shrink-0 text-[9px] ${
                          saving[row.index] === "saved" ? "text-emerald-600" : saving[row.index] === "error" ? "text-rose" : "text-transparent"
                        }`}
                        data-testid={`sa-state-${row.index}`}
                        data-state={saving[row.index] ?? "idle"}
                        aria-hidden
                      >
                        {saving[row.index] === "error" ? "!" : "✓"}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
            <tr className="font-bold" style={{ borderTopStyle: "double" }}>
              <td className={GRID_CELL}>TOTAL</td>
              <td className={GRID_CELL}>{rows.length} {fr ? "indices" : "indexes"}</td>
              <td className={GRID_NUM}>{fmt(rows.reduce((s, r) => s + r.closing, 0))}</td>
              <td className={GRID_NUM}>{rows.reduce((s, r) => s + r.volume, 0) || "—"}</td>
              <td className={GRID_CELL} />
              <td className={GRID_CELL} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
