"use client";

// The Sampling tool, structured like the methodology chapter:
//   1 — Sampling for TESTS OF CONTROLS: the controls selected for testing
//       arrive with their attributes straight from S2.1/S2.2; the user only
//       supplies the population of occurrences and the minimum sample follows
//       the frequency table (manual daily 25 — or 60 when it is the only
//       control covering an assertion — weekly 5, monthly/quarterly 2,
//       annually 1; 50–250 occurrences → 10%, under 50 → 5, under 5 → all;
//       automated → test of one). Confirming assigns the size to the control.
//   2 — Sampling for TESTS OF DETAILS: pick the account from the GL dropdown;
//       base sample = (population − key items) ÷ TE, multiplied by the
//       audit-risk-table factor (CRA × assurance × key-item coverage); the
//       sample is drawn systematically (MUS) and revealed item by item.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { leadIndexFor } from "@/lib/lead-classes";
import { todLabel, type CraTod } from "@/lib/cra-model";

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

export interface GlAccountOption {
  prefix: string;
  total: number;
  lines: number;
}

const CRAS = [
  { value: "minimal", en: "Minimal", fr: "Minimal" },
  { value: "low", en: "Low", fr: "Faible" },
  { value: "low_sr", en: "Low + Significant risk", fr: "Faible + risque important" },
  { value: "moderate", en: "Moderate", fr: "Modéré" },
  { value: "high", en: "High", fr: "Élevé" },
  { value: "high_sr", en: "High + Significant risk", fr: "Élevé + risque important" },
] as const;
const ASSURANCES = [
  { value: "little", en: "Little", fr: "Faible" },
  { value: "some", en: "Some", fr: "Partielle" },
  { value: "corroborative", en: "Corroborative", fr: "Corroborante" },
  { value: "persuasive", en: "Persuasive", fr: "Persuasive" },
] as const;

const normFreq = (f: string | null): string => {
  const s = (f ?? "").toLowerCase();
  if (s.includes("dail") || s.includes("quotid")) return "daily";
  if (s.includes("week") || s.includes("hebdo")) return "weekly";
  if (s.includes("month") || s.includes("mensuel")) return "monthly";
  if (s.includes("quart") || s.includes("trimes")) return "quarterly";
  if (s.includes("semi") || s.includes("semes")) return "semi_annually";
  if (s.includes("ann")) return "annually";
  return s;
};

/** SAMPLE 3.3 — the minimum-sample table for tests of controls. */
function tocSuggested(
  controlType: string,
  frequency: string | null,
  population: number | null,
  sole: boolean,
  fr: boolean,
): { size: number; rule: string } | { needPopulation: true } | null {
  if (controlType !== "manual") {
    return { size: 1, rule: fr ? "Contrôle automatisé — test unique (ITGC efficaces)" : "Automated/application control — test of one (ITGCs effective)" };
  }
  const f = normFreq(frequency);
  if (f === "daily") {
    if (!population || population < 1) return { needPopulation: true };
    if (population > 250) {
      return sole
        ? { size: 60, rule: fr ? "Quotidien, seul contrôle sur l'assertion → 60" : "Daily, only control on its assertion → 60" }
        : { size: 25, rule: fr ? "Quotidien, population > 250 → 25" : "Daily, population > 250 → 25" };
    }
    if (population >= 50) return { size: Math.ceil(population * 0.1), rule: fr ? "50–250 occurrences → 10 %" : "50–250 occurrences → 10%" };
    if (population >= 5) return { size: 5, rule: fr ? "< 50 occurrences → 5" : "Under 50 occurrences → 5" };
    return { size: population, rule: fr ? "< 5 occurrences → 100 %" : "Under 5 occurrences → all of them" };
  }
  const table: Record<string, number> = { weekly: 5, monthly: 2, quarterly: 2, semi_annually: 2, annually: 1 };
  const size = table[f];
  if (!size) return null;
  const capped = population && population > 0 ? Math.min(size, population) : size;
  return { size: capped, rule: fr ? `Manuel ${frequency ?? ""} → minimum ${size}` : `Manual, ${frequency ?? "?"} → minimum ${size}` };
}

