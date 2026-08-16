"use client";

// S1.1 — the SCOT register: one row per significant class of transactions,
// typed, linked to lead-schedule indexes, and assignable to a team member.
// Excel-grid conventions; structural changes refresh the server view.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GRID_CELL, GRID_HEAD } from "@/components/ui/grid";
import { LEAD_INDEXES } from "@/lib/lead-classes";
import type { ScotStudioView } from "@/lib/scots";

const COLS = [
  { width: "170px" }, // name
  { width: "104px" }, // type
  { width: "150px" }, // indexes
  { width: "120px" }, // applications
  { width: "96px" },  // strategy
  { width: "130px" }, // assignee
  { width: "40px" },  // delete
];

export function ScotRegister({
  engagementId,
  view,
  team,
  locale,
}: {
  engagementId: string;
  view: ScotStudioView;
  team: { userId: string; userName: string }[];
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function op(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/engagements/${engagementId}/scots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      const detail = (await r?.json().catch(() => null)) as { error?: string } | null;
      setError(detail?.error === "duplicate-name" ? (fr ? "Ce nom de SCOT existe déjà." : "A SCOT with that name already exists.") : fr ? "Échec de l'enregistrement." : "Save failed.");
      return false;
    }
    router.refresh();
    return true;
  }

  const typeLabel = (t: string) =>
    t === "routine" ? (fr ? "Routinier" : "Routine") : t === "non_routine" ? (fr ? "Non routinier" : "Non-routine") : fr ? "Estimation" : "Estimation";

  return (
    <div className="flex flex-col gap-1.5" data-testid="scot-register">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
          {fr ? "Registre des SCOT" : "SCOT register"}
        </span>
        <span className="text-[11px] text-muted tnum">{view.scots.length} SCOT(s)</span>
        {view.uncoveredIndexes.length > 0 ? (
          <span className="rounded-full bg-[var(--color-warn-soft)] px-2 py-0.5 text-[10.5px] font-bold text-warn" data-testid="scot-uncovered">
            {view.uncoveredIndexes.length} {fr ? "compte(s) significatif(s) sans SCOT" : "significant account(s) without a SCOT"}: {view.uncoveredIndexes.join(", ")}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            {fr ? "Comptes significatifs couverts" : "Significant accounts covered"}
          </span>
        )}
        {error ? <span className="text-[11px] font-semibold text-rose">{error}</span> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse bg-white dark:bg-surface" data-testid="scot-grid">
          <colgroup>{COLS.map((c, i) => <col key={i} style={c} />)}</colgroup>
          <thead>
            <tr className={GRID_HEAD}>
              <th className={`${GRID_CELL} text-left`}>{fr ? "SCOT" : "SCOT"}</th>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Type" : "Type"}</th>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Comptes (indices)" : "Accounts (indexes)"}</th>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Applications" : "Applications"}</th>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Stratégie" : "Strategy"}</th>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Assigné à" : "Assigned to"}</th>
              <th className={GRID_CELL} />
            </tr>
          </thead>
          <tbody>
            {view.scots.map((scot) => (
              <tr key={scot.id} data-testid={`scot-row-${scot.name.replace(/[^A-Za-z0-9]/g, "_")}`}>
                <td className={`${GRID_CELL} whitespace-normal font-semibold`}>{scot.name}</td>
                <td className={`${GRID_CELL} p-0`}>
                  <select
                    defaultValue={scot.transactionType}
                    onChange={(e) => void op({ op: "updateScot", scotId: scot.id, transactionType: e.target.value })}
                    className="w-full bg-transparent px-1 py-0.5 text-[10.6px] outline-none"
                  >
                    <option value="routine">{typeLabel("routine")}</option>
                    <option value="non_routine">{typeLabel("non_routine")}</option>
                    <option value="estimation">{typeLabel("estimation")}</option>
                  </select>
                </td>
                <td className={`${GRID_CELL} whitespace-normal`}>
                  <span className="flex flex-wrap items-center gap-1">
                    {scot.indexes.map((link) => (
                      <button
                        key={link.indexCode}
                        type="button"
                        title={fr ? "Cliquer pour délier" : "Click to unlink"}
                        onClick={() => void op({ op: "unlinkIndex", scotId: scot.id, indexCode: link.indexCode })}
                        className="rounded-full bg-[var(--color-accent-soft,#e8f3ee)] px-1.5 py-[1px] font-mono text-[9.5px] font-bold text-emerald-800 hover:bg-[var(--color-rose-soft)] hover:text-rose dark:bg-emerald-950/40 dark:text-emerald-300"
                        data-testid={`scot-link-${scot.id.slice(0, 6)}-${link.indexCode}`}
                      >
                        {link.indexCode}
                      </button>
                    ))}
                    <select
                      value=""
                      onChange={(e) => { if (e.target.value) void op({ op: "linkIndex", scotId: scot.id, indexCode: e.target.value, assertions: [] }); }}
                      className="bg-transparent text-[9.5px] text-muted outline-none"
                      data-testid={`scot-addlink-${scot.id.slice(0, 6)}`}
                    >
                      <option value="">＋</option>
                      {LEAD_INDEXES.filter((d) => !scot.indexes.some((l) => l.indexCode === d.code)).map((d) => (
                        <option key={d.code} value={d.code}>{d.code} — {d.labelEn}</option>
                      ))}
                    </select>
                  </span>
                </td>
                <td className={`${GRID_CELL} p-0`}>
                  <input
                    defaultValue={scot.applications ?? ""}
                    placeholder="Sage, Excel…"
                    onBlur={(e) => { if (e.target.value !== (scot.applications ?? "")) void op({ op: "updateScot", scotId: scot.id, applications: e.target.value }); }}
                    className="w-full bg-[var(--color-warn-soft)] px-1 py-0.5 text-[10.6px] text-ink outline-none"
                  />
                </td>
                <td className={`${GRID_CELL} p-0`}>
                  <select
                    defaultValue={scot.strategy}
                    onChange={(e) => void op({ op: "updateScot", scotId: scot.id, strategy: e.target.value })}
                    className="w-full bg-transparent px-1 py-0.5 text-[10.6px] outline-none"
                    data-testid={`scot-strategy-${scot.id.slice(0, 6)}`}
                  >
                    <option value="controls">{fr ? "Contrôles" : "Controls"}</option>
                    <option value="substantive">{fr ? "Substantif" : "Substantive"}</option>
                  </select>
                </td>
                <td className={`${GRID_CELL} p-0`}>
                  <select
                    defaultValue={scot.assigneeUserId ?? ""}
                    onChange={(e) => void op({ op: "assignScot", scotId: scot.id, userId: e.target.value || null })}
                    className="w-full bg-transparent px-1 py-0.5 text-[10.6px] outline-none"
                    data-testid={`scot-assign-${scot.id.slice(0, 6)}`}
                  >
                    <option value="">{fr ? "— non assigné" : "— unassigned"}</option>
                    {team.map((m) => <option key={m.userId} value={m.userId}>{m.userName}</option>)}
                  </select>
                </td>
                <td className={`${GRID_CELL} text-center`}>
                  <button
                    type="button"
                    title={fr ? "Supprimer le SCOT" : "Delete SCOT"}
                    onClick={() => { if (confirm(fr ? "Supprimer ce SCOT et ses WCGW/contrôles ?" : "Delete this SCOT and its WCGWs/controls?")) void op({ op: "deleteScot", scotId: scot.id }); }}
                    className="text-muted hover:text-rose"
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const data = new FormData(f);
          void op({
            op: "createScot",
            name: String(data.get("name") ?? ""),
            transactionType: String(data.get("transactionType") ?? "routine"),
            strategy: String(data.get("strategy") ?? "substantive"),
            applications: String(data.get("applications") ?? ""),
          }).then((ok) => { if (ok) f.reset(); });
        }}
      >
        <input name="name" required placeholder={fr ? "Nouveau SCOT (ex. Ventes & encaissements)" : "New SCOT (e.g. Sales & cash receipts)"} className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-[12px] text-ink outline-none focus:border-emerald-600" data-testid="scot-new-name" />
        <select name="transactionType" className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-[12px]" defaultValue="routine">
          <option value="routine">{typeLabel("routine")}</option>
          <option value="non_routine">{typeLabel("non_routine")}</option>
          <option value="estimation">{typeLabel("estimation")}</option>
        </select>
        <select name="strategy" className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-[12px]" defaultValue="substantive">
          <option value="controls">{fr ? "Contrôles" : "Controls"}</option>
          <option value="substantive">{fr ? "Substantif" : "Substantive"}</option>
        </select>
        <input name="applications" placeholder={fr ? "Applications" : "Applications"} className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-[12px] text-ink outline-none" />
        <button type="submit" disabled={busy} className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50" data-testid="scot-add">
          {fr ? "+ Créer" : "+ Create"}
        </button>
      </form>
    </div>
  );
}
