"use client";

// GL insight suite: five working-paper sheets over the ingested general ledger,
// rendered through the Excel primitives (components/ui/excel.tsx) so each panel
// reads like a worksheet — column letters, row numbers, blue header cells, grey
// calculated cells. The first four insights arrive precomputed from the server
// page; the account correlation study is interactive (pick 2..6 prefixes, POST,
// render the month x day matrix and the pairwise Pearson table).

import { useState } from "react";
import { SCell, SRow, Sheet, SheetNote, SheetTable, num, type SheetCol } from "@/components/ui/excel";
import type {
  ClassVolumes,
  CorrelationResult,
  EntryLag,
  GlPrefix,
  PreparersReviewers,
  WeekdayAnalysis,
} from "@/lib/gl-insights";

const ROLE_LABELS: Record<string, { en: string; fr: string }> = {
  recordedBy: { en: "Recorded by", fr: "Saisi par" },
  preparedBy: { en: "Prepared by", fr: "Préparé par" },
  approvedBy: { en: "Approved by", fr: "Approuvé par" },
};

const CLASS_LABELS: Record<string, { en: string; fr: string }> = {
  "1": { en: "Durable resources", fr: "Ressources durables" },
  "2": { en: "Fixed assets", fr: "Actif immobilisé" },
  "3": { en: "Inventories", fr: "Stocks" },
  "4": { en: "Third parties", fr: "Tiers" },
  "5": { en: "Treasury", fr: "Trésorerie" },
  "6": { en: "Expenses", fr: "Charges" },
  "7": { en: "Income", fr: "Produits" },
};

const WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FR = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

const LAG_BUCKET_LABELS: Record<string, { en: string; fr: string }> = {
  d0: { en: "0 days", fr: "0 jour" },
  d1_7: { en: "1–7 days", fr: "1–7 jours" },
  d8_30: { en: "8–30 days", fr: "8–30 jours" },
  d31_90: { en: "31–90 days", fr: "31–90 jours" },
  over90: { en: "> 90 days", fr: "> 90 jours" },
};

