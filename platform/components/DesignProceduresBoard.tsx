"use client";

// S5.5 — the substantive-procedures design board: per significant account and
// per relevant assertion, the CRA inherited from S3.1 and the designed nature,
// timing and extent (ISA 330 ¶6–7: procedures are designed per assertion,
// responsive to that assertion's assessed risk). The badge on each account row
// is its worst relevant-assertion CRA; the grid inside designs each assertion
// against its own level. OSPs stay at account level.

import { useState } from "react";
import Link from "next/link";
import type { DspRow, DspView } from "@/lib/design-procedures";
import { craTone, thresholdSuggestion, timingSuggestion, todLabel, type CraLevel, type CraTod } from "@/lib/cra-model";
import { Chip } from "@/components/ui/atlas";

const NATURE_OPTIONS = [
  { value: "combined", en: "SAPs + tests of details", fr: "Analytiques + tests de détail" },
  { value: "tod_led", en: "Tests of details led", fr: "Tests de détail en priorité" },
  { value: "sap_led", en: "Analytics led, data tested", fr: "Analytiques en priorité, données testées" },
] as const;

const TIMING_OPTIONS = [
  { value: "period_end", en: "At / near period end", fr: "À / près de la clôture" },
  { value: "interim_3", en: "Interim ≤ 3 months + rollforward", fr: "Intercalaire ≤ 3 mois + liaison" },
  { value: "interim_6", en: "Interim ≤ 6 months + rollforward", fr: "Intercalaire ≤ 6 mois + liaison" },
] as const;

/** The widest interim window the CRA level permits. */
function timingAllowed(level: CraLevel | null): string[] {
  if (level === "minimal") return ["period_end", "interim_3", "interim_6"];
  if (level === "low") return ["period_end", "interim_3"];
  return ["period_end"];
}

const levelOf = (tod: CraTod): CraLevel => tod.replace("_sr", "") as CraLevel;

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

  const label = "text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const select = "w-full rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-1.5 py-1 text-[11.8px] text-ink outline-none focus:border-emerald-600";
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
      <div className="flex flex-col gap-1 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-[11px] text-ink-soft">
        <span>
          <b>{fr ? "Le badge sur chaque ligne est l'ECR" : "The badge on each row is the CRA"}</b>{" "}
          {fr
            ? "(évaluation combinée des risques) arrêtée en S3.1 — Minimal · Faible · Modéré · Élevé, la pire des assertions pertinentes du compte ; « +SR » signale un risque important ou de fraude. Les procédures se conçoivent par assertion pertinente, contre l'ECR propre à cette assertion."
            : "(combined risk assessment) settled in S3.1 — Minimal · Low · Moderate · High, the worst of the account's relevant assertions; \"+SR\" flags a significant or fraud risk. Procedures are designed per relevant assertion, against that assertion's own CRA."}
        </span>
        <span className="flex flex-wrap items-center gap-3">
          <Link href={`/engagements/${engagementId}/cra`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            {fr ? "Matrice ECR (S3.1)" : "CRA matrix (S3.1)"}
          </Link>
          <Link href={`/engagements/${engagementId}/tools/sampling`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            {fr ? "Outil d'échantillonnage" : "Sampling tool"}
          </Link>
        </span>
      </div>

      {error ? <p className="text-[12px] font-semibold text-rose">{error}</p> : null}

      {view.rows.map((row: DspRow) => {
        const isOpen = open === row.indexCode;
        const level = row.worst ? levelOf(row.worst) : null;
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
              {row.worst && level ? <Chip tone={craTone(level)}>{todLabel(row.worst, fr ? "fr" : "en")}</Chip> : <Chip tone="muted">{fr ? "ECR à évaluer" : "CRA pending"}</Chip>}
              {row.ospRequired ? <Chip tone="warn">OSP</Chip> : null}
              <span className="text-[11px] text-muted">{isOpen ? "▾" : "▸"}</span>
            </button>

            {isOpen ? (
              <div className="flex flex-col gap-2.5 border-t border-line px-3 py-2.5" data-testid={`dsp-detail-${row.indexCode}`}>
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

                {/* design grid: one row per relevant assertion, against its own CRA */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px]">
                    <thead>
                      <tr>
                        <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Assertion" : "Assertion"}</th>
                        <th className={`${label} px-1.5 py-1 text-left`}>CRA</th>
                        <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Nature" : "Nature"}</th>
                        <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Calendrier" : "Timing"}</th>
                        <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Étendue" : "Extent"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.cells.map((c) => {
                        const cellLevel = levelOf(c.tod);
                        const allowed = timingAllowed(cellLevel);
                        return (
                          <tr key={c.assertion} className="border-t border-line align-top">
                            <td className="px-1.5 py-1.5">
                              <span className="text-[12.5px] font-bold text-ink">{c.assertion}</span>
                              {c.significant ? <span className="ml-1"><Chip tone="rose">SR</Chip></span> : null}
                            </td>
                            <td className="px-1.5 py-1.5">
                              <Chip tone={craTone(cellLevel)}>{todLabel(c.tod, fr ? "fr" : "en")}</Chip>
                            </td>
                            <td className="px-1.5 py-1.5">
                              <select
                                value={v(`${c.assertion}_nature`)}
                                onChange={(e) => void save(row.indexCode, `${c.assertion}_nature`, e.target.value)}
                                className={select}
                                data-testid={`dsp-nature-${row.indexCode}-${c.assertion}`}
                              >
                                <option value="">{fr ? "— choisir" : "— choose"}</option>
                                {NATURE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value} disabled={o.value === "sap_led" && c.significant}>
                                    {(fr ? o.fr : o.en) + (o.value === "sap_led" && c.significant ? (fr ? " — interdit (risque important)" : " — barred (significant risk)") : "")}
                                  </option>
                                ))}
                              </select>
                              {c.significant ? (
                                <p className="mt-0.5 text-[10px] text-muted">{fr ? "Test de détail obligatoire (ISA 330 ¶21)" : "Test of details required (ISA 330 ¶21)"}</p>
                              ) : null}
                            </td>
                            <td className="px-1.5 py-1.5">
                              <select
                                value={v(`${c.assertion}_timing`)}
                                onChange={(e) => void save(row.indexCode, `${c.assertion}_timing`, e.target.value)}
                                className={select}
                                title={timingSuggestion(cellLevel, fr ? "fr" : "en")}
                                data-testid={`dsp-timing-${row.indexCode}-${c.assertion}`}
                              >
                                <option value="">{fr ? "— choisir" : "— choose"}</option>
                                {TIMING_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value} disabled={!allowed.includes(o.value)}>
                                    {(fr ? o.fr : o.en) + (!allowed.includes(o.value) ? (fr ? " — indisponible à cet ECR" : " — unavailable at this CRA") : "")}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-1.5 py-1.5">
                              <input
                                defaultValue={v(`${c.assertion}_extent`)}
                                placeholder={thresholdSuggestion(cellLevel, fr ? "fr" : "en")}
                                onBlur={(e) => { if (e.target.value !== v(`${c.assertion}_extent`)) void save(row.indexCode, `${c.assertion}_extent`, e.target.value); }}
                                className={`${area} min-w-[180px]`}
                                data-testid={`dsp-extent-${row.indexCode}-${c.assertion}`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