export function SamplingStudio({
  engagementId,
  purposes,
  glAccounts,
  craByIndex,
  s22Href,
  locale,
}: {
  engagementId: string;
  purposes: SamplingPurpose[];
  glAccounts: GlAccountOption[];
  /** S3.1 roll-up: lead index → CRA in sampling vocabulary (minimal…high_sr) */
  craByIndex?: Record<string, string>;
  /** the S2.2 design screen — clicking a control's description returns there */
  s22Href?: string;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [populations, setPopulations] = useState<Record<string, string>>({});

  // tests of details state
  const [prefix, setPrefix] = useState(glAccounts[0]?.prefix ?? "");
  const [cra, setCra] = useState("low");

  // S3.1 write-through: when the account changes, the matrix's roll-up for its
  // lead index becomes the CRA default (still overridable by hand)
  const s31 = useMemo(() => {
    if (!craByIndex || !prefix) return null;
    const idx = leadIndexFor(prefix);
    const v = idx ? craByIndex[idx] : undefined;
    return v ? { index: idx as string, value: v } : null;
  }, [craByIndex, prefix]);
  useEffect(() => {
    if (s31) setCra(s31.value);
  }, [s31]);
  const [assurance, setAssurance] = useState("little");
  const [threshold, setThreshold] = useState("");
  const [todPending, setTodPending] = useState(false);
  const [tod, setTod] = useState<{
    populationValue: number; populationCount: number; te: number; threshold: number;
    keyItemCount: number; keyItemValue: number; coveragePct: number; baseSize: number;
    factor: number | null; sampleSize: number; interval: number | null;
    items: { ref: string; account: string; amount: number; kind: "key" | "sample" }[];
  } | null>(null);

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

  async function runTod() {
    setError(null); setDone(null); setTodPending(true); setTod(null);
    const body = await op({
      op: "todPreview",
      prefix,
      cra,
      assurance,
      threshold: threshold ? Number(threshold.replace(/[\s  ]/g, "")) : undefined,
    });
    setTodPending(false);
    if (!body) return;
    if (!body.ok) {
      setError(
        body.error === "no-gl" ? (fr ? "Aucun grand livre — importer le GL dans l'analyseur." : "No general ledger — upload it in the GL Analyzer.")
        : body.error === "no-materiality" ? (fr ? "Seuil de signification non approuvé (P6.1)." : "Materiality not approved yet (P6.1).")
        : body.error === "empty-population" ? (fr ? "Aucune ligne pour ce compte." : "No GL line for that account.")
        : fr ? "Colonnes du GL non mappées." : "GL columns not mapped.",
      );
      return;
    }
    setTod(body);
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
      <div className="flex flex-col gap-1.5" data-testid="sampling-tod">
        <p className={sectionTitle}>{fr ? "2 · Échantillonnage — tests de détail" : "2 · Sampling for tests of details"}</p>
        <p className="text-[11.5px] text-muted">
          {fr
            ? "Choisissez le compte : les éléments clés (≥ seuil) sont examinés à 100 % ; l'échantillon représentatif = (population − éléments clés) ÷ TE × facteur des tables de risque, tiré en MUS systématique."
            : "Pick the account: key items (≥ threshold) are examined in full; the representative sample = (population − key items) ÷ TE × the audit-risk-table factor, drawn by systematic MUS."}
        </p>
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Compte (GL)" : "Account (GL)"}
            <select value={prefix} onChange={(e) => setPrefix(e.target.value)} className={input} data-testid="tod-account">
              {glAccounts.length === 0 ? <option value="">{fr ? "— aucun GL" : "— no GL yet"}</option> : null}
              {glAccounts.map((a) => (
                <option key={a.prefix} value={a.prefix}>
                  {a.prefix} — {n(a.total)} FCFA · {n(a.lines)} {fr ? "lignes" : "lines"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            CRA
            <select value={cra} onChange={(e) => setCra(e.target.value)} className={input} data-testid="tod-cra">
              {CRAS.map((c) => <option key={c.value} value={c.value}>{fr ? c.fr : c.en}</option>)}
            </select>
            {s31 ? (
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400" data-testid="tod-cra-s31">
                {fr ? `S3.1 (${s31.index}) : ${todLabel(s31.value as CraTod, "fr")}` : `From S3.1 (${s31.index}): ${todLabel(s31.value as CraTod, "en")}`}
              </span>
            ) : null}
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Assurance des autres procédures" : "Assurance from other procedures"}
            <select value={assurance} onChange={(e) => setAssurance(e.target.value)} className={input} data-testid="tod-assurance">
              {ASSURANCES.map((a) => <option key={a.value} value={a.value}>{fr ? a.fr : a.en}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted">
            {fr ? "Seuil éléments clés (vide = TE)" : "Key-item threshold (blank = TE)"}
            <input value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="TE" className={`${input} w-[140px] tnum`} data-testid="tod-threshold" />
          </label>
          <button
            type="button"
            onClick={runTod}
            disabled={todPending || !prefix}
            className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            data-testid="tod-run"
          >
            {todPending ? "…" : fr ? "Générer l'échantillon" : "Generate the sample"}
          </button>
        </div>

        {tod ? (
          <div className="rounded-[var(--radius-atlas-sm)] border border-emerald-600/30 bg-emerald-50 px-3.5 py-2.5 dark:bg-emerald-950/30" data-testid="tod-result">
            <p className="text-[13.5px] text-ink">
              {fr ? "Échantillon représentatif" : "Representative sample"}: <b className="tnum text-[15px]">{tod.sampleSize}</b>
              <span className="ml-2 text-[11.5px] text-muted">
                {fr ? "base" : "base"} {tod.baseSize} × {fr ? "facteur" : "factor"} {tod.factor ?? "—"} · {fr ? "intervalle" : "interval"} {tod.interval ? n(tod.interval) : "—"}
              </span>
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink-soft">
              {fr ? "Population" : "Population"} {n(tod.populationValue)} FCFA ({n(tod.populationCount)} {fr ? "lignes" : "lines"}) ·{" "}
              {fr ? "éléments clés" : "key items"} {tod.keyItemCount} ({n(tod.keyItemValue)} FCFA, {tod.coveragePct}% {fr ? "couverture" : "coverage"}, {fr ? "seuil" : "threshold"} {n(tod.threshold)}) ·{" "}
              TE {n(tod.te)}
              {tod.factor === null ? (
                <b className="ml-1 text-emerald-800 dark:text-emerald-300">{fr ? "— aucun échantillon représentatif requis à cette combinaison." : "— no representative sample required at this combination."}</b>
              ) : null}
            </p>
            {tod.items.length > 0 ? (
              <div className="mt-2 max-h-[300px] overflow-y-auto rounded-[var(--radius-atlas-xs)] border border-emerald-600/20">
                <table className="w-full text-[11.5px]" data-testid="tod-items">
                  <thead>
                    <tr className="bg-surface-2 text-left text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-muted">
                      <th className="px-2 py-1">{fr ? "Type" : "Kind"}</th>
                      <th className="px-2 py-1">{fr ? "Référence" : "Reference"}</th>
                      <th className="px-2 py-1">{fr ? "Compte" : "Account"}</th>
                      <th className="px-2 py-1 text-right">{fr ? "Montant" : "Amount"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tod.items.map((it, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="px-2 py-1">
                          <span className={`rounded-full px-1.5 py-[1px] text-[9px] font-bold ${it.kind === "key" ? "bg-[var(--color-warn-soft)] text-warn" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
                            {it.kind === "key" ? (fr ? "clé" : "key") : fr ? "échantillon" : "sample"}
                          </span>
                        </td>
                        <td className="px-2 py-1 font-mono text-[10.5px]">{it.ref}</td>
                        <td className="px-2 py-1 font-mono text-[10.5px]">{it.account}</td>
                        <td className="px-2 py-1 text-right tnum">{n(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
