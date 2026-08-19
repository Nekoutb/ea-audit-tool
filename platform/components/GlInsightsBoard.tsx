"use client";

// GL insight suite: five excel-style panels over the ingested general ledger.
// The first four insights arrive precomputed from the server page; the account
// correlation study is interactive (pick 2..6 prefixes, POST, render the
// month x day matrix and the pairwise Pearson table).

import { useState } from "react";
import { Panel } from "@/components/ui/atlas";
import { GRID_CELL, GRID_HEAD, GRID_NUM } from "@/components/ui/grid";
import type {
  ClassVolumes,
  CorrelationResult,
  EntryLag,
  GlPrefix,
  PreparersReviewers,
  WeekdayAnalysis,
} from "@/lib/gl-insights";

const TITLE = "text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";

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

  return (
    <div className="flex flex-col gap-4" data-testid="gl-insights">
      {/* 1 ─ Preparers & reviewers */}
      <Panel data-testid="gl-preparers">
        <h3 className={TITLE}>{fr ? "Préparateurs et réviseurs" : "Preparers & reviewers"}</h3>
        {preparers ? (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse" data-testid="gl-preparers-table">
                <thead>
                  <tr className={GRID_HEAD}>
                    <th className={`${GRID_CELL} text-left`}>{fr ? "Rôle" : "Role"}</th>
                    <th className={GRID_NUM}>{fr ? "Utilisateurs N" : "CY users"}</th>
                    <th className={GRID_NUM}>{fr ? "Utilisateurs N-1" : "PY users"}</th>
                    <th className={`${GRID_CELL} text-left`}>{fr ? "Nouveaux en N" : "New in CY"}</th>
                    <th className={`${GRID_CELL} text-left`}>{fr ? "Disparus depuis N-1" : "Gone since PY"}</th>
                  </tr>
                </thead>
                <tbody>
                  {preparers.roles.map((role) => (
                    <tr key={role.key} data-testid={`gl-preparers-${role.key}`}>
                      <td className={`${GRID_CELL} font-medium`}>{fr ? ROLE_LABELS[role.key].fr : ROLE_LABELS[role.key].en}</td>
                      {role.mapped ? (
                        <>
                          <td className={GRID_NUM}>{role.cyCount === null ? "—" : fmt(role.cyCount)}</td>
                          <td className={GRID_NUM}>{role.pyCount === null ? "—" : fmt(role.pyCount)}</td>
                          <td className={`${GRID_CELL} whitespace-normal`}>{role.pyCount === null ? "—" : names(role.onlyCy, fr)}</td>
                          <td className={`${GRID_CELL} whitespace-normal`}>{role.pyCount === null ? "—" : names(role.onlyPy, fr)}</td>
                        </>
                      ) : (
                        <td className={`${GRID_CELL} text-muted`} colSpan={4}>
                          {fr ? "Colonne non mappée sur le grand livre N" : "Column not mapped on the CY ledger"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!preparers.hasPy ? (
              <p className="mt-2 text-[12px] text-muted">
                {fr
                  ? "Importer le grand livre N-1 (option « Grand livre N-1 ») pour comparer les utilisateurs d'une année sur l'autre."
                  : "Import the prior-year GL (the 'Prior-year GL' timing) to compare users year over year."}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-[12px] text-muted">{fr ? "Aucun grand livre importé." : "No general ledger imported."}</p>
        )}
      </Panel>

      {/* 2 ─ Volumes by account class */}
      <Panel data-testid="gl-class-volumes">
        <h3 className={TITLE}>{fr ? "Volumes par classe de comptes" : "Volumes by account class"}</h3>
        {volumes ? (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse" data-testid="gl-class-volumes-table">
                <thead>
                  <tr className={GRID_HEAD}>
                    <th className={`${GRID_CELL} text-left`}>{fr ? "Classe" : "Class"}</th>
                    <th className={`${GRID_CELL} text-left`}>{fr ? "Intitulé" : "Label"}</th>
                    <th className={GRID_NUM}>{fr ? "Lignes N" : "CY lines"}</th>
                    <th className={GRID_NUM}>{fr ? "Montant brut N" : "CY gross"}</th>
                    <th className={GRID_NUM}>{fr ? "Lignes N-1" : "PY lines"}</th>
                    <th className={GRID_NUM}>{fr ? "Montant brut N-1" : "PY gross"}</th>
                    <th className={GRID_NUM}>{fr ? "Δ lignes %" : "Δ lines %"}</th>
                    <th className={GRID_NUM}>{fr ? "Δ montant %" : "Δ gross %"}</th>
                  </tr>
                </thead>
                <tbody>
                  {volumes.rows.map((row) => (
                    <tr key={row.cls} data-testid={`gl-class-${row.cls}`}>
                      <td className={`${GRID_CELL} font-mono font-bold`}>{row.cls}</td>
                      <td className={GRID_CELL}>{fr ? CLASS_LABELS[row.cls].fr : CLASS_LABELS[row.cls].en}</td>
                      <td className={GRID_NUM}>{fmt(row.cyLines)}</td>
                      <td className={GRID_NUM}>{fmt(row.cyGross)}</td>
                      <td className={GRID_NUM}>{row.pyLines === null ? "—" : fmt(row.pyLines)}</td>
                      <td className={GRID_NUM}>{row.pyGross === null ? "—" : fmt(row.pyGross)}</td>
                      <td className={`${GRID_NUM} ${row.linesPct !== null && Math.abs(row.linesPct) >= 50 ? "text-rose" : ""}`}>
                        {row.linesPct === null ? "—" : `${row.linesPct > 0 ? "+" : ""}${row.linesPct}%`}
                      </td>
                      <td className={`${GRID_NUM} ${row.grossPct !== null && Math.abs(row.grossPct) >= 50 ? "text-rose" : ""}`}>
                        {row.grossPct === null ? "—" : `${row.grossPct > 0 ? "+" : ""}${row.grossPct}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!volumes.hasPy ? (
              <p className="mt-2 text-[12px] text-muted">
                {fr
                  ? "Sans grand livre N-1, les colonnes N-1 et les variations restent vides."
                  : "Without a prior-year GL the PY columns and % changes stay empty."}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-[12px] text-muted">{fr ? "Aucun grand livre importé." : "No general ledger imported."}</p>
        )}
      </Panel>

      {/* 3 ─ Journals by weekday */}
      <Panel data-testid="gl-weekday">
        <h3 className={TITLE}>{fr ? "Écritures par jour de la semaine" : "Journals by weekday"}</h3>
        {weekdays ? (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse" data-testid="gl-weekday-table">
                <thead>
                  <tr className={GRID_HEAD}>
                    <th className={`${GRID_CELL} text-left`}>{fr ? "Jour" : "Day"}</th>
                    <th className={GRID_NUM}>{fr ? "Journaux" : "Journals"}</th>
                    <th className={GRID_NUM}>{fr ? "Lignes" : "Lines"}</th>
                    <th className={GRID_NUM}>{fr ? "Montant brut" : "Gross amount"}</th>
                  </tr>
                </thead>
                <tbody>
                  {weekdays.rows.map((row) => {
                    const weekend = row.dow >= 5;
                    return (
                      <tr
                        key={row.dow}
                        className={weekend ? "bg-[var(--color-warn-soft)]" : ""}
                        data-testid={`gl-weekday-${row.dow}`}
                      >
                        <td className={`${GRID_CELL} font-medium ${weekend ? "text-rose" : ""}`}>
                          {weekdayLabels[row.dow]}
                          {weekend ? <b className="ml-1" title={fr ? "Week-end" : "Weekend"}>⚑</b> : null}
                        </td>
                        <td className={GRID_NUM}>{fmt(row.journals)}</td>
                        <td className={GRID_NUM}>{fmt(row.lines)}</td>
                        <td className={GRID_NUM}>{fmt(row.gross)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {weekdays.undated > 0 ? (
              <p className="mt-2 text-[12px] text-muted tnum">
                {weekdays.undated} {fr ? "ligne(s) sans date lisible ignorée(s)." : "line(s) skipped for unreadable dates."}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-[12px] text-muted">{fr ? "Aucun grand livre importé." : "No general ledger imported."}</p>
        )}
      </Panel>

      {/* 4 ─ Entry date vs effective date */}
      <Panel data-testid="gl-entry-lag">
        <h3 className={TITLE}>{fr ? "Date de saisie vs date d'effet" : "Entry date vs effective date"}</h3>
        {lag ? (
          <>
            <p className="mt-2 text-[12.5px] text-ink-soft tnum">
              {fr
                ? `Décalage moyen ${lag.avgDays} jours · maximum ${lag.maxDays} jours · ${fmt(lag.journals)} journaux datés`
                : `Average lag ${lag.avgDays} days · maximum ${lag.maxDays} days · ${fmt(lag.journals)} dated journals`}
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse" data-testid="gl-entry-lag-table">
                <thead>
                  <tr className={GRID_HEAD}>
                    <th className={`${GRID_CELL} text-left`}>{fr ? "Décalage" : "Lag"}</th>
                    <th className={GRID_NUM}>{fr ? "Journaux" : "Journals"}</th>
                  </tr>
                </thead>
                <tbody>
                  {lag.buckets.map((bucket) => (
                    <tr key={bucket.key} data-testid={`gl-lag-${bucket.key}`}>
                      <td className={GRID_CELL}>{fr ? LAG_BUCKET_LABELS[bucket.key].fr : LAG_BUCKET_LABELS[bucket.key].en}</td>
                      <td className={GRID_NUM}>{fmt(bucket.journals)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-2 text-[12px] text-muted" data-testid="gl-entry-lag-hint">
            {fr
              ? "Mappez la colonne « Date de saisie » lors de l'ingestion du grand livre pour comparer la date de saisie à la date d'effet."
              : "Map the 'JE date (entered)' column when ingesting the GL to compare entry dates with effective dates."}
          </p>
        )}
      </Panel>

      {/* 5 ─ Account correlation */}
      <Panel data-testid="gl-correlation">
        <h3 className={TITLE}>{fr ? "Corrélation entre comptes" : "Account correlation"}</h3>
        <p className="mt-2 text-[12px] text-muted">
          {fr
            ? "Choisir 2 à 6 préfixes de comptes : journaux touchant tous les préfixes, répartition mois × jour et corrélation de Pearson des volumes quotidiens."
            : "Pick 2 to 6 account prefixes: journals touching every prefix, month × day spread, and Pearson correlation of daily volumes."}
        </p>

        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={fr ? "Filtrer les préfixes…" : "Filter prefixes…"}
          spellCheck={false}
          data-testid="gl-corr-search"
          className="mt-3 w-full max-w-xs rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-emerald-600"
        />
        <div className="mt-2 max-h-52 overflow-y-auto rounded-[var(--radius-atlas-sm)] border border-line" data-testid="gl-corr-prefixes">
          {visiblePrefixes.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-muted">{fr ? "Aucun préfixe." : "No prefixes."}</p>
          ) : (
            visiblePrefixes.map((p) => (
              <label key={p.prefix} className="flex cursor-pointer items-center gap-2 border-t border-line px-3 py-1.5 text-[12.5px] first:border-t-0 hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={selected.includes(p.prefix)}
                  onChange={() => toggle(p.prefix)}
                  data-testid={`gl-corr-prefix-${p.prefix}`}
                  className="accent-emerald-700"
                />
                <span className="font-mono font-semibold text-ink">{p.prefix}</span>
                <span className="min-w-0 flex-1 truncate text-ink-soft">{p.name ?? "—"}</span>
                <span className="text-muted tnum">{fmt(p.lines)} {fr ? "lignes" : "lines"}</span>
              </label>
            ))
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={compute}
            disabled={pending || selected.length < 2 || selected.length > 6}
            data-testid="gl-corr-run"
            className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {pending ? "…" : fr ? "Calculer" : "Compute"}
          </button>
          <span className="text-[12px] text-muted tnum">
            {selected.length} {fr ? "sélectionné(s) (2 à 6 requis)" : "selected (2 to 6 required)"}
          </span>
          {corrError ? <p role="alert" className="text-[12px] text-rose">{corrError}</p> : null}
        </div>

        {corr ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="gl-corr-totals">
                <thead>
                  <tr className={GRID_HEAD}>
                    <th className={`${GRID_CELL} text-left`}>{fr ? "Préfixe" : "Prefix"}</th>
                    <th className={GRID_NUM}>{fr ? "Lignes" : "Lines"}</th>
                    <th className={GRID_NUM}>{fr ? "Montant brut" : "Gross amount"}</th>
                  </tr>
                </thead>
                <tbody>
                  {corr.prefixes.map((p) => (
                    <tr key={p.prefix}>
                      <td className={`${GRID_CELL} font-mono font-semibold`}>{p.prefix}</td>
                      <td className={GRID_NUM}>{fmt(p.lines)}</td>
                      <td className={GRID_NUM}>{fmt(p.gross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[12.5px] text-ink-soft tnum" data-testid="gl-corr-shared">
              {fr
                ? `${fmt(corr.sharedJournals)} journaux touchent l'ensemble des préfixes sélectionnés.`
                : `${fmt(corr.sharedJournals)} journals touch every selected prefix.`}
            </p>

            <div className="overflow-x-auto">
              <table className="border-collapse" data-testid="gl-corr-matrix">
                <thead>
                  <tr className={GRID_HEAD}>
                    <th className={`${GRID_CELL} text-left`}>{fr ? "Mois" : "Month"}</th>
                    {Array.from({ length: 31 }, (_, i) => (
                      <th key={i} className={`${GRID_CELL} text-center tnum`}>{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {corr.matrix.map((days, month) => (
                    <tr key={month}>
                      <td className={`${GRID_CELL} font-medium`}>{monthLabels[month]}</td>
                      {days.map((count, day) => (
                        <td key={day} className={`${GRID_CELL} text-center tnum ${count > 0 ? "font-bold text-ink" : "text-muted/40"}`}>
                          {count > 0 ? count : "·"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="gl-corr-pairs">
                <thead>
                  <tr className={GRID_HEAD}>
                    <th className={`${GRID_CELL} text-left`}>{fr ? "Paire" : "Pair"}</th>
                    <th className={GRID_NUM}>r</th>
                    <th className={`${GRID_CELL} text-left`}>{fr ? "Lecture" : "Interpretation"}</th>
                  </tr>
                </thead>
                <tbody>
                  {corr.pairs.map((pair) => (
                    <tr key={`${pair.a}-${pair.b}`} data-testid={`gl-corr-pair-${pair.a}-${pair.b}`}>
                      <td className={`${GRID_CELL} font-mono`}>{pair.a} × {pair.b}</td>
                      <td className={GRID_NUM}>{pair.r === null ? "—" : pair.r.toFixed(2)}</td>
                      <td className={GRID_CELL}>{interp(pair.r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
