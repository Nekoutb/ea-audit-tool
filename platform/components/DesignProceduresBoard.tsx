"use client";

// S5.5 — the substantive-procedures design board: per significant account, the
// CRA it inherits from S3.1, the primary-procedure baseline the library will
// generate in E4, and the designed nature, timing and extent. The timing and
// key-item-threshold guidance follows the CRA; an OSP note is demanded
// wherever a significant risk or a no-reliance assertion leaves a gap the
// primary procedures cannot carry alone.

import { useState } from "react";
import Link from "next/link";
import type { DspRow, DspView } from "@/lib/design-procedures";
import { craTone, thresholdSuggestion, timingSuggestion, todLabel, type CraLevel } from "@/lib/cra-model";
import { Chip } from "@/components/ui/atlas";

const NATURE_OPTIONS = [
  { value: "combined", en: "SAPs + tests of details (combined)", fr: "Procédures analytiques + tests de détail (combiné)" },
  { value: "tod_led", en: "Tests of details led", fr: "Tests de détail en priorité" },
  { value: "sap_led", en: "Substantive analytics led, data tested", fr: "Procédures analytiques en priorité, données testées" },
] as const;

const TIMING_OPTIONS = [
  { value: "period_end", en: "At / near the period end", fr: "À la clôture ou près de la clôture" },
  { value: "interim_3", en: "Interim ≤ 3 months before period end + rollforward", fr: "Intercalaire ≤ 3 mois avant la clôture + liaison" },
  { value: "interim_6", en: "Interim ≤ 6 months before period end + rollforward", fr: "Intercalaire ≤ 6 mois avant la clôture + liaison" },
] as const;

