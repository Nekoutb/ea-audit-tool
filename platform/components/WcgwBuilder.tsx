"use client";

// The WCGW & controls builder, in four modes along the phase:
//   wcgw    (S1.2) — per-SCOT collapsible groups: WCGW | controls table, a tidy
//                    controls register per SCOT, and add-rows. Roll a SCOT up
//                    or down with its chevron to focus without scrolling.
//   select  (S2.1) — ONE flat table of every control with its attributes,
//                    assertions covered and SCOT; tick to select for testing.
//   design  (S2.2) — a card per selected control: the test design in the
//                    yellow box, and the sample size ASSIGNED by the sampling
//                    tool (never typed here).
//   results (E1.1) — design eval + implementation + derived operating conclusion;
//                    the operating verdict comes from control_test rows, never stored
// Structural changes refresh the server view; field edits save on blur.

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Scot, ScotStudioView } from "@/lib/scots";

const ASSERTION_CODES = ["C", "E", "A", "V", "P"] as const;
export const CONTROL_FREQUENCIES = [
  { value: "daily", en: "Daily", fr: "Quotidien" },
  { value: "weekly", en: "Weekly", fr: "Hebdomadaire" },
  { value: "monthly", en: "Monthly", fr: "Mensuel" },
  { value: "quarterly", en: "Quarterly", fr: "Trimestriel" },
  { value: "semi_annually", en: "Semi-annually", fr: "Semestriel" },
  { value: "annually", en: "Annually", fr: "Annuel" },
] as const;
const slug = (s: string) => s.replace(/[^A-Za-z0-9]/g, "_");
const freqLabel = (v: string | null, fr: boolean) => {
  const f = CONTROL_FREQUENCIES.find((x) => x.value === v);
  return f ? (fr ? f.fr : f.en) : v ?? "—";
};
const typeShort = (t: string, fr: boolean) =>
  t === "manual" ? (fr ? "Manuel" : "Manual") : t === "it_dependent" ? (fr ? "Dépendant IT" : "IT-dependent") : fr ? "Automatisé" : "Automated";

