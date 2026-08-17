"use client";

// The WCGW & controls builder, in four modes along the phase:
//   wcgw    (S1.2) — one clear table: SCOT | what can go wrong | controls
//                    covering it. Everything on one page; controls are always
//                    visible under the WCGW they answer, and controls not yet
//                    covering a WCGW sit in the SCOT's footer row.
//   select  (S2.1) — the selected-for-testing decision, with the ¶33 warnings
//   design  (S2.2) — nature/timing/extent per selected control
//   results (E1.1) — design eval + implementation + derived operating conclusion;
//                    the operating verdict comes from control_test rows, never stored
// Structural changes refresh the server view; field edits save on blur.

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import type { Scot, ScotStudioView } from "@/lib/scots";

const ASSERTION_CODES = ["C", "E", "A", "V", "P"] as const;
const slug = (s: string) => s.replace(/[^A-Za-z0-9]/g, "_");

// The S1.2 table renders INSIDE the PaperWizard's <form> (it owns page 1), so
// it must not contain <form> elements of its own — nested forms are dropped by
// the HTML parser and break hydration. The footer is plain inputs + buttons.
function ScotFooter({
  scot,
  fr,
  op,
}: {
  scot: Scot;
  fr: boolean;
  op: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [wcgwText, setWcgwText] = useState("");
  const [assertions, setAssertions] = useState<string[]>([]);
  const [ctrl, setCtrl] = useState({ name: "", owner: "", ctype: "manual", freq: "", objective: "prevent" });
  const uncovered = scot.controls.filter((c) => c.wcgwIds.length === 0);

  const addWcgw = () => {
    if (!wcgwText.trim()) return;
    void op({ op: "addWcgw", scotId: scot.id, description: wcgwText, assertions }).then((ok) => {
      if (ok) { setWcgwText(""); setAssertions([]); }
    });
  };
  const addControl = () => {
    if (!ctrl.name.trim()) return;
    void op({ op: "addControl", scotId: scot.id, name: ctrl.name, owner: ctrl.owner, controlType: ctrl.ctype, frequency: ctrl.freq, objective: ctrl.objective }).then((ok) => {
      if (ok) setCtrl({ name: "", owner: "", ctype: "manual", freq: "", objective: "prevent" });
    });
  };
  const enter = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); fn(); }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={wcgwText}
          onChange={(e) => setWcgwText(e.target.value)}
          onKeyDown={enter(addWcgw)}
          placeholder={fr ? "Nouveau WCGW — que peut-il mal se passer ?" : "New WCGW — what can go wrong?"}
          className="min-w-[200px] flex-1 rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[11.5px] outline-none focus:border-emerald-600"
          data-testid={`wcgw-new-${slug(scot.name)}`}
        />
        {ASSERTION_CODES.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAssertions((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))}
            className={`h-[17px] w-[17px] rounded-[3px] text-[9.5px] font-bold ${assertions.includes(a) ? "bg-emerald-700 text-white" : "border border-line text-muted"}`}
          >{a}</button>
        ))}
        <button type="button" onClick={addWcgw} className="ml-auto inline-flex w-[104px] justify-center rounded-[var(--radius-atlas-xs)] bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800" data-testid={`wcgw-add-${slug(scot.name)}`}>＋ WCGW</button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={ctrl.name}
          onChange={(e) => setCtrl((c) => ({ ...c, name: e.target.value }))}
          onKeyDown={enter(addControl)}
          placeholder={fr ? "Nouveau contrôle" : "New control"}
          className="min-w-[150px] flex-1 rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[11.5px] outline-none focus:border-emerald-600"
          data-testid={`control-new-${slug(scot.name)}`}
        />
        <input
          value={ctrl.owner}
          onChange={(e) => setCtrl((c) => ({ ...c, owner: e.target.value }))}
          placeholder={fr ? "Qui l'exécute" : "Performed by"}
          className="w-[110px] rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[11.5px] outline-none"
        />
        <select value={ctrl.ctype} onChange={(e) => setCtrl((c) => ({ ...c, ctype: e.target.value }))} className="rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-1.5 py-1 text-[11px]">
          <option value="manual">{fr ? "Manuel" : "Manual"}</option>
          <option value="it_dependent">{fr ? "Manuel dépendant IT" : "IT-dependent"}</option>
          <option value="automated">{fr ? "Automatisé" : "Automated"}</option>
        </select>
        <input
          value={ctrl.freq}
          onChange={(e) => setCtrl((c) => ({ ...c, freq: e.target.value }))}
          placeholder={fr ? "Fréquence" : "Frequency"}
          className="w-[85px] rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[11.5px] outline-none"
        />
        <select value={ctrl.objective} onChange={(e) => setCtrl((c) => ({ ...c, objective: e.target.value }))} className="rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-1.5 py-1 text-[11px]">
          <option value="prevent">{fr ? "Prévention" : "Prevent"}</option>
          <option value="detect">{fr ? "Détection" : "Detect"}</option>
        </select>
        <button type="button" onClick={addControl} className="ml-auto inline-flex w-[104px] justify-center rounded-[var(--radius-atlas-xs)] bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800" data-testid={`control-add-${slug(scot.name)}`}>＋ {fr ? "contrôle" : "control"}</button>
      </div>
      {uncovered.length > 0 ? (
        <p className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted" data-testid={`uncovered-controls-${slug(scot.name)}`}>
          {fr ? "Contrôles sans WCGW (lier depuis une ligne « ＋ lier ») :" : "Controls not covering a WCGW yet (link them from a row's ＋ link):"}
          {uncovered.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2 py-[1px] font-semibold text-ink-soft">
              {c.name}
              <button
                type="button"
                title={fr ? "Supprimer le contrôle" : "Delete control"}
                onClick={() => { if (confirm(fr ? "Supprimer ce contrôle ?" : "Delete this control?")) void op({ op: "deleteControl", controlId: c.id }); }}
                className="text-muted hover:text-rose"
              >×</button>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

export function WcgwBuilder({
  engagementId,
  view,
  mode,
  locale,
}: {
  engagementId: string;
  view: ScotStudioView;
  mode: "wcgw" | "select" | "design" | "results";
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(view.scots[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  async function op(body: Record<string, unknown>) {
    setError(null);
    const r = await fetch(`/api/engagements/${engagementId}/scots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!r?.ok) { setError(fr ? "Échec de l'enregistrement." : "Save failed."); return false; }
    router.refresh();
    return true;
  }

  if (view.scots.length === 0) {
    return (
      <p className="rounded-[var(--radius-atlas-sm)] bg-surface-2 px-3 py-2 text-[12.5px] text-muted" data-testid="wcgw-empty">
        {fr ? "Aucun SCOT — créez-les d'abord sur S1.1." : "No SCOTs yet — create them on S1.1 first."}
      </p>
    );
  }

  const header = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
        {mode === "wcgw"
          ? fr ? "SCOT · WCGW · Contrôles" : "SCOTs · WCGWs · Controls"
          : mode === "select"
            ? fr ? "Sélection des contrôles à tester" : "Select controls to test"
            : mode === "design"
              ? fr ? "Conception des tests" : "Test design"
              : fr ? "Résultats des contrôles" : "Control results"}
      </span>
      {view.unansweredWcgws > 0 && mode === "wcgw" ? (
        <span className="rounded-full bg-[var(--color-warn-soft)] px-2 py-0.5 text-[10.5px] font-bold text-warn" data-testid="wcgw-unanswered">
          {view.unansweredWcgws} {fr ? "WCGW sans contrôle" : "WCGW(s) without a control"}
        </span>
      ) : null}
      {mode === "select" && view.para33Violations.length > 0 ? (
        <span className="rounded-full bg-[var(--color-rose-soft)] px-2 py-0.5 text-[10.5px] font-bold text-rose" data-testid="p33-violations" title={view.para33Violations.map((v) => `${v.indexCode}: ${v.riskDescription}`).join("\n")}>
          ¶33: {view.para33Violations.length} {fr ? "indice(s) « substantif seul insuffisant » sans contrôle sélectionné" : "substantive-alone-insufficient index(es) with no selected control"}
        </span>
      ) : null}
      {error ? <span className="text-[11px] font-semibold text-rose">{error}</span> : null}
    </div>
  );

  // ------------------------------------------------- S1.2 — the flow table --
  if (mode === "wcgw") {
    const td = "border-t border-line px-2.5 py-1.5 align-top";
    return (
      <div className="flex flex-col gap-2" data-testid="wcgw-builder-wcgw">
        {header}
        <div className="overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line">
          <table className="w-full table-fixed text-[12px]" data-testid="scot-wcgw-table">
            <colgroup>
              <col style={{ width: "18%" }} />
              <col style={{ width: "42%" }} />
              <col style={{ width: "40%" }} />
            </colgroup>
            <thead>
              <tr className="bg-surface-2 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted">
                <th className="px-2.5 py-1.5">SCOT</th>
                <th className="px-2.5 py-1.5">{fr ? "Qu'est-ce qui peut mal tourner (WCGW)" : "What can go wrong (WCGW)"}</th>
                <th className="px-2.5 py-1.5">{fr ? "Contrôles couvrant ce WCGW" : "Controls covering it"}</th>
              </tr>
            </thead>
            <tbody>
              {view.scots.map((scot) => {
                const byId = new Map(scot.controls.map((c) => [c.id, c]));
                const rows: (typeof scot.wcgws[number] | null)[] = scot.wcgws.length > 0 ? scot.wcgws : [null];
                const span = rows.length + 1;
                return (
                  <Fragment key={scot.id}>
                    {rows.map((w, j) => (
                      <tr key={w?.id ?? "empty"} data-testid={w ? `wcgw-row-${slug(w.description.slice(0, 24))}` : undefined}>
                        {j === 0 ? (
                          <td rowSpan={span} className="border-t-2 border-line-strong px-2.5 py-1.5 align-top">
                            <p className="text-[12.5px] font-bold leading-snug text-ink">{scot.name}</p>
                            <p className="mt-0.5 text-[10.5px] text-muted">
                              {scot.transactionType === "routine" ? (fr ? "Routinier" : "Routine") : scot.transactionType === "non_routine" ? (fr ? "Non routinier" : "Non-routine") : "Estimation"}
                              {scot.indexes.length > 0 ? (
                                <span className="ml-1 font-mono text-emerald-800 dark:text-emerald-300">
                                  {scot.indexes.map((i) => i.indexCode).join(", ")}
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 text-[10.5px] text-muted tnum">
                              {scot.wcgws.length} WCGW · {scot.controls.length} {fr ? "contrôle(s)" : "control(s)"}
                            </p>
                          </td>
                        ) : null}
                        {w ? (
                          <>
                            <td className={`${td} ${j === 0 ? "border-t-2 border-line-strong" : ""} ${w.controlIds.length === 0 ? "bg-[var(--color-warn-soft)]" : ""}`}>
                              <div className="flex items-start gap-1.5">
                                <p className="min-w-0 flex-1 leading-snug text-ink">{w.description}</p>
                                <span className="font-mono text-[9.5px] font-bold text-emerald-800 dark:text-emerald-300">[{w.assertions.join("") || "—"}]</span>
                                <button
                                  type="button"
                                  title={fr ? "Supprimer le WCGW" : "Delete WCGW"}
                                  onClick={() => { if (confirm(fr ? "Supprimer ce WCGW ?" : "Delete this WCGW?")) void op({ op: "deleteWcgw", wcgwId: w.id }); }}
                                  className="text-muted hover:text-rose"
                                >×</button>
                              </div>
                            </td>
                            <td className={`${td} ${j === 0 ? "border-t-2 border-line-strong" : ""}`}>
                              <span className="flex flex-wrap items-center gap-1">
                                {w.controlIds.map((cid) => {
                                  const c = byId.get(cid);
                                  if (!c) return null;
                                  return (
                                    <button
                                      key={cid}
                                      type="button"
                                      title={`${c.owner ?? "—"} · ${c.controlType.replace("_", "-")} · ${c.frequency ?? "—"} · ${c.objective}${fr ? " — cliquer pour délier" : " — click to unlink"}`}
                                      onClick={() => void op({ op: "toggleLink", wcgwId: w.id, controlId: cid, linked: false })}
                                      className="rounded-full bg-emerald-700 px-2 py-[1.5px] text-[10.5px] font-semibold text-white hover:bg-rose-700"
                                      data-testid={`wcgw-ctrl-${slug(c.name.slice(0, 20))}`}
                                    >
                                      {c.name}
                                    </button>
                                  );
                                })}
                                {scot.controls.some((c) => !w.controlIds.includes(c.id)) ? (
                                  <select
                                    value=""
                                    onChange={(e) => { if (e.target.value) void op({ op: "toggleLink", wcgwId: w.id, controlId: e.target.value, linked: true }); }}
                                    className="rounded-[var(--radius-atlas-xs)] border border-line bg-surface px-1 py-0.5 text-[10px] text-muted outline-none"
                                    data-testid={`wcgw-link-${slug(w.description.slice(0, 24))}`}
                                    title={fr ? "Lier un contrôle existant" : "Link an existing control"}
                                  >
                                    <option value="">{fr ? "＋ lier" : "＋ link"}</option>
                                    {scot.controls.filter((c) => !w.controlIds.includes(c.id)).map((c) => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </select>
                                ) : null}
                                {w.controlIds.length === 0 && scot.controls.length === 0 ? (
                                  <span className="text-[10.5px] text-muted">{fr ? "Créer un contrôle ci-dessous" : "Create a control below"}</span>
                                ) : null}
                              </span>
                            </td>
                          </>
                        ) : (
                          <td colSpan={2} className={`${td} border-t-2 border-line-strong italic text-muted`}>
                            {fr ? "Aucun WCGW sur ce SCOT — ajouter ci-dessous." : "No WCGW on this SCOT yet — add one below."}
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* the SCOT's footer: add WCGW, add control, and the controls not yet covering a WCGW */}
                    <tr className="bg-surface-2/40">
                      <td colSpan={2} className="border-t border-line px-2.5 py-2">
                        <ScotFooter scot={scot} fr={fr} op={op} />
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ------------------------------- S2.1 / S2.2 / E1.1 — per-SCOT accordions --
  return (
    <div className="flex flex-col gap-2" data-testid={`wcgw-builder-${mode}`}>
      {header}
      {view.scots.map((scot) => {
        const isOpen = open === scot.id;
        const relevantControls = scot.controls.filter((c) => mode === "select" || c.selectedForTesting);
        return (
          <div key={scot.id} className="rounded-[var(--radius-atlas-sm)] border border-line">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : scot.id)}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface-2"
              data-testid={`wcgw-scot-${slug(scot.name)}`}
            >
              <span className="text-[12.5px] font-bold text-ink">{scot.name}</span>
              <span className="text-[10.5px] text-muted tnum">
                {scot.wcgws.length} WCGW · {scot.controls.length} {fr ? "contrôle(s)" : "control(s)"}
                {` · ${scot.controls.filter((c) => c.selectedForTesting).length} ${fr ? "sélectionné(s)" : "selected"}`}
              </span>
              <span className="ml-auto text-muted">{isOpen ? "▾" : "▸"}</span>
            </button>

            {isOpen ? (
              <div className="border-t border-line px-2.5 py-2">
                <div className="flex flex-col gap-1.5">
                  {relevantControls.length === 0 ? (
                    <p className="text-[11.5px] text-muted">{mode === "design" || mode === "results" ? (fr ? "Aucun contrôle sélectionné sur ce SCOT." : "No controls selected on this SCOT.") : fr ? "Aucun contrôle défini — S1.2." : "No controls defined — see S1.2."}</p>
                  ) : null}
                  {relevantControls.map((c) => (
                    <div key={c.id} className="rounded-[var(--radius-atlas-xs)] border border-line px-2 py-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-semibold text-ink">{c.name}</span>
                        <span className="text-[10.5px] text-muted">{c.owner ?? "—"} · {c.controlType.replace("_", "-")} · {c.frequency ?? "—"} · {c.objective}</span>
                        {mode === "select" ? (
                          <label className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-ink-soft">
                            <input
                              type="checkbox"
                              defaultChecked={c.selectedForTesting}
                              onChange={(e) => void op({ op: "updateControl", controlId: c.id, selectedForTesting: e.target.checked })}
                              data-testid={`control-select-${slug(c.name)}`}
                            />
                            {fr ? "Tester" : "Test"}
                          </label>
                        ) : mode === "results" ? (
                          <span
                            className={`ml-auto rounded-full px-2 py-[1px] text-[10px] font-bold ${
                              c.operating === "effective"
                                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : c.operating === "exceptions"
                                  ? "bg-[var(--color-rose-soft)] text-rose"
                                  : "bg-surface-2 text-muted"
                            }`}
                            title={fr ? "Conclusion opératoire dérivée des tests enregistrés" : "Operating conclusion derived from recorded tests"}
                            data-testid={`control-operating-${slug(c.name)}`}
                          >
                            {c.operating === "effective"
                              ? (fr ? "Efficace" : "Effective")
                              : c.operating === "exceptions"
                                ? "Exceptions"
                                : fr ? "Aucun test" : "No tests yet"}
                            {c.testsCount > 0 ? ` · ${c.testsCount}` : ""}
                          </span>
                        ) : (
                          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-muted">{c.selectedForTesting ? (fr ? "sélectionné" : "selected") : ""}</span>
                        )}
                      </div>
                      {mode === "results" ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          {c.testDesign ? <p className="w-full text-[10.5px] italic leading-snug text-muted">{c.testDesign}</p> : null}
                          <label className="flex items-center gap-1 text-[10.5px] text-muted">
                            {fr ? "Conception" : "Design"}
                            <select
                              defaultValue={c.designEval ?? ""}
                              onChange={(e) => void op({ op: "updateControl", controlId: c.id, designEval: e.target.value })}
                              className="rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-1.5 py-0.5 text-[10.5px] text-ink outline-none"
                              data-testid={`control-designeval-${slug(c.name)}`}
                            >
                              <option value="">—</option>
                              <option value="effective">{fr ? "Efficace" : "Effective"}</option>
                              <option value="ineffective">{fr ? "Inefficace" : "Ineffective"}</option>
                            </select>
                          </label>
                          <label className="flex items-center gap-1 text-[10.5px] text-muted">
                            {fr ? "Mise en œuvre" : "Implemented"}
                            <select
                              defaultValue={c.implemented === null ? "" : c.implemented ? "yes" : "no"}
                              onChange={(e) => { if (e.target.value) void op({ op: "updateControl", controlId: c.id, implemented: e.target.value === "yes" }); }}
                              className="rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-1.5 py-0.5 text-[10.5px] text-ink outline-none"
                              data-testid={`control-implemented-${slug(c.name)}`}
                            >
                              <option value="">—</option>
                              <option value="yes">{fr ? "Oui" : "Yes"}</option>
                              <option value="no">{fr ? "Non" : "No"}</option>
                            </select>
                          </label>
                          <input
                            defaultValue={c.operatingNotes ?? ""}
                            placeholder={fr ? "Notes sur le fonctionnement…" : "Operating notes…"}
                            onBlur={(e) => { if (e.target.value !== (c.operatingNotes ?? "")) void op({ op: "updateControl", controlId: c.id, operatingNotes: e.target.value }); }}
                            className="min-w-[180px] flex-1 rounded-[var(--radius-atlas-xs)] bg-[var(--color-warn-soft)] px-2 py-1 text-[10.5px] text-ink outline-none focus:ring-1 focus:ring-emerald-600/40"
                          />
                        </div>
                      ) : null}
                      {mode === "design" ? (
                        <textarea
                          rows={2}
                          defaultValue={c.testDesign ?? ""}
                          placeholder={fr ? "Nature, calendrier et étendue du test…" : "Nature, timing and extent of the test…"}
                          onBlur={(e) => { if (e.target.value !== (c.testDesign ?? "")) void op({ op: "updateControl", controlId: c.id, testDesign: e.target.value }); }}
                          className="mt-1 w-full resize-none rounded-[var(--radius-atlas-xs)] bg-[var(--color-warn-soft)] px-2 py-1 text-[11.5px] text-ink outline-none focus:ring-1 focus:ring-emerald-600/40"
                          data-testid={`control-design-${slug(c.name)}`}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
