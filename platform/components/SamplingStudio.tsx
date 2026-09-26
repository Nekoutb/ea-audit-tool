"use client";

// The Sampling tool, structured like the methodology chapter:
//   1 — Sampling for TESTS OF CONTROLS: the controls selected for testing
//       arrive with their attributes straight from S2.1/S2.2; the user
//       supplies and saves the population of occurrences, the minimum sample
//       follows the frequency table (manual daily 25 — or 60 when it is the
//       only control covering an assertion — weekly 5, monthly/quarterly 2,
//       annually 1; 50–250 occurrences → 10%, under 50 → 5, under 5 → all;
//       automated → test of one), and "Generate" draws that many occurrence
//       numbers at random — afresh every time — saved on the control and
//       extracted to Excel, one tab per control.
//   2 — Sampling for TESTS OF DETAILS: every account of one side of the
//       financial statements, as a workbook with one tab per lead index —
//       the CRA from S3.1 and the key-item threshold set there, key items in
//       full (≥ threshold), the representative sample beneath (base =
//       (population − key items) ÷ TE × the audit-risk-table factor, drawn
//       by systematic MUS), entry columns for the tester.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordTodResultAction } from "@/app/actions/engines";
import type { TodResultRow } from "@/lib/engines";
import { SubmitButton } from "@/components/SubmitButton";
import { drawTocSample, normFreq, tocSuggested } from "@/lib/toc-sampling";
import { freqLabel } from "@/lib/control-labels";

export interface SamplingPurpose {
  controlId: string;
  controlName: string;
  scotName: string;
  sampleSize: number | null;
  /** saved population of occurrences, and the items last drawn */
  population: number | null;
  sampleItems: number[];
  drawnAt: string | null;
  frequency: string | null;
  controlType: string;
  assertions: string[];
  /** covers at least one assertion no other selected control covers */
  sole: boolean;
}

const ASSURANCES = [
  { value: "little", en: "Little", fr: "Faible" },
  { value: "some", en: "Some", fr: "Partielle" },
  { value: "corroborative", en: "Corroborative", fr: "Corroborante" },
  { value: "persuasive", en: "Persuasive", fr: "Persuasive" },
] as const;

