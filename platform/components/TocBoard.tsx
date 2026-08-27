"use client";

// E1.2 — Test Controls over Significant Classes of Transactions.
//
// The board lists each SCOT and, beneath it, the controls SELECTED FOR
// TESTING in the S2.2 design — a control never originates here (EY GAM
// CONTROLS 4: we test the relevant controls selected to address each WCGW
// per relevant assertion). Per control: the relevant assertions (union of
// the WCGWs it answers), the SAMPLE 3.3 minimum sample size computed from
// its type/frequency/population, the transactions-tested matrix with
// user-amendable attributes, and the documented conclusion — Effective /
// Not effective (CONTROLS 7.3).

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScotStudioView, TocGrid } from "@/lib/scots";
import { tocSuggested } from "@/lib/toc-sampling";

const DEFAULT_ATTRIBUTES_EN = ["Evidence of performance (signature/stamp)", "Performed timely", "Follow-up of exceptions"];
const DEFAULT_ATTRIBUTES_FR = ["Preuve d'exécution (visa/signature)", "Exécuté dans les délais", "Suivi des exceptions"];

export function TocBoard({
  engagementId,
  view,
  locale,
}: {
  engagementId: string;
  view: ScotStudioView;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [openGrid, setOpenGrid] = useState<string | null>(null);
  const [grids, setGrids] = useState<Record<string, TocGrid>>({});
  const [pops, setPops] = useState<Record<string, string>>({});

  async function patch(controlId: string, body: Record<string, unknown>) {
    setError(null);
    const r = await fetch(`/api/engagements/${engagementId}/scots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "updateControl", controlId, ...body }),
    }).catch(() => null);
    if (!r?.ok) { setError(fr ? "Échec de l'enregistrement." : "Save failed."); return false; }
    router.refresh();
    return true;
  }

  const gridOf = (c: { id: string; tocGrid: TocGrid | null }): TocGrid =>
    grids[c.id] ?? c.tocGrid ?? { attributes: fr ? DEFAULT_ATTRIBUTES_FR : DEFAULT_ATTRIBUTES_EN, rows: [] };

  function setGrid(controlId: string, next: TocGrid) {
    setGrids((g) => ({ ...g, [controlId]: next }));
    void patch(controlId, { tocGrid: next });
  }

  // union of the assertions of the WCGWs a control answers
  const assertionsOf = (scotId: string, wcgwIds: string[]): string[] => {
    const scot = view.scots.find((s) => s.id === scotId);
    const out = new Set<string>();
    for (const w of scot?.wcgws ?? []) if (wcgwIds.includes(w.id)) w.assertions.forEach((a) => out.add(a));
    return [...out].sort();
  };

  const scots = view.scots.filter((s) => s.controls.some((c) => c.selectedForTesting));
  const input = "rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[11.8px] text-ink outline-none focus:border-emerald-600";
  const th = "px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-muted";
  const td = "px-2.5 py-2 align-top";

  if (scots.length === 0) {
    return (
      <p className="rounded-[var(--radius-atlas-sm)] bg-surface-2 px-3 py-2 text-[12.5px] text-muted" data-testid="toc-empty">
        {fr
          ? "Aucun contrôle retenu pour test — sélectionner les contrôles pertinents par WCGW en S2.2 d'abord."
          : "No controls selected for testing yet — select the relevant controls per WCGW in S2.2 first."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="toc-board">
      <p className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
        {fr
          ? "Hypothèse d'appui : peu ou pas d'exceptions attendues (sondage de découverte). L'entretien seul ne suffit jamais — combiner avec inspection, observation ou réexécution. Taille d'échantillon minimale selon SAMPLE 3.3 ; toute exception : cause, incidence, extension ou arrêt du test, et évaluation en déficience."
          : "Reliance hypothesis: no or very few exceptions expected (discovery sampling). Inquiry alone is never sufficient — combine with inspection, observation or reperformance. Minimum sample size per SAMPLE 3.3; any exception: cause, implication, extend or stop, and evaluate as a deficiency."}
      </p>
      {error ? <p className="text-[12px] font-semibold text-rose">{error}</p> : null}

      {scots.map((scot) => {
        const tested = scot.controls.filter((c) => c.selectedForTesting);
        return (
          <div key={scot.id} className="overflow-hidden rounded-[var(--radius-atlas-sm)] border border-line bg-surface" data-testid={`toc-scot-${scot.id}`}>
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
              <span className="text-[12.8px] font-bold text-ink">{scot.name}</span>
              <span className="rounded-full border border-line-strong px-2 py-0.5 text-[10.5px] font-semibold text-muted">{scot.transactionType}</span>
              <span className="ml-auto text-[11px] text-muted">
                {fr ? "Contrôles testés" : "Controls tested"}: <b className="text-ink tnum">{tested.length}</b>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left" data-testid={`toc-table-${scot.id}`}>
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <th className={th} style={{ minWidth: 240 }}>{fr ? "Contrôle" : "Control"}</th>
                    <th className={th} style={{ width: 110 }}>{fr ? "Type · fréquence" : "Type · frequency"}</th>
                    <th className={th} style={{ width: 96 }}>{fr ? "Assertions" : "Assertions"}</th>
                    <th className={`${th} text-right`} style={{ width: 96 }}>{fr ? "Population" : "Population"}</th>
                    <th className={`${th} text-right`} style={{ width: 84 }}>{fr ? "Échantillon" : "Sample"}</th>
                    <th className={`${th} text-center`} style={{ width: 128 }}>{fr ? "Transactions testées" : "Transactions tested"}</th>
                    <th className={th} style={{ width: 150 }}>{fr ? "Conclusion" : "Conclusion"}</th>
                  </tr>
                </thead>
                <tbody>
                  {tested.map((c) => {
                    const asserts = assertionsOf(scot.id, c.wcgwIds);
                    const pop = pops[c.id] ?? (c.tocPopulation != null ? String(c.tocPopulation) : "");
                    const sole = asserts.length > 0 && tested.filter((x) => assertionsOf(scot.id, x.wcgwIds).some((a) => asserts.includes(a))).length === 1;
                    const sug = tocSuggested(c.controlType, c.frequency, pop ? Number(pop) : null, sole, fr);
                    const suggested = sug && !("needPopulation" in sug) ? sug : null;
                    const size = c.sampleSize ?? suggested?.size ?? null;
                    const grid = gridOf(c);
                    const deviations = grid.rows.reduce((n, r) => n + Object.values(r.results).filter((v) => v === "fail").length, 0);
                    const gridOpen = openGrid === c.id;
                    const short = size != null && grid.rows.length < size;
                    return (
                      <FragmentRows key={c.id}>
                        <tr className="border-b border-line align-top" data-testid={`toc-control-${c.id}`}>
                          <td className={td}>
                            <span className="block text-[12.3px] font-semibold leading-snug text-ink">{c.name}</span>
                            {c.owner ? <span className="block text-[10.5px] text-muted">{c.owner}</span> : null}
                          </td>
                          <td className={`${td} text-[11px] text-ink-soft`}>
                            {c.controlType}
                            {c.frequency ? <span className="block text-muted">{c.frequency}</span> : null}
                          </td>
                          <td className={`${td} text-[12px] font-bold text-ink`} data-testid={`toc-asserts-${c.id}`}>
                            {asserts.join(" ") || "—"}
                          </td>
                          <td className={`${td} text-right`}>
                            <input
                              value={pop}
                              onChange={(e) => setPops((p) => ({ ...p, [c.id]: e.target.value }))}
                              onBlur={() => { const n = Number(pop); if (Number.isFinite(n) && n >= 0 && n !== c.tocPopulation) void patch(c.id, { tocPopulation: n }); }}
                              placeholder="—"
                              className={`${input} w-[76px] text-right tnum`}
                              aria-label={fr ? `Population ${c.name}` : `Population ${c.name}`}
                              data-testid={`toc-pop-${c.id}`}
                            />
                          </td>
                          <td className={`${td} text-right`} title={suggested?.rule ?? (fr ? "Saisir la population" : "Enter the population")}>
                            <span className="text-[13px] font-extrabold text-ink tnum" data-testid={`toc-size-${c.id}`}>{size ?? "—"}</span>
                            {suggested ? <span className="block text-[9.5px] font-semibold text-emerald-700 dark:text-emerald-400">{fr ? "auto" : "auto"}</span> : null}
                          </td>
                          <td className={`${td} text-center`}>
                            <button
                              type="button"
                              onClick={() => setOpenGrid(gridOpen ? null : c.id)}
                              className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-2 py-1 text-[11.5px] font-semibold text-ink-soft hover:bg-surface-2"
                              data-testid={`toc-grid-open-${c.id}`}
                            >
                              {grid.rows.length}{size != null ? `/${size}` : ""} {gridOpen ? "▾" : "▸"}
                            </button>
                            {deviations > 0 ? <span className="block text-[10px] font-bold text-rose">{deviations} ✗</span> : null}
                            {short && deviations === 0 ? <span className="block text-[10px] text-amber-700 dark:text-amber-400">{fr ? "incomplet" : "short"}</span> : null}
                          </td>
                          <td className={td}>
                            <select
                              value={c.operatingEval ?? ""}
                              onChange={(e) => void patch(c.id, { operatingEval: e.target.value })}
                              className={`${input} w-full font-semibold ${c.operatingEval === "effective" ? "text-emerald-700 dark:text-emerald-400" : c.operatingEval === "not_effective" ? "text-rose" : "text-muted"}`}
                              data-testid={`toc-eval-${c.id}`}
                            >
                              {c.operatingEval === null ? <option value="" disabled hidden /> : null}
                              <option value="effective">{fr ? "Efficace" : "Effective"}</option>
                              <option value="not_effective">{fr ? "Non efficace" : "Not effective"}</option>
                            </select>
                            {c.operatingEval === "not_effective" ? (
                              <span className="mt-0.5 block text-[10px] leading-snug text-amber-700 dark:text-amber-400">
                                {fr
                                  ? "Évaluer la déficience, réviser S3.1 (pas d'appui), étendre les procédures de substance."
                                  : "Evaluate the deficiency, revise S3.1 to not-rely, extend the substantive procedures."}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                        {gridOpen ? (
                          <tr className="border-b border-line">
                            <td colSpan={7} className="bg-surface-2/40 px-3 py-2">
                              <TocGridEditor
                                grid={grid}
                                sampleSize={size}
                                fr={fr}
                                controlId={c.id}
                                onChange={(next) => setGrid(c.id, next)}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </FragmentRows>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The transactions-tested matrix: rows = sample items, columns = attributes
 *  the user can add or rename; each cell passes, fails or is n/a. */
function TocGridEditor({
  grid,
  sampleSize,
  fr,
  controlId,
  onChange,
}: {
  grid: TocGrid;
  sampleSize: number | null;
  fr: boolean;
  controlId: string;
  onChange: (next: TocGrid) => void;
}) {
  const cell = "border border-line px-1.5 py-1 text-[11.3px]";
  const cycle: Record<string, "pass" | "fail" | "na" | ""> = { "": "pass", pass: "fail", fail: "na", na: "" };
  const mark = (v: string) => (v === "pass" ? "✓" : v === "fail" ? "✗" : v === "na" ? "n/a" : "—");
  const tone = (v: string) =>
    v === "pass" ? "text-emerald-700 dark:text-emerald-400" : v === "fail" ? "text-rose font-bold" : "text-muted";

  const addRow = () =>
    onChange({ ...grid, rows: [...grid.rows, { ref: "", date: "", desc: "", results: {} }] });
  const addAttr = () => {
    const name = window.prompt(fr ? "Nom du nouvel attribut à tester :" : "Name of the new attribute to test:");
    if (name?.trim()) onChange({ ...grid, attributes: [...grid.attributes, name.trim()] });
  };
  const renameAttr = (i: number) => {
    const name = window.prompt(fr ? "Renommer l'attribut :" : "Rename the attribute:", grid.attributes[i]);
    if (name?.trim()) {
      const attributes = grid.attributes.map((a, j) => (j === i ? name.trim() : a));
      const rows = grid.rows.map((r) => {
        const results = { ...r.results };
        if (results[grid.attributes[i]] !== undefined) {
          results[name.trim()] = results[grid.attributes[i]];
          delete results[grid.attributes[i]];
        }
        return { ...r, results };
      });
      onChange({ attributes, rows });
    }
  };
  const setField = (ri: number, field: "ref" | "date" | "desc", value: string) =>
    onChange({ ...grid, rows: grid.rows.map((r, i) => (i === ri ? { ...r, [field]: value } : r)) });
  const toggle = (ri: number, attr: string) =>
    onChange({
      ...grid,
      rows: grid.rows.map((r, i) =>
        i === ri ? { ...r, results: { ...r.results, [attr]: cycle[r.results[attr] ?? ""] } } : r,
      ),
    });
  const removeRow = (ri: number) => onChange({ ...grid, rows: grid.rows.filter((_, i) => i !== ri) });

  return (
    <div className="mt-2 overflow-x-auto" data-testid={`toc-grid-${controlId}`}>
      {sampleSize != null && grid.rows.length < sampleSize ? (
        <p className="mb-1 text-[10.5px] font-medium text-amber-700 dark:text-amber-400">
          {fr
            ? `${grid.rows.length}/${sampleSize} éléments documentés — l'échantillon minimal n'est pas encore couvert.`
            : `${grid.rows.length}/${sampleSize} items documented — the minimum sample is not yet covered.`}
        </p>
      ) : null}
      <table className="w-auto min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="bg-surface-2 text-[10px] font-extrabold uppercase tracking-[0.05em] text-muted">
            <th className={cell}>#</th>
            <th className={cell}>{fr ? "Réf" : "Ref"}</th>
            <th className={cell}>{fr ? "Date" : "Date"}</th>
            <th className={cell}>{fr ? "Description" : "Description"}</th>
            {grid.attributes.map((a, i) => (
              <th key={i} className={`${cell} cursor-pointer hover:text-ink`} title={fr ? "Cliquer pour renommer" : "Click to rename"} onClick={() => renameAttr(i)}>
                {a}
              </th>
            ))}
            <th className={cell}>
              <button type="button" onClick={addAttr} className="font-bold text-emerald-700 hover:underline dark:text-emerald-400" data-testid={`toc-add-attr-${controlId}`}>
                + {fr ? "attribut" : "attribute"}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((r, ri) => (
            <tr key={ri}>
              <td className={`${cell} text-muted tnum`}>{ri + 1}</td>
              {(["ref", "date", "desc"] as const).map((f) => (
                <td key={f} className={cell}>
                  <input
                    value={r[f]}
                    onChange={(e) => setField(ri, f, e.target.value)}
                    className="w-full bg-transparent text-[11.3px] text-ink outline-none"
                    style={{ minWidth: f === "desc" ? 160 : 70 }}
                  />
                </td>
              ))}
              {grid.attributes.map((a, ai) => (
                <td key={ai} className={`${cell} cursor-pointer text-center ${tone(r.results[a] ?? "")}`} onClick={() => toggle(ri, a)} data-testid={`toc-cell-${controlId}-${ri}-${ai}`}>
                  {mark(r.results[a] ?? "")}
                </td>
              ))}
              <td className={cell}>
                <button type="button" onClick={() => removeRow(ri)} className="text-muted hover:text-rose" title={fr ? "Supprimer la ligne" : "Remove row"}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={addRow}
        className="mt-1.5 rounded-[var(--radius-atlas-sm)] border border-line-strong px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft hover:bg-surface-2"
        data-testid={`toc-add-row-${controlId}`}
      >
        + {fr ? "Ajouter une transaction" : "Add a transaction"}
      </button>
    </div>
  );
}

/** React fragments keyed inside <tbody> (a plain <>…</> cannot carry a key). */
function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
