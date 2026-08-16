"use client";

// The WCGW & controls builder, in four modes along the phase:
//   wcgw    (S1.2) — identify WCGWs per SCOT and the controls answering them
//   select  (S2.1) — the selected-for-testing decision, with the ¶33 warnings
//   design  (S2.2) — nature/timing/extent per selected control
//   results (E1.1) — design eval + implementation + derived operating conclusion;
//                    the operating verdict comes from control_test rows, never stored
// Structural changes refresh the server view; field edits save on blur.

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ScotStudioView } from "@/lib/scots";

const ASSERTION_CODES = ["C", "E", "A", "V", "P"] as const;

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
  const [newAssertions, setNewAssertions] = useState<string[]>([]);
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

  return (
    <div className="flex flex-col gap-2" data-testid={`wcgw-builder-${mode}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
          {mode === "wcgw"
            ? fr ? "WCGW & contrôles par SCOT" : "WCGWs & controls per SCOT"
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

      {view.scots.map((scot) => {
        const isOpen = open === scot.id;
        const relevantControls = mode === "wcgw" ? scot.controls : scot.controls.filter((c) => mode === "select" || c.selectedForTesting);
        return (
          <div key={scot.id} className="rounded-[var(--radius-atlas-sm)] border border-line">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : scot.id)}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface-2"
              data-testid={`wcgw-scot-${scot.name.replace(/[^A-Za-z0-9]/g, "_")}`}
            >
              <span className="text-[12.5px] font-bold text-ink">{scot.name}</span>
              <span className="text-[10.5px] text-muted tnum">
                {scot.wcgws.length} WCGW · {scot.controls.length} {fr ? "contrôle(s)" : "control(s)"}
                {mode !== "wcgw" ? ` · ${scot.controls.filter((c) => c.selectedForTesting).length} ${fr ? "sélectionné(s)" : "selected"}` : ""}
              </span>
              <span className="ml-auto text-muted">{isOpen ? "▾" : "▸"}</span>
            </button>

            {isOpen ? (
              <div className="border-t border-line px-2.5 py-2">
                {mode === "wcgw" ? (
                  <>
                    {scot.wcgws.map((w) => (
                      <div key={w.id} className={`mb-1.5 rounded-[var(--radius-atlas-xs)] border px-2 py-1.5 ${w.controlIds.length === 0 ? "border-[var(--color-warn)]/40 bg-[var(--color-warn-soft)]" : "border-line"}`}>
                        <div className="flex items-start gap-2">
                          <p className="min-w-0 flex-1 text-[12px] leading-snug text-ink">{w.description}</p>
                          <span className="font-mono text-[9.5px] font-bold text-emerald-800 dark:text-emerald-300">[{w.assertions.join("") || "—"}]</span>
                          <button type="button" onClick={() => void op({ op: "deleteWcgw", wcgwId: w.id })} className="text-muted hover:text-rose">×</button>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-1">
                          {scot.controls.map((c) => {
                            const linked = w.controlIds.includes(c.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => void op({ op: "toggleLink", wcgwId: w.id, controlId: c.id, linked: !linked })}
                                className={`rounded-full px-2 py-[1px] text-[10px] font-semibold transition ${linked ? "bg-emerald-700 text-white" : "border border-line text-muted hover:border-emerald-600"}`}
                                title={fr ? (linked ? "Délier ce contrôle" : "Lier ce contrôle") : linked ? "Unlink this control" : "Link this control"}
                              >
                                {c.name}
                              </button>
                            );
                          })}
                          {scot.controls.length === 0 ? <span className="text-[10.5px] text-muted">{fr ? "Ajouter un contrôle ci-dessous" : "Add a control below"}</span> : null}
                        </div>
                      </div>
                    ))}
                    <form
                      className="mt-1 flex flex-wrap items-center gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = e.currentTarget;
                        const d = new FormData(f);
                        void op({ op: "addWcgw", scotId: scot.id, description: String(d.get("description") ?? ""), assertions: newAssertions }).then((ok) => { if (ok) { f.reset(); setNewAssertions([]); } });
                      }}
                    >
                      <input name="description" required placeholder={fr ? "Nouveau WCGW — que peut-il mal se passer ?" : "New WCGW — what can go wrong?"} className="min-w-[220px] flex-1 rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[11.5px] outline-none focus:border-emerald-600" data-testid={`wcgw-new-${scot.name.replace(/[^A-Za-z0-9]/g, "_")}`} />
                      {ASSERTION_CODES.map((a) => (
                        <button key={a} type="button" onClick={() => setNewAssertions((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))} className={`h-[17px] w-[17px] rounded-[3px] text-[9.5px] font-bold ${newAssertions.includes(a) ? "bg-emerald-700 text-white" : "border border-line text-muted"}`}>{a}</button>
                      ))}
                      <button type="submit" className="rounded-[var(--radius-atlas-xs)] bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800" data-testid={`wcgw-add-${scot.name.replace(/[^A-Za-z0-9]/g, "_")}`}>+</button>
                    </form>
                    <form
                      className="mt-1.5 flex flex-wrap items-center gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = e.currentTarget;
                        const d = new FormData(f);
                        void op({ op: "addControl", scotId: scot.id, name: String(d.get("cname") ?? ""), owner: String(d.get("owner") ?? ""), controlType: String(d.get("ctype") ?? "manual"), frequency: String(d.get("freq") ?? ""), objective: String(d.get("objective") ?? "prevent") }).then((ok) => { if (ok) f.reset(); });
                      }}
                    >
                      <input name="cname" required placeholder={fr ? "Nouveau contrôle" : "New control"} className="min-w-[160px] rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[11.5px] outline-none focus:border-emerald-600" data-testid={`control-new-${scot.name.replace(/[^A-Za-z0-9]/g, "_")}`} />
                      <input name="owner" placeholder={fr ? "Qui l'exécute" : "Performed by"} className="w-[120px] rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[11.5px] outline-none" />
                      <select name="ctype" className="rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-1.5 py-1 text-[11px]" defaultValue="manual">
                        <option value="manual">{fr ? "Manuel" : "Manual"}</option>
                        <option value="it_dependent">{fr ? "Manuel dépendant IT" : "IT-dependent"}</option>
                        <option value="automated">{fr ? "Automatisé" : "Automated"}</option>
                      </select>
                      <input name="freq" placeholder={fr ? "Fréquence" : "Frequency"} className="w-[90px] rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[11.5px] outline-none" />
                      <select name="objective" className="rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-1.5 py-1 text-[11px]" defaultValue="prevent">
                        <option value="prevent">{fr ? "Prévention" : "Prevent"}</option>
                        <option value="detect">{fr ? "Détection" : "Detect"}</option>
                      </select>
                      <button type="submit" className="rounded-[var(--radius-atlas-xs)] bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800" data-testid={`control-add-${scot.name.replace(/[^A-Za-z0-9]/g, "_")}`}>＋ {fr ? "contrôle" : "control"}</button>
                    </form>
                  </>
                ) : (
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
                                data-testid={`control-select-${c.name.replace(/[^A-Za-z0-9]/g, "_")}`}
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
                              data-testid={`control-operating-${c.name.replace(/[^A-Za-z0-9]/g, "_")}`}
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
                                data-testid={`control-designeval-${c.name.replace(/[^A-Za-z0-9]/g, "_")}`}
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
                                data-testid={`control-implemented-${c.name.replace(/[^A-Za-z0-9]/g, "_")}`}
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
                            data-testid={`control-design-${c.name.replace(/[^A-Za-z0-9]/g, "_")}`}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