export function SamplingStudio({
  engagementId,
  purposes,
  s22Href,
  locale,
  te = null,
  indexes = [],
  results = [],
  resultsError = null,
  resultsRecorded = false,
}: {
  engagementId: string;
  purposes: SamplingPurpose[];
  /** the S2.2 design screen — clicking a control's description returns there */
  s22Href?: string;
  locale: "en" | "fr";
  /** tolerable error (TE), the yardstick the projection is read against */
  te?: number | null;
  /** the lead indexes a result can be recorded for */
  indexes?: { code: string; label: string }[];
  /** results already recorded, newest first */
  results?: TodResultRow[];
  /** the ?error= code the results action redirected back with */
  resultsError?: string | null;
  resultsRecorded?: boolean;
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [populations, setPopulations] = useState<Record<string, string>>(() =>
    Object.fromEntries(purposes.filter((p) => p.population !== null).map((p) => [p.controlId, String(p.population)])),
  );
  const [drawn, setDrawn] = useState<Record<string, { items: number[]; at: string }>>(() =>
    Object.fromEntries(purposes.filter((p) => p.sampleItems.length > 0).map((p) => [p.controlId, { items: p.sampleItems, at: p.drawnAt ?? "" }])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [tocExporting, setTocExporting] = useState(false);

  // one workbook per side of the statements
  const [side, setSide] = useState<"bs" | "is">("is");
  const [sideAssurance, setSideAssurance] = useState("little");
  const [sideError, setSideError] = useState<string | null>(null);
  const [sidePending, setSidePending] = useState(false);

  async function exportSide() {
    setSideError(null); setSidePending(true);
    const url = `/api/engagements/${engagementId}/sampling/tod-export?side=${side}&assurance=${sideAssurance}&locale=${locale}`;
    const r = await fetch(url).catch(() => null);
    setSidePending(false);
    if (!r) { setSideError(fr ? "Connexion perdue." : "The connection dropped."); return; }
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      setSideError(
        body.error === "no-materiality" ? (fr ? "Seuil de signification non approuvé (P6.1)." : "Materiality not approved yet (P6.1).")
        : body.error === "no-gl" ? (fr ? "Aucun grand livre — importer le GL dans l'analyseur." : "No general ledger — upload it in the GL Analyzer.")
        : body.error === "no-mapping" ? (fr ? "Colonnes du GL non mappées : compte, et montant ou débit/crédit." : "GL columns not mapped: account, and amount or debit/credit.")
        : fr ? "Le classeur n'a pas pu être construit." : "The workbook could not be built.",
      );
      return;
    }
    const blob = await r.blob();
    const disposition = r.headers.get("Content-Disposition") ?? "";
    const encoded = /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1];
    const plain = /filename="([^"]+)"/.exec(disposition)?.[1];
    const filename = encoded ? decodeURIComponent(encoded) : (plain ?? "Tests-of-details.xlsx");
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(href);
  }

  const n = (x: number) => new Intl.NumberFormat("fr-FR").format(x);
  const input = "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-emerald-600";

  async function op(body: Record<string, unknown>) {
    setError(null);
    const r = await fetch(`/api/engagements/${engagementId}/scots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!r?.ok) { setError(fr ? "Échec de l'opération." : "Operation failed."); return null; }
    return r.json().catch(() => ({}));
  }

  const popOf = (p: SamplingPurpose): number | null => Number((populations[p.controlId] ?? "").replace(/[\s\u00a0\u202f]/g, "")) || null;

  async function savePopulation(p: SamplingPurpose) {
    const pop = popOf(p);
    if (!pop) { setError(fr ? "Saisir la population avant d'enregistrer." : "Enter the population before saving."); return; }
    setDone(null); setBusy(p.controlId);
    const r = await op({ op: "updateControl", controlId: p.controlId, tocPopulation: pop });
    setBusy(null);
    if (r) { setDone(`${fr ? "Population enregistrée pour" : "Population saved for"} « ${p.controlName} » : ${n(pop)}.`); router.refresh(); }
  }

  async function generateSample(p: SamplingPurpose) {
    const pop = popOf(p);
    const suggestion = tocSuggested(p.controlType, p.frequency, pop, p.sole, fr);
    if (!suggestion || "needPopulation" in suggestion) return;
    setDone(null); setBusy(p.controlId);
    // the draw is random and afresh on every click; what was drawn is saved
    // with the control so the Excel extract shows exactly these items
    const items = pop && p.controlType !== "automated" ? drawTocSample(pop, suggestion.size) : pop ? drawTocSample(pop, 1) : [];
    const note = `${fr ? "Test de contrôles" : "Test of controls"} — ${suggestion.rule}` + (pop ? ` · ${fr ? "population" : "population"} ${n(pop)}` : "");
    const r = await op({ op: "updateControl", controlId: p.controlId, tocPopulation: pop, sampleSize: suggestion.size, sampleNote: note, tocSampleItems: items });
    setBusy(null);
    if (r) {
      setDrawn((d) => ({ ...d, [p.controlId]: { items, at: new Date().toISOString() } }));
      setDone(`${fr ? "Échantillon de" : "Sample of"} ${items.length || suggestion.size} ${fr ? "tiré au hasard pour" : "drawn at random for"} « ${p.controlName} » — ${fr ? "listé pour test dans le papier E1.2 et dans l'extrait Excel" : "listed for testing in the E1.2 paper and in the Excel extract"}.`);
      router.refresh();
    }
  }

  async function exportToc() {
    setError(null); setTocExporting(true);
    const r = await fetch(`/api/engagements/${engagementId}/sampling/toc-export?locale=${locale}`).catch(() => null);
    setTocExporting(false);
    if (!r?.ok) { setError(fr ? "L'extrait n'a pas pu être construit." : "The extract could not be built."); return; }
    const blob = await r.blob();
    const disposition = r.headers.get("Content-Disposition") ?? "";
    const encoded = /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1];
    const plain = /filename="([^"]+)"/.exec(disposition)?.[1];
    const filename = encoded ? decodeURIComponent(encoded) : (plain ?? "Tests-of-controls-samples.xlsx");
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(href);
  }

  const sectionTitle = "text-[11px] font-extrabold uppercase tracking-[0.07em] text-emerald-700 dark:text-emerald-400";
  const th = "px-2.5 py-1.5 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted bg-surface-2";
  const td = "border-t border-line px-2.5 py-1.5 text-[12px] align-middle";

  return (
    <div className="flex flex-col gap-4" data-testid="sampling-studio">
      {(error || done) ? (
        <p className={`text-[12px] font-semibold ${error ? "text-rose" : "text-emerald-700 dark:text-emerald-400"}`} role={error ? "alert" : undefined} data-testid={error ? "sampling-error" : "sampling-assigned"}>
          {error ?? done}
        </p>
      ) : null}

      {/* ------------------------------------------- 1 · tests of controls -- */}
      <div className="flex flex-col gap-1.5" data-testid="sampling-toc">
        <p className={sectionTitle}>{fr ? "1 · Échantillonnage — tests de contrôles" : "1 · Sampling for tests of controls"}</p>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="max-w-[820px] text-[11.5px] text-muted">
            {fr
              ? "Les contrôles sélectionnés pour test (S2.1) arrivent avec leurs attributs ; saisissez et enregistrez la population d'occurrences, la taille minimale suit la table des fréquences, et « Générer » tire au hasard les occurrences à tester — un nouveau tirage à chaque fois."
              : "The controls selected for testing (S2.1) arrive with their attributes; enter and save the population of occurrences, the minimum size follows the frequency table, and Generate draws the occurrences to test at random — a fresh draw every time."}
          </p>
          <button
            type="button"
            onClick={() => void exportToc()}
            disabled={tocExporting || purposes.length === 0}
            className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink-soft hover:bg-surface-2 disabled:opacity-50"
            data-testid="toc-export"
          >
            {tocExporting ? (fr ? "Construction…" : "Building…") : fr ? "Extraire les échantillons (Excel, un onglet par contrôle)" : "Extract the samples (Excel, one tab per control)"}
          </button>
        </div>
        {purposes.length === 0 ? (
          <p className="text-[12px] text-warn">{fr ? "Aucun contrôle sélectionné pour test — voir S2.1." : "No control selected for testing yet — see S2.1."}</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={th}>{fr ? "Contrôle" : "Control"}</th>
                  <th className={th}>SCOT</th>
                  <th className={th}>{fr ? "Fréquence" : "Frequency"}</th>
                  <th className={th}>{fr ? "Assertions" : "Assertions"}</th>
                  <th className={th}>{fr ? "Population" : "Population"}</th>
                  <th className={th}>{fr ? "Taille minimale" : "Minimum sample"}</th>
                  <th className={th}>{fr ? "Éléments tirés" : "Items drawn"}</th>
                </tr>
              </thead>
              <tbody>
                {purposes.map((p) => {
                  const pop = Number((populations[p.controlId] ?? "").replace(/[\s  ]/g, "")) || null;
                  const suggestion = tocSuggested(p.controlType, p.frequency, pop, p.sole, fr);
                  return (
                    <tr key={p.controlId} data-testid={`toc-row-${p.controlName.replace(/[^A-Za-z0-9]/g, "_").slice(0, 24)}`}>
                      <td className={`${td} whitespace-normal`}>
                        {s22Href ? (
                          <a href={s22Href} className="font-medium text-ink underline-offset-2 hover:text-emerald-700 hover:underline dark:hover:text-emerald-400" title={fr ? "Ouvrir la conception du test (S2.2)" : "Open the test design (S2.2)"} data-testid={`toc-open-${p.controlName.replace(/[^A-Za-z0-9]/g, "_").slice(0, 24)}`}>
                            {p.controlName}
                          </a>
                        ) : (
                          <span className="font-medium text-ink">{p.controlName}</span>
                        )}
                        {p.sole ? <span className="ml-1.5 rounded-full bg-[var(--color-warn-soft)] px-1.5 py-[1px] text-[9px] font-bold text-warn" title={fr ? "Seul contrôle couvrant une assertion — échantillon renforcé" : "Only control covering an assertion — larger sample"}>{fr ? "seul" : "sole"}</span> : null}
                        {p.sampleSize ? <span className="ml-1.5 text-[10px] text-muted tnum">({fr ? "actuel" : "current"}: {p.sampleSize})</span> : null}
                      </td>
                      <td className={`${td} whitespace-normal text-ink-soft`}>{p.scotName}</td>
                      <td className={`${td} text-ink-soft`}>{p.frequency ? freqLabel(normFreq(p.frequency), fr) : "—"}</td>
                      <td className={`${td} font-mono text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300`}>{p.assertions.join("") || "—"}</td>
                      <td className={`${td} p-1`}>
                        <div className="flex items-center gap-1">
                          <input
                            value={populations[p.controlId] ?? ""}
                            onChange={(e) => setPopulations((s) => ({ ...s, [p.controlId]: e.target.value }))}
                            placeholder={normFreq(p.frequency) === "daily" ? "250+" : fr ? "occurrences" : "occurrences"}
                            className="w-full min-w-0 rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[12px] outline-none focus:border-emerald-600 tnum"
                            data-testid={`toc-pop-${p.controlName.replace(/[^A-Za-z0-9]/g, "_").slice(0, 24)}`}
                          />
                          <button
                            type="button"
                            onClick={() => void savePopulation(p)}
                            disabled={busy === p.controlId || !popOf(p) || popOf(p) === p.population}
                            className="rounded-[var(--radius-atlas-xs)] border border-line-strong px-2 py-1 text-[11px] font-semibold text-ink-soft hover:bg-surface-2 disabled:opacity-40"
                            title={fr ? "Enregistrer la population sur le contrôle" : "Save the population on the control"}
                            data-testid={`toc-save-${p.controlName.replace(/[^A-Za-z0-9]/g, "_").slice(0, 24)}`}
                          >
                            {popOf(p) === p.population && p.population ? "✓" : fr ? "Enregistrer" : "Save"}
                          </button>
                        </div>
                      </td>
                      <td className={td}>
                        {suggestion === null ? (
                          <span className="text-muted">—</span>
                        ) : "needPopulation" in suggestion ? (
                          <span className="text-[11px] text-warn">{fr ? "Saisir la population" : "Enter the population"}</span>
                        ) : (
                          <span title={suggestion.rule}>
                            <b className="tnum text-[14px] text-ink">{suggestion.size}</b>
                            <span className="ml-1.5 text-[10px] text-muted">{suggestion.rule}</span>
                          </span>
                        )}
                      </td>
                      <td className={`${td} whitespace-normal`}>
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => void generateSample(p)}
                            disabled={busy === p.controlId || !suggestion || "needPopulation" in suggestion || !popOf(p)}
                            className="self-start rounded-[var(--radius-atlas-xs)] bg-emerald-700 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
                            title={fr ? "Tirer au hasard les occurrences à tester (nouveau tirage à chaque clic)" : "Draw the occurrences to test at random (a fresh draw every click)"}
                            data-testid={`toc-generate-${p.controlName.replace(/[^A-Za-z0-9]/g, "_").slice(0, 24)}`}
                          >
                            {drawn[p.controlId] ? (fr ? "Régénérer" : "Regenerate") : fr ? "Générer" : "Generate"}
                          </button>
                          {drawn[p.controlId] ? (
                            <span className="text-[10.5px] leading-snug text-ink-soft tnum" data-testid={`toc-items-${p.controlName.replace(/[^A-Za-z0-9]/g, "_").slice(0, 24)}`}>
                              <b className="text-ink">{drawn[p.controlId].items.length}</b> {fr ? "sur" : "of"} {n(p.population ?? popOf(p) ?? 0)}: {drawn[p.controlId].items.join(", ")}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------- 2 · tests of details -- */}
      <div className="flex flex-col gap-1.5" data-testid="sampling-tod-side">
        <p className={sectionTitle}>{fr ? "2 · Échantillonnage — tests de détail" : "2 · Sampling for tests of details"}</p>
        <p className="text-[11.5px] text-muted">
          {fr
            ? "Choisissez le bilan ou le compte de résultat : chaque indice de ce côté reçoit un onglet avec ses éléments clés (≥ seuil fixé sur S3.1, TE à défaut) et son échantillon représentatif dimensionné par la CRA de S3.1 — colonnes de test à remplir."
            : "Choose the balance sheet or the income statement: every lead index of that side gets a tab with its key items (≥ the threshold set on S3.1, TE by default) and its representative sample sized by the S3.1 CRA — with the columns the tester fills."}
        </p>
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Côté des états financiers" : "Financial statements side"}
            <div className="flex overflow-hidden rounded-[var(--radius-atlas-sm)] border border-line-strong" role="radiogroup" data-testid="tod-side">
              {([["bs", fr ? "Bilan" : "Balance sheet"], ["is", fr ? "Compte de résultat" : "Income statement"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={side === value}
                  onClick={() => setSide(value)}
                  className={`px-3 py-1.5 text-[12px] font-semibold transition ${side === value ? "bg-emerald-700 text-white" : "bg-surface text-ink-soft hover:bg-surface-2"}`}
                  data-testid={`tod-side-${value}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Assurance des autres procédures" : "Assurance from other procedures"}
            <select value={sideAssurance} onChange={(e) => setSideAssurance(e.target.value)} className={input} data-testid="tod-side-assurance">
              {ASSURANCES.map((a) => <option key={a.value} value={a.value}>{fr ? a.fr : a.en}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void exportSide()}
            disabled={sidePending}
            className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            data-testid="tod-side-export"
          >
            {sidePending ? (fr ? "Construction du classeur…" : "Building the workbook…") : fr ? "Générer le classeur Excel (un onglet par indice)" : "Generate the Excel workbook (one tab per index)"}
          </button>
        </div>
        {sideError ? <p role="alert" className="text-[12px] font-semibold text-rose" data-testid="tod-side-error">{sideError}</p> : null}
      </div>

      {/* ------------------------------------------- 3 · results & projection -- */}
      <div className="flex flex-col gap-1.5" data-testid="sampling-tod-results">
        <p className={sectionTitle}>{fr ? "3 · Résultats des tests de détail — extrapolation" : "3 · Tests-of-details results — projection"}</p>
        <p className="max-w-[820px] text-[11.5px] text-muted">
          {fr
            ? "Reportez, par indice, ce que le classeur a relevé : la valeur de l'échantillon examiné, l'anomalie trouvée dans l'échantillon, l'anomalie avérée sur les éléments clés et la population restante (toutes lues sur l'onglet). L'anomalie extrapolée = anomalie de l'échantillon ÷ valeur de l'échantillon × population restante (ISA 530 ¶14) ; au-delà du seuil négligeable elle est portée sur C1.1, comme l'anomalie avérée des éléments clés."
            : "Bring back, per index, what the workbook found: the value of the sample examined, the misstatement found in it, the factual misstatement in the key items and the remaining population (all read off the tab). Projected misstatement = sample misstatement ÷ sample value × remaining population (ISA 530 ¶14); above clearly trivial it is carried to C1.1, as is the factual misstatement in the key items."}
        </p>
        {resultsError ? (
          <p role="alert" className="text-[12px] font-semibold text-rose" data-testid="tod-results-error">
            {resultsError === "empty-population"
              ? fr ? "La valeur de l'échantillon doit être supérieure à zéro." : "The sample value must be above zero."
              : resultsError === "invalid-index"
                ? fr ? "Choisissez un indice." : "Choose an index."
                : fr ? "Les montants saisis ne sont pas lisibles." : "The amounts entered could not be read."}
          </p>
        ) : null}
        {resultsRecorded ? (
          <p className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400" data-testid="tod-results-recorded">
            {fr ? "Résultat enregistré et extrapolé — voir C1.1 pour le registre." : "Result recorded and projected — see C1.1 for the register."}
          </p>
        ) : null}
        <form action={recordTodResultAction.bind(null, engagementId)} className="flex flex-wrap items-end gap-2.5" data-testid="tod-results-form">
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Indice" : "Index"}
            <select name="indexCode" required className={input} data-testid="tod-result-index">
              <option value="">—</option>
              {indexes.map((i) => <option key={i.code} value={i.code}>{i.code} — {i.label}</option>)}
            </select>
          </label>
          {([
            ["sampleValue", fr ? "Valeur de l'échantillon" : "Sample value", true],
            ["sampleMisstatement", fr ? "Anomalie dans l'échantillon" : "Misstatement in sample", false],
            ["keyMisstatement", fr ? "Anomalie sur éléments clés" : "Key-item misstatement", false],
            ["remainingValue", fr ? "Population restante" : "Remaining population", true],
          ] as const).map(([name, label, required]) => (
            <label key={name} className="flex flex-col gap-0.5 text-[11px] text-muted">
              {label}
              <input name={name} required={required} inputMode="decimal" className={`${input} w-40 tnum`} data-testid={`tod-result-${name}`} />
            </label>
          ))}
          <SubmitButton className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-800" testId="tod-result-submit">
            {fr ? "Enregistrer et extrapoler" : "Record and project"}
          </SubmitButton>
        </form>
        {results.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>{fr ? "Indice" : "Index"}</th>
                  <th className={th}>{fr ? "Échantillon" : "Sample"}</th>
                  <th className={th}>{fr ? "Anomalie échantillon" : "Sample misstatement"}</th>
                  <th className={th}>{fr ? "Population restante" : "Remaining population"}</th>
                  <th className={th}>{fr ? "Extrapolée" : "Projected"}</th>
                  <th className={th}>{fr ? "Éléments clés (avérée)" : "Key items (factual)"}</th>
                  <th className={th}>{fr ? "Probable totale" : "Total likely"}</th>
                  <th className={th}>{te !== null ? `vs TE ${n(te)}` : "vs TE"}</th>
                  <th className={th}>{fr ? "Enregistré" : "Recorded"}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const total = (r.projected ?? 0) + r.keyMisstatement;
                  const exceeds = te !== null && Math.abs(total) > te;
                  return (
                    <tr key={r.id} data-testid={`tod-result-row-${r.indexCode}`}>
                      <td className={`${td} font-mono font-bold text-ink`}>{r.indexCode}</td>
                      <td className={`${td} tnum`}>{n(r.sampleValue)}</td>
                      <td className={`${td} tnum`}>{n(r.sampleMisstatement)}</td>
                      <td className={`${td} tnum`}>{n(r.remainingValue)}</td>
                      <td className={`${td} tnum font-semibold`}>{r.projected === null ? "—" : n(r.projected)}</td>
                      <td className={`${td} tnum`}>{n(r.keyMisstatement)}</td>
                      <td className={`${td} tnum font-semibold`}>{n(total)}</td>
                      <td className={`${td} ${exceeds ? "font-bold text-rose" : "text-emerald-700 dark:text-emerald-400"}`}>
                        {te === null ? "—" : exceeds ? (fr ? "Dépasse TE" : "Exceeds TE") : fr ? "Sous TE" : "Within TE"}
                        {r.raisedToB5 ? <span className="ml-1 text-[10px] text-muted">· C1.1</span> : null}
                      </td>
                      <td className={`${td} text-muted tnum`}>{r.createdAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
