"use client";

// The Summary of Audit Differences, replicated from the firm's Excel
// template (1016_DPDC_SAD): the same six schedules, the same headers, band
// rows and colour coding — grey #d9d9d9 header cells, #c0c0c0 section bands,
// #ffff99 entry cells, Debit/(Credit) bracket convention — rendered as one
// page where each schedule opens from its own drop-down instead of a tab.
// The sheet area is deliberately a light "paper": it looks the same in dark
// mode, exactly like the document it replicates.

import { useState } from "react";
import { amountOr } from "@/lib/amount";
import {
  SAD_CAPTIONS,
  SAD_COLUMN_COUNT,
  captionColumn,
  type SadCaption,
  type SadCfRow,
  type SadDiscRow,
  type SadEntry,
  type SadView,
} from "@/lib/sad-model";

const MAIN_TYPES = ["factual", "judgmental", "projected"];
const HDR = "#d9d9d9";
const BAND = "#c0c0c0";
const YEL = "#ffff99";

const CAPTION_LABELS: Record<SadCaption, { en: string; fr: string }> = {
  current_asset: { en: "Assets Current", fr: "Actif courant" },
  non_current_asset: { en: "Assets Non-current", fr: "Actif non courant" },
  current_liability: { en: "Liabilities Current", fr: "Passif courant" },
  non_current_liability: { en: "Liabilities Non-current", fr: "Passif non courant" },
  equity: { en: "Equity components", fr: "Capitaux propres" },
  income: { en: "Income statement", fr: "Résultat" },
  expense: { en: "Income statement", fr: "Résultat" },
};

const COLS = (fr: boolean) => [
  fr ? "Actif\ncourant" : "Assets\nCurrent",
  fr ? "Actif\nnon courant" : "Assets\nNon-current",
  fr ? "Passif\ncourant" : "Liabilities\nCurrent",
  fr ? "Passif\nnon courant" : "Liabilities\nNon-current",
  fr ? "Capitaux propres" : "Equity components",
  fr ? "Effet résultat\nDébit/(Crédit)" : "Income statement\nDebit/(Credit)",
];

const QUAL_ITEMS = (fr: boolean) => [
  {
    k: "tq_1",
    text: fr
      ? "1. Anomalies non corrigées, individuellement ou en cumul, sensibles au regard des circonstances de l'entité — éléments concernés :"
      : "1. Uncorrected misstatements, individually or in the aggregate, that are sensitive in the entity's circumstances — affecting:",
    subs: fr
      ? ["a. la base de détermination du seuil de signification", "b. des montants ou sous-totaux du compte de résultat", "c. le résultat avant ou après impôt", "d. les tendances du résultat", "e. des montants du bilan, y compris le fonds de roulement", "f. les composantes du résultat global", "g. des composantes ou sous-totaux sectoriels", "h. des totaux ou postes individuels des états financiers", "i. les résultats publiés en période intermédiaire"]
      : ["a. the basis on which materiality was determined", "b. income statement amounts or subtotals", "c. pretax or after-tax income", "d. income trends", "e. balance sheet amounts, including working capital", "f. reported components of other comprehensive income", "g. reported segment components or subtotals", "h. totals or any individual financial-statement line item", "i. results reported in the interim financial statements"],
  },
  { k: "tq_2", text: fr ? "2. Anomalies non corrigées, individuellement ou en cumul, masquant un changement de tendance des résultats ou d'autres tendances." : "2. Uncorrected misstatements, individually or in the aggregate, that mask a change in earnings or other trends.", subs: [] },
  { k: "tq_3", text: fr ? "3. La revue des anomalies corrigées et non corrigées indique-t-elle un biais de la direction ?" : "3. Does our review of corrected and uncorrected misstatements indicate possible management bias?", subs: [] },
  { k: "tq_4", text: fr ? "4. La revue indique-t-elle des anomalies intentionnelles (fraude potentielle) ?" : "4. Does our review indicate intentional misstatements (possible fraud)?", subs: [] },
  { k: "tq_5", text: fr ? "5. Le total des anomalies non corrigées des exercices antérieurs a-t-il un effet significatif sur les états financiers de l'exercice ?" : "5. Does the total of prior-period uncorrected misstatements have a material effect on the current financial statements?", subs: [] },
];