// The S1.2 group renders INSIDE the PaperWizard's <form>, so no <form>
// elements of our own — nested forms are dropped by the HTML parser and break
// hydration. Plain inputs + buttons throughout.
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
  const [ctrl, setCtrl] = useState({ name: "", owner: "", ctype: "manual", freq: "monthly", objective: "prevent" });

  const addWcgw = () => {
    if (!wcgwText.trim()) return;
    void op({ op: "addWcgw", scotId: scot.id, description: wcgwText, assertions }).then((ok) => {
      if (ok) { setWcgwText(""); setAssertions([]); }
    });
  };
  const addControl = () => {
    if (!ctrl.name.trim()) return;
    void op({ op: "addControl", scotId: scot.id, name: ctrl.name, owner: ctrl.owner, controlType: ctrl.ctype, frequency: ctrl.freq, objective: ctrl.objective }).then((ok) => {
      if (ok) setCtrl({ name: "", owner: "", ctype: "manual", freq: "monthly", objective: "prevent" });
    });
  };
  const enter = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); fn(); }
  };
  const box = "rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[11.5px] outline-none focus:border-emerald-600";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[1fr_92px] items-center gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            value={wcgwText}
            onChange={(e) => setWcgwText(e.target.value)}
            onKeyDown={enter(addWcgw)}
            placeholder={fr ? "Nouveau WCGW — que peut-il mal se passer ?" : "New WCGW — what can go wrong?"}
            className={`${box} min-w-[200px] flex-1`}
            data-testid={`wcgw-new-${slug(scot.name)}`}
          />
          {ASSERTION_CODES.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAssertions((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))}
              className={`h-[18px] w-[18px] rounded-[3px] text-[9.5px] font-bold ${assertions.includes(a) ? "bg-emerald-700 text-white" : "border border-line text-muted"}`}
            >{a}</button>
          ))}
        </div>
        <button type="button" onClick={addWcgw} className="rounded-[var(--radius-atlas-xs)] bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800" data-testid={`wcgw-add-${slug(scot.name)}`}>＋ WCGW</button>
      </div>
      <div className="grid grid-cols-[1fr_92px] items-center gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            value={ctrl.name}
            onChange={(e) => setCtrl((c) => ({ ...c, name: e.target.value }))}
            onKeyDown={enter(addControl)}
            placeholder={fr ? "Nouveau contrôle" : "New control"}
            className={`${box} min-w-[150px] flex-1`}
            data-testid={`control-new-${slug(scot.name)}`}
          />
          <input
            value={ctrl.owner}
            onChange={(e) => setCtrl((c) => ({ ...c, owner: e.target.value }))}
            placeholder={fr ? "Qui l'exécute" : "Performed by"}
            className={`${box} w-[110px]`}
          />
          <select value={ctrl.ctype} onChange={(e) => setCtrl((c) => ({ ...c, ctype: e.target.value }))} className={`${box} py-[5px]`}>
            <option value="manual">{fr ? "Manuel" : "Manual"}</option>
            <option value="it_dependent">{fr ? "Manuel dépendant IT" : "IT-dependent"}</option>
            <option value="automated">{fr ? "Automatisé" : "Automated"}</option>
          </select>
          <select value={ctrl.freq} onChange={(e) => setCtrl((c) => ({ ...c, freq: e.target.value }))} className={`${box} py-[5px]`} data-testid={`control-freq-${slug(scot.name)}`}>
            {CONTROL_FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>{fr ? f.fr : f.en}</option>
            ))}
          </select>
          <select value={ctrl.objective} onChange={(e) => setCtrl((c) => ({ ...c, objective: e.target.value }))} className={`${box} py-[5px]`}>
            <option value="prevent">{fr ? "Prévention" : "Prevent"}</option>
            <option value="detect">{fr ? "Détection" : "Detect"}</option>
          </select>
        </div>
        <button type="button" onClick={addControl} className="rounded-[var(--radius-atlas-xs)] bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800" data-testid={`control-add-${slug(scot.name)}`}>＋ {fr ? "Contrôle" : "Control"}</button>
      </div>
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
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(view.scots.map((s, i) => [s.id, i === 0])),
  );
  const [accordion, setAccordion] = useState<string | null>(view.scots[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  // S2.1: selections stage locally and commit on Save
  const [staged, setStaged] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

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
      {mode === "design" ? (
        <Link
          href={`/engagements/${engagementId}/tools/sampling`}
          className="rounded-full border border-emerald-600/50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
          data-testid="design-sampling-link"
        >
          {fr ? "Outil d'échantillonnage →" : "Sampling tool →"}
        </Link>
      ) : null}
      {error ? <span className="text-[11px] font-semibold text-rose">{error}</span> : null}
    </div>
  );

  // ------------------------------------------- S1.2 — collapsible SCOT groups --
  if (mode === "wcgw") {
    const td = "border-t border-line px-2.5 py-2 align-top text-[12px]";
    return (
      <div className="flex flex-col gap-2" data-testid="wcgw-builder-wcgw">
        {header}
        {view.scots.map((scot) => {
          const byId = new Map(scot.controls.map((c) => [c.id, c]));
          const isOpen = open[scot.id] ?? false;
          return (
            <div key={scot.id} className="rounded-[var(--radius-atlas-sm)] border border-line" data-testid={`scot-group-${slug(scot.name)}`}>
              <button
                type="button"
                onClick={() => setOpen((s) => ({ ...s, [scot.id]: !isOpen }))}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-2"
                data-testid={`scot-toggle-${slug(scot.name)}`}
              >
                <span className="text-[13px] font-bold text-ink">{scot.name}</span>
                <span className="font-mono text-[10px] text-emerald-800 dark:text-emerald-300">
                  {scot.indexes.map((i) => i.indexCode).join(", ")}
                </span>
                <span className="text-[10.5px] text-muted tnum">
                  {scot.wcgws.length} WCGW · {scot.controls.length} {fr ? "contrôle(s)" : "control(s)"}
                </span>
                {scot.wcgws.some((w) => w.controlIds.length === 0) ? (
                  <span className="rounded-full bg-[var(--color-warn-soft)] px-1.5 py-[1px] text-[9.5px] font-bold text-warn">
                    {fr ? "WCGW ouverts" : "open WCGWs"}
                  </span>
                ) : null}
                <span className="ml-auto text-[13px] text-muted">{isOpen ? "▾" : "▸"}</span>
              </button>

              {isOpen ? (
                <div className="border-t border-line">
                  <table className="w-full table-fixed text-[12px]">
                    <colgroup>
                      <col style={{ width: "52%" }} />
                      <col style={{ width: "48%" }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-surface-2 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted">
                        <th className="px-2.5 py-1.5">{fr ? "Qu'est-ce qui peut mal tourner (WCGW)" : "What can go wrong (WCGW)"}</th>
                        <th className="px-2.5 py-1.5">{fr ? "Contrôles couvrant ce WCGW" : "Controls covering it"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scot.wcgws.length === 0 ? (
                        <tr>
                          <td colSpan={2} className={`${td} italic text-muted`}>
                            {fr ? "Aucun WCGW sur ce SCOT — ajouter ci-dessous." : "No WCGW on this SCOT yet — add one below."}
                          </td>
                        </tr>
                      ) : (
                        scot.wcgws.map((w) => (
                          <tr key={w.id} data-testid={`wcgw-row-${slug(w.description.slice(0, 24))}`}>
                            <td className={`${td} ${w.controlIds.length === 0 ? "bg-[var(--color-warn-soft)]" : ""}`}>
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
                            <td className={td}>
                              <span className="flex flex-wrap items-center gap-1">
                                {w.controlIds.map((cid) => {
                                  const c = byId.get(cid);
                                  if (!c) return null;
                                  return (
                                    <button
                                      key={cid}
                                      type="button"
                                      title={`${c.owner ?? "—"} · ${typeShort(c.controlType, fr)} · ${freqLabel(c.frequency, fr)} · ${c.objective}${fr ? " — cliquer pour délier" : " — click to unlink"}`}
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
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* the SCOT's controls register — every control, tidy */}
                  {scot.controls.length > 0 ? (
                    <div className="border-t border-line px-2.5 py-2">
                      <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted">
                        {fr ? "Contrôles de ce SCOT" : "Controls of this SCOT"}
                      </p>
                      <table className="w-full table-fixed text-[11.5px]" data-testid={`controls-register-${slug(scot.name)}`}>
                        <colgroup>
                          <col style={{ width: "32%" }} />
                          <col style={{ width: "18%" }} />
                          <col style={{ width: "16%" }} />
                          <col style={{ width: "14%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "8%" }} />
                        </colgroup>
                        <thead>
                          <tr className="text-left text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-muted">
                            <th className="px-1.5 py-1">{fr ? "Contrôle" : "Control"}</th>
                            <th className="px-1.5 py-1">{fr ? "Exécuté par" : "Performed by"}</th>
                            <th className="px-1.5 py-1">{fr ? "Nature" : "Nature"}</th>
                            <th className="px-1.5 py-1">{fr ? "Fréquence" : "Frequency"}</th>
                            <th className="px-1.5 py-1">{fr ? "Objectif" : "Objective"}</th>
                            <th className="px-1.5 py-1 text-right">{fr ? "WCGW" : "WCGWs"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scot.controls.map((c) => (
                            <tr key={c.id} className="border-t border-line" data-testid={`control-row-${slug(c.name.slice(0, 20))}`}>
                              <td className="px-1.5 py-1 font-medium text-ink">{c.name}</td>
                              <td className="px-1.5 py-1 text-ink-soft">{c.owner ?? "—"}</td>
                              <td className="px-1.5 py-1 text-ink-soft">{typeShort(c.controlType, fr)}</td>
                              <td className="px-1.5 py-1 text-ink-soft">{freqLabel(c.frequency, fr)}</td>
                              <td className="px-1.5 py-1 text-ink-soft">{c.objective === "prevent" ? (fr ? "Prévention" : "Prevent") : fr ? "Détection" : "Detect"}</td>
                              <td className="px-1.5 py-1 text-right">
                                <span className={`tnum ${c.wcgwIds.length === 0 ? "font-bold text-warn" : "text-ink-soft"}`}>{c.wcgwIds.length}</span>
                                <button
                                  type="button"
                                  title={fr ? "Supprimer le contrôle" : "Delete control"}
                                  onClick={() => { if (confirm(fr ? "Supprimer ce contrôle ?" : "Delete this control?")) void op({ op: "deleteControl", controlId: c.id }); }}
                                  className="ml-2 text-muted hover:text-rose"
                                >×</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  <div className="border-t border-line bg-surface-2/40 px-2.5 py-2">
                    <ScotFooter scot={scot} fr={fr} op={op} />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  // ------------------------------------------------ S2.1 — the selection table --
  if (mode === "select") {
    const rows = view.scots.flatMap((scot) =>
      scot.controls.map((c) => {
        const covered = new Set<string>();
        for (const w of scot.wcgws) if (c.wcgwIds.includes(w.id)) for (const a of w.assertions) covered.add(a);
        return { scot, c, assertions: ASSERTION_CODES.filter((a) => covered.has(a)) };
      }),
    );
    const isChecked = (id: string, current: boolean) => staged[id] ?? current;
    const dirty = rows.filter(({ c }) => (staged[c.id] ?? c.selectedForTesting) !== c.selectedForTesting);
    const saveSelections = async () => {
      setSaving(true);
      setError(null);
      // direct fetches — ONE refresh at the end, and staged stays in place so
      // the checkboxes never flip back while the server view catches up
      let ok = true;
      for (const { c } of dirty) {
        const r = await fetch(`/api/engagements/${engagementId}/scots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "updateControl", controlId: c.id, selectedForTesting: staged[c.id] }),
        }).catch(() => null);
        if (!r?.ok) ok = false;
      }
      setSaving(false);
      if (ok) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 3000);
        router.refresh();
      } else {
        setError(fr ? "Échec de l'enregistrement." : "Save failed.");
      }
    };
    const td = "border-t border-line px-2.5 py-2 align-top text-[12px]";
    return (
      <div className="flex flex-col gap-2" data-testid="wcgw-builder-select">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {header}
          <button
            type="button"
            onClick={saveSelections}
            disabled={dirty.length === 0 || saving}
            className="ml-auto rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
            data-testid="select-save"
          >
            {saving ? "…" : dirty.length > 0 ? (fr ? `Enregistrer (${dirty.length})` : `Save changes (${dirty.length})`) : savedFlash ? (fr ? "Enregistré ✓" : "Saved ✓") : fr ? "Enregistrer" : "Save changes"}
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="text-[12px] text-muted">{fr ? "Aucun contrôle défini — voir S1.2." : "No controls defined — see S1.2."}</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line">
            <table className="w-full table-fixed text-[12px]" data-testid="select-table">
              <colgroup>
                <col style={{ width: "24%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "7%" }} />
              </colgroup>
              <thead>
                <tr className="bg-surface-2 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted">
                  <th className="px-2.5 py-1.5">{fr ? "Contrôle" : "Control"}</th>
                  <th className="px-2.5 py-1.5">SCOT</th>
                  <th className="px-2.5 py-1.5">{fr ? "Assertions" : "Assertions"}</th>
                  <th className="px-2.5 py-1.5">{fr ? "Exécuté par" : "Owner"}</th>
                  <th className="px-2.5 py-1.5">{fr ? "Fréquence" : "Frequency"}</th>
                  <th className="px-2.5 py-1.5">{fr ? "Nature" : "Nature"}</th>
                  <th className="px-2.5 py-1.5">{fr ? "Objectif" : "Objective"}</th>
                  <th className="px-2.5 py-1.5 text-center">{fr ? "Tester" : "Test"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ scot, c, assertions }) => (
                  <tr key={c.id} className={isChecked(c.id, c.selectedForTesting) ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""} data-testid={`select-row-${slug(c.name.slice(0, 20))}`}>
                    <td className={`${td} whitespace-normal font-medium text-ink`}>{c.name}</td>
                    <td className={`${td} whitespace-normal text-ink-soft`}>{scot.name}</td>
                    <td className={`${td} font-mono text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300`}>{assertions.join("") || "—"}</td>
                    <td className={`${td} text-ink-soft`}>{c.owner ?? "—"}</td>
                    <td className={`${td} text-ink-soft`}>{freqLabel(c.frequency, fr)}</td>
                    <td className={`${td} text-ink-soft`}>{typeShort(c.controlType, fr)}</td>
                    <td className={`${td} text-ink-soft`}>{c.objective === "prevent" ? (fr ? "Prévention" : "Prevent") : fr ? "Détection" : "Detect"}</td>
                    <td className={`${td} text-center`}>
                      <input
                        type="checkbox"
                        checked={isChecked(c.id, c.selectedForTesting)}
                        onChange={(e) => setStaged((s) => ({ ...s, [c.id]: e.target.checked }))}
                        data-testid={`control-select-${slug(c.name)}`}
                        className="h-4 w-4 accent-emerald-700"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ------------------------------------------------ S2.2 — design cards --
  if (mode === "design") {
    const selected = view.scots.flatMap((scot) => scot.controls.filter((c) => c.selectedForTesting).map((c) => ({ scot, c })));
    return (
      <div className="flex flex-col gap-2" data-testid="wcgw-builder-design">
        {header}
        {selected.length === 0 ? (
          <p className="text-[12px] text-muted">{fr ? "Aucun contrôle sélectionné — voir S2.1." : "No controls selected — see S2.1."}</p>
        ) : (
          selected.map(({ scot, c }) => (
            <div key={c.id} className="rounded-[var(--radius-atlas-sm)] border border-line px-3 py-2" data-testid={`design-card-${slug(c.name.slice(0, 20))}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-bold text-ink">{c.name}</span>
                <span className="text-[10.5px] text-muted">{scot.name} · {c.owner ?? "—"} · {typeShort(c.controlType, fr)} · {freqLabel(c.frequency, fr)} · {c.objective}</span>
                <span
                  className={`ml-auto rounded-full px-2 py-[1px] text-[10.5px] font-bold ${c.sampleSize ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-[var(--color-warn-soft)] text-warn"}`}
                  title={c.sampleNote ?? undefined}
                  data-testid={`design-sample-${slug(c.name.slice(0, 20))}`}
                >
                  {c.sampleSize
                    ? `${fr ? "Échantillon" : "Sample"}: ${c.sampleSize}`
                    : fr ? "Échantillon à déterminer — outil d'échantillonnage" : "Sample to determine — use the Sampling tool"}
                </span>
              </div>
              {c.sampleNote ? <p className="mt-0.5 text-[10.5px] text-muted">{c.sampleNote}</p> : null}
              <textarea spellCheck={false}
                rows={2}
                defaultValue={c.testDesign ?? ""}
                placeholder={fr ? "Nature, calendrier et étendue du test…" : "Nature, timing and extent of the test…"}
                onBlur={(e) => { if (e.target.value !== (c.testDesign ?? "")) void op({ op: "updateControl", controlId: c.id, testDesign: e.target.value }); }}
                onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }}
                ref={(el) => { if (el && el.value) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }}
                className="mt-1.5 w-full resize-none overflow-hidden rounded-[var(--radius-atlas-xs)] bg-[color:var(--wp-input)] px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-muted focus:ring-1 focus:ring-emerald-600/40"
                data-testid={`control-design-${slug(c.name)}`}
              />
            </div>
          ))
        )}
      </div>
    );
  }

  // ------------------------------------------------ E1.1 — results accordion --
  return (
    <div className="flex flex-col gap-2" data-testid="wcgw-builder-results">
      {header}
      {view.scots.map((scot) => {
        const isOpen = accordion === scot.id;
        const relevantControls = scot.controls.filter((c) => c.selectedForTesting);
        return (
          <div key={scot.id} className="rounded-[var(--radius-atlas-sm)] border border-line">
            <button
              type="button"
              onClick={() => setAccordion(isOpen ? null : scot.id)}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface-2"
              data-testid={`wcgw-scot-${slug(scot.name)}`}
            >
              <span className="text-[12.5px] font-bold text-ink">{scot.name}</span>
              <span className="text-[10.5px] text-muted tnum">
                {relevantControls.length} {fr ? "sélectionné(s)" : "selected"}
              </span>
              <span className="ml-auto text-muted">{isOpen ? "▾" : "▸"}</span>
            </button>

            {isOpen ? (
              <div className="border-t border-line px-2.5 py-2">
                <div className="flex flex-col gap-1.5">
                  {relevantControls.length === 0 ? (
                    <p className="text-[11.5px] text-muted">{fr ? "Aucun contrôle sélectionné sur ce SCOT." : "No controls selected on this SCOT."}</p>
                  ) : null}
                  {relevantControls.map((c) => (
                    <div key={c.id} className="rounded-[var(--radius-atlas-xs)] border border-line px-2 py-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-semibold text-ink">{c.name}</span>
                        <span className="text-[10.5px] text-muted">{c.owner ?? "—"} · {typeShort(c.controlType, fr)} · {freqLabel(c.frequency, fr)} · {c.objective}</span>
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
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        {c.testDesign ? <p className="w-full text-[10.5px] italic leading-snug text-muted">{c.testDesign}{c.sampleSize ? ` — ${fr ? "échantillon" : "sample"}: ${c.sampleSize}` : ""}</p> : null}
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
