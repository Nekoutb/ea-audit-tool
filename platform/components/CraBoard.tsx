"use client";

// The Combined Risk Assessment matrix (S3.1): account rows that roll out into
// a per-assertion grid where inherent risk and control risk are assessed
// separately and combine into the level that calibrates the substantive
// response. Suggestions come from the risk register (IR) and from SCOT
// Studio + S2.5 (CR); recorded values always win.

import { useState } from "react";
import Link from "next/link";
import type { CraAccountRow, CraBoardView, CraCell } from "@/lib/cra";
import { craOf, craTone, toTod, todLabel, worstTod, type CraCr, type CraIr, type CraLevel, type CraTod } from "@/lib/cra-model";
import { Chip } from "@/components/ui/atlas";

const ASSERTION_LABELS: Record<string, { en: string; fr: string }> = {
  C: { en: "Completeness", fr: "Exhaustivité" },
  E: { en: "Existence / occurrence", fr: "Existence / réalité" },
  A: { en: "Accuracy / cut-off", fr: "Exactitude / séparation" },
  V: { en: "Valuation", fr: "Évaluation" },
  P: { en: "Presentation / disclosure", fr: "Présentation / information" },
};

function cellState(c: CraCell): { ir: CraIr; cr: CraCr; recorded: boolean } {
  return { ir: c.ir ?? c.suggestedIr, cr: c.cr ?? c.suggestedCr, recorded: c.ir !== null && c.cr !== null };
}

function CraChip({ cell, fr }: { cell: CraCell; fr: boolean }) {
  const { ir, cr, recorded } = cellState(cell);
  const level = craOf(ir, cr);
  const tod = toTod(level, cell.significant);
  return (
    <span className="inline-flex items-center gap-1" data-testid={`cra-level-${cell.assertion}`}>
      <Chip tone={craTone(level)}>{todLabel(tod, fr ? "fr" : "en")}</Chip>
      {!recorded ? (
        <span className="text-[10px] italic text-muted" title={fr ? "Suggestion du dossier — à confirmer" : "Suggested from the file — to confirm"}>
          {fr ? "sugg." : "sugg."}
        </span>
      ) : null}
    </span>
  );
}