function parseRows<T>(raw: string | undefined): T[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function SadWorkbook({
  engagementId,
  view,
  locale,
}: {
  engagementId: string;
  view: SadView;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const [entries, setEntries] = useState<SadEntry[]>(view.entries);
  const [meta, setMeta] = useState<Record<string, string>>(view.meta);
  const [cfRows, setCfRows] = useState<SadCfRow[]>(() => parseRows<SadCfRow>(view.meta.cf_rows));
  const [discRows, setDiscRows] = useState<SadDiscRow[]>(() => parseRows<SadDiscRow>(view.meta.disc_rows));
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ uncorrected: true });
  const [detail, setDetail] = useState<string | null>(null);

  const n = (x: number) =>
    x < 0
      ? `(${new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(x)))})`
      : new Intl.NumberFormat("fr-FR").format(Math.round(x));
  const pctf = (x: number) =>
    `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x * 100)}%`;

  async function call(body: Record<string, unknown>): Promise<boolean> {
    setError(null);
    const r = await fetch(`/api/engagements/${engagementId}/sad`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!r?.ok) setError(fr ? "Échec de l'opération." : "Operation failed.");
    return Boolean(r?.ok);
  }
  const saveMeta = (key: string, value: string) => {
    setMeta((m) => ({ ...m, [key]: value }));
    void call({ op: "saveMeta", key, value });
  };
  const saveCf = (rows: SadCfRow[]) => { setCfRows(rows); void call({ op: "saveMeta", key: "cf_rows", value: JSON.stringify(rows) }); };
  const saveDisc = (rows: SadDiscRow[]) => { setDiscRows(rows); void call({ op: "saveMeta", key: "disc_rows", value: JSON.stringify(rows) }); };
  const patch = (stepId: string, p: Partial<SadEntry>) =>
    setEntries((es) => es.map((e) => (e.stepId === stepId ? { ...e, ...p } : e)));

  // ---- partitions and totals -------------------------------------------------
  const uncorrectedE = entries.filter((e) => !e.corrected && MAIN_TYPES.includes(e.mtype));
  const correctedE = entries.filter((e) => e.corrected && MAIN_TYPES.includes(e.mtype));
  const reclassE = entries.filter((e) => e.mtype === "classification");
  const columnTotals = (list: SadEntry[]): number[] => {
    const totals = new Array<number>(SAD_COLUMN_COUNT).fill(0);
    for (const e of list) {
      totals[captionColumn(e.drCaption)] += e.drAmount;
      totals[captionColumn(e.crCaption)] -= e.crAmount;
    }
    return totals;
  };

  // ---- the tax / turnaround cascade (template rows 60–78) --------------------
  const mat = view.materiality;
  const ibt = view.incomeBeforeTax;
  const cumIS = columnTotals(uncorrectedE)[5];
  const rate = amountOr(meta.tax_rate ?? "33", 33) / 100;
  const taxEffect = -cumIS * rate;
  const afterTaxIS = cumIS + taxEffect;
  const turnF = amountOr(meta.turnaround_factual ?? "", 0);
  const turnJ = amountOr(meta.turnaround_judgmental ?? "", 0);
  const cumulative = afterTaxIS + (turnF + turnJ) * (1 - rate);
  const iat = amountOr(meta.income_after_tax ?? "", 0) || null;
  const threshold = mat ? mat.performance : null;

  // ---- shared cell styles ----------------------------------------------------
  const td = "border border-[#999] px-1.5 py-0.5 text-[11px] leading-tight text-black";
  const tdNum = `${td} text-right tnum whitespace-nowrap`;
  const inputCell = "w-full bg-transparent text-[11px] text-black outline-none";
  const yn = (v: string | undefined, key: string) => (
    <select
      value={v ?? ""}
      onChange={(e) => saveMeta(key, e.target.value)}
      className="bg-transparent text-[11px] text-black outline-none"
    >
      <option value="">—</option>
      <option value="yes">{fr ? "Oui" : "Yes"}</option>
      <option value="no">{fr ? "Non" : "No"}</option>
      <option value="na">N/A</option>
    </select>
  );

  const headerBlock = (title: string) => (
    <div className="border border-[#999] px-2 py-1" style={{ background: "#fff" }}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-[11px] text-black">
        <b className="text-[12.5px]">{title}</b>
        <span><b>{fr ? "Entité :" : "Entity:"}</b> {view.entityName}</span>
        <span><b>{fr ? "Clôture :" : "Period ended:"}</b> {view.periodEnd}</span>
        <span><b>{fr ? "Devise :" : "Currency:"}</b> XAF</span>
        <span><b>PM:</b> <span className="tnum">{mat ? n(mat.overall) : "—"}</span></span>
        <span><b>TE:</b> <span className="tnum">{mat ? n(mat.performance) : "—"}</span></span>
        <span><b>{fr ? "Nominal :" : "Nominal:"}</b> <span className="tnum">{mat ? n(mat.trivial) : "—"}</span></span>
      </div>
    </div>
  );

  // ---- an entry grid (uncorrected / corrected / reclassification) ------------
  const entryGrid = (list: SadEntry[], opts: { rationale: boolean; bands: boolean }) => {
    const cols = COLS(fr);
    const groups: { key: string; label: string; rows: SadEntry[] }[] = opts.bands
      ? [
          { key: "factual", label: fr ? "Anomalies avérées :" : "Factual misstatements:", rows: list.filter((e) => e.mtype === "factual") },
          { key: "judgmental", label: fr ? "Anomalies de jugement :" : "Judgmental misstatements:", rows: list.filter((e) => e.mtype === "judgmental") },
          { key: "projected", label: fr ? "Anomalies extrapolées :" : "Projected misstatements:", rows: list.filter((e) => e.mtype === "projected") },
        ]
      : [{ key: "all", label: "", rows: list }];
    const totals = columnTotals(list);
    const fsc = view.fsCaptions;
    const span = 3 + SAD_COLUMN_COUNT + (opts.rationale ? 1 : 0);
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse">
          <thead>
            <tr>
              <th className={td} style={{ background: HDR, width: 34 }}><b>No.</b></th>
              <th className={td} style={{ background: HDR, width: 64 }}><b>{fr ? "Réf." : "W/P ref."}</b></th>
              <th className={td} style={{ background: HDR, minWidth: 220 }}><b>{fr ? "Compte / description" : "Account / description"}</b></th>
              {cols.map((c) => (
                <th key={c} className={td} style={{ background: HDR, width: 96 }}>
                  <b className="whitespace-pre-line">{c}</b>
                  <div className="text-[9.5px] font-normal">{fr ? "Débit/(Crédit)" : "Debit/(Credit)"}</div>
                </th>
              ))}
              {opts.rationale ? <th className={td} style={{ background: HDR, minWidth: 160 }}><b>{fr ? "Justification" : "Rationale"}</b></th> : null}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <FragmentRows key={g.key}>
                {g.label ? (
                  <tr>
                    <td className={td} colSpan={span} style={{ background: BAND }}><b>{g.label}</b></td>
                  </tr>
                ) : null}
                {g.rows.length === 0 && g.label ? (
                  <tr><td className={`${td} italic text-[#666]`} colSpan={span}>{fr ? "Aucune" : "None"}</td></tr>
                ) : null}
                {g.rows.map((e, i) => {
                  const no = i + 1;
                  const dCol = captionColumn(e.drCaption);
                  const cCol = captionColumn(e.crCaption);
                  const line = (which: "dr" | "cr") => {
                    const col = which === "dr" ? dCol : cCol;
                    const amount = which === "dr" ? e.drAmount : -e.crAmount;
                    const account = which === "dr" ? e.drAccount : e.crAccount;
                    return (
                      <tr key={`${e.stepId}-${which}`}>
                        <td className={td} style={{ background: YEL }}>{no}</td>
                        <td className={td} style={{ background: YEL }}>
                          <a href={`/engagements/${engagementId}/sections/${e.taskItemId}`} className="text-[#0b4f9c] underline">{e.ref || e.taskCode}</a>
                        </td>
                        <td className={td} style={{ background: YEL }}>
                          {account}
                          <span className="ml-1 text-[9.5px] text-[#666]">
                            {fr ? CAPTION_LABELS[which === "dr" ? e.drCaption : e.crCaption].fr : CAPTION_LABELS[which === "dr" ? e.drCaption : e.crCaption].en}
                          </span>
                        </td>
                        {Array.from({ length: SAD_COLUMN_COUNT }, (_, c) => (
                          <td key={c} className={tdNum} style={{ background: YEL }}>{c === col ? n(amount) : ""}</td>
                        ))}
                        {opts.rationale ? <td className={td} style={{ background: YEL }} /> : null}
                      </tr>
                    );
                  };
                  return (
                    <FragmentRows key={e.stepId}>
                      <tr className="cursor-pointer" onClick={() => setDetail(detail === e.stepId ? null : e.stepId)} data-testid={`sad-entry-${e.stepId}`}>
                        <td className={td} style={{ background: YEL }}><b>{no}</b></td>
                        <td className={td} style={{ background: YEL }}>
                          <a href={`/engagements/${engagementId}/sections/${e.taskItemId}`} className="text-[#0b4f9c] underline" onClick={(ev) => ev.stopPropagation()}>{e.taskCode}</a>
                        </td>
                        <td className={td} style={{ background: YEL }} colSpan={SAD_COLUMN_COUNT + 1}>
                          <b>{e.finding || e.taskTitle}</b>
                          <span className="ml-2 text-[9.5px] text-[#666]">{e.mtype}{e.posted ? (fr ? " · portée au registre" : " · posted") : ""} ▾</span>
                        </td>
                        {opts.rationale ? (
                          <td className={td} style={{ background: YEL }}>
                            <input
                              defaultValue={e.rationale}
                              onBlur={(ev) => { if (ev.target.value !== e.rationale) { patch(e.stepId, { rationale: ev.target.value }); void call({ op: "save", stepId: e.stepId, field: "rationale", value: ev.target.value }); } }}
                              className={inputCell}
                            />
                          </td>
                        ) : null}
                      </tr>
                      {line("dr")}
                      {line("cr")}
                      {detail === e.stepId ? (
                        <tr>
                          <td className={td} colSpan={span} style={{ background: "#f5f5f5" }}>
                            <span className="flex flex-wrap items-center gap-3 py-0.5 text-[11px] text-black">
                              <label>Dr:{" "}
                                <select value={e.drCaption} onChange={(ev) => { patch(e.stepId, { drCaption: ev.target.value as SadCaption }); void call({ op: "save", stepId: e.stepId, field: "drcap", value: ev.target.value }); }} className="bg-white text-[11px] outline-none">
                                  {SAD_CAPTIONS.map((c) => <option key={c} value={c}>{fr ? CAPTION_LABELS[c].fr : CAPTION_LABELS[c].en}</option>)}
                                </select>
                              </label>
                              <label>Cr:{" "}
                                <select value={e.crCaption} onChange={(ev) => { patch(e.stepId, { crCaption: ev.target.value as SadCaption }); void call({ op: "save", stepId: e.stepId, field: "crcap", value: ev.target.value }); }} className="bg-white text-[11px] outline-none">
                                  {SAD_CAPTIONS.map((c) => <option key={c} value={c}>{fr ? CAPTION_LABELS[c].fr : CAPTION_LABELS[c].en}</option>)}
                                </select>
                              </label>
                              <label>
                                <input type="checkbox" checked={e.corrected} onChange={(ev) => { patch(e.stepId, { corrected: ev.target.checked }); void call({ op: "save", stepId: e.stepId, field: "corrected", value: ev.target.checked ? "1" : "" }); }} />{" "}
                                {fr ? "Corrigée par l'entité" : "Corrected by the entity"}
                              </label>
                              {!e.posted ? (
                                <button type="button" className="font-semibold text-emerald-800 underline" onClick={() => { void call({ op: "post", stepId: e.stepId }).then((ok) => ok && patch(e.stepId, { posted: true })); }}>
                                  {fr ? "Porter au registre C1.1" : "Post to the C1.1 register"}
                                </button>
                              ) : null}
                            </span>
                          </td>
                        </tr>
                      ) : null}
                    </FragmentRows>
                  );
                })}
              </FragmentRows>
            ))}
            <tr>
              <td className={`${td} font-bold`} colSpan={3} style={{ borderTop: "3px double #000" }}>{fr ? "Total" : "Total"}</td>
              {totals.map((t, i) => (
                <td key={i} className={`${tdNum} font-bold`} style={{ borderTop: "3px double #000" }}>{n(t)}</td>
              ))}
              {opts.rationale ? <td className={td} style={{ borderTop: "3px double #000" }} /> : null}
            </tr>
            <tr>
              <td className={td} colSpan={3}><b>{fr ? "Montants des états financiers" : "Financial statement amounts"}</b></td>
              {Array.from({ length: SAD_COLUMN_COUNT }, (_, i) => (
                <td key={i} className={tdNum}>{fsc ? n(fsc[i] ?? 0) : "—"}</td>
              ))}
              {opts.rationale ? <td className={td} /> : null}
            </tr>
            <tr>
              <td className={td} colSpan={3}><b>{fr ? "Effet des anomalies (en % des états financiers)" : "Effect of misstatements as a % of financial statement amounts"}</b></td>
              {Array.from({ length: SAD_COLUMN_COUNT }, (_, i) => (
                <td key={i} className={tdNum}>{fsc && fsc[i] ? pctf(totals[i] / fsc[i]) : "—"}</td>
              ))}
              {opts.rationale ? <td className={td} /> : null}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const metaNum = (key: string, testId?: string) => (
    <input
      defaultValue={meta[key] ?? ""}
      onBlur={(e) => { if (e.target.value !== (meta[key] ?? "")) saveMeta(key, e.target.value); }}
      className={`${inputCell} text-right`}
      style={{ background: YEL }}
      data-testid={testId}
    />
  );

  const section = (key: string, title: string, body: React.ReactNode) => (
    <div className="border border-[#999]" data-testid={`sad-section-${key}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
        className="flex w-full items-center justify-between px-2.5 py-1.5 text-left"
        style={{ background: HDR }}
        data-testid={`sad-open-${key}`}
      >
        <b className="text-[12.5px] text-black">{title}</b>
        <span className="text-[11px] text-black">{open[key] ? "▾" : "▸"}</span>
      </button>
      {open[key] ? <div className="flex flex-col gap-2 p-2">{body}</div> : null}
    </div>
  );

  return (
    <div className="rounded-[var(--radius-atlas-sm)] bg-white p-3 text-black shadow-atlas-sm" data-testid="sad-workbook">
      {error ? <p className="mb-2 text-[12px] font-bold text-red-700">{error}</p> : null}
      <div className="flex flex-col gap-3">
        {section("uncorrected", fr ? "Récapitulatif des anomalies non corrigées" : "Summary of uncorrected misstatements", (
          <>
            {headerBlock(fr ? "Récapitulatif des anomalies non corrigées" : "Summary of uncorrected misstatements")}
            {entryGrid(uncorrectedE, { rationale: false, bands: true })}
            <table className="w-full max-w-[760px] border-collapse self-end">
              <tbody>
                <tr><td className={td}><b>{fr ? "Anomalies non corrigées avant impôt" : "Uncorrected misstatements before tax"}</b></td><td className={tdNum}>{n(cumIS)}</td></tr>
                <tr>
                  <td className={td}><b>{fr ? "Moins : effet d'impôt (taux %)" : "Less: tax effect of misstatements (rate %)"}</b>{" "}
                    <input defaultValue={meta.tax_rate ?? "33"} onBlur={(e) => saveMeta("tax_rate", e.target.value)} className="w-12 text-right text-[11px] outline-none" style={{ background: YEL }} />
                  </td>
                  <td className={tdNum}>{n(taxEffect)}</td>
                </tr>
                <tr><td className={td}><b>{fr ? "Anomalies non corrigées en résultat après impôt" : "Uncorrected misstatements in income after tax"}</b></td><td className={tdNum} style={{ borderTop: "3px double #000" }}>{n(afterTaxIS)}</td></tr>
                <tr>
                  <td className={td}>{fr ? "Effet de retournement N-1 — avérées et extrapolées (avant impôt)" : "Turnaround effect of prior period — factual and projected (before tax)"}</td>
                  <td className={tdNum} style={{ width: 130 }}>{metaNum("turnaround_factual")}</td>
                </tr>
                <tr>
                  <td className={td}>{fr ? "Effet de retournement N-1 — de jugement (avant impôt, note 2)" : "Turnaround effect of prior period — judgmental (before tax, Note 2)"}</td>
                  <td className={tdNum}>{metaNum("turnaround_judgmental")}</td>
                </tr>
                <tr><td className={td}><b>{fr ? "Effet cumulé des anomalies non corrigées (après impôt)" : "Cumulative effect of uncorrected misstatements (after tax)"}</b></td><td className={`${tdNum} font-bold`} style={{ borderTop: "3px double #000" }}>{n(cumulative)}</td></tr>
                <tr><td className={td}>{fr ? "Résultat de l'exercice avant impôt" : "Current year income before tax"}</td><td className={tdNum}>{ibt !== null ? n(ibt) : "—"}</td></tr>
                <tr>
                  <td className={td}>{fr ? "Résultat de l'exercice après impôt" : "Current year income after tax"}</td>
                  <td className={tdNum}>{metaNum("income_after_tax")}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-[10px] leading-snug text-[#444]">
              {fr
                ? "(Note 1) Débit/(Crédit) par rubrique, selon la convention du modèle. (Note 2) Les anomalies de jugement de l'exercice précédent ne se retournent pas toutes ; documenter le raisonnement."
                : "(Note 1) Debit/(Credit) per caption, per the template convention. (Note 2) Not all of the prior period's judgmental misstatements turn around; document the reasoning."}
            </p>
          </>
        ))}

        {section("corrected", fr ? "Récapitulatif des anomalies corrigées" : "Summary of corrected misstatements", (
          <>
            {headerBlock(fr ? "Récapitulatif des anomalies corrigées" : "Summary of corrected misstatements")}
            {entryGrid(correctedE, { rationale: true, bands: true })}
          </>
        ))}

        {section("conclusion", fr ? "Conclusion du récapitulatif des anomalies" : "Summary of audit differences conclusion", (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr>
                    <th className={td} style={{ background: HDR, minWidth: 260 }} />
                    <th className={td} colSpan={2} style={{ background: HDR }}><b>{fr ? "Avant impôt" : "Before tax"}</b></th>
                    <th className={td} colSpan={2} style={{ background: HDR }}><b>{fr ? "Après impôt" : "After tax"}</b></th>
                  </tr>
                  <tr>
                    <th className={td} style={{ background: HDR }} />
                    <th className={td} style={{ background: HDR }}>{fr ? "Avant retournement" : "Before turnaround"}</th>
                    <th className={td} style={{ background: HDR }}>{fr ? "Après retournement" : "After turnaround"}</th>
                    <th className={td} style={{ background: HDR }}>{fr ? "Avant retournement" : "Before turnaround"}</th>
                    <th className={td} style={{ background: HDR }}>{fr ? "Après retournement" : "After turnaround"}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={td}><b>{fr ? "Effet cumulé sur le résultat des anomalies non corrigées" : "Cumulative income effect of uncorrected misstatements"}</b></td>
                    <td className={tdNum}>{n(cumIS)}</td>
                    <td className={tdNum}>{n(cumIS + turnF + turnJ)}</td>
                    <td className={tdNum}>{n(afterTaxIS)}</td>
                    <td className={tdNum}>{n(cumulative)}</td>
                  </tr>
                  <tr>
                    <td className={td}>{fr ? "Résultat de l'exercice (avant / après impôt)" : "Current year income (before / after tax)"}</td>
                    <td className={tdNum} colSpan={2}>{ibt !== null ? n(ibt) : "—"}</td>
                    <td className={tdNum} colSpan={2}>{iat !== null ? n(iat) : "—"}</td>
                  </tr>
                  <tr>
                    <td className={td}>{fr ? "Anomalies en % du résultat" : "Misstatements as a percentage of income"}</td>
                    <td className={tdNum}>{ibt ? pctf(cumIS / ibt) : "—"}</td>
                    <td className={tdNum}>{ibt ? pctf((cumIS + turnF + turnJ) / ibt) : "—"}</td>
                    <td className={tdNum}>{iat ? pctf(afterTaxIS / iat) : "—"}</td>
                    <td className={tdNum}>{iat ? pctf(cumulative / iat) : "—"}</td>
                  </tr>
                  <tr><td className={td}>{fr ? "Seuil de signification (PM)" : "Planning materiality"}</td><td className={tdNum} colSpan={4}>{mat ? n(mat.overall) : "—"}</td></tr>
                  <tr><td className={td}>{fr ? "Seuil des anomalies non corrigées (TE)" : "Uncorrected Misstatements Threshold (TE)"}</td><td className={tdNum} colSpan={4}>{threshold !== null ? n(threshold) : "—"}</td></tr>
                  <tr>
                    <td className={td} style={{ background: HDR }}><b>{fr ? "Les anomalies non corrigées dépassent-elles le seuil ?" : "Do uncorrected misstatements exceed the threshold?"}</b></td>
                    {[cumIS, cumIS + turnF + turnJ, afterTaxIS, cumulative].map((v, i) => (
                      <td key={i} className={`${tdNum} font-bold`} style={{ background: threshold !== null && Math.abs(v) > threshold ? "#ffc0c0" : "#c6efce" }}>
                        {threshold === null ? "—" : Math.abs(v) > threshold ? (fr ? "Oui" : "Yes") : fr ? "Non" : "No"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11.5px] font-bold text-black">{fr ? "Nous avons pris en considération les facteurs qualitatifs suivants :" : "We considered the following qualitative factors:"}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr>
                    <th className={td} style={{ background: HDR }}><b>{fr ? "Facteur" : "Factor"}</b></th>
                    <th className={td} style={{ background: HDR, width: 90 }}><b>{fr ? "Oui/Non/N-A" : "Yes/No/N/A"}</b></th>
                    <th className={td} style={{ background: HDR, minWidth: 200 }}><b>{fr ? "Commentaires (requis si « Oui »)" : "Comments (required if any \"Yes\")"}</b></th>
                  </tr>
                </thead>
                <tbody>
                  {QUAL_ITEMS(fr).map((q) => (
                    <tr key={q.k}>
                      <td className={td}>
                        {q.text}
                        {q.subs.length > 0 ? (
                          <ul className="mt-0.5 list-none pl-4 text-[10px] text-[#444]">
                            {q.subs.map((s2) => <li key={s2}>{s2}</li>)}
                          </ul>
                        ) : null}
                      </td>
                      <td className={td} style={{ background: YEL }}>{yn(meta[q.k], q.k)}</td>
                      <td className={td} style={{ background: YEL }}>
                        <input defaultValue={meta[`${q.k}c`] ?? ""} onBlur={(e) => saveMeta(`${q.k}c`, e.target.value)} className={inputCell} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="text-[11.5px] font-bold text-black">{fr ? "Conclusion" : "Conclusion"}</p>
              <textarea
                defaultValue={meta.concl_text ?? ""}
                onBlur={(e) => { if (e.target.value !== (meta.concl_text ?? "")) saveMeta("concl_text", e.target.value); }}
                rows={3}
                className="mt-1 w-full border border-[#999] px-2 py-1 text-[11.5px] text-black outline-none"
                style={{ background: YEL }}
                data-testid="sad-conclusion-text"
              />
            </div>
          </>
        ))}

        {section("reclass", fr ? "Récapitulatif des reclassements" : "Reclassification misstatements summary", (
          <>
            {headerBlock(fr ? "Récapitulatif des reclassements" : "Reclassification misstatements summary")}
            <p className="text-[10.5px] text-[#444]">
              {fr
                ? "Les reclassements non corrigés sont accumulés ici ; documenter la justification si le reclassement n'est pas corrigé (note 1 du modèle)."
                : "We accumulate reclassification misstatements here; document your rationale if the reclassification is not corrected (template Note 1)."}
            </p>
            {entryGrid(reclassE, { rationale: true, bands: false })}
          </>
        ))}

        {section("cashflow", fr ? "Anomalies du tableau des flux de trésorerie" : "Cash flow misstatements schedule", (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr>
                  {["No.", fr ? "Réf." : "W/P ref.", fr ? "Ligne du tableau des flux" : "Statement of cash flows line", fr ? "Flux opérationnels" : "Operating cash flows", fr ? "Flux d'investissement" : "Investing cash flows", fr ? "Flux de financement" : "Financing cash flows", fr ? "Évaluation et conclusion" : "Evaluation and conclusion"].map((h) => (
                    <th key={h} className={td} style={{ background: HDR }}><b>{h}</b></th>
                  ))}
                  <th className={td} style={{ background: HDR, width: 30 }} />
                </tr>
              </thead>
              <tbody>
                {cfRows.map((r, i) => (
                  <tr key={i}>
                    {(["no", "ref", "line", "operating", "investing", "financing", "evaluation"] as const).map((f) => (
                      <td key={f} className={f === "operating" || f === "investing" || f === "financing" ? tdNum : td} style={{ background: YEL }}>
                        <input
                          defaultValue={r[f]}
                          onBlur={(e) => { const rows = cfRows.map((x, j) => (j === i ? { ...x, [f]: e.target.value } : x)); saveCf(rows); }}
                          className={`${inputCell} ${f === "operating" || f === "investing" || f === "financing" ? "text-right" : ""}`}
                        />
                      </td>
                    ))}
                    <td className={td}><button type="button" onClick={() => saveCf(cfRows.filter((_, j) => j !== i))} className="text-[#666] hover:text-red-700">×</button></td>
                  </tr>
                ))}
                <tr>
                  <td className={`${td} font-bold`} colSpan={3} style={{ borderTop: "3px double #000" }}>{fr ? "Total des anomalies non corrigées des flux" : "Total of uncorrected cash flow misstatements"}</td>
                  {(["operating", "investing", "financing"] as const).map((f) => (
                    <td key={f} className={`${tdNum} font-bold`} style={{ borderTop: "3px double #000" }}>
                      {n(cfRows.reduce((a, r) => a + amountOr(r[f], 0), 0))}
                    </td>
                  ))}
                  <td className={td} colSpan={2} style={{ borderTop: "3px double #000" }} />
                </tr>
              </tbody>
            </table>
            <button type="button" onClick={() => saveCf([...cfRows, { no: String(cfRows.length + 1), ref: "", line: "", operating: "", investing: "", financing: "", evaluation: "" }])} className="mt-1.5 border border-[#999] px-2 py-0.5 text-[11px] font-semibold text-black hover:bg-[#eee]">
              + {fr ? "Ajouter une ligne" : "Add a row"}
            </button>
          </div>
        ))}

        {section("disclosures", fr ? "Anomalies dans les informations annexes" : "Schedule of misstatements in disclosures", (
          <div className="overflow-x-auto">
            {([false, true] as const).map((corrected) => (
              <div key={String(corrected)} className="mb-2">
                <div className={td} style={{ background: BAND }}>
                  <b>{corrected ? (fr ? "Anomalies corrigées dans les annexes" : "Corrected misstatements in disclosures") : fr ? "Anomalies non corrigées dans les annexes" : "Uncorrected misstatements in disclosures"}</b>
                </div>
                <table className="w-full min-w-[820px] border-collapse">
                  <thead>
                    <tr>
                      {["No.", fr ? "Réf. note" : "FN reference", fr ? "Description de l'anomalie" : "Description of misstatement in disclosure", fr ? "Référence normative" : "Authoritative guidance reference", fr ? "Évaluation et conclusion" : "Evaluation of and conclusion on the misstatement"].map((h) => (
                        <th key={h} className={td} style={{ background: HDR }}><b>{h}</b></th>
                      ))}
                      <th className={td} style={{ background: HDR, width: 30 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {discRows.map((r, i) => ({ r, i })).filter(({ r }) => Boolean(r.corrected) === corrected).map(({ r, i }) => (
                      <tr key={i}>
                        {(["no", "fn", "description", "guidance", "evaluation"] as const).map((f) => (
                          <td key={f} className={td} style={{ background: YEL }}>
                            <input
                              defaultValue={r[f]}
                              onBlur={(e) => { const rows = discRows.map((x, j) => (j === i ? { ...x, [f]: e.target.value } : x)); saveDisc(rows); }}
                              className={inputCell}
                            />
                          </td>
                        ))}
                        <td className={td}><button type="button" onClick={() => saveDisc(discRows.filter((_, j) => j !== i))} className="text-[#666] hover:text-red-700">×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  onClick={() => saveDisc([...discRows, { no: String(discRows.length + 1), fn: "", description: "", guidance: "", evaluation: "", corrected }])}
                  className="mt-1 border border-[#999] px-2 py-0.5 text-[11px] font-semibold text-black hover:bg-[#eee]"
                >
                  + {fr ? "Ajouter une ligne" : "Add a row"}
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** React fragments keyed inside <tbody> (a plain <>…</> cannot carry a key). */
function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
