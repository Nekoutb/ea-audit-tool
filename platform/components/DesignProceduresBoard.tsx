"use client";

// S5.5 — the substantive-procedures design board: per significant account and
// per relevant assertion, the CRA inherited from S3.1 and the designed nature,
// timing and extent (ISA 330 ¶6–7: procedures are designed per assertion,
// responsive to that assertion's assessed risk). The badge on each account row
// is its worst relevant-assertion CRA; the grid inside designs each assertion
// against its own level. OSPs stay at account level, and each one is a record
// carrying the same parameters a library procedure carries.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NATURE_OPTIONS, TIMING_OPTIONS, craLevelOf, timingAllowed, type OspProcedure } from "@/lib/design-procedures-model";
import type { DspRow, DspView } from "@/lib/design-procedures";
import { craTone, thresholdSuggestion, timingSuggestion, todLabel, worstTod } from "@/lib/cra-model";
import { Chip } from "@/components/ui/atlas";

// timingAllowed lives in the model (UAT B75): the same rule now refuses an
// out-of-window timing on the server, not only in this drop-down.
const levelOf = craLevelOf;

/** Short, stable enough to key one account's handful of custom procedures. */
const newOspId = (): string => Math.random().toString(36).slice(2, 10);

/** Where a selection panel is pinned, in viewport coordinates. */
interface SelPanel {
  key: string;
  left: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const PANEL_WIDTH = 340;

export function DesignProceduresBoard({
  engagementId,
  view,
  locale,
}: {
  engagementId: string;
  view: DspView;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  // The panel is positioned against the viewport rather than the cell: the
  // design grid scrolls horizontally, and an overflow-x scroller clips a
  // positioned child on BOTH axes — the lower checkboxes were unreachable.
  const [panel, setPanel] = useState<SelPanel | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const chosenRefs = useRef<Record<string, HTMLUListElement | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const r of view.rows) for (const [k, v] of Object.entries(r.values)) out[`${r.indexCode}_${k}`] = v;
    return out;
  });
  // index|assertion → selected catalog positions
  const [sels, setSels] = useState<Record<string, number[]>>(() => {
    const out: Record<string, number[]> = {};
    for (const r of view.rows) for (const [a, arr] of Object.entries(r.selected)) out[`${r.indexCode}|${a}`] = arr;
    return out;
  });
  // index → the account's custom procedures, saved as one list per account
  const [osps, setOsps] = useState<Record<string, OspProcedure[]>>(() => {
    const out: Record<string, OspProcedure[]> = {};
    for (const r of view.rows) out[r.indexCode] = r.osps;
    return out;
  });
  // the same lists, readable synchronously: two fields blurred in quick
  // succession both edit the list as it stands, not as the last render saw it
  const ospsRef = useRef(osps);

  const closePanel = useCallback(() => { triggerRef.current = null; setPanel(null); }, []);

  /** Pin the panel to the trigger's current place on screen. */
  const place = useCallback((key: string, trigger: HTMLElement) => {
    const rect = trigger.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8));
    const below = window.innerHeight - rect.bottom - 12;
    // when the row sits low in the paper pane the list opens upwards instead,
    // so the last checkbox is reachable without scrolling anything
    if (below < 220 && rect.top > below) {
      setPanel({ key, left, bottom: window.innerHeight - rect.top + 4, maxHeight: rect.top - 12 });
      return;
    }
    setPanel({ key, left, top: rect.bottom + 4, maxHeight: below });
  }, []);

  // Viewport coordinates go stale as soon as anything scrolls, and ticking a
  // box scrolls the paper pane itself, so the panel follows its trigger rather
  // than closing under the preparer mid-selection.
  const panelKey = panel?.key;
  useEffect(() => {
    if (!panelKey) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest("[data-dsp-sel-trigger]")) return; // the trigger toggles itself
      if (panelRef.current?.contains(target as Node)) return;
      closePanel();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel(); };
    const follow = () => {
      const el = triggerRef.current;
      const rect = el?.getBoundingClientRect();
      if (!el?.isConnected || !rect || rect.bottom < 0 || rect.top > window.innerHeight) { closePanel(); return; }
      place(panelKey, el);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [panelKey, closePanel, place]);

  function openPanel(key: string, trigger: HTMLElement) {
    if (panelKey === key) { closePanel(); return; }
    triggerRef.current = trigger;
    place(key, trigger);
  }

  async function save(indexCode: string, field: string, value: string) {
    setError(null);
    setValues((v) => ({ ...v, [`${indexCode}_${field}`]: value }));
    const r = await fetch(`/api/engagements/${engagementId}/dsp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "save", indexCode, field, value }),
    }).catch(() => null);
    if (!r?.ok) setError(fr ? "Échec de l'enregistrement." : "Save failed.");
  }

  function toggleSel(indexCode: string, assertion: string, pos: number) {
    const key = `${indexCode}|${assertion}`;
    const cur = sels[key] ?? [];
    const next = cur.includes(pos) ? cur.filter((n) => n !== pos) : [...cur, pos].sort((a, b) => a - b);
    setSels((s) => ({ ...s, [key]: next }));
    void save(indexCode, `sel_${assertion}`, JSON.stringify(next));
    // the chosen list grows the row inside the paper's fixed-height pane, so
    // pull it back into view after the tick rather than leaving it below the fold
    requestAnimationFrame(() => chosenRefs.current[key]?.scrollIntoView({ block: "nearest" }));
  }

  /** Every custom-procedure edit rewrites the account's whole list — one field, one row. */
  function updateOsps(indexCode: string, mutate: (list: OspProcedure[]) => OspProcedure[]) {
    const next = mutate(ospsRef.current[indexCode] ?? []);
    ospsRef.current = { ...ospsRef.current, [indexCode]: next };
    setOsps(ospsRef.current);
    void save(indexCode, "osp_list", JSON.stringify(next));
  }

  function patchOsp(indexCode: string, id: string, patch: Partial<OspProcedure>) {
    updateOsps(indexCode, (list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  const rowSelectedCount = (row: DspRow) => {
    const all = new Set<number>();
    for (const c of row.cells) for (const n of sels[`${row.indexCode}|${c.assertion}`] ?? []) all.add(n);
    return all.size;
  };

  const label = "text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const select = "w-full rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-1.5 py-1 text-[11.8px] text-ink outline-none focus:border-emerald-600";
  const area = "w-full resize-none rounded-[var(--radius-atlas-sm)] border border-line bg-[color:var(--wp-input)] px-2.5 py-1.5 text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-muted focus:border-emerald-600";

  if (view.rows.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-[12.5px] text-muted" data-testid="dsp-empty">
        {fr
          ? "Aucun compte significatif — arrêter d'abord P6.2, puis évaluer les risques en S3.1."
          : "No significant accounts yet — settle P6.2 first, then assess the risks in S3.1."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="dsp-board">
      <div className="flex flex-col gap-1 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-[11px] text-ink-soft">
        <span>
          <b>{fr ? "Le badge sur chaque ligne est l'ECR" : "The badge on each row is the CRA"}</b>{" "}
          {fr
            ? "(évaluation combinée des risques) arrêtée en S3.1 — Minimal · Faible · Modéré · Élevé, la pire des assertions pertinentes du compte ; « +SR » signale un risque important ou de fraude. Les procédures se conçoivent par assertion pertinente, contre l'ECR propre à cette assertion."
            : "(combined risk assessment) settled in S3.1 — Minimal · Low · Moderate · High, the worst of the account's relevant assertions; \"+SR\" flags a significant or fraud risk. Procedures are designed per relevant assertion, against that assertion's own CRA."}
        </span>
        <span className="flex flex-wrap items-center gap-3">
          <Link href={`/engagements/${engagementId}/cra`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            {fr ? "Matrice ECR (S3.1)" : "CRA matrix (S3.1)"}
          </Link>
          <Link href={`/engagements/${engagementId}/tools/sampling`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            {fr ? "Outil d'échantillonnage" : "Sampling tool"}
          </Link>
        </span>
      </div>

      {error ? <p className="text-[12px] font-semibold text-rose">{error}</p> : null}

      {(() => {
        // an account designed only with custom procedures is designed: the gap
        // banner counts the same way the server-side gate does
        const gaps = view.rows
          .filter((row) => row.cells.length > 0
            && !Object.values(row.selected).some((a) => a.length > 0)
            && (osps[row.indexCode] ?? []).length === 0)
          .map((row) => row.indexCode);
        return gaps.length > 0 ? (
          <div className="rounded-[var(--radius-atlas-sm)] border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" data-testid="dsp-gaps">
            {fr
              ? `⚠ ${gaps.length} compte(s) avec assertions clés sans procédures conçues : ${gaps.join(", ")}`
              : `⚠ ${gaps.length} account(s) with key assertions and no designed procedures yet: ${gaps.join(", ")}`}
          </div>
        ) : null;
      })()}

      {view.rows.map((row: DspRow) => {
        const isOpen = open === row.indexCode;
        const level = row.worst ? levelOf(row.worst) : null;
        const v = (f: string) => values[`${row.indexCode}_${f}`] ?? "";
        const rowOsps = osps[row.indexCode] ?? [];
        return (
          <div key={row.indexCode} className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : row.indexCode)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-2"
              data-testid={`dsp-row-${row.indexCode}`}
            >
              <span className="font-mono text-[11.5px] font-extrabold text-emerald-700/70 tnum dark:text-emerald-400/70">{row.indexCode}</span>
              <span className="min-w-0 flex-1 truncate text-[12.8px] font-semibold text-ink">{row.label}</span>
              {row.worst && level ? <Chip tone={craTone(level)}>{todLabel(row.worst, fr ? "fr" : "en")}</Chip> : <Chip tone="muted">{fr ? "ECR à évaluer" : "CRA pending"}</Chip>}
              <span className="text-[11px] text-muted">{isOpen ? "▾" : "▸"}</span>
            </button>

            {isOpen ? (
              <div className="flex flex-col gap-2.5 border-t border-line px-3 py-2.5" data-testid={`dsp-detail-${row.indexCode}`}>
                <p className="text-[12px] text-ink-soft" data-testid={`dsp-summary-${row.indexCode}`}>
                  <b>{rowSelectedCount(row)}</b>
                  {"/"}
                  <b>{row.pspCount}</b>{" "}
                  {fr
                    ? "procédures substantives primaires retenues — seules les procédures retenues sont générées dans le papier E4"
                    : "primary substantive procedures selected — only selected procedures are generated in the E4 paper"}
                  {rowOsps.length > 0 ? (fr ? ` · ${rowOsps.length} OSP conçue(s)` : ` · ${rowOsps.length} custom procedure(s)`) : null}
                  {" · "}
                  {row.generated > 0
                    ? fr ? `${row.done}/${row.generated} exécutées dans le papier` : `${row.done}/${row.generated} executed in the workpaper`
                    : fr ? "non encore générées" : "not generated yet"}
                  {row.taskItemId ? (
                    <>
                      {" · "}
                      <Link href={`/engagements/${engagementId}/sections/${row.taskItemId}?back=${encodeURIComponent(pathname)}`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400" data-testid={`dsp-open-${row.indexCode}`}>
                        {fr ? `Ouvrir ${row.taskCode}` : `Open ${row.taskCode}`}
                      </Link>
                    </>
                  ) : row.taskCode ? (
                    // UAT run 2 B20: never a silent dead end — the paper that
                    // executes this design is not on the file yet.
                    <span className="font-semibold text-rose" data-testid={`dsp-no-task-${row.indexCode}`}>
                      {" · "}
                      {fr
                        ? `${row.taskCode} absent du dossier — sélectionnez une procédure pour l'ajouter`
                        : `${row.taskCode} is not on the file — select a procedure to add it`}
                    </span>
                  ) : null}
                </p>

                {row.cells.length === 0 ? (
                  <p className="rounded-[var(--radius-atlas-sm)] bg-surface-2 px-3 py-2 text-[12px] text-muted" data-testid={`dsp-no-key-${row.indexCode}`}>
                    {fr
                      ? "Aucune assertion clé retenue pour ce compte (P6.2 / console des risques) — rien à concevoir ici."
                      : "No key assertions selected for this account (P6.2 / risk console) — nothing to design here."}
                  </p>
                ) : null}
                {/* design grid: one row per relevant assertion, against its own CRA */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px]">
                    <thead>
                      <tr>
                        <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Assertion" : "Assertion"}</th>
                        <th className={`${label} px-1.5 py-1 text-left`}>CRA</th>
                        <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Procédures substantives primaires" : "Primary substantive procedures"}</th>
                        <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Nature" : "Nature"}</th>
                        <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Calendrier" : "Timing"}</th>
                        <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Étendue" : "Extent"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.cells.map((c) => {
                        const cellLevel = levelOf(c.tod);
                        const allowed = timingAllowed(cellLevel);
                        const selKey = `${row.indexCode}|${c.assertion}`;
                        const covering = row.catalog.filter((p) => p.a.includes(c.assertion));
                        const chosen = sels[selKey] ?? [];
                        const selOpen = panelKey === selKey;
                        return (
                          <tr key={c.assertion} className="border-t border-line align-top">
                            <td className="px-1.5 py-1.5">
                              <span className="text-[12.5px] font-bold text-ink">{c.assertion}</span>
                              {c.significant ? <span className="ml-1"><Chip tone="rose">SR</Chip></span> : null}
                            </td>
                            <td className="px-1.5 py-1.5">
                              <Chip tone={craTone(cellLevel)}>{todLabel(c.tod, fr ? "fr" : "en")}</Chip>
                            </td>
                            <td className="px-1.5 py-1.5">
                              {/* the chosen procedures sit ABOVE the trigger: a tick
                                  then reads at the top of the cell instead of pushing
                                  the row down out of the paper pane */}
                              {chosen.length > 0 ? (
                                <ul
                                  ref={(el) => { chosenRefs.current[selKey] = el; }}
                                  className="mb-1.5 flex flex-col gap-1"
                                  data-testid={`dsp-chosen-${row.indexCode}-${c.assertion}`}
                                >
                                  {chosen.map((n) => {
                                    const p = row.catalog[n];
                                    return p ? (
                                      <li key={n} className="flex gap-1.5 rounded-[var(--radius-atlas-xs)] bg-emerald-50 px-2 py-1 text-[11.5px] leading-snug text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                                        <span aria-hidden className="flex-shrink-0 font-bold">•</span>
                                        <span>{fr ? p.fr : p.en}</span>
                                      </li>
                                    ) : null;
                                  })}
                                </ul>
                              ) : null}
                              <button
                                type="button"
                                data-dsp-sel-trigger=""
                                onClick={(e) => openPanel(selKey, e.currentTarget)}
                                className="w-full min-w-[150px] rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-left text-[11.8px] text-ink hover:border-emerald-600"
                                data-testid={`dsp-sel-${row.indexCode}-${c.assertion}`}
                              >
                                {chosen.length > 0
                                  ? `${chosen.length}/${covering.length} ${fr ? "retenues" : "selected"}`
                                  : fr ? `— retenir (${covering.length})` : `— select (${covering.length})`}
                                <span className="float-right text-muted">{selOpen ? "▴" : "▾"}</span>
                              </button>
                              {selOpen && panel
                                ? createPortal(
                                    <div
                                      ref={panelRef}
                                      style={{ position: "fixed", left: panel.left, top: panel.top, bottom: panel.bottom, width: PANEL_WIDTH, maxHeight: panel.maxHeight }}
                                      className="z-50 overflow-y-auto rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface-pop p-2 shadow-atlas-sm"
                                      data-testid={`dsp-sel-list-${row.indexCode}-${c.assertion}`}
                                    >
                                      {covering.length === 0 ? (
                                        <p className="text-[11.5px] text-muted">{fr ? "Aucune procédure de la bibliothèque ne couvre cette assertion — ajouter une OSP." : "No library procedure covers this assertion — add a custom procedure."}</p>
                                      ) : (
                                        covering.map((p) => (
                                          <label key={p.i} className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-[11.8px] leading-snug text-ink-soft hover:bg-surface-2">
                                            <input
                                              type="checkbox"
                                              checked={chosen.includes(p.i)}
                                              onChange={() => toggleSel(row.indexCode, c.assertion, p.i)}
                                              className="mt-0.5 h-3.5 w-3.5 accent-emerald-700"
                                              data-testid={`dsp-sel-${row.indexCode}-${c.assertion}-${p.i}`}
                                            />
                                            <span>{fr ? p.fr : p.en}</span>
                                          </label>
                                        ))
                                      )}
                                    </div>,
                                    document.body,
                                  )
                                : null}
                            </td>
                            <td className="px-1.5 py-1.5">
                              <select
                                value={v(`${c.assertion}_nature`)}
                                onChange={(e) => void save(row.indexCode, `${c.assertion}_nature`, e.target.value)}
                                className={select}
                                data-testid={`dsp-nature-${row.indexCode}-${c.assertion}`}
                              >
                                <option value="">{fr ? "— choisir" : "— choose"}</option>
                                {NATURE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value} disabled={o.value === "sap_led" && c.significant}>
                                    {(fr ? o.fr : o.en) + (o.value === "sap_led" && c.significant ? (fr ? " — interdit (risque important)" : " — barred (significant risk)") : "")}
                                  </option>
                                ))}
                              </select>
                              {c.significant ? (
                                <p className="mt-0.5 text-[10px] text-muted">{fr ? "Test de détail obligatoire (ISA 330 ¶21)" : "Test of details required (ISA 330 ¶21)"}</p>
                              ) : null}
                            </td>
                            <td className="px-1.5 py-1.5">
                              <select
                                value={v(`${c.assertion}_timing`)}
                                onChange={(e) => void save(row.indexCode, `${c.assertion}_timing`, e.target.value)}
                                className={select}
                                title={timingSuggestion(cellLevel, fr ? "fr" : "en")}
                                data-testid={`dsp-timing-${row.indexCode}-${c.assertion}`}
                              >
                                <option value="">{fr ? "— choisir" : "— choose"}</option>
                                {TIMING_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value} disabled={!allowed.includes(o.value)}>
                                    {(fr ? o.fr : o.en) + (!allowed.includes(o.value) ? (fr ? " — indisponible à cet ECR" : " — unavailable at this CRA") : "")}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-1.5 py-1.5">
                              <input
                                defaultValue={v(`${c.assertion}_extent`)}
                                placeholder={thresholdSuggestion(cellLevel, fr ? "fr" : "en")}
                                onBlur={(e) => { if (e.target.value !== v(`${c.assertion}_extent`)) void save(row.indexCode, `${c.assertion}_extent`, e.target.value); }}
                                className={`${area} min-w-[180px]`}
                                data-testid={`dsp-extent-${row.indexCode}-${c.assertion}`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div data-testid={`dsp-osp-list-${row.indexCode}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={label}>
                      {fr ? "Autres procédures substantives (OSP)" : "Other substantive procedures (OSPs)"}
                      {row.ospRequired ? <span className="ml-1.5 font-bold normal-case text-amber-700 dark:text-amber-400">{fr ? "— requises" : "— required"}</span> : null}
                    </p>
                    <button
                      type="button"
                      onClick={() => updateOsps(row.indexCode, (list) => [...list, { id: newOspId(), en: "", fr: "", assertions: [], nature: "", timing: "", extent: "" }])}
                      className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-[11.5px] font-semibold text-ink hover:border-emerald-600"
                      data-testid={`dsp-osp-add-${row.indexCode}`}
                    >
                      {fr ? "+ Ajouter une procédure" : "+ Add a procedure"}
                    </button>
                  </div>

                  {rowOsps.length === 0 ? (
                    <p className="mt-1 text-[11.5px] text-muted" data-testid={`dsp-osp-empty-${row.indexCode}`}>
                      {row.ospRequired
                        ? fr
                          ? "Un risque important ou une assertion sans appui appelle des procédures au-delà du socle : ajouter un test de détail répondant spécifiquement au risque."
                          : "A significant risk or a no-reliance assertion calls for procedures beyond the baseline: add a test of details specifically responsive to the risk."
                        : fr ? "Aucune requise — ajouter celles qui sont conçues pour ce compte." : "None required — add any designed for this account."}
                    </p>
                  ) : null}

                  <div className="mt-1.5 flex flex-col gap-2">
                    {rowOsps.map((osp, i) => {
                      const covered = row.cells.filter((c) => osp.assertions.includes(c.assertion));
                      // the procedure answers a set of assertions, so it is bound
                      // by the worst CRA among them; before any assertion is
                      // ticked the account's own worst CRA holds the line
                      const basis = worstTod(covered.map((c) => c.tod)) ?? row.worst;
                      const ospLevel = basis ? levelOf(basis) : null;
                      const ospAllowed = timingAllowed(ospLevel);
                      const ospSignificant = covered.length > 0
                        ? covered.some((c) => c.significant)
                        : (row.worst?.endsWith("_sr") ?? false);
                      return (
                        <div key={osp.id} className="flex flex-col gap-1.5 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 p-2" data-testid={`dsp-osp-${row.indexCode}-${osp.id}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-muted">
                              {fr ? `OSP ${i + 1}` : `OSP ${i + 1}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateOsps(row.indexCode, (list) => list.filter((o) => o.id !== osp.id))}
                              className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-rose hover:bg-rose/10"
                              data-testid={`dsp-osp-${row.indexCode}-${osp.id}-delete`}
                            >
                              {fr ? "Supprimer" : "Delete"}
                            </button>
                          </div>
                          <label className="flex flex-col text-[10.5px] text-muted">
                            {fr ? "Description (EN)" : "Description (EN)"}
                            <textarea
                              rows={2}
                              spellCheck={false}
                              defaultValue={osp.en}
                              placeholder={fr ? "ex. Vouch each item above the SAD to the signed contract…" : "e.g. Vouch each item above the SAD to the signed contract…"}
                              onBlur={(e) => { if (e.target.value !== osp.en) patchOsp(row.indexCode, osp.id, { en: e.target.value }); }}
                              className={area}
                              data-testid={`dsp-osp-${row.indexCode}-${osp.id}-en`}
                            />
                          </label>
                          <label className="flex flex-col text-[10.5px] text-muted">
                            {fr ? "Description (FR)" : "Description (FR)"}
                            <textarea
                              rows={2}
                              spellCheck={false}
                              defaultValue={osp.fr}
                              placeholder={fr ? "ex. Justifier chaque élément supérieur au SAD par le contrat signé…" : "e.g. Justifier chaque élément supérieur au SAD par le contrat signé…"}
                              onBlur={(e) => { if (e.target.value !== osp.fr) patchOsp(row.indexCode, osp.id, { fr: e.target.value }); }}
                              className={area}
                              data-testid={`dsp-osp-${row.indexCode}-${osp.id}-fr`}
                            />
                          </label>
                          <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                            {fr ? "Assertions couvertes :" : "Assertions answered:"}
                            {row.cells.length === 0 ? (
                              <span>{fr ? "aucune assertion clé sur ce compte" : "no key assertion on this account"}</span>
                            ) : null}
                            {row.cells.map((c) => {
                              const on = osp.assertions.includes(c.assertion);
                              return (
                                <label key={c.assertion} className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${on ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-line text-ink-soft"}`}>
                                  <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={on}
                                    onChange={() => patchOsp(row.indexCode, osp.id, {
                                      assertions: on ? osp.assertions.filter((a) => a !== c.assertion) : [...osp.assertions, c.assertion],
                                    })}
                                    data-testid={`dsp-osp-${row.indexCode}-${osp.id}-assert-${c.assertion}`}
                                  />
                                  {c.assertion}
                                </label>
                              );
                            })}
                          </span>
                          {covered.length > 0 ? (
                            <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted" data-testid={`dsp-osp-${row.indexCode}-${osp.id}-cra`}>
                              {fr ? "ECR de ces assertions :" : "CRA of those assertions:"}
                              {covered.map((c) => (
                                <span key={c.assertion} className="inline-flex items-center gap-1">
                                  <b className="text-ink">{c.assertion}</b>
                                  <Chip tone={craTone(levelOf(c.tod))}>{todLabel(c.tod, fr ? "fr" : "en")}</Chip>
                                </span>
                              ))}
                            </span>
                          ) : null}
                          <span className="flex flex-wrap items-end gap-2.5">
                            <label className="flex flex-col text-[10.5px] text-muted">
                              {fr ? "Nature" : "Nature"}
                              <select
                                value={osp.nature}
                                onChange={(e) => patchOsp(row.indexCode, osp.id, { nature: e.target.value })}
                                className={select}
                                data-testid={`dsp-osp-${row.indexCode}-${osp.id}-nature`}
                              >
                                <option value="">{fr ? "— choisir" : "— choose"}</option>
                                {NATURE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value} disabled={o.value === "sap_led" && ospSignificant}>
                                    {(fr ? o.fr : o.en) + (o.value === "sap_led" && ospSignificant ? (fr ? " — interdit (risque important)" : " — barred (significant risk)") : "")}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col text-[10.5px] text-muted">
                              {fr ? "Calendrier" : "Timing"}
                              <select
                                value={osp.timing}
                                onChange={(e) => patchOsp(row.indexCode, osp.id, { timing: e.target.value })}
                                className={select}
                                title={ospLevel ? timingSuggestion(ospLevel, fr ? "fr" : "en") : undefined}
                                data-testid={`dsp-osp-${row.indexCode}-${osp.id}-timing`}
                              >
                                <option value="">{fr ? "— choisir" : "— choose"}</option>
                                {TIMING_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value} disabled={!ospAllowed.includes(o.value)}>
                                    {(fr ? o.fr : o.en) + (!ospAllowed.includes(o.value) ? (fr ? " — indisponible à cet ECR" : " — unavailable at this CRA") : "")}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex min-w-[220px] flex-1 flex-col text-[10.5px] text-muted">
                              {fr ? "Étendue" : "Extent"}
                              <input
                                defaultValue={osp.extent}
                                placeholder={ospLevel ? thresholdSuggestion(ospLevel, fr ? "fr" : "en") : (fr ? "ex. 100 % des éléments > SAD nominal…" : "e.g. 100% of items > SAD Nominal…")}
                                onBlur={(e) => { if (e.target.value !== osp.extent) patchOsp(row.indexCode, osp.id, { extent: e.target.value }); }}
                                className={select}
                                data-testid={`dsp-osp-${row.indexCode}-${osp.id}-extent`}
                              />
                            </label>
                          </span>
                          {osp.nature === "sap_led" && ospSignificant ? (
                            <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                              {fr
                                ? "Les analytiques seules ne portent jamais un risque important (ISA 330 ¶21) — passer à un test de détail."
                                : "Analytics alone never carry a significant risk (ISA 330 ¶21) — move to a test of details."}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {rowOsps.length > 0 ? (
                    <p className="mt-1 text-[10.5px] text-muted">
                      {fr
                        ? "Ces procédures sont générées dans le papier E4 avec les procédures primaires retenues — inutile de les ressaisir."
                        : "These procedures are generated into the E4 paper alongside the selected primary ones — no need to retype them."}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
