"use client";

// S2.3 / S2.5 — the relevant IT applications and the IT strategy per
// application. On S2.3 the board is editable (decide the strategy and the ITGC
// testing scope); on S2.5 it renders read-only so the evaluation concludes
// against the same record.

import { useState } from "react";
import { IT_STRATEGIES, newAppKey, type ItAppRow, type ItAppsView, type ItStrategy } from "@/lib/itgc-model";
import { Chip } from "@/components/ui/atlas";

const STRATEGY_LABELS: Record<ItStrategy, { en: string; fr: string }> = {
  rely_itgc: { en: "Rely on IT processes — test ITGCs", fr: "Appui sur les processus IT — tester les ITGC" },
  test_direct: { en: "Test automated controls directly each period", fr: "Tester les contrôles automatisés directement chaque période" },
  substantive_only: { en: "Fully substantive — no IT reliance", fr: "Substantif intégral — pas d'appui IT" },
};

export function ItAppsBoard({
  engagementId,
  view,
  locale,
  readOnly = false,
}: {
  engagementId: string;
  view: ItAppsView;
  locale: "en" | "fr";
  readOnly?: boolean;
}) {
  const fr = locale === "fr";
  const [rows, setRows] = useState<ItAppRow[]>(view.rows);
  const [adding, setAdding] = useState("");
  const [error, setError] = useState<string | null>(null);

  const label = "text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const select = "w-full rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-1.5 py-1 text-[11.8px] text-ink outline-none focus:border-emerald-600";
  const input = "w-full rounded-[var(--radius-atlas-sm)] border border-line bg-[color:var(--wp-input)] px-2 py-1 text-[11.8px] text-ink outline-none placeholder:text-muted focus:border-emerald-600";

  async function save(key: string, patch: Record<string, unknown>) {
    setError(null);
    const r = await fetch(`/api/engagements/${engagementId}/itapps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "save", key, ...patch }),
    }).catch(() => null);
    if (!r?.ok) setError(fr ? "Échec de l'enregistrement." : "Save failed.");
  }

  function patchRow(key: string, patch: Partial<ItAppRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  return (
    <div className="flex flex-col gap-2" data-testid="itapps-board">
      <p className="text-[11px] text-ink-soft">
        {fr
          ? "Applications issues du registre S1.1 (colonne applications) et ajoutées ici. Pour chacune : la stratégie IT retenue et le périmètre des tests d'ITGC — S2.4 exécute, S2.5 évalue contre ce même tableau."
          : "Applications come from the S1.1 register (applications column) plus any added here. For each: the IT strategy decided and the ITGC testing scope — S2.4 executes it, S2.5 evaluates against this same record."}
      </p>

      {error ? <p className="text-[12px] font-semibold text-rose">{error}</p> : null}

      {rows.length === 0 ? (
        <p className="px-2 py-4 text-center text-[12px] text-muted" data-testid="itapps-empty">
          {fr
            ? "Aucune application — renseigner la colonne applications du registre S1.1, ou ajouter ici."
            : "No applications yet — fill the applications column on the S1.1 register, or add one here."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Application" : "Application"}</th>
                <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Couches en périmètre" : "Layers in scope"}</th>
                <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Stratégie IT" : "IT strategy"}</th>
                <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Décision de test ITGC" : "ITGC testing decision"}</th>
                {readOnly ? null : <th className={`${label} px-1.5 py-1`} />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-line align-top" data-testid={`itapp-${row.key}`}>
                  <td className="px-1.5 py-1.5">
                    <span className="text-[12.5px] font-semibold text-ink">{row.name}</span>
                    {row.scots.length > 0 ? (
                      <p className="mt-0.5 text-[10px] text-muted" title={row.scots.join(", ")}>
                        {fr ? `${row.scots.length} SCOT (S1.1)` : `${row.scots.length} SCOT(s) (S1.1)`}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[10px] text-muted">{fr ? "ajoutée ici" : "added here"}</p>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5">
                    {readOnly ? (
                      <span className="text-[11.8px] text-ink-soft">{row.layers || "—"}</span>
                    ) : (
                      <input
                        defaultValue={row.layers}
                        placeholder={fr ? "application · BD · OS · réseau" : "application · DB · OS · network"}
                        onBlur={(e) => { if (e.target.value !== row.layers) { patchRow(row.key, { layers: e.target.value }); void save(row.key, { layers: e.target.value }); } }}
                        className={input}
                        data-testid={`itapp-layers-${row.key}`}
                      />
                    )}
                  </td>
                  <td className="px-1.5 py-1.5">
                    {readOnly ? (
                      row.strategy ? (
                        <Chip tone={row.strategy === "rely_itgc" ? "good" : row.strategy === "test_direct" ? "warn" : "muted"}>
                          {fr ? STRATEGY_LABELS[row.strategy].fr : STRATEGY_LABELS[row.strategy].en}
                        </Chip>
                      ) : (
                        <Chip tone="rose">{fr ? "Non décidée (S2.3)" : "Not decided (S2.3)"}</Chip>
                      )
                    ) : (
                      <select
                        value={row.strategy}
                        onChange={(e) => { patchRow(row.key, { strategy: e.target.value as ItStrategy | "" }); void save(row.key, { strategy: e.target.value }); }}
                        className={select}
                        data-testid={`itapp-strategy-${row.key}`}
                      >
                        <option value="">{fr ? "— décider" : "— decide"}</option>
                        {IT_STRATEGIES.map((s) => (
                          <option key={s} value={s}>{fr ? STRATEGY_LABELS[s].fr : STRATEGY_LABELS[s].en}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5">
                    {readOnly ? (
                      <span className="text-[11.8px] text-ink-soft">{row.itgcNote || "—"}</span>
                    ) : (
                      <input
                        defaultValue={row.itgcNote}
                        placeholder={fr ? "Processus en périmètre : accès · changements · exploitation…" : "Processes in scope: access · change · operations…"}
                        onBlur={(e) => { if (e.target.value !== row.itgcNote) { patchRow(row.key, { itgcNote: e.target.value }); void save(row.key, { itgcNote: e.target.value }); } }}
                        className={input}
                        data-testid={`itapp-note-${row.key}`}
                      />
                    )}
                  </td>
                  {readOnly ? null : (
                    <td className="px-1.5 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => { setRows((rs) => rs.filter((r) => r.key !== row.key)); void save(row.key, { removed: true }); }}
                        className="text-[11px] font-semibold text-muted hover:text-rose"
                        title={fr ? "Retirer" : "Remove"}
                        data-testid={`itapp-remove-${row.key}`}
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {readOnly ? (
        rows.some((r) => !r.strategy) ? (
          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400" data-testid="itapps-undecided">
            {fr
              ? "Des applications restent sans stratégie — retourner en S2.3 avant de conclure."
              : "Some applications have no strategy yet — go back to S2.3 before concluding."}
          </p>
        ) : null
      ) : (
        <div className="flex items-center gap-2">
          <input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            placeholder={fr ? "Ajouter une application (ex. Sage Paie)…" : "Add an application (e.g. the payroll package)…"}
            className={`${input} max-w-xs`}
            data-testid="itapp-add-name"
          />
          <button
            type="button"
            onClick={() => {
              const name = adding.trim();
              if (!name) return;
              const key = `${newAppKey(name)}-${rows.length + 1}`.slice(0, 40).replace(/^-+|-+$/g, "");
              setRows((rs) => [...rs, { key, name, layers: "", scots: [], strategy: "", itgcNote: "" }]);
              setAdding("");
              void save(key, { name });
            }}
            className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-emerald-800"
            data-testid="itapp-add"
          >
            {fr ? "Ajouter" : "Add"}
          </button>
        </div>
      )}
    </div>
  );
}
