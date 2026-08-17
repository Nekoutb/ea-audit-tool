"use client";

// The Sampling tool's two sub-tools for tests of controls:
//   Random (attribute) sampling — the user gives the population size; the size
//   comes from the attribute formula n = ln(1−CL)/ln(1−tolerable), capped at
//   the population, and the item numbers are drawn at random.
//   Monetary Unit Sampling — the population is the pre-audit GL filtered by
//   account prefix; interval defaults to TE/3; items ≥ interval form the top
//   stratum (examined in full). Sizes are computed, never typed.
// The purpose list holds every control selected for testing (S2.1); confirming
// assigns the size + method note straight onto that control's S2.2 design card.

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface SamplingPurpose {
  controlId: string;
  controlName: string;
  scotName: string;
  sampleSize: number | null;
}

const CONFIDENCES = [
  { value: 0.9, label: "90%" },
  { value: 0.95, label: "95%" },
] as const;
const TOLERABLES = [
  { value: 0.05, label: "5%" },
  { value: 0.1, label: "10%" },
] as const;

export function SamplingStudio({
  engagementId,
  purposes,
  locale,
}: {
  engagementId: string;
  purposes: SamplingPurpose[];
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const [tool, setTool] = useState<"random" | "mus">("random");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // random
  const [population, setPopulation] = useState("");
  const [confidence, setConfidence] = useState(0.9);
  const [tolerable, setTolerable] = useState(0.1);
  const [randomResult, setRandomResult] = useState<{ size: number; items: number[] } | null>(null);

  // mus
  const [prefix, setPrefix] = useState("");
  const [interval, setInterval] = useState("");
  const [musResult, setMusResult] = useState<{ populationValue: number; populationCount: number; interval: number; topStratum: number; sampleSize: number } | null>(null);
  const [musPending, setMusPending] = useState(false);

  const n = (x: number) => new Intl.NumberFormat("fr-FR").format(x);
  const input = "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-emerald-600";

  function runRandom() {
    setError(null); setDone(null); setMusResult(null);
    const pop = Math.floor(Number(population.replace(/[\s  ]/g, "")));
    if (!Number.isFinite(pop) || pop < 1) { setError(fr ? "Population invalide." : "Invalid population."); return; }
    const size = Math.min(pop, Math.ceil(Math.log(1 - confidence) / Math.log(1 - tolerable)));
    // draw distinct item numbers at random
    const picked = new Set<number>();
    while (picked.size < size) picked.add(1 + Math.floor(Math.random() * pop));
    setRandomResult({ size, items: [...picked].sort((a, b) => a - b) });
  }

  async function runMus() {
    setError(null); setDone(null); setRandomResult(null); setMusPending(true);
    const r = await fetch(`/api/engagements/${engagementId}/scots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "musPreview", prefix, interval: interval ? Number(interval.replace(/[\s  ]/g, "")) : undefined }),
    }).catch(() => null);
    setMusPending(false);
    const body = await r?.json().catch(() => null);
    if (!r?.ok || !body) { setError(fr ? "Échec du calcul." : "Computation failed."); return; }
    if (!body.ok) {
      setError(
        body.error === "no-gl"
          ? fr ? "Aucun grand livre — importer le GL dans l'analyseur." : "No general ledger — upload it in the GL Analyzer."
          : body.error === "empty-population"
            ? fr ? "Aucune ligne du GL ne correspond à ce préfixe." : "No GL line matches that account prefix."
            : fr ? "Colonnes du GL non mappées." : "GL columns not mapped.",
      );
      return;
    }
    setMusResult(body);
  }

  async function assign() {
    setError(null);
    const result = tool === "random" ? randomResult : musResult;
    if (!result || !purpose) return;
    const size = tool === "random" ? randomResult!.size : musResult!.sampleSize;
    const note =
      tool === "random"
        ? `${fr ? "Sondage aléatoire par attributs" : "Random attribute sampling"} — ${fr ? "population" : "population"} ${n(Number(population))}, ${fr ? "confiance" : "confidence"} ${Math.round(confidence * 100)}%, ${fr ? "taux tolérable" : "tolerable rate"} ${Math.round(tolerable * 100)}% · ${fr ? "éléments" : "items"}: ${randomResult!.items.slice(0, 40).join(", ")}${randomResult!.items.length > 40 ? "…" : ""}`
        : `MUS — ${fr ? "comptes" : "accounts"} ${prefix || (fr ? "tous" : "all")}, ${fr ? "population" : "population"} ${n(musResult!.populationValue)} FCFA (${n(musResult!.populationCount)} ${fr ? "lignes" : "lines"}), ${fr ? "intervalle" : "interval"} ${n(musResult!.interval)}, ${fr ? "strate haute" : "top stratum"} ${musResult!.topStratum}`;
    const r = await fetch(`/api/engagements/${engagementId}/scots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "updateControl", controlId: purpose, sampleSize: size, sampleNote: note }),
    }).catch(() => null);
    if (!r?.ok) { setError(fr ? "Échec de l'assignation." : "Assignment failed."); return; }
    const p = purposes.find((x) => x.controlId === purpose);
    setDone(`${fr ? "Échantillon de" : "Sample of"} ${size} ${fr ? "assigné à" : "assigned to"} « ${p?.controlName} » — ${fr ? "visible sur S2.2" : "now on S2.2"}.`);
    router.refresh();
  }

  const result = tool === "random" ? randomResult : musResult;
  const tab = (t: "random" | "mus", label: string) => (
    <button
      type="button"
      onClick={() => { setTool(t); setError(null); setDone(null); }}
      className={`rounded-full px-3 py-1 text-[12.5px] font-semibold transition ${tool === t ? "bg-emerald-700 text-white" : "border border-line-strong text-ink-soft hover:border-emerald-600"}`}
      data-testid={`sampling-tab-${t}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3" data-testid="sampling-studio">
      <div className="flex flex-wrap items-center gap-2">
        {tab("random", fr ? "Sondage aléatoire" : "Random sampling")}
        {tab("mus", fr ? "Sondage par unités monétaires (MUS)" : "Monetary Unit Sampling (MUS)")}
        {error ? <span role="alert" className="text-[12px] font-semibold text-rose">{error}</span> : null}
        {done ? <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400" data-testid="sampling-assigned">{done}</span> : null}
      </div>

      {tool === "random" ? (
        <div className="flex flex-wrap items-end gap-2.5" data-testid="sampling-random">
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Taille de la population (occurrences du contrôle)" : "Population size (occurrences of the control)"}
            <input value={population} onChange={(e) => setPopulation(e.target.value)} placeholder="250" className={`${input} w-[190px]`} data-testid="random-population" />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Confiance" : "Confidence"}
            <select value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className={input}>
              {CONFIDENCES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Taux d'écart tolérable" : "Tolerable deviation rate"}
            <select value={tolerable} onChange={(e) => setTolerable(Number(e.target.value))} className={input}>
              {TOLERABLES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={runRandom} className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-800" data-testid="random-run">
            {fr ? "Calculer" : "Compute"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2.5" data-testid="sampling-mus">
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Préfixe de comptes du GL (ex. 70, 411)" : "GL account prefix (e.g. 70, 411)"}
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="70" className={`${input} w-[170px]`} data-testid="mus-prefix" />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Intervalle (vide = TE ÷ 3)" : "Interval (blank = TE ÷ 3)"}
            <input value={interval} onChange={(e) => setInterval(e.target.value)} placeholder={fr ? "auto" : "auto"} className={`${input} w-[150px]`} data-testid="mus-interval" />
          </label>
          <button type="button" onClick={runMus} disabled={musPending} className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-60" data-testid="mus-run">
            {musPending ? "…" : fr ? "Calculer depuis le GL" : "Compute from the GL"}
          </button>
        </div>
      )}

      {result ? (
        <div className="rounded-[var(--radius-atlas-sm)] border border-emerald-600/30 bg-emerald-50 px-3.5 py-2.5 dark:bg-emerald-950/30" data-testid="sampling-result">
          {tool === "random" && randomResult ? (
            <>
              <p className="text-[13.5px] text-ink">
                {fr ? "Taille d'échantillon" : "Sample size"}: <b className="tnum text-[15px]">{randomResult.size}</b>
                <span className="ml-2 text-[11.5px] text-muted">
                  n = ln(1−{Math.round(confidence * 100)}%) / ln(1−{Math.round(tolerable * 100)}%)
                </span>
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">
                {fr ? "Éléments tirés au hasard" : "Randomly drawn items"}: <span className="tnum">{randomResult.items.join(", ")}</span>
              </p>
            </>
          ) : musResult ? (
            <p className="text-[13.5px] text-ink">
              {fr ? "Taille d'échantillon" : "Sample size"}: <b className="tnum text-[15px]">{musResult.sampleSize}</b>
              <span className="ml-2 text-[11.5px] text-muted">
                {fr ? "population" : "population"} {n(musResult.populationValue)} FCFA · {n(musResult.populationCount)} {fr ? "lignes" : "lines"} · {fr ? "intervalle" : "interval"} {n(musResult.interval)} · {fr ? "strate haute (≥ intervalle, à 100%)" : "top stratum (≥ interval, in full)"} {musResult.topStratum}
              </span>
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-emerald-600/20 pt-2">
            <span className="text-[11.5px] font-semibold text-ink-soft">{fr ? "Objet — contrôle sélectionné pour test" : "Purpose — control selected for testing"}:</span>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={input} data-testid="sampling-purpose">
              <option value="">{fr ? "— choisir un contrôle" : "— choose a control"}</option>
              {purposes.map((p) => (
                <option key={p.controlId} value={p.controlId}>
                  {p.scotName} · {p.controlName}{p.sampleSize ? ` (${fr ? "actuel" : "current"}: ${p.sampleSize})` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={assign}
              disabled={!purpose}
              className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              data-testid="sampling-assign"
            >
              {fr ? "Confirmer et assigner à la conception du test" : "Confirm & assign to the test design"}
            </button>
          </div>
          {purposes.length === 0 ? (
            <p className="mt-1 text-[11px] text-warn">{fr ? "Aucun contrôle sélectionné pour test — voir S2.1." : "No control selected for testing yet — see S2.1."}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