export function CraBoard({
  engagementId,
  view,
  locale,
}: {
  engagementId: string;
  view: CraBoardView;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const [rows, setRows] = useState(view.rows);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const n = (x: number) => new Intl.NumberFormat("fr-FR").format(Math.round(x));
  const label = "text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const select = "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-1.5 py-1 text-[12px] text-ink outline-none focus:border-emerald-600";
  const basisInput = "w-full rounded-[var(--radius-atlas-sm)] border border-line bg-[color:var(--wp-input)] px-2 py-1 text-[11.5px] text-ink outline-none placeholder:text-muted focus:border-emerald-600";

  async function save(indexCode: string, assertion: string, patch: Record<string, unknown>) {
    setError(null);
    const r = await fetch(`/api/engagements/${engagementId}/cra`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "saveCell", indexCode, assertion, ...patch }),
    }).catch(() => null);
    if (!r?.ok) setError(fr ? "Échec de l'enregistrement." : "Save failed.");
  }

  function patchCell(indexCode: string, assertion: string, patch: Partial<CraCell>) {
    setRows((rs) =>
      rs.map((row) =>
        row.indexCode === indexCode
          ? { ...row, cells: row.cells.map((c) => (c.assertion === assertion ? { ...c, ...patch } : c)) }
          : row,
      ),
    );
  }

  const rowTod = (row: CraAccountRow): CraTod | null =>
    worstTod(
      row.cells
        .filter((c) => c.relevant)
        .map((c) => {
          const { ir, cr } = cellState(c);
          return toTod(craOf(ir, cr), c.significant);
        }),
    );

  if (rows.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-[12.5px] text-muted" data-testid="cra-empty">
        {view.glAvailable
          ? fr
            ? "Aucun compte significatif retenu en P6.2 — arrêter d'abord les comptes significatifs."
            : "No account is marked significant in P6.2 yet — settle the significant accounts first."
          : fr
            ? "Importer la balance et le grand livre, puis arrêter les comptes significatifs (P6.2)."
            : "Upload the trial balance and general ledger, then settle the significant accounts (P6.2)."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="cra-board">
      {/* the matrix legend and the upstream states the assessment leans on */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2">
        <span className="text-[11px] text-ink-soft">
          <b>{fr ? "Matrice" : "Matrix"}:</b>{" "}
          {fr
            ? "RI faible + appui = Minimal · RI faible sans appui = Modéré · RI élevé + appui = Faible · RI élevé sans appui = Élevé"
            : "Lower IR + rely = Minimal · Lower IR + not rely = Moderate · Higher IR + rely = Low · Higher IR + not rely = High"}
        </span>
        <span data-testid="cra-itgc">
          {view.itgcState === "support" ? (
            <Chip tone="good">{fr ? "ITGC : appui possible (S2.5)" : "ITGCs support reliance (S2.5)"}</Chip>
          ) : view.itgcState === "not_support" ? (
            <Chip tone="rose">{fr ? "ITGC : pas d'appui (S2.5)" : "ITGCs do not support reliance (S2.5)"}</Chip>
          ) : view.itgcState === "mixed" ? (
            <Chip tone="warn">{fr ? "ITGC : conclusion mitigée (S2.5)" : "ITGC conclusion mixed (S2.5)"}</Chip>
          ) : (
            <Chip tone="muted">{fr ? "ITGC : S2.5 non conclu" : "ITGCs: S2.5 not concluded"}</Chip>
          )}
        </span>
        <span className="flex items-center gap-3 text-[11px]">
          <Link href={`/engagements/${engagementId}/risks`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            {fr ? "Registre des risques" : "Risk register"}
          </Link>
          <Link href={`/engagements/${engagementId}/tools/sampling`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            {fr ? "Échantillonnage" : "Sampling tool"}
          </Link>
        </span>
      </div>

      {error ? <p className="text-[12px] font-semibold text-rose">{error}</p> : null}

      {rows.map((row) => {
        const isOpen = open === row.indexCode;
        const worst = rowTod(row);
        return (
          <div key={row.indexCode} className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : row.indexCode)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-2"
              data-testid={`cra-row-${row.indexCode}`}
            >
              <span className="font-mono text-[11.5px] font-extrabold text-emerald-700/70 tnum dark:text-emerald-400/70">{row.indexCode}</span>
              <span className="min-w-0 flex-1 truncate text-[12.8px] font-semibold text-ink">{row.label}</span>
              {row.closing !== 0 ? <span className="text-[11px] text-muted tnum">{n(row.closing)}</span> : null}
              <span className="hidden items-center gap-1.5 sm:flex">
                {row.scots > 0 ? <Chip tone="muted">{row.scots} SCOT</Chip> : null}
                {row.controlsSelected > 0 ? (
                  <Chip tone="muted">{row.controlsSelected} {fr ? "ctrl" : "ctrl"}</Chip>
                ) : null}
              </span>
              {worst ? <Chip tone={craTone(worst.replace("_sr", "") as CraLevel)}>{todLabel(worst, fr ? "fr" : "en")}</Chip> : null}
              <span className="text-[11px] text-muted">{isOpen ? "▾" : "▸"}</span>
            </button>

            {isOpen ? (
              <div className="overflow-x-auto border-t border-line px-3 py-2" data-testid={`cra-detail-${row.indexCode}`}>
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr>
                      <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Pertinente" : "Relevant"}</th>
                      <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Assertion" : "Assertion"}</th>
                      <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Risque inhérent" : "Inherent risk"}</th>
                      <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "Risque lié au contrôle" : "Control risk"}</th>
                      <th className={`${label} px-1.5 py-1 text-left`}>{fr ? "ECR" : "CRA"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.cells.map((cell) => {
                      const crHint =
                        cell.controlsCovering === 0
                          ? fr ? "aucun contrôle sélectionné (S2.1)" : "no control selected for testing (S2.1)"
                          : cell.controlsFailed > 0
                            ? fr ? `${cell.controlsFailed} contrôle(s) en échec (E1.1)` : `${cell.controlsFailed} control(s) failed (E1.1)`
                            : cell.controlsEffective > 0
                              ? fr ? `${cell.controlsEffective}/${cell.controlsCovering} contrôles efficaces (E1.1)` : `${cell.controlsEffective}/${cell.controlsCovering} controls effective (E1.1)`
                              : fr ? `${cell.controlsCovering} contrôle(s) sélectionné(s), tests non exécutés` : `${cell.controlsCovering} control(s) selected, tests not yet executed`;
                      return (
                        <tr key={cell.assertion} className={`border-t border-line align-top ${cell.relevant ? "" : "opacity-45"}`}>
                          <td className="px-1.5 py-1.5">
                            <input
                              type="checkbox"
                              checked={cell.relevant}
                              onChange={(e) => { patchCell(row.indexCode, cell.assertion, { relevant: e.target.checked }); void save(row.indexCode, cell.assertion, { relevant: e.target.checked }); }}
                              className="h-4 w-4 accent-emerald-700"
                              data-testid={`cra-rel-${row.indexCode}-${cell.assertion}`}
                            />
                          </td>
                          <td className="px-1.5 py-1.5">
                            <span className="text-[12px] font-semibold text-ink">{cell.assertion}</span>
                            <span className="ml-1 text-[11px] text-muted">{fr ? ASSERTION_LABELS[cell.assertion].fr : ASSERTION_LABELS[cell.assertion].en}</span>
                            {cell.significant ? <Chip tone="rose">{fr ? "Risque important" : "Significant risk"}</Chip> : null}
                          </td>
                          <td className="px-1.5 py-1.5">
                            <div className="flex flex-col gap-1">
                              <select
                                value={cell.ir ?? ""}
                                onChange={(e) => { const v = e.target.value as CraIr | ""; patchCell(row.indexCode, cell.assertion, { ir: v === "" ? null : v }); void save(row.indexCode, cell.assertion, { ir: v }); }}
                                className={select}
                                disabled={!cell.relevant}
                                data-testid={`cra-ir-${row.indexCode}-${cell.assertion}`}
                              >
                                <option value="">{fr ? `— sugg. ${cell.suggestedIr === "higher" ? "élevé" : "faible"}` : `— sugg. ${cell.suggestedIr}`}</option>
                                <option value="lower">{fr ? "Faible" : "Lower"}</option>
                                <option value="higher">{fr ? "Élevé" : "Higher"}</option>
                              </select>
                              <span className="text-[10.5px] text-muted">
                                {cell.riskCount > 0
                                  ? fr ? `${cell.riskCount} risque(s) au registre` : `${cell.riskCount} risk(s) in the register`
                                  : fr ? "aucun risque rattaché" : "no risk linked"}
                              </span>
                              <input
                                defaultValue={cell.irBasis}
                                placeholder={fr ? "Fondement (une phrase)…" : "Basis (one sentence)…"}
                                onBlur={(e) => { if (e.target.value !== cell.irBasis) { patchCell(row.indexCode, cell.assertion, { irBasis: e.target.value }); void save(row.indexCode, cell.assertion, { irBasis: e.target.value }); } }}
                                className={basisInput}
                                disabled={!cell.relevant}
                                data-testid={`cra-irb-${row.indexCode}-${cell.assertion}`}
                              />
                            </div>
                          </td>
                          <td className="px-1.5 py-1.5">
                            <div className="flex flex-col gap-1">
                              <select
                                value={cell.cr ?? ""}
                                onChange={(e) => { const v = e.target.value as CraCr | ""; patchCell(row.indexCode, cell.assertion, { cr: v === "" ? null : v }); void save(row.indexCode, cell.assertion, { cr: v }); }}
                                className={select}
                                disabled={!cell.relevant}
                                data-testid={`cra-cr-${row.indexCode}-${cell.assertion}`}
                              >
                                <option value="">{fr ? `— sugg. ${cell.suggestedCr === "rely" ? "appui" : "sans appui"}` : `— sugg. ${cell.suggestedCr === "rely" ? "rely" : "not rely"}`}</option>
                                <option value="rely">{fr ? "Appui sur les contrôles" : "Rely on controls"}</option>
                                <option value="not_rely">{fr ? "Sans appui" : "Not rely"}</option>
                              </select>
                              <span className="text-[10.5px] text-muted">{crHint}</span>
                              <input
                                defaultValue={cell.crBasis}
                                placeholder={fr ? "Fondement…" : "Basis…"}
                                onBlur={(e) => { if (e.target.value !== cell.crBasis) { patchCell(row.indexCode, cell.assertion, { crBasis: e.target.value }); void save(row.indexCode, cell.assertion, { crBasis: e.target.value }); } }}
                                className={basisInput}
                                disabled={!cell.relevant}
                                data-testid={`cra-crb-${row.indexCode}-${cell.assertion}`}
                              />
                            </div>
                          </td>
                          <td className="px-1.5 py-1.5">{cell.relevant ? <CraChip cell={cell} fr={fr} /> : <span className="text-[11px] text-muted">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-1.5 text-[10.5px] text-muted">
                  {fr
                    ? "L'appui sur les contrôles suppose des tests d'efficacité (S2.2 · E1.1). Un risque important impose un test de détail parmi les procédures (voir S5.5 et le papier E4)."
                    : "Relying on controls requires operating-effectiveness tests (S2.2 · E1.1). A significant risk requires a test of details among the responses (see S5.5 and the E4 paper)."}
                  {row.taskItemId ? (
                    <>
                      {" · "}
                      <Link href={`/engagements/${engagementId}/sections/${row.taskItemId}`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                        {fr ? `Papier ${row.taskCode}` : `${row.taskCode} workpaper`}
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
