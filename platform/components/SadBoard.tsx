"use client";

// The Summary of Audit Differences as the six-tab workbook, on one page:
// uncorrected / corrected / conclusion / reclassification / cash-flow /
// disclosure misstatements, each an expandable section. Auto sections are fed
// by the adjustments proposed on the substantive working papers (each block
// keeps the link back to its paper); cash-flow and disclosure rows are manual.

import { Fragment, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  SAD_CAPTIONS,
  SAD_COLUMN_COUNT,
  SAD_QUAL_FACTORS,
  SAD_TYPES,
  captionColumn,
  type SadCaption,
  type SadCfRow,
  type SadDiscRow,
  type SadEntry,
  type SadView,
} from "@/lib/sad-model";
import { Chip, Panel } from "@/components/ui/atlas";

const CAPTION_LABELS: Record<SadCaption, { en: string; fr: string }> = {
  current_asset: { en: "Current asset", fr: "Actif circulant" },
  non_current_asset: { en: "Non-current asset", fr: "Actif immobilisé" },
  current_liability: { en: "Current liability", fr: "Passif circulant" },
  non_current_liability: { en: "Non-current liability", fr: "Dettes financières" },
  equity: { en: "Equity", fr: "Capitaux propres" },
  income: { en: "Income", fr: "Produits" },
  expense: { en: "Expenses", fr: "Charges" },
};

const TYPE_LABELS: Record<string, { en: string; fr: string }> = {
  factual: { en: "Factual", fr: "Avérée" },
  judgmental: { en: "Judgmental", fr: "De jugement" },
  projected: { en: "Projected", fr: "Extrapolée" },
  classification: { en: "Reclassification", fr: "Reclassement" },
  disclosure: { en: "Disclosure", fr: "Information" },
};

/** The six caption-grid columns, workbook order. */
const COLUMN_LABELS: { en: string; fr: string }[] = [
  { en: "Assets — current", fr: "Actif circulant" },
  { en: "Assets — non-current", fr: "Actif immobilisé" },
  { en: "Liabilities — current", fr: "Passif circulant" },
  { en: "Liabilities — non-current", fr: "Dettes financières" },
  { en: "Equity", fr: "Capitaux propres" },
  { en: "Income statement (current period)", fr: "Compte de résultat (exercice)" },
];

// Qualitative factors per ISA 450 ¶A21 — original wording, (a)–(h).
const QUAL_FACTOR_TEXT: Record<string, { en: string; fr: string }> = {
  sensitivity: {
    en: "The misstatement is sensitive relative to the basis used to set materiality (e.g. a regulated figure or key ratio).",
    fr: "L'anomalie est sensible par rapport à la base retenue pour fixer le seuil de signification (p. ex. un chiffre réglementé ou un ratio clé).",
  },
  subtotals: {
    en: "It moves an income-statement subtotal or alters the reported earnings trend.",
    fr: "Elle modifie un sous-total du compte de résultat ou infléchit la tendance des résultats publiés.",
  },
  balance_sheet: {
    en: "It affects balance-sheet amounts, their classification, or working capital.",
    fr: "Elle affecte des postes du bilan, leur classement ou le fonds de roulement.",
  },
  covenants: {
    en: "It bears on compliance with loan covenants, regulatory requirements or other contractual terms.",
    fr: "Elle a une incidence sur le respect de clauses d'emprunt, d'exigences réglementaires ou d'autres engagements contractuels.",
  },
  loss_reversal: {
    en: "It turns a reported loss into income, or income into a loss.",
    fr: "Elle transforme une perte en bénéfice, ou un bénéfice en perte.",
  },
  segments: {
    en: "It affects segment or component information significant to the entity's operations.",
    fr: "Elle affecte une information sectorielle ou par composant significative pour l'activité de l'entité.",
  },
  trend_mask: {
    en: "It conceals a change in earnings or masks an unfavourable trend.",
    fr: "Elle dissimule une évolution du résultat ou masque une tendance défavorable.",
  },
  bias: {
    en: "It may indicate possible management bias in estimates or accounting choices.",
    fr: "Elle peut révéler un parti pris possible de la direction dans les estimations ou les choix comptables.",
  },
};

const MAIN_TYPES = ["factual", "judgmental", "projected"];

const parseRows = <T,>(json: string | undefined): T[] => {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
};

