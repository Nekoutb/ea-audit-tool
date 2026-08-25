"use client";

// S5.5 — the substantive-procedures design board: per significant account and
// per relevant assertion, the CRA inherited from S3.1 and the designed nature,
// timing and extent (ISA 330 ¶6–7: procedures are designed per assertion,
// responsive to that assertion's assessed risk). The badge on each account row
// is its worst relevant-assertion CRA; the grid inside designs each assertion
// against its own level. OSPs stay at account level.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [openSel, setOpenSel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const r of view.rows) for (const [k, v] of Object.entries(r.values)) out[`${r.indexCode}_${k}`] = v;
    return out;
  });
  // index|assertion → selected catalog positions
  const [sels, setSels] = useState<Record<string, number[]>>(() => {
    const out: Record<string, number[]> = {};
    for (const r of view.rows) for (const [a, arr] of Object.entries(r.selected)) out[`${r.indexCode}|${a}`] = arr;
    return out;
  });

  function toggleSel(indexCode: string, assertion: string, pos: number) {
    const key = `${indexCode}|${assertion}`;
    const cur = sels[key] ?? [];
    const next = cur.includes(pos) ? cur.filter((n) => n !== pos) : [...cur, pos].sort((a, b) => a - b);
    setSels((s) => ({ ...s, [key]: next }));
    void save(indexCode, `sel_${assertion}`, JSON.stringify(next));
  }

  const rowSelectedCount = (row: DspRow) => {
    const all = new Set<number>();
    for (const c of row.cells) for (const n of sels[`${row.indexCode}|${c.assertion}`] ?? []) all.add(n);
    return all.size;
  };

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

      {(() => {
        const gaps = view.rows
          .filter((row) => row.cells.length > 0 && !Object.values(row.selected).some((a) => a.length > 0))
          .map((row) => row.indexCode);
        return gaps.length > 0 ? (
          <div className="rounded-[var(--radius-atlas-sm)] border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" data-testid="dsp-gaps">
            {fr
              ? `⚠ ${gaps.length} compte(s) avec assertions clés sans procédures conçues : ${gaps.join(", ")}`
              : `⚠ ${gaps.length} account(s) with key assertions and no designed procedures yet: ${gaps.join(", ")}`}
          </div>
        ) : null;
      })()}

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
              <span className="text-[11px] text-muted">{isOpen ? "▾" : "▸"}</span>
            </button>

            {isOpen ? (
              <div className="flex flex-col gap-2.5 border-t border-line px-3 py-2.5" data-testid={`dsp-detail-${row.indexCode}`}>
                <p className="text-[12px] text-ink-soft" data-testid={`dsp-summary-${row.indexCode}`}>
                  <b>{rowSelectedCount(row)}</b>
                  {"/"}
                  <b>{row.pspCount}</b>{" "}
                  {fr
                    ? "procédures substantives primaires retenues — seules les procédures retenues sont générées dans le papier E4"
                    : "primary substantive procedures selected — only selected procedures are generated in the E4 paper"}
                  {" · "}
                  {row.generated > 0
                    ? fr ? `${row.done}/${row.generated} exécutées dans le papier` : `${row.done}/${row.generated} executed in the workpaper`
                    : fr ? "non encore générées" : "not generated yet"}
                  {row.taskItemId ? (
                    <>
                      {" · "}
                      <Link href={`/engagements/${engagementId}/sections/${row.taskItemId}?back=${encodeURIComponent(pathname)}`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400" data-testid={`dsp-open-${row.indexCode}`}>
                        {fr ? `Ouvrir ${row.taskCode}` : `Open ${row.taskCode}`}
                      </Link>
                    </>
                  ) : null}
                </p>

                {row.cells.length === 0 ? (
                  <p className="rounded-[var(--radius-atlas-sm)] bg-surface-2 px-3 py-2 text-[12px] text-muted" data-testid={`dsp-no-key-${row.indexCode}`}>
                    {fr
                      ? "Aucune assertion clé retenue pour ce compte (P6.2 / console des risques) — rien à concevoir ici."
                      : "No key assertions selected for this account (P6.2 / risk console) — nothing to design here."}
                  </p>
                ) : null}
                {/* design grid: one row per relevant assertion, against its own CRA */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px]">
                    <thead>
                      <tr>
                        <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Assertion" : "Assertion"}</th>
                        <th className={`${label} px-1.5 py-1 text-left`}>CRA</th>
                        <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Procédures substantives primaires" : "Primary substantive procedures"}</th>
                        <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Nature" : "Nature"}</th>
                        <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Calendrier" : "Timing"}</th>
                        <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Étendue" : "Extent"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.cells.map((c) => {
                        const cellLevel = levelOf(c.tod);
                        const allowed = timingAllowed(cellLevel);
                        const selKey = `${row.indexCode}|${c.assertion}`;
                        const covering = row.catalog.filter((p) => p.a.includes(c.assertion));
                        const chosen = sels[selKey] ?? [];
                        const selOpen = openSel === selKey;
                        return (
                          <tr key={c.assertion} className="border-t border-line align-top">
                            <td className="px-1.5 py-1.5">
                              <span className="text-[12.5px] font-bold text-ink">{c.assertion}</span>
                              {c.significant ? <span className="ml-1"><Chip tone="rose">SR</Chip></span> : null}
                            </td>
                            <td className="px-1.5 py-1.5">
                              <Chip tone={craTone(cellLevel)}>{todLabel(c.tod, fr ? "fr" : "en")}</Chip>
                            </td>
                            <td className="relative px-1.5 py-1.5">
                              <button
                                type="button"
                                onClick={() => setOpenSel(selOpen ? null : selKey)}
                                className="w-full min-w-[150px] rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-left text-[11.8px] text-ink hover:border-emerald-600"
                                data-testid={`dsp-sel-${row.indexCode}-${c.assertion}`}
                              >
                                {chosen.length > 0
                                  ? `${chosen.length}/${covering.length} ${fr ? "retenues" : "selected"}`
                                  : fr ? `— retenir (${covering.length})` : `— select (${covering.length})`}
                                <span className="float-right text-muted">{selOpen ? "▴" : "▾"}</span>
                              </button>
                              {selOpen ? (
                                <div className="absolute left-0 top-full z-20 mt-1 w-[340px] rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface-pop p-2 shadow-atlas-sm" data-testid={`dsp-sel-list-${row.indexCode}-${c.assertion}`}>
                                  {covering.length === 0 ? (
                                    <p className="text-[11.5px] text-muted">{fr ? "Aucune procédure de la bibliothèque ne couvre cette assertion — ajouter une OSP." : "No library procedure covers this assertion — add an OSP."}</p>
                                  ) : (
                                    covering.map((p) => (
                                      <label key={p.i} className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-[11.8px] leading-snug text-ink-soft hover:bg-surface-2">
                                        <input
                                          type="checkbox"
                                          checked={chosen.includes(p.i)}
                                          onChange={() => toggleSel(row.indexCode, c.assertion, p.i)}
                                          className="mt-0.5 h-3.5 w-3.5 accent-emerald-700"
                                          data-testid={`dsp-sel-${row.indexCode}-${c.assertion}-${p.i}`}
                                        />
                                        <span>{fr ? p.fr : p.en}</span>
                                      </label>
                                    ))
                                  )}
                                </div>
                              ) : null}
                              {chosen.length > 0 ? (
                                <ul className="mt-1.5 flex flex-col gap-1" data-testid={`dsp-chosen-${row.indexCode}-${c.assertion}`}>
                                  {chosen.map((n) => {
                                    const p = row.catalog[n];
                                    return p ? (
                                      <li key={n} className="flex gap-1.5 rounded-[var(--radius-atlas-xs)] bg-emerald-50 px-2 py-1 text-[11.5px] leading-snug text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                                        <span aria-hidden className="flex-shrink-0 font-bold">•</span>
                                        <span>{fr ? p.fr : p.en}</span>
                                      </li>
                                    ) : null;
                                  })}
                                </ul>
                              ) : null}
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
                  {/* OSPs are designed like the library procedures: pick the
                      assertions they answer (their CRA fills in), then set
                      nature, timing and extent. */}
                  {(() => {
                    let ospAsserts: string[] = [];
                    try { const a = JSON.parse(v("osp_assertions") || "[]"); if (Array.isArray(a)) ospAsserts = a; } catch { /* none */ }
                    const toggleOspAssert = (assertion: string) => {
                      const next = ospAsserts.includes(assertion)
                        ? ospAsserts.filter((x) => x !== assertion)
                        : [...ospAsserts, assertion];
                      void save(row.indexCode, "osp_assertions", JSON.stringify(next));
                    };
                    return (
                      <div className="mt-2 flex flex-col gap-1.5" data-testid={`dsp-osp-design-${row.indexCode}`}>
                        <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                          {fr ? "Assertions couvertes :" : "Assertions answered:"}
                          {row.cells.map((c) => (
                            <label key={c.assertion} className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${ospAsserts.includes(c.assertion) ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-line text-ink-soft"}`}>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={ospAsserts.includes(c.assertion)}
                                onChange={() => toggleOspAssert(c.assertion)}
                                data-testid={`dsp-osp-assert-${row.indexCode}-${c.assertion}`}
                              />
                              {c.assertion}
                            </label>
                          ))}
                        </span>
                        {ospAsserts.length > 0 ? (
                          <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted" data-testid={`dsp-osp-cra-${row.indexCode}`}>
                            {fr ? "ECR de ces assertions :" : "CRA of those assertions:"}
                            {row.cells.filter((c) => ospAsserts.includes(c.assertion)).map((c) => (
                              <span key={c.assertion} className="inline-flex items-center gap-1">
                                <b className="text-ink">{c.assertion}</b>
                                <Chip tone={craTone(levelOf(c.tod))}>{todLabel(c.tod, fr ? "fr" : "en")}</Chip>
                              </span>
                            ))}
                          </span>
                        ) : null}
                        {ospAsserts.length > 0 ? (
                          <span className="flex flex-wrap items-end gap-2.5">
                            <label className="flex flex-col text-[10.5px] text-muted">
                              {fr ? "Nature" : "Nature"}
                              <select
                                value={v("osp_nature")}
                                onChange={(e) => void save(row.indexCode, "osp_nature", e.target.value)}
                                className={select}
                                data-testid={`dsp-osp-nature-${row.indexCode}`}
                              >
                                <option value="">{fr ? "— choisir" : "— choose"}</option>
                                {NATURE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>{fr ? o.fr : o.en}</option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col text-[10.5px] text-muted">
                              {fr ? "Calendrier" : "Timing"}
                              <select
                                value={v("osp_timing")}
                                onChange={(e) => void save(row.indexCode, "osp_timing", e.target.value)}
                                className={select}
                                data-testid={`dsp-osp-timing-${row.indexCode}`}
                              >
                                <option value="">{fr ? "— choisir" : "— choose"}</option>
                                {TIMING_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>{fr ? o.fr : o.en}</option>
                                ))}
                              </select>
                            </label>
                            <label className="flex min-w-[220px] flex-1 flex-col text-[10.5px] text-muted">
                              {fr ? "Étendue" : "Extent"}
                              <input
                                defaultValue={v("osp_extent")}
                                placeholder={fr ? "ex. 100 % des éléments > SAD nominal…" : "e.g. 100% of items > SAD Nominal…"}
                                onBlur={(e) => { if (e.target.value !== v("osp_extent")) void save(row.indexCode, "osp_extent", e.target.value); }}
                                className={select}
                                data-testid={`dsp-osp-extent-${row.indexCode}`}
                              />
                            </label>
                          </span>
                        ) : null}
                      </div>
                    );
                  })()}
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