/** The widest interim window the CRA level permits. */
function timingAllowed(level: CraLevel | null): string[] {
  if (level === "minimal") return ["period_end", "interim_3", "interim_6"];
  if (level === "low") return ["period_end", "interim_3"];
  return ["period_end"];
}

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
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const r of view.rows) for (const [k, v] of Object.entries(r.values)) out[`${r.indexCode}_${k}`] = v;
    return out;
  });

  const n = (x: number) => new Intl.NumberFormat("fr-FR").format(Math.round(x));
  const label = "text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const select = "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1.5 text-[12.3px] text-ink outline-none focus:border-emerald-600";
  const area = "w-full resize-none rounded-[var(--radius-atlas-sm)] border border-line bg-[color:var(--wp-input)] px-2.5 py-1.5 text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-muted focus:border-emerald-600";

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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-[11px] text-ink-soft">
        <span>
          {fr
            ? "Les procédures substantives primaires constituent le socle pour chaque assertion pertinente, quel que soit l'ECR ; l'ECR règle leur nature, leur calendrier et leur étendue."
            : "Primary substantive procedures are the baseline for every relevant assertion regardless of the CRA; the CRA sets their nature, timing and extent."}
        </span>
        <Link href={`/engagements/${engagementId}/cra`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          {fr ? "Matrice ECR (S3.1)" : "CRA matrix (S3.1)"}
        </Link>
        <Link href={`/engagements/${engagementId}/tools/sampling`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          {fr ? "Outil d'échantillonnage" : "Sampling tool"}
        </Link>
      </div>

      {error ? <p className="text-[12px] font-semibold text-rose">{error}</p> : null}

      {view.rows.map((row: DspRow) => {
        const isOpen = open === row.indexCode;
        const level = (row.worst ? row.worst.replace("_sr", "") : null) as CraLevel | null;
        const allowed = timingAllowed(level);
        const v = (f: string) => values[`${row.indexCode}_${f}`] ?? "";
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
              {row.closing !== 0 ? <span className="hidden text-[11px] text-muted tnum sm:inline">{n(row.closing)}</span> : null}
              {row.worst && level ? <Chip tone={craTone(level)}>{todLabel(row.worst, fr ? "fr" : "en")}</Chip> : <Chip tone="muted">{fr ? "ECR à évaluer" : "CRA pending"}</Chip>}
              {row.ospRequired ? <Chip tone="warn">OSP</Chip> : null}
              <span className="text-[11px] text-muted">{isOpen ? "▾" : "▸"}</span>
            </button>

            {isOpen ? (
              <div className="flex flex-col gap-2.5 border-t border-line px-3 py-2.5" data-testid={`dsp-detail-${row.indexCode}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-soft">
                  <span className={label}>{fr ? "ECR par assertion (S3.1)" : "CRA per assertion (S3.1)"}</span>
                  {row.cells.map((c) => (
                    <span key={c.assertion} className="inline-flex items-center gap-1">
                      <b>{c.assertion}</b>
                      <Chip tone={craTone(c.tod.replace("_sr", "") as CraLevel)}>{todLabel(c.tod, fr ? "fr" : "en")}</Chip>
                    </span>
                  ))}
                </div>

                <p className="text-[12px] text-ink-soft">
                  <b>{row.pspCount}</b>{" "}
                  {fr ? "procédures substantives primaires dans la bibliothèque" : "primary substantive procedures in the library"}
                  {" · "}
                  {row.generated > 0
                    ? fr ? `${row.done}/${row.generated} exécutées dans le papier` : `${row.done}/${row.generated} executed in the workpaper`
                    : fr ? "non encore générées" : "not generated yet"}
                  {row.taskItemId ? (
                    <>
                      {" · "}
                      <Link href={`/engagements/${engagementId}/sections/${row.taskItemId}`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400" data-testid={`dsp-open-${row.indexCode}`}>
                        {fr ? `Ouvrir ${row.taskCode}` : `Open ${row.taskCode}`}
                      </Link>
                    </>
                  ) : null}
                </p>

                <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                  <div>
                    <p className={label}>{fr ? "Nature" : "Nature"}</p>
                    <select
                      value={v("nature")}
                      onChange={(e) => void save(row.indexCode, "nature", e.target.value)}
                      className={`${select} mt-1 w-full`}
                      data-testid={`dsp-nature-${row.indexCode}`}
                    >
                      <option value="">{fr ? "— choisir" : "— choose"}</option>
                      {NATURE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{fr ? o.fr : o.en}</option>
                      ))}
                    </select>
                    {(level === "moderate" || level === "high") ? (
                      <p className="mt-1 text-[10.5px] text-muted">
                        {fr
                          ? "Sans appui sur les contrôles, les procédures doivent détecter les anomalies : analytiques plus désagrégées, données sous-jacentes testées."
                          : "With no controls reliance the procedures must detect misstatements: greater disaggregation of analytics, underlying data tested."}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className={label}>{fr ? "Calendrier" : "Timing"}</p>
                    <select
                      value={v("timing")}
                      onChange={(e) => void save(row.indexCode, "timing", e.target.value)}
                      className={`${select} mt-1 w-full`}
                      data-testid={`dsp-timing-${row.indexCode}`}
                    >
                      <option value="">{fr ? "— choisir" : "— choose"}</option>
                      {TIMING_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value} disabled={!allowed.includes(o.value)}>
                          {(fr ? o.fr : o.en) + (!allowed.includes(o.value) ? (fr ? " — indisponible à cet ECR" : " — unavailable at this CRA") : "")}
                        </option>
                      ))}
                    </select>
                    {level ? <p className="mt-1 text-[10.5px] text-muted">{timingSuggestion(level, fr ? "fr" : "en")}</p> : null}
                  </div>
                </div>

                <div>
                  <p className={label}>{fr ? "Étendue" : "Extent"}</p>
                  <textarea
                    rows={2}
                    spellCheck={false}
                    defaultValue={v("extent")}
                    placeholder={level ? thresholdSuggestion(level, fr ? "fr" : "en") : fr ? "Étendue prévue…" : "Planned extent…"}
                    onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }}
                    onBlur={(e) => { if (e.target.value !== v("extent")) void save(row.indexCode, "extent", e.target.value); }}
                    className={`${area} mt-1`}
                    data-testid={`dsp-extent-${row.indexCode}`}
                  />
                  {level ? <p className="mt-0.5 text-[10.5px] text-muted">{thresholdSuggestion(level, fr ? "fr" : "en")} · {fr ? "échantillon dimensionné par l'outil" : "sample sized by the sampling tool"}</p> : null}
                </div>

                <div>
                  <p className={label}>
                    {fr ? "Autres procédures substantives (OSP)" : "Other substantive procedures (OSPs)"}
                    {row.ospRequired ? <span className="ml-1.5 font-bold normal-case text-amber-700 dark:text-amber-400">{fr ? "— requises" : "— required"}</span> : null}
                  </p>
                  <textarea
                    rows={2}
                    spellCheck={false}
                    defaultValue={v("osp")}
                    placeholder={
                      row.ospRequired
                        ? fr
                          ? "Un risque important ou une assertion sans appui appelle des procédures au-delà du socle : test de détail répondant spécifiquement au risque…"
                          : "A significant risk or a no-reliance assertion calls for procedures beyond the baseline: a test of details specifically responsive to the risk…"
                        : fr ? "Aucune requise — consigner si ajoutées." : "None required — record any added."
                    }
                    onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }}
                    onBlur={(e) => { if (e.target.value !== v("osp")) void save(row.indexCode, "osp", e.target.value); }}
                    className={`${area} mt-1`}
                    data-testid={`dsp-osp-${row.indexCode}`}
                  />
                  {row.ospRequired ? (
                    <p className="mt-0.5 text-[10.5px] text-muted">
                      {fr
                        ? "Ajouter les OSP dans le papier E4 (« + Ajouter des procédures substantives ») — les analytiques seules ne portent jamais un risque important."
                        : "Add the OSPs in the E4 workpaper (\"+ Add substantive procedures\") — analytics alone never carry a significant risk."}
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