export function SadBoard({
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ uncorrected: true });
  const [meta, setMeta] = useState<Record<string, string>>(view.meta);
  const [cfRows, setCfRows] = useState<SadCfRow[]>(() => parseRows<SadCfRow>(view.meta.cf_rows));
  const [discRows, setDiscRows] = useState<SadDiscRow[]>(() => parseRows<SadDiscRow>(view.meta.disc_rows));

  const n = (x: number) => new Intl.NumberFormat("fr-FR").format(Math.round(x));
  const pct1 = (x: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(x)} %`;
  const amt = (v: string): number => {
    const x = Number(String(v).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(x) ? x : 0;
  };
  const label = "text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const select = "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-1 py-0.5 text-[11.3px] text-ink outline-none focus:border-emerald-600";
  const input = "w-full rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-1.5 py-1 text-[11.8px] text-ink outline-none focus:border-emerald-600";
  const backParam = encodeURIComponent(`/engagements/${engagementId}/tools/sad`);

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

  const saveMeta = (key: string, value: string) => call({ op: "saveMeta", key, value });

  function patch(stepId: string, p: Partial<SadEntry>) {
    setEntries((es) => es.map((e) => (e.stepId === stepId ? { ...e, ...p } : e)));
  }

  // --- entry partitions per tab ---
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

  // --- conclusion figures ---
  const cumIS = columnTotals(uncorrectedE)[5];
  const ibt = view.incomeBeforeTax;
  const isPct = ibt !== null && ibt !== 0 ? (cumIS / ibt) * 100 : null;
  const mat = view.materiality;
  const umt = mat ? mat.overall - mat.performance : null;
  const exceeds = mat && umt !== null ? Math.abs(cumIS) > umt : null;

  // roll-up (kept from the flat board, now inside the conclusion section)
  const allUncorrected = entries.filter((e) => !e.corrected);
  const totalUncorrected = allUncorrected.reduce((a, e) => a + Math.max(Math.abs(e.drAmount), Math.abs(e.crAmount)), 0);
  const byCaption = new Map<SadCaption, number>();
  for (const e of allUncorrected) {
    const a = Math.max(Math.abs(e.drAmount), Math.abs(e.crAmount));
    byCaption.set(e.drCaption, (byCaption.get(e.drCaption) ?? 0) + a);
    byCaption.set(e.crCaption, (byCaption.get(e.crCaption) ?? 0) - a);
  }

  // ---------- shared block grid (uncorrected / corrected / reclass) ----------
  function entryControls(e: SadEntry, showRationale: boolean) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-1">
          <span className={label}>{fr ? "Débit" : "Dr"}</span>
          <select
            value={e.drCaption}
            onChange={(ev) => { patch(e.stepId, { drCaption: ev.target.value as SadCaption, drSuggested: false }); void call({ op: "save", stepId: e.stepId, field: "drcap", value: ev.target.value }); }}
            className={select}
            data-testid={`sad-drcap-${e.stepId}`}
          >
            {SAD_CAPTIONS.map((c) => (
              <option key={c} value={c}>{(fr ? CAPTION_LABELS[c].fr : CAPTION_LABELS[c].en) + (e.drSuggested && c === e.drCaption ? " (sugg.)" : "")}</option>
            ))}
          </select>
        </span>
        <span className="flex items-center gap-1">
          <span className={label}>{fr ? "Crédit" : "Cr"}</span>
          <select
            value={e.crCaption}
            onChange={(ev) => { patch(e.stepId, { crCaption: ev.target.value as SadCaption, crSuggested: false }); void call({ op: "save", stepId: e.stepId, field: "crcap", value: ev.target.value }); }}
            className={select}
            data-testid={`sad-crcap-${e.stepId}`}
          >
            {SAD_CAPTIONS.map((c) => (
              <option key={c} value={c}>{(fr ? CAPTION_LABELS[c].fr : CAPTION_LABELS[c].en) + (e.crSuggested && c === e.crCaption ? " (sugg.)" : "")}</option>
            ))}
          </select>
        </span>
        <span className="flex items-center gap-1">
          <span className={label}>{fr ? "Nature" : "Type"}</span>
          <select
            value={e.mtype}
            onChange={(ev) => { patch(e.stepId, { mtype: ev.target.value }); void call({ op: "save", stepId: e.stepId, field: "mtype", value: ev.target.value }); }}
            className={select}
            data-testid={`sad-type-${e.stepId}`}
          >
            {SAD_TYPES.map((t) => (
              <option key={t} value={t}>{fr ? TYPE_LABELS[t].fr : TYPE_LABELS[t].en}</option>
            ))}
          </select>
        </span>
        <label className="flex items-center gap-1.5 text-[11.3px] text-ink-soft">
          <input
            type="checkbox"
            checked={e.corrected}
            onChange={(ev) => { patch(e.stepId, { corrected: ev.target.checked }); void call({ op: "save", stepId: e.stepId, field: "corrected", value: ev.target.checked ? "yes" : "no" }); }}
            className="h-4 w-4 accent-emerald-700"
            data-testid={`sad-corrected-${e.stepId}`}
          />
          {fr ? "Corrigée" : "Corrected"}
        </label>
        <button
          type="button"
          disabled={busy === e.stepId}
          onClick={async () => { setBusy(e.stepId); if (await call({ op: "post", stepId: e.stepId })) patch(e.stepId, { posted: true }); setBusy(null); }}
          className={e.posted
            ? "text-[10.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            : "rounded-[var(--radius-atlas-sm)] border border-emerald-700 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-700 hover:text-white dark:text-emerald-400"}
          title={e.posted ? (fr ? "Reporté — cliquer pour mettre à jour" : "Posted — click to update") : undefined}
          data-testid={`sad-post-${e.stepId}`}
        >
          {e.posted ? <Chip tone="good">{fr ? "Reportée ↻" : "Posted ↻"}</Chip> : (fr ? "Reporter" : "Post")}
        </button>
        {showRationale ? (
          <span className="flex min-w-[260px] flex-1 items-center gap-1.5">
            <span className={label}>{fr ? "Justification" : "Rationale"}</span>
            <input
              type="text"
              defaultValue={e.rationale}
              placeholder={fr ? "Justification de la correction / inclusion" : "Rationale for correction / inclusion"}
              onBlur={(ev) => { if (ev.target.value !== e.rationale) { patch(e.stepId, { rationale: ev.target.value }); void call({ op: "save", stepId: e.stepId, field: "rationale", value: ev.target.value }); } }}
              className={input}
              spellCheck={false}
              data-testid={`sad-rationale-${e.stepId}`}
            />
          </span>
        ) : null}
      </div>
    );
  }

  function captionGrid(
    groups: { label: string | null; entries: SadEntry[] }[],
    showRationale: boolean,
    testPrefix: string,
  ) {
    const all = groups.flatMap((g) => g.entries);
    if (all.length === 0) {
      return (
        <p className="px-1 py-4 text-[12px] text-muted" data-testid={`${testPrefix}-empty`}>
          {fr ? "Aucune anomalie dans cette section." : "No misstatements in this section."}
        </p>
      );
    }
    const totals = columnTotals(all);
    let no = 0;
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px]" data-testid={`${testPrefix}-table`}>
          <thead>
            <tr>
              <th className={`${label} min-w-[240px] px-2 py-1.5 text-left`}>{fr ? "Écriture" : "Journal line"}</th>
              {COLUMN_LABELS.map((c, i) => (
                <th key={i} className={`${label} min-w-[110px] px-2 py-1.5 text-right`}>{fr ? c.fr : c.en}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group, gi) => (
              <Fragment key={gi}>
                {group.label ? (
                  <tr className="border-t border-line bg-surface-2">
                    <td colSpan={1 + SAD_COLUMN_COUNT} className={`${label} px-2 py-1.5`}>{group.label}</td>
                  </tr>
                ) : null}
                {group.entries.map((e) => {
                  no += 1;
                  const drCol = captionColumn(e.drCaption);
                  const crCol = captionColumn(e.crCaption);
                  return (
                    <Fragment key={e.stepId}>
                      <tr className="border-t border-line" data-testid={`sad-${e.stepId}`}>
                        <td colSpan={1 + SAD_COLUMN_COUNT} className="px-2 pb-0.5 pt-2.5">
                          <span className="mr-2 text-[11px] font-extrabold text-muted tnum">{fr ? "N°" : "No."} {no}</span>
                          <Link
                            href={`/engagements/${engagementId}/sections/${e.taskItemId}?back=${backParam}`}
                            className="mr-2 font-mono text-[11.5px] font-extrabold text-emerald-700 hover:underline dark:text-emerald-400"
                            title={e.taskTitle}
                            data-testid={`sad-open-${e.stepId}`}
                          >
                            {e.ref}
                          </Link>
                          <span className="text-[11.8px] text-ink-soft">
                            {e.finding || <span className="italic text-muted">{fr ? "sans description" : "no description"}</span>}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-2 py-0.5 text-[11.8px] font-semibold text-ink">
                          <span className="mr-1.5 text-[10px] font-extrabold uppercase text-muted">{fr ? "Débit" : "Dr"}</span>
                          <span className="tnum">{e.drAccount || "—"}</span>
                        </td>
                        {COLUMN_LABELS.map((_, i) => (
                          <td key={i} className="px-2 py-0.5 text-right text-[11.8px] text-ink tnum">
                            {i === drCol && e.drAmount ? n(e.drAmount) : ""}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-2 py-0.5 text-[11.8px] font-semibold text-ink">
                          <span className="mr-1.5 text-[10px] font-extrabold uppercase text-muted">{fr ? "Crédit" : "Cr"}</span>
                          <span className="tnum">{e.crAccount || "—"}</span>
                        </td>
                        {COLUMN_LABELS.map((_, i) => (
                          <td key={i} className="px-2 py-0.5 text-right text-[11.8px] text-ink tnum">
                            {i === crCol && e.crAmount ? n(-e.crAmount) : ""}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td colSpan={1 + SAD_COLUMN_COUNT} className="px-2 pb-2.5 pt-1">
                          {entryControls(e, showRationale)}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line-strong">
              <td className="px-2 py-1.5 text-[11.8px] font-bold text-ink">{fr ? "Total" : "Total"}</td>
              {totals.map((t, i) => (
                <td key={i} className="px-2 py-1.5 text-right text-[11.8px] font-bold text-ink tnum">{t !== 0 ? n(t) : "—"}</td>
              ))}
            </tr>
            <tr className="border-t border-line">
              <td className="px-2 py-1.5 text-[11.3px] text-ink-soft">{fr ? "Montants des états financiers" : "Financial statement amounts"}</td>
              {COLUMN_LABELS.map((_, i) => (
                <td key={i} className="px-2 py-1.5 text-right text-[11.3px] text-ink-soft tnum">
                  {view.fsCaptions ? n(view.fsCaptions[i]) : "—"}
                </td>
              ))}
            </tr>
            <tr className="border-t border-line">
              <td className="px-2 py-1.5 text-[11.3px] text-ink-soft">{fr ? "Effet sur les états financiers" : "Effect on FS amounts"}</td>
              {COLUMN_LABELS.map((_, i) => (
                <td key={i} className="px-2 py-1.5 text-right text-[11.3px] text-ink-soft tnum">
                  {view.fsCaptions && view.fsCaptions[i] !== 0 ? pct1((totals[i] / view.fsCaptions[i]) * 100) : "—"}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  // ---------- section shell ----------
  function section(slug: string, title: string, count: number | null, body: ReactNode) {
    const isOpen = Boolean(open[slug]);
    return (
      <Panel flush className="overflow-hidden" data-testid={`sad-tab-${slug}`}>
        <button
          type="button"
          onClick={() => setOpen((o) => ({ ...o, [slug]: !o[slug] }))}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-surface-2"
          aria-expanded={isOpen}
          data-testid={`sad-toggle-${slug}`}
        >
          <span className="flex items-baseline gap-2">
            <span className="text-[13.5px] font-bold tracking-[-0.01em] text-ink">{title}</span>
            {count !== null ? <span className="text-[11.5px] text-muted tnum">{count}</span> : null}
          </span>
          <span className="text-[15px] font-bold text-ink-soft">{isOpen ? "−" : "+"}</span>
        </button>
        {isOpen ? <div className="border-t border-line px-4 py-4">{body}</div> : null}
      </Panel>
    );
  }

  // ---------- conclusion ----------
  function conclusionBody() {
    const rows: { key: string; label: string; value: ReactNode }[] = [
      { key: "cum-is", label: fr ? "Effet cumulé des anomalies non corrigées sur le résultat" : "Cumulative income-statement effect of uncorrected misstatements", value: n(cumIS) },
      { key: "ibt", label: fr ? "Résultat avant impôt de l'exercice (balance)" : "Current-year income before tax (TB)", value: ibt !== null ? n(ibt) : "—" },
      { key: "is-pct", label: fr ? "Anomalies en % du résultat" : "Misstatements as % of income", value: isPct !== null ? pct1(isPct) : "—" },
      { key: "pm", label: fr ? "Seuil de signification (PM)" : "Overall materiality (PM)", value: mat ? n(mat.overall) : "—" },
      { key: "te", label: fr ? "Seuil de travail (TE) — estimation des anomalies non détectées" : "Performance materiality (TE) — estimate for undetected misstatements", value: mat ? n(mat.performance) : "—" },
      { key: "umt", label: fr ? "Marge pour anomalies non corrigées (UMT = PM − TE)" : "Margin for uncorrected misstatements (UMT = PM − TE)", value: umt !== null ? n(umt) : "—" },
    ];
    return (
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]" data-testid="sad-conclusion-figures">
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-line first:border-t-0">
                  <td className="px-2 py-1.5 text-[12px] text-ink-soft">{r.label}</td>
                  <td className="px-2 py-1.5 text-right text-[12px] font-semibold text-ink tnum">{r.value}</td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="px-2 py-1.5 text-[12px] text-ink-soft">
                  {fr ? "Les anomalies non corrigées dépassent-elles l'UMT ?" : "Uncorrected misstatements exceed UMT?"}
                </td>
                <td className="px-2 py-1.5 text-right" data-testid="sad-umt-exceed">
                  {exceeds === null ? (
                    <span className="text-[12px] text-muted">{fr ? "Seuil non approuvé (P6.1)" : "Materiality not approved yet (P6.1)"}</span>
                  ) : (
                    <Chip tone={exceeds ? "rose" : "good"}>{exceeds ? (fr ? "Oui" : "Yes") : (fr ? "Non" : "No")}</Chip>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* roll-up: uncorrected effect per caption, against materiality */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-[11.5px]" data-testid="sad-totals">
          <span className="font-bold text-ink">
            {fr ? "Non corrigées" : "Uncorrected"}: {n(totalUncorrected)}
          </span>
          {mat ? (
            <>
              <span className={totalUncorrected > mat.overall ? "font-bold text-rose" : "text-ink-soft"}>
                {fr ? "Seuil global" : "Overall materiality"}: {n(mat.overall)}
              </span>
              <span className="text-ink-soft">
                {fr ? "Seuil de travail" : "Performance"}: {n(mat.performance)}
              </span>
              <span className="text-ink-soft">
                {fr ? "Seuil SAD" : "SAD nominal"}: {n(mat.trivial)}
              </span>
            </>
          ) : (
            <span className="text-muted">{fr ? "Seuil non approuvé (P6.1)" : "Materiality not approved yet (P6.1)"}</span>
          )}
          {[...byCaption.entries()].filter(([, v]) => v !== 0).map(([c, v]) => (
            <span key={c} className="text-ink-soft tnum">
              {(fr ? CAPTION_LABELS[c].fr : CAPTION_LABELS[c].en)}: {v > 0 ? "+" : ""}{n(v)}
            </span>
          ))}
        </div>

        {/* qualitative factors — ISA 450 ¶A21 */}
        <div>
          <p className={label}>{fr ? "Facteurs qualitatifs (ISA 450 ¶A21)" : "Qualitative factors (ISA 450 ¶A21)"}</p>
          <div className="mt-2 flex flex-col gap-2" data-testid="sad-qual-factors">
            {SAD_QUAL_FACTORS.map((k, i) => {
              const qv = meta[`q_${k}`] ?? "";
              return (
                <div key={k} className="flex flex-col gap-1.5 border-t border-line pt-2 first:border-t-0 first:pt-0 md:flex-row md:items-center md:gap-3">
                  <p className="flex-1 text-[12px] text-ink-soft">
                    <span className="mr-1.5 font-bold text-ink">({String.fromCharCode(97 + i)})</span>
                    {fr ? QUAL_FACTOR_TEXT[k].fr : QUAL_FACTOR_TEXT[k].en}
                  </p>
                  <span className="flex items-center gap-1">
                    {(["yes", "no", "na"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => { setMeta((m) => ({ ...m, [`q_${k}`]: v })); void saveMeta(`q_${k}`, v); }}
                        className={
                          qv === v
                            ? "rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-2 py-0.5 text-[10.5px] font-bold uppercase text-white"
                            : "rounded-[var(--radius-atlas-sm)] border border-line-strong px-2 py-0.5 text-[10.5px] font-bold uppercase text-ink-soft hover:bg-surface-2"
                        }
                        data-testid={`sad-q-${k}-${v}`}
                      >
                        {v === "yes" ? (fr ? "Oui" : "Yes") : v === "no" ? (fr ? "Non" : "No") : (fr ? "N/A" : "N/A")}
                      </button>
                    ))}
                  </span>
                  <input
                    type="text"
                    defaultValue={meta[`qx_${k}`] ?? ""}
                    placeholder={fr ? "Commentaire" : "Comment"}
                    onBlur={(ev) => { if (ev.target.value !== (meta[`qx_${k}`] ?? "")) { setMeta((m) => ({ ...m, [`qx_${k}`]: ev.target.value })); void saveMeta(`qx_${k}`, ev.target.value); } }}
                    className={`${input} md:w-[260px]`}
                    spellCheck={false}
                    data-testid={`sad-qx-${k}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className={label}>{fr ? "Conclusion générale" : "Overall conclusion"}</p>
          <textarea
            defaultValue={meta.concl_text ?? ""}
            onBlur={(ev) => { if (ev.target.value !== (meta.concl_text ?? "")) { setMeta((m) => ({ ...m, concl_text: ev.target.value })); void saveMeta("concl_text", ev.target.value); } }}
            rows={4}
            className={`${input} mt-1.5`}
            spellCheck={false}
            placeholder={fr
              ? "Conclusion sur l'effet des anomalies non corrigées, individuellement et en cumul, sur les états financiers…"
              : "Conclusion on whether uncorrected misstatements are material, individually or in aggregate, to the financial statements…"}
            data-testid="sad-concl-text"
          />
        </div>
      </div>
    );
  }

  // ---------- cash flow (manual rows) ----------
  function cashflowBody() {
    const saveCf = (rows: SadCfRow[]) => void saveMeta("cf_rows", JSON.stringify(rows));
    const setCf = (i: number, field: keyof SadCfRow, value: string) => {
      setCfRows((rows) => rows.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
    };
    const tot = (field: "operating" | "investing" | "financing") => cfRows.reduce((a, r) => a + amt(r[field]), 0);
    const fields: { key: keyof SadCfRow; en: string; fr: string; right?: boolean; w: string }[] = [
      { key: "no", en: "No.", fr: "N°", w: "w-[52px]" },
      { key: "ref", en: "W/P ref", fr: "Réf. papier", w: "w-[90px]" },
      { key: "line", en: "Cash-flow statement line", fr: "Ligne du tableau des flux", w: "min-w-[220px]" },
      { key: "operating", en: "Operating", fr: "Exploitation", right: true, w: "w-[120px]" },
      { key: "investing", en: "Investing", fr: "Investissement", right: true, w: "w-[120px]" },
      { key: "financing", en: "Financing", fr: "Financement", right: true, w: "w-[120px]" },
      { key: "evaluation", en: "Evaluation & conclusion", fr: "Évaluation et conclusion", w: "min-w-[220px]" },
    ];
    return (
      <div className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]" data-testid="sad-cf-table">
            <thead>
              <tr>
                {fields.map((f) => (
                  <th key={f.key} className={`${label} px-2 py-1.5 ${f.right ? "text-right" : "text-left"}`}>{fr ? f.fr : f.en}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cfRows.length === 0 ? (
                <tr>
                  <td colSpan={fields.length} className="px-2 py-4 text-[12px] text-muted" data-testid="sad-cf-empty">
                    {fr ? "Aucune ligne — ajouter les anomalies affectant le tableau des flux de trésorerie." : "No rows — add misstatements affecting the cash-flow statement."}
                  </td>
                </tr>
              ) : (
                cfRows.map((r, i) => (
                  <tr key={i} className="border-t border-line align-top">
                    {fields.map((f) => (
                      <td key={f.key} className={`px-1 py-1 ${f.w}`}>
                        <input
                          type="text"
                          value={r[f.key] as string}
                          onChange={(ev) => setCf(i, f.key, ev.target.value)}
                          onBlur={() => saveCf(cfRows)}
                          className={`${input} ${f.right ? "text-right tnum" : ""}`}
                          spellCheck={false}
                          data-testid={`sad-cf-${i}-${f.key}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {cfRows.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-line-strong">
                  <td colSpan={3} className="px-2 py-1.5 text-[11.8px] font-bold text-ink">{fr ? "Total" : "Total"}</td>
                  <td className="px-2 py-1.5 text-right text-[11.8px] font-bold text-ink tnum">{n(tot("operating"))}</td>
                  <td className="px-2 py-1.5 text-right text-[11.8px] font-bold text-ink tnum">{n(tot("investing"))}</td>
                  <td className="px-2 py-1.5 text-right text-[11.8px] font-bold text-ink tnum">{n(tot("financing"))}</td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = [...cfRows, { no: String(cfRows.length + 1), ref: "", line: "", operating: "", investing: "", financing: "", evaluation: "" }];
            setCfRows(next);
            saveCf(next);
          }}
          className="self-start rounded-[var(--radius-atlas-sm)] border border-emerald-700 px-2.5 py-1 text-[11.5px] font-bold text-emerald-700 hover:bg-emerald-700 hover:text-white dark:text-emerald-400"
          data-testid="sad-cf-add"
        >
          {fr ? "+ Ajouter une ligne" : "+ Add row"}
        </button>
      </div>
    );
  }

  // ---------- disclosures (manual rows) ----------
  function disclosuresBody() {
    const saveDisc = (rows: SadDiscRow[]) => void saveMeta("disc_rows", JSON.stringify(rows));
    const setDisc = (i: number, p: Partial<SadDiscRow>, persist = false) => {
      const next = discRows.map((r, j) => (j === i ? { ...r, ...p } : r));
      setDiscRows(next);
      if (persist) saveDisc(next);
    };
    const fields: { key: "no" | "fn" | "description" | "guidance" | "evaluation"; en: string; fr: string; w: string }[] = [
      { key: "no", en: "No.", fr: "N°", w: "w-[52px]" },
      { key: "fn", en: "FN reference", fr: "Réf. note", w: "w-[100px]" },
      { key: "description", en: "Description", fr: "Description", w: "min-w-[240px]" },
      { key: "guidance", en: "Framework reference", fr: "Référence du référentiel", w: "min-w-[160px]" },
      { key: "evaluation", en: "Evaluation & conclusion", fr: "Évaluation et conclusion", w: "min-w-[220px]" },
    ];
    const groups: { label: string; rows: { r: SadDiscRow; i: number }[] }[] = [
      { label: fr ? "Non corrigées" : "Uncorrected", rows: discRows.map((r, i) => ({ r, i })).filter((x) => !x.r.corrected) },
      { label: fr ? "Corrigées" : "Corrected", rows: discRows.map((r, i) => ({ r, i })).filter((x) => x.r.corrected) },
    ];
    return (
      <div className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]" data-testid="sad-disc-table">
            <thead>
              <tr>
                {fields.map((f) => (
                  <th key={f.key} className={`${label} px-2 py-1.5 text-left`}>{fr ? f.fr : f.en}</th>
                ))}
                <th className={`${label} px-2 py-1.5 text-left`}>{fr ? "Corrigée" : "Corrected"}</th>
              </tr>
            </thead>
            <tbody>
              {discRows.length === 0 ? (
                <tr>
                  <td colSpan={fields.length + 1} className="px-2 py-4 text-[12px] text-muted" data-testid="sad-disc-empty">
                    {fr ? "Aucune ligne — ajouter les anomalies relevées dans les notes annexes." : "No rows — add misstatements identified in the disclosures."}
                  </td>
                </tr>
              ) : (
                groups.map((g) => (
                  <Fragment key={g.label}>
                    <tr className="border-t border-line bg-surface-2">
                      <td colSpan={fields.length + 1} className={`${label} px-2 py-1.5`}>{g.label}</td>
                    </tr>
                    {g.rows.length === 0 ? (
                      <tr>
                        <td colSpan={fields.length + 1} className="px-2 py-2 text-[11.5px] italic text-muted">—</td>
                      </tr>
                    ) : (
                      g.rows.map(({ r, i }) => (
                        <tr key={i} className="border-t border-line align-top">
                          {fields.map((f) => (
                            <td key={f.key} className={`px-1 py-1 ${f.w}`}>
                              <input
                                type="text"
                                value={r[f.key]}
                                onChange={(ev) => setDisc(i, { [f.key]: ev.target.value })}
                                onBlur={() => saveDisc(discRows)}
                                className={input}
                                spellCheck={false}
                                data-testid={`sad-disc-${i}-${f.key}`}
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={r.corrected}
                              onChange={(ev) => setDisc(i, { corrected: ev.target.checked }, true)}
                              className="h-4 w-4 accent-emerald-700"
                              data-testid={`sad-disc-${i}-corrected`}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = [...discRows, { no: String(discRows.length + 1), fn: "", description: "", guidance: "", evaluation: "", corrected: false }];
            setDiscRows(next);
            saveDisc(next);
          }}
          className="self-start rounded-[var(--radius-atlas-sm)] border border-emerald-700 px-2.5 py-1 text-[11.5px] font-bold text-emerald-700 hover:bg-emerald-700 hover:text-white dark:text-emerald-400"
          data-testid="sad-disc-add"
        >
          {fr ? "+ Ajouter une ligne" : "+ Add row"}
        </button>
      </div>
    );
  }

  // ---------- render ----------
  const typeGroup = (t: string, list: SadEntry[]) => ({
    label: fr
      ? `Anomalies ${t === "factual" ? "avérées" : t === "judgmental" ? "de jugement" : "extrapolées"}`
      : `${TYPE_LABELS[t].en} misstatements`,
    entries: list.filter((e) => e.mtype === t),
  });

  return (
    <div className="flex flex-col gap-3" data-testid="sad-board">
      {error ? <p className="text-[12px] font-semibold text-rose">{error}</p> : null}

      {/* shared header strip */}
      <Panel className="p-4" data-testid="sad-header">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
          <div>
            <p className={label}>{fr ? "Entité" : "Entity"}</p>
            <p className="text-[13px] font-semibold text-ink">{view.entityName || "—"}</p>
          </div>
          <div>
            <p className={label}>{fr ? "Clôture" : "Period end"}</p>
            <p className="text-[13px] font-semibold text-ink tnum">{view.periodEnd || "—"}</p>
          </div>
          <div>
            <p className={label}>{fr ? "Devise" : "Currency"}</p>
            <p className="text-[13px] font-semibold text-ink">FCFA</p>
          </div>
          {mat ? (
            <>
              <div>
                <p className={label}>{fr ? "Seuil de signification (PM)" : "Overall materiality (PM)"}</p>
                <p className="text-[13px] font-semibold text-ink tnum">{n(mat.overall)}</p>
              </div>
              <div>
                <p className={label}>{fr ? "Seuil de travail (TE)" : "Performance materiality (TE)"}</p>
                <p className="text-[13px] font-semibold text-ink tnum">{n(mat.performance)}</p>
              </div>
              <div>
                <p className={label}>{fr ? "Seuil SAD" : "SAD nominal amount"}</p>
                <p className="text-[13px] font-semibold text-ink tnum">{n(mat.trivial)}</p>
              </div>
            </>
          ) : (
            <div>
              <p className={label}>{fr ? "Seuils" : "Materiality"}</p>
              <p className="text-[13px] text-muted">{fr ? "Seuil non approuvé (P6.1)" : "Materiality not approved yet (P6.1)"}</p>
            </div>
          )}
        </div>
      </Panel>

      {section(
        "uncorrected",
        fr ? "SAD — anomalies non corrigées" : "SAD uncorrected",
        uncorrectedE.length,
        captionGrid(
          [typeGroup("factual", uncorrectedE), typeGroup("judgmental", uncorrectedE), typeGroup("projected", uncorrectedE)],
          false,
          "sad-uncorrected",
        ),
      )}

      {section(
        "corrected",
        fr ? "SAD — anomalies corrigées" : "SAD corrected",
        correctedE.length,
        captionGrid([{ label: null, entries: correctedE }], true, "sad-corrected"),
      )}

      {section("conclusion", fr ? "Conclusion SAD" : "SAD conclusion", null, conclusionBody())}

      {section(
        "reclass",
        fr ? "Anomalies de reclassement" : "Reclassification misstatements",
        reclassE.length,
        captionGrid([{ label: null, entries: reclassE }], true, "sad-reclass"),
      )}

      {section(
        "cashflow",
        fr ? "Anomalies du tableau des flux de trésorerie" : "Cash flow misstatements",
        cfRows.length,
        cashflowBody(),
      )}

      {section(
        "disclosures",
        fr ? "Anomalies dans les notes annexes" : "Misstatements in disclosures",
        discRows.length,
        disclosuresBody(),
      )}

      <p className="text-[10.5px] text-muted">
        {fr
          ? "Chaque bloc provient de l'écriture proposée dans « Constats & conclusion » du papier — cliquer la référence pour y retourner. « Reporter » inscrit la ligne au récapitulatif des anomalies évalué en C1.1 ; les corrections passées en comptabilité se marquent « corrigée ». Les sections flux de trésorerie et notes annexes se saisissent manuellement."
          : "Each block comes from the entry proposed under \"Findings & conclusion\" on the workpaper — click the reference to go back to it. \"Post\" writes the line onto the misstatement schedule evaluated in C1.1; adjustments booked by the client are marked corrected. The cash-flow and disclosure sections are entered manually."}
      </p>
    </div>
  );
}
