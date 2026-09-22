"use client";

// The Sampling tool, structured like the methodology chapter:
//   1 — Sampling for TESTS OF CONTROLS: the controls selected for testing
//       arrive with their attributes straight from S2.1/S2.2; the user only
//       supplies the population of occurrences and the minimum sample follows
//       the frequency table (manual daily 25 — or 60 when it is the only
//       control covering an assertion — weekly 5, monthly/quarterly 2,
//       annually 1; 50–250 occurrences → 10%, under 50 → 5, under 5 → all;
//       automated → test of one). Confirming assigns the size to the control.
//   2 — Sampling for TESTS OF DETAILS: every account of one side of the
//       financial statements, as a workbook with one tab per lead index —
//       the CRA from S3.1 and the key-item threshold set there, key items in
//       full (≥ threshold), the representative sample beneath (base =
//       (population − key items) ÷ TE × the audit-risk-table factor, drawn
//       by systematic MUS), entry columns for the tester.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normFreq, tocSuggested } from "@/lib/toc-sampling";

export interface SamplingPurpose {
  controlId: string;
  controlName: string;
  scotName: string;
  sampleSize: number | null;
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
}: {
  engagementId: string;
  purposes: SamplingPurpose[];
  /** the S2.2 design screen — clicking a control's description returns there */
  s22Href?: string;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [populations, setPopulations] = useState<Record<string, string>>({});

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
        : body.error === "no-mapping" ? (fr ? "Colonnes du GL non mappées (compte, montant)." : "GL columns not mapped (account, amount).")
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

  async function assignToc(p: SamplingPurpose) {
    const pop = Number((populations[p.controlId] ?? "").replace(/[\s  ]/g, "")) || null;
    const suggestion = tocSuggested(p.controlType, p.frequency, pop, p.sole, fr);
    if (!suggestion || "needPopulation" in suggestion) return;
    // random selection: with the population known, draw the actual occurrence
    // numbers (1..population) without bias and disclose them
    let drawn: number[] = [];
    if (pop && pop > 0 && p.controlType === "manual") {
      const size = Math.min(suggestion.size, pop);
      const picked = new Set<number>();
      // eslint-disable-next-line react-hooks/purity -- event handler, not render: the random draw happens once per click and is persisted in the note
      while (picked.size < size) picked.add(1 + Math.floor(Math.random() * pop));
      drawn = [...picked].sort((a, b) => a - b);
    }
    const note =
      `${fr ? "Test de contrôles" : "Test of controls"} — ${suggestion.rule}` +
      (pop ? ` · ${fr ? "population" : "population"} ${n(pop)}` : "") +
      (drawn.length > 0 ? ` · ${fr ? "éléments tirés au hasard" : "randomly drawn items"}: ${drawn.join(", ")}` : "");
    const r = await op({ op: "updateControl", controlId: p.controlId, sampleSize: suggestion.size, sampleNote: note });
    if (r) {
      setDone(
        `${fr ? "Échantillon de" : "Sample of"} ${suggestion.size} ${fr ? "assigné à" : "assigned to"} « ${p.controlName} » — ${fr ? "visible sur S2.2" : "now on S2.2"}.` +
        (drawn.length > 0 ? ` ${fr ? "Éléments" : "Items"}: ${drawn.join(", ")}.` : ` ${fr ? "Saisir la population pour tirer les éléments au hasard." : "Enter the population to draw the items at random."}`),
      );
      router.refresh();
    }
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
        <p className="text-[11.5px] text-muted">
          {fr
            ? "Les contrôles sélectionnés pour test (S2.1) arrivent avec leurs attributs ; saisissez la population d'occurrences et la taille minimale suit la table des fréquences."
            : "The controls selected for testing (S2.1) arrive with their attributes; enter the population of occurrences and the minimum size follows the frequency table."}
        </p>
        {purposes.length === 0 ? (
          <p className="text-[12px] text-warn">{fr ? "Aucun contrôle sélectionné pour test — voir S2.1." : "No control selected for testing yet — see S2.1."}</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: "26%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={th}>{fr ? "Contrôle" : "Control"}</th>
                  <th className={th}>SCOT</th>
                  <th className={th}>{fr ? "Fréquence" : "Frequency"}</th>
                  <th className={th}>{fr ? "Assertions" : "Assertions"}</th>
                  <th className={th}>{fr ? "Population" : "Population"}</th>
                  <th className={th}>{fr ? "Taille minimale" : "Minimum sample"}</th>
                  <th className={th} />
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
                      <td className={`${td} text-ink-soft`}>{p.frequency ?? "—"}</td>
                      <td className={`${td} font-mono text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300`}>{p.assertions.join("") || "—"}</td>
                      <td className={`${td} p-1`}>
                        <input
                          value={populations[p.controlId] ?? ""}
                          onChange={(e) => setPopulations((s) => ({ ...s, [p.controlId]: e.target.value }))}
                          placeholder={normFreq(p.frequency) === "daily" ? "250+" : fr ? "optionnel" : "optional"}
                          className="w-full rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[12px] outline-none focus:border-emerald-600 tnum"
                          data-testid={`toc-pop-${p.controlName.replace(/[^A-Za-z0-9]/g, "_").slice(0, 24)}`}
                        />
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
                      <td className={`${td} text-right`}>
                        <button
                          type="button"
                          onClick={() => void assignToc(p)}
                          disabled={!suggestion || "needPopulation" in suggestion}
                          className="rounded-[var(--radius-atlas-xs)] bg-emerald-700 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
                          data-testid={`toc-assign-${p.controlName.replace(/[^A-Za-z0-9]/g, "_").slice(0, 24)}`}
                        >
                          {fr ? "Assigner" : "Assign"}
                        </button>
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
    </div>
  );
}