function names(list: string[], fr: boolean): string {
  if (list.length === 0) return "—";
  const shown = list.slice(0, 10).join(", ");
  const extra = list.length - 10;
  return extra > 0 ? `${shown} ${fr ? `+${extra} autres` : `+${extra} more`}` : shown;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export function GlInsightsBoard({
  engagementId,
  locale,
  preparers,
  volumes,
  weekdays,
  lag,
  prefixes,
}: {
  engagementId: string;
  locale: "en" | "fr";
  preparers: PreparersReviewers | null;
  volumes: ClassVolumes | null;
  weekdays: WeekdayAnalysis | null;
  /** null = the JE entry-date column is unmapped (a hint is shown) */
  lag: EntryLag | null;
  prefixes: GlPrefix[];
}) {
  const fr = locale === "fr";
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
  const weekdayLabels = fr ? WEEKDAYS_FR : WEEKDAYS_EN;
  const monthLabels = fr ? MONTHS_FR : MONTHS_EN;
  const noGl = fr ? "Aucun grand livre importé." : "No general ledger imported.";

  // correlation panel state
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState(false);
  const [corrError, setCorrError] = useState<string | null>(null);
  const [corr, setCorr] = useState<CorrelationResult | null>(null);

  const toggle = (prefix: string) =>
    setSelected((s) => (s.includes(prefix) ? s.filter((p) => p !== prefix) : [...s, prefix]));

  async function compute() {
    setPending(true);
    setCorrError(null);
    const response = await fetch(`/api/engagements/${engagementId}/gl-insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "correlate", accounts: selected }),
    });
    setPending(false);
    const body = (await response.json().catch(() => ({}))) as { result?: CorrelationResult; error?: string };
    if (!response.ok || !body.result) {
      setCorr(null);
      setCorrError(fr ? "Échec du calcul de corrélation." : "Correlation computation failed.");
      return;
    }
    setCorr(body.result);
  }

  const interp = (r: number | null): string => {
    if (r === null) return fr ? "non calculable" : "not computable";
    const a = Math.abs(r);
    const strength = a >= 0.7 ? (fr ? "forte" : "strong") : a >= 0.4 ? (fr ? "modérée" : "moderate") : fr ? "faible" : "weak";
    const sign = r >= 0 ? (fr ? "positive" : "positive") : fr ? "négative" : "negative";
    return fr ? `corrélation ${strength} ${sign}` : `${strength} ${sign} correlation`;
  };

  const visiblePrefixes = prefixes.filter(
    (p) =>
      p.prefix.includes(filter.trim()) ||
      (p.name ?? "").toLowerCase().includes(filter.trim().toLowerCase()),
  );

  // ── column geometries ────────────────────────────────────────────────────
  const preparerCols: SheetCol[] = [
    { label: fr ? "Rôle" : "Role", width: 150 },
    { label: fr ? "Utilisateurs N" : "CY users", width: 96, align: "right" },
    { label: fr ? "Utilisateurs N-1" : "PY users", width: 96, align: "right" },
    { label: fr ? "Nouveaux en N" : "New in CY", width: 280 },
    { label: fr ? "Disparus depuis N-1" : "Gone since PY", width: 280 },
  ];

  const volumeCols: SheetCol[] = [
    { label: fr ? "Classe" : "Class", width: 64, align: "center" },
    { label: fr ? "Intitulé" : "Label", width: 190 },
    { label: fr ? "Lignes N" : "CY lines", width: 92, align: "right" },
    { label: fr ? "Montant brut N" : "CY gross", width: 128, align: "right" },
    { label: fr ? "Lignes N-1" : "PY lines", width: 92, align: "right" },
    { label: fr ? "Montant brut N-1" : "PY gross", width: 128, align: "right" },
    { label: fr ? "Δ lignes %" : "Δ lines %", width: 96, align: "right" },
    { label: fr ? "Δ montant %" : "Δ gross %", width: 96, align: "right" },
  ];

  const weekdayCols: SheetCol[] = [
    { label: fr ? "Jour" : "Day", width: 96 },
    { label: fr ? "Journaux" : "Journals", width: 96, align: "right" },
    { label: fr ? "Lignes" : "Lines", width: 96, align: "right" },
    { label: fr ? "Montant brut" : "Gross amount", width: 136, align: "right" },
    { label: fr ? "Indicateur" : "Flag", width: 116 },
  ];

  const lagCols: SheetCol[] = [
    { label: fr ? "Décalage" : "Lag", width: 150 },
    { label: fr ? "Journaux" : "Journals", width: 96, align: "right" },
  ];

  const corrTotalCols: SheetCol[] = [
    { label: fr ? "Préfixe" : "Prefix", width: 96 },
    { label: fr ? "Lignes" : "Lines", width: 96, align: "right" },
    { label: fr ? "Montant brut" : "Gross amount", width: 136, align: "right" },
  ];

  const matrixCols: SheetCol[] = [
    { label: fr ? "Mois" : "Month", width: 72 },
    ...Array.from({ length: 31 }, (_, i) => ({ label: i + 1, width: 30, align: "center" as const })),
  ];

  const pairCols: SheetCol[] = [
    { label: fr ? "Paire" : "Pair", width: 150 },
    { label: "r", width: 72, align: "right" },
    { label: fr ? "Lecture" : "Interpretation", width: 260 },
  ];

  // ── totals ───────────────────────────────────────────────────────────────
  const volumeTotals = volumes
    ? {
        cyLines: sum(volumes.rows.map((r) => r.cyLines)),
        cyGross: sum(volumes.rows.map((r) => r.cyGross)),
        pyLines: volumes.hasPy ? sum(volumes.rows.map((r) => r.pyLines ?? 0)) : null,
        pyGross: volumes.hasPy ? sum(volumes.rows.map((r) => r.pyGross ?? 0)) : null,
      }
    : null;
  const pctOf = (now: number, base: number | null): number | null =>
    base === null || base === 0 ? null : Math.round(((now - base) / base) * 1000) / 10;

  const weekdayTotals = weekdays
    ? {
        journals: sum(weekdays.rows.map((r) => r.journals)),
        lines: sum(weekdays.rows.map((r) => r.lines)),
        gross: sum(weekdays.rows.map((r) => r.gross)),
      }
    : null;

  const pctCell = (value: number | null) => {
    const strong = value !== null && Math.abs(value) >= 50;
    return (
      <SCell
        align="right"
        kind="calc"
        className={strong ? "font-bold" : undefined}
        title={strong ? (fr ? "Variation d'au moins 50 %" : "Movement of 50% or more") : undefined}
      >
        {num(value, { digits: 1, suffix: "%", signed: true })}
      </SCell>
    );
  };

  return (
    <div className="flex flex-col gap-4" data-testid="gl-insights">
      {/* 1 ─ Preparers & reviewers */}
      <Sheet
        testId="gl-preparers"
        title={fr ? "Préparateurs et réviseurs" : "Preparers & reviewers"}
        subtitle={fr ? "Grand livre N vs N-1" : "CY vs PY general ledger"}
        objective={
          fr
            ? "Objectif : identifier qui saisit, prépare et approuve les écritures, et comparer cette population à celle de l'exercice précédent pour repérer les arrivées, les départs et les cumuls de fonctions."
            : "Objective: identify who records, prepares and approves journal entries, and compare that population with the prior year to spot joiners, leavers and combined duties."
        }
      >
        {preparers ? (
          <>
            <SheetTable cols={preparerCols} testId="gl-preparers-table">
              <tbody>
                {preparers.roles.map((role, i) => (
                  <SRow key={role.key} n={i + 1} testId={`gl-preparers-${role.key}`}>
                    <SCell className="font-semibold">
                      {fr ? ROLE_LABELS[role.key].fr : ROLE_LABELS[role.key].en}
                    </SCell>
                    {role.mapped ? (
                      <>
                        <SCell align="right" kind="calc">{num(role.cyCount)}</SCell>
                        <SCell align="right" kind="calc">{num(role.pyCount)}</SCell>
                        <SCell wrap>{role.pyCount === null ? "—" : names(role.onlyCy, fr)}</SCell>
                        <SCell wrap>{role.pyCount === null ? "—" : names(role.onlyPy, fr)}</SCell>
                      </>
                    ) : (
                      <SCell colSpan={4} wrap>
                        {fr ? "Colonne non mappée sur le grand livre N" : "Column not mapped on the CY ledger"}
                      </SCell>
                    )}
                  </SRow>
                ))}
              </tbody>
            </SheetTable>
            {!preparers.hasPy ? (
              <SheetNote testId="gl-preparers-hint">
                {fr
                  ? "Importer le grand livre N-1 (option « Grand livre N-1 ») pour comparer les utilisateurs d'une année sur l'autre."
                  : "Import the prior-year GL (the 'Prior-year GL' timing) to compare users year over year."}
              </SheetNote>
            ) : null}
          </>
        ) : (
          <SheetNote>{noGl}</SheetNote>
        )}
      </Sheet>

      {/* 2 ─ Volumes by account class */}
      <Sheet
        testId="gl-class-volumes"
        title={fr ? "Volumes par classe de comptes" : "Volumes by account class"}
        subtitle={fr ? "Classes SYSCOHADA 1 à 7" : "SYSCOHADA classes 1 to 7"}
        objective={
          fr
            ? "Objectif : comparer le nombre de lignes et les montants bruts par classe de comptes avec l'exercice précédent ; les colonnes Δ sont calculées et signalent les mouvements d'au moins 50 %."
            : "Objective: compare line counts and gross amounts by account class with the prior year; the Δ columns are calculated and flag movements of 50% or more."
        }
      >
        {volumes && volumeTotals ? (
          <>
            <SheetTable cols={volumeCols} testId="gl-class-volumes-table">
              <tbody>
                {volumes.rows.map((row, i) => (
                  <SRow key={row.cls} n={i + 1} testId={`gl-class-${row.cls}`}>
                    <SCell align="center" className="font-mono font-bold">{row.cls}</SCell>
                    <SCell wrap>{fr ? CLASS_LABELS[row.cls].fr : CLASS_LABELS[row.cls].en}</SCell>
                    <SCell align="right">{num(row.cyLines)}</SCell>
                    <SCell align="right">{num(row.cyGross)}</SCell>
                    <SCell align="right">{num(row.pyLines)}</SCell>
                    <SCell align="right">{num(row.pyGross)}</SCell>
                    {pctCell(row.linesPct)}
                    {pctCell(row.grossPct)}
                  </SRow>
                ))}
                <SRow n={volumes.rows.length + 1} total testId="gl-class-volumes-total">
                  <SCell align="center" kind="calc">Σ</SCell>
                  <SCell kind="calc">{fr ? "Total général" : "Grand total"}</SCell>
                  <SCell align="right" kind="calc">{num(volumeTotals.cyLines)}</SCell>
                  <SCell align="right" kind="calc">{num(volumeTotals.cyGross)}</SCell>
                  <SCell align="right" kind="calc">{num(volumeTotals.pyLines)}</SCell>
                  <SCell align="right" kind="calc">{num(volumeTotals.pyGross)}</SCell>
                  {pctCell(pctOf(volumeTotals.cyLines, volumeTotals.pyLines))}
                  {pctCell(pctOf(volumeTotals.cyGross, volumeTotals.pyGross))}
                </SRow>
              </tbody>
            </SheetTable>
            {!volumes.hasPy ? (
              <SheetNote testId="gl-class-volumes-hint">
                {fr
                  ? "Sans grand livre N-1, les colonnes N-1 et les variations restent vides."
                  : "Without a prior-year GL the PY columns and % changes stay empty."}
              </SheetNote>
            ) : null}
          </>
        ) : (
          <SheetNote>{noGl}</SheetNote>
        )}
      </Sheet>

      {/* 3 ─ Journals by weekday */}
      <Sheet
        testId="gl-weekday"
        title={fr ? "Écritures par jour de la semaine" : "Journals by weekday"}
        subtitle={fr ? "Date d'effet du journal" : "Journal effective date"}
        objective={
          fr
            ? "Objectif : tester le moment de comptabilisation des écritures ; les journaux passés un samedi ou un dimanche portent la mention « Week-end » et font l'objet d'un suivi."
            : "Objective: test when journals are posted; entries recorded on a Saturday or Sunday carry the word 'Weekend' and are followed up."
        }
      >
        {weekdays && weekdayTotals ? (
          <>
            <SheetTable cols={weekdayCols} testId="gl-weekday-table">
              <tbody>
                {weekdays.rows.map((row, i) => {
                  const weekend = row.dow >= 5;
                  return (
                    <SRow key={row.dow} n={i + 1} testId={`gl-weekday-${row.dow}`}>
                      <SCell kind={weekend ? "calc" : "input"} className="font-semibold">
                        {weekdayLabels[row.dow]}
                      </SCell>
                      <SCell align="right">{num(row.journals)}</SCell>
                      <SCell align="right">{num(row.lines)}</SCell>
                      <SCell align="right">{num(row.gross)}</SCell>
                      <SCell kind={weekend ? "calc" : "input"} className={weekend ? "font-bold" : undefined}>
                        {weekend ? (fr ? "⚑ Week-end" : "⚑ Weekend") : fr ? "Jour ouvré" : "Working day"}
                      </SCell>
                    </SRow>
                  );
                })}
                <SRow n={weekdays.rows.length + 1} total testId="gl-weekday-total">
                  <SCell kind="calc">{fr ? "Total" : "Total"}</SCell>
                  <SCell align="right" kind="calc">{num(weekdayTotals.journals)}</SCell>
                  <SCell align="right" kind="calc">{num(weekdayTotals.lines)}</SCell>
                  <SCell align="right" kind="calc">{num(weekdayTotals.gross)}</SCell>
                  <SCell kind="calc" />
                </SRow>
              </tbody>
            </SheetTable>
            {weekdays.undated > 0 ? (
              <SheetNote testId="gl-weekday-undated" className="tnum">
                {weekdays.undated} {fr ? "ligne(s) sans date lisible ignorée(s)." : "line(s) skipped for unreadable dates."}
              </SheetNote>
            ) : null}
          </>
        ) : (
          <SheetNote>{noGl}</SheetNote>
        )}
      </Sheet>

      {/* 4 ─ Entry date vs effective date */}
      <Sheet
        testId="gl-entry-lag"
        title={fr ? "Date de saisie vs date d'effet" : "Entry date vs effective date"}
        subtitle={fr ? "Journaux datés des deux côtés" : "Journals dated on both sides"}
        objective={
          fr
            ? "Objectif : mesurer le décalage entre la date de saisie d'une écriture et sa date d'effet, et répartir les journaux par tranche de décalage — un décalage long peut signaler des écritures rétroactives."
            : "Objective: measure the lag between the date a journal was entered and the date it takes effect, and spread the journals across lag bands — a long lag can signal back-dated entries."
        }
      >
        {lag ? (
          <>
            <SheetNote testId="gl-entry-lag-summary" className="tnum">
              {fr
                ? `Décalage moyen ${lag.avgDays} jours · maximum ${lag.maxDays} jours · ${fmt(lag.journals)} journaux datés`
                : `Average lag ${lag.avgDays} days · maximum ${lag.maxDays} days · ${fmt(lag.journals)} dated journals`}
            </SheetNote>
            <SheetTable cols={lagCols} testId="gl-entry-lag-table">
              <tbody>
                {lag.buckets.map((bucket, i) => (
                  <SRow key={bucket.key} n={i + 1} testId={`gl-lag-${bucket.key}`}>
                    <SCell>{fr ? LAG_BUCKET_LABELS[bucket.key].fr : LAG_BUCKET_LABELS[bucket.key].en}</SCell>
                    <SCell align="right" kind="calc">{num(bucket.journals)}</SCell>
                  </SRow>
                ))}
                <SRow n={lag.buckets.length + 1} total testId="gl-lag-total">
                  <SCell kind="calc">{fr ? "Total" : "Total"}</SCell>
                  <SCell align="right" kind="calc">{num(sum(lag.buckets.map((b) => b.journals)))}</SCell>
                </SRow>
              </tbody>
            </SheetTable>
          </>
        ) : (
          <SheetNote testId="gl-entry-lag-hint">
            {fr
              ? "Mappez la colonne « Date de saisie » lors de l'ingestion du grand livre pour comparer la date de saisie à la date d'effet."
              : "Map the 'JE date (entered)' column when ingesting the GL to compare entry dates with effective dates."}
          </SheetNote>
        )}
      </Sheet>

      {/* 5 ─ Account correlation */}
      <Sheet
        testId="gl-correlation"
        title={fr ? "Corrélation entre comptes" : "Account correlation"}
        subtitle={fr ? "2 à 6 préfixes" : "2 to 6 prefixes"}
        objective={
          fr
            ? "Objectif : choisir 2 à 6 préfixes de comptes pour isoler les journaux touchant tous les préfixes, lire leur répartition mois × jour et mesurer la corrélation de Pearson des volumes quotidiens."
            : "Objective: pick 2 to 6 account prefixes to isolate the journals touching every prefix, read their month × day spread, and measure the Pearson correlation of daily volumes."
        }
      >
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={fr ? "Filtrer les préfixes…" : "Filter prefixes…"}
            spellCheck={false}
            data-testid="gl-corr-search"
            aria-label={fr ? "Filtrer les préfixes" : "Filter prefixes"}
            className="w-full max-w-xs rounded-[4px] border border-[color:var(--xl-frame)] bg-[var(--xl-input)] px-2.5 py-1.5 text-[12px] text-[color:var(--xl-ink)] outline-none placeholder:text-[color:var(--xl-gutter-ink)] focus:border-emerald-600"
          />
          <div
            className="max-h-52 overflow-y-auto border border-[color:var(--xl-frame)] bg-[var(--xl-input)]"
            data-testid="gl-corr-prefixes"
          >
            {visiblePrefixes.length === 0 ? (
              <p className="px-3 py-2 text-[11.5px] text-[color:var(--xl-gutter-ink)]">
                {fr ? "Aucun préfixe." : "No prefixes."}
              </p>
            ) : (
              visiblePrefixes.map((p) => (
                <label
                  key={p.prefix}
                  className="flex cursor-pointer items-center gap-2 border-t border-[color:var(--xl-line)] px-3 py-1.5 text-[11.5px] text-[color:var(--xl-ink)] first:border-t-0 hover:bg-[var(--xl-calc)]"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(p.prefix)}
                    onChange={() => toggle(p.prefix)}
                    data-testid={`gl-corr-prefix-${p.prefix}`}
                    className="accent-emerald-700"
                  />
                  <span className="font-mono font-semibold">{p.prefix}</span>
                  <span className="min-w-0 flex-1 truncate text-[color:var(--xl-ink-soft)]">{p.name ?? "—"}</span>
                  <span className="tnum text-[color:var(--xl-gutter-ink)]">
                    {fmt(p.lines)} {fr ? "lignes" : "lines"}
                  </span>
                </label>
              ))
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={compute}
              disabled={pending || selected.length < 2 || selected.length > 6}
              data-testid="gl-corr-run"
              className="rounded-[4px] bg-emerald-700 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {pending ? "…" : fr ? "Calculer" : "Compute"}
            </button>
            <span className="tnum text-[11.5px] text-[color:var(--xl-gutter-ink)]">
              {selected.length} {fr ? "sélectionné(s) (2 à 6 requis)" : "selected (2 to 6 required)"}
            </span>
            {corrError ? (
              <p role="alert" className="text-[11.5px] font-semibold text-[color:var(--xl-neg)]">
                {corrError}
              </p>
            ) : null}
          </div>
        </div>

        {corr ? (
          <>
            <SheetTable cols={corrTotalCols} testId="gl-corr-totals">
              <tbody>
                {corr.prefixes.map((p, i) => (
                  <SRow key={p.prefix} n={i + 1} testId={`gl-corr-total-${p.prefix}`}>
                    <SCell className="font-mono font-semibold">{p.prefix}</SCell>
                    <SCell align="right">{num(p.lines)}</SCell>
                    <SCell align="right">{num(p.gross)}</SCell>
                  </SRow>
                ))}
                <SRow n={corr.prefixes.length + 1} total testId="gl-corr-totals-total">
                  <SCell kind="calc">{fr ? "Total" : "Total"}</SCell>
                  <SCell align="right" kind="calc">{num(sum(corr.prefixes.map((p) => p.lines)))}</SCell>
                  <SCell align="right" kind="calc">{num(sum(corr.prefixes.map((p) => p.gross)))}</SCell>
                </SRow>
              </tbody>
            </SheetTable>

            <SheetNote testId="gl-corr-shared" className="tnum">
              {fr
                ? `${fmt(corr.sharedJournals)} journaux touchent l'ensemble des préfixes sélectionnés.`
                : `${fmt(corr.sharedJournals)} journals touch every selected prefix.`}
            </SheetNote>

            <SheetTable cols={matrixCols} testId="gl-corr-matrix">
              <tbody>
                {corr.matrix.map((days, month) => (
                  <SRow key={month} n={month + 1} testId={`gl-corr-month-${month}`}>
                    <SCell className="font-semibold">{monthLabels[month]}</SCell>
                    {days.map((count, day) => (
                      <SCell
                        key={day}
                        align="center"
                        kind={count > 0 ? "calc" : "input"}
                        className={count > 0 ? "tnum font-bold" : "tnum"}
                      >
                        {count > 0 ? count : "·"}
                      </SCell>
                    ))}
                  </SRow>
                ))}
              </tbody>
            </SheetTable>

            <SheetTable cols={pairCols} testId="gl-corr-pairs">
              <tbody>
                {corr.pairs.map((pair, i) => (
                  <SRow key={`${pair.a}-${pair.b}`} n={i + 1} testId={`gl-corr-pair-${pair.a}-${pair.b}`}>
                    <SCell className="font-mono">
                      {pair.a} × {pair.b}
                    </SCell>
                    <SCell align="right" kind="calc">
                      {num(pair.r, { digits: 2, minDigits: 2 })}
                    </SCell>
                    <SCell wrap>{interp(pair.r)}</SCell>
                  </SRow>
                ))}
              </tbody>
            </SheetTable>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}
