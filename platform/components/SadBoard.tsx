"use client";

// The Summary of Audit Differences: adjustments proposed in the substantive
// working papers, one line each, classified by caption per side, corrected or
// not, and posted onto the misstatement schedule. Every line links back to the
// working paper that concluded it.

import { useState } from "react";
import Link from "next/link";
import { SAD_CAPTIONS, SAD_TYPES, type SadCaption, type SadEntry, type SadView } from "@/lib/sad-model";
import { Chip } from "@/components/ui/atlas";

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

  const n = (x: number) => new Intl.NumberFormat("fr-FR").format(Math.round(x));
  const label = "text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const select = "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-1 py-0.5 text-[11.3px] text-ink outline-none focus:border-emerald-600";

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

  function patch(stepId: string, p: Partial<SadEntry>) {
    setEntries((es) => es.map((e) => (e.stepId === stepId ? { ...e, ...p } : e)));
  }

  const uncorrected = entries.filter((e) => !e.corrected);
  const totalUncorrected = uncorrected.reduce((a, e) => a + Math.max(Math.abs(e.drAmount), Math.abs(e.crAmount)), 0);
  const byCaption = new Map<SadCaption, number>();
  for (const e of uncorrected) {
    const amt = Math.max(Math.abs(e.drAmount), Math.abs(e.crAmount));
    byCaption.set(e.drCaption, (byCaption.get(e.drCaption) ?? 0) + amt);
    byCaption.set(e.crCaption, (byCaption.get(e.crCaption) ?? 0) - amt);
  }

  if (entries.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-[12.5px] text-muted" data-testid="sad-empty">
        {fr
          ? "Aucun ajustement proposé — les écritures saisies dans « Constats & conclusion » des papiers substantifs (E4) apparaîtront ici."
          : "No proposed adjustments yet — entries recorded under \"Findings & conclusion\" on the substantive workpapers (E4) appear here."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="sad-board">
      {error ? <p className="text-[12px] font-semibold text-rose">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr>
              <th className={`${label} px-2 py-1.5 text-left`}>{fr ? "Papier" : "Workpaper"}</th>
              <th className={`${label} px-2 py-1.5 text-left`}>{fr ? "Constat" : "Finding"}</th>
              <th className={`${label} px-2 py-1.5 text-left`}>{fr ? "Débit" : "Debit"}</th>
              <th className={`${label} px-2 py-1.5 text-right`}>{fr ? "Montant" : "Amount"}</th>
              <th className={`${label} px-2 py-1.5 text-left`}>{fr ? "Crédit" : "Credit"}</th>
              <th className={`${label} px-2 py-1.5 text-right`}>{fr ? "Montant" : "Amount"}</th>
              <th className={`${label} px-2 py-1.5 text-left`}>{fr ? "Nature" : "Type"}</th>
              <th className={`${label} px-2 py-1.5 text-left`}>{fr ? "Corrigée" : "Corrected"}</th>
              <th className={`${label} px-2 py-1.5 text-left`}>{fr ? "Récap." : "Schedule"}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.stepId} className="border-t border-line align-top" data-testid={`sad-${e.stepId}`}>
                <td className="px-2 py-1.5">
                  <Link
                    href={`/engagements/${engagementId}/sections/${e.taskItemId}`}
                    className="font-mono text-[11.5px] font-extrabold text-emerald-700 hover:underline dark:text-emerald-400"
                    title={e.taskTitle}
                    data-testid={`sad-open-${e.stepId}`}
                  >
                    {e.ref}
                  </Link>
                  <p className="text-[10px] text-muted">{e.taskCode}</p>
                </td>
                <td className="max-w-[220px] px-2 py-1.5 text-[11.8px] text-ink-soft">{e.finding || <span className="italic text-muted">{fr ? "sans description" : "no description"}</span>}</td>
                <td className="px-2 py-1.5">
                  <p className="text-[11.8px] font-semibold text-ink tnum">{e.drAccount || "—"}</p>
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
                </td>
                <td className="px-2 py-1.5 text-right text-[11.8px] text-ink tnum">{e.drAmount ? n(e.drAmount) : "—"}</td>
                <td className="px-2 py-1.5">
                  <p className="text-[11.8px] font-semibold text-ink tnum">{e.crAccount || "—"}</p>
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
                </td>
                <td className="px-2 py-1.5 text-right text-[11.8px] text-ink tnum">{e.crAmount ? n(e.crAmount) : "—"}</td>
                <td className="px-2 py-1.5">
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
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={e.corrected}
                    onChange={(ev) => { patch(e.stepId, { corrected: ev.target.checked }); void call({ op: "save", stepId: e.stepId, field: "corrected", value: ev.target.checked ? "yes" : "no" }); }}
                    className="h-4 w-4 accent-emerald-700"
                    data-testid={`sad-corrected-${e.stepId}`}
                  />
                </td>
                <td className="px-2 py-1.5">
                  {e.posted ? (
                    <button
                      type="button"
                      onClick={async () => { setBusy(e.stepId); if (await call({ op: "post", stepId: e.stepId })) patch(e.stepId, { posted: true }); setBusy(null); }}
                      className="text-[10.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                      title={fr ? "Reporté — cliquer pour mettre à jour" : "Posted — click to update"}
                      data-testid={`sad-post-${e.stepId}`}
                    >
                      <Chip tone="good">{fr ? "Reportée ↻" : "Posted ↻"}</Chip>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === e.stepId}
                      onClick={async () => { setBusy(e.stepId); if (await call({ op: "post", stepId: e.stepId })) patch(e.stepId, { posted: true }); setBusy(null); }}
                      className="rounded-[var(--radius-atlas-sm)] border border-emerald-700 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-700 hover:text-white dark:text-emerald-400"
                      data-testid={`sad-post-${e.stepId}`}
                    >
                      {fr ? "Reporter" : "Post"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* roll-up: uncorrected effect per caption, against materiality */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-[11.5px]" data-testid="sad-totals">
        <span className="font-bold text-ink">
          {fr ? "Non corrigées" : "Uncorrected"}: {n(totalUncorrected)}
        </span>
        {view.materiality ? (
          <>
            <span className={totalUncorrected > view.materiality.overall ? "font-bold text-rose" : "text-ink-soft"}>
              {fr ? "Seuil global" : "Overall materiality"}: {n(view.materiality.overall)}
            </span>
            <span className="text-ink-soft">
              {fr ? "Seuil de travail" : "Performance"}: {n(view.materiality.performance)}
            </span>
            <span className="text-ink-soft">
              {fr ? "Seuil SAD" : "SAD nominal"}: {n(view.materiality.trivial)}
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

      <p className="text-[10.5px] text-muted">
        {fr
          ? "Chaque ligne provient de l'écriture proposée dans « Constats & conclusion » du papier — cliquer la référence pour y retourner. « Reporter » inscrit la ligne au récapitulatif des anomalies évalué en C1.1 ; les corrections passées en comptabilité se marquent « corrigée »."
          : "Each line comes from the entry proposed under \"Findings & conclusion\" on the workpaper — click the reference to go back to it. \"Post\" writes the line onto the misstatement schedule evaluated in C1.1; adjustments booked by the client are marked corrected."}
      </p>
    </div>
  );
}
