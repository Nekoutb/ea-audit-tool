"use client";

// The Combined Risk Assessment matrix (S3.1): one flat table — LEAD · assertion
// · IH · CR · CRA. Only the relevant assertions selected at the P6.2
// significant-accounts determination appear, ordered by priority (significant
// and fraud risks first). IH and CR are assessed separately per assertion
// (ISA 315 ¶34) and combine into the level; a significant risk overlays
// special audit considerations, never a fifth level.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CraAccountRow, CraBoardView, CraCell } from "@/lib/cra";
import { craOf, craTone, toTod, todLabel, type CraCr, type CraIr, type CraLevel } from "@/lib/cra-model";
import { Chip } from "@/components/ui/atlas";

const ASSERTION_LABELS: Record<string, { en: string; fr: string }> = {
  C: { en: "Completeness", fr: "Exhaustivité" },
  E: { en: "Existence / occurrence", fr: "Existence / réalité" },
  A: { en: "Accuracy / cut-off", fr: "Exactitude / séparation" },
  V: { en: "Valuation", fr: "Évaluation" },
  P: { en: "Presentation / disclosure", fr: "Présentation / information" },
};

const ORDER = ["C", "E", "A", "V", "P"];

/** Priority order inside a row: significant risks, then fraud, then risk-linked, then the rest. */
function priorityCells(row: CraAccountRow): CraCell[] {
  return row.cells
    .filter((c) => c.relevant)
    .sort((a, b) => {
      const score = (c: CraCell) => (c.significant ? 0 : c.fraud ? 1 : c.riskCount > 0 ? 2 : 3);
      const d = score(a) - score(b);
      return d !== 0 ? d : ORDER.indexOf(a.assertion) - ORDER.indexOf(b.assertion);
    });
}

function cellState(c: CraCell): { ir: CraIr; cr: CraCr; recorded: boolean } {
  return { ir: c.ir ?? c.suggestedIr, cr: c.cr ?? c.suggestedCr, recorded: c.ir !== null && c.cr !== null };
}

function CraChip({ cell, fr }: { cell: CraCell; fr: boolean }) {
  const { ir, cr, recorded } = cellState(cell);
  if (!recorded) {
    return (
      <span data-testid={`cra-level-${cell.assertion}`}>
        <Chip tone="muted">—</Chip>
      </span>
    );
  }
  const level = craOf(ir, cr);
  const tod = toTod(level, cell.significant);
  return (
    <span data-testid={`cra-level-${cell.assertion}`}>
      <Chip tone={craTone(level)}>{todLabel(tod, fr ? "fr" : "en")}</Chip>
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
  const pathname = usePathname();
  const [rows, setRows] = useState(view.rows);
  const [openBasis, setOpenBasis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            ? "RI faible + appui = Minimal · RI faible sans appui = Modéré · RI élevé + appui = Faible · RI élevé sans appui = Élevé · un risque important/fraude superpose des diligences particulières (+SR)"
            : "Lower IH + rely = Minimal · Lower IH + not rely = Moderate · Higher IH + rely = Low · Higher IH + not rely = High · a significant/fraud risk overlays special audit considerations (+SR)"}
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr>
              <th className={`${label} px-2 py-1.5 text-left`}>{fr ? "Indice" : "Lead"}</th>
              <th className={`${label} px-2 py-1.5 text-left`}>{fr ? "Assertion" : "Assertion"}</th>
              <th className={`${label} px-2 py-1.5 text-left`} title={fr ? "Risque inhérent" : "Inherent risk"}>IH</th>
              <th className={`${label} px-2 py-1.5 text-left`} title={fr ? "Risque lié au contrôle" : "Control risk"}>CR</th>
              <th className={`${label} px-2 py-1.5 text-left`} title={fr ? "Évaluation combinée des risques" : "Combined risk assessment"}>CRA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cells = priorityCells(row);
              return cells.map((cell, i) => {
                const basisKey = `${row.indexCode}|${cell.assertion}`;
                const basisOpen = openBasis === basisKey;
                return (
                  <tr
                    key={basisKey}
                    className={`align-middle ${i === 0 ? "border-t-2 border-line-strong" : "border-t border-line"}`}
                    data-testid={i === 0 ? `cra-row-${row.indexCode}` : undefined}
                  >
                    {i === 0 ? (
                      <td className="px-2 py-1.5 align-top" rowSpan={cells.length}>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-[12px] font-extrabold text-emerald-700/80 tnum dark:text-emerald-400/80">{row.indexCode}</span>
                          <span className="max-w-[180px] text-[12px] font-semibold leading-tight text-ink">{row.label}</span>
                          {row.taskItemId ? (
                            <Link
                              href={`/engagements/${engagementId}/sections/${row.taskItemId}?back=${encodeURIComponent(pathname)}`}
                              className="text-[10.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                            >
                              {row.taskCode}
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                    <td className="px-2 py-1.5">
                      <span
                        className="cursor-help text-[12.5px] font-bold text-ink"
                        title={fr ? ASSERTION_LABELS[cell.assertion].fr : ASSERTION_LABELS[cell.assertion].en}
                      >
                        {cell.assertion}
                      </span>
                      {cell.significant ? <span className="ml-1.5"><Chip tone="rose">{fr ? "Risque important" : "Significant risk"}</Chip></span> : null}
                      {cell.fraud ? <span className="ml-1"><Chip tone="rose">{fr ? "Fraude" : "Fraud"}</Chip></span> : null}
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={cell.ir ?? ""}
                        onChange={(e) => { const v = e.target.value as CraIr | ""; patchCell(row.indexCode, cell.assertion, { ir: v === "" ? null : v }); void save(row.indexCode, cell.assertion, { ir: v }); }}
                        className={select}
                        title={cell.riskCount > 0 ? (fr ? `${cell.riskCount} risque(s) au registre` : `${cell.riskCount} risk(s) in the register`) : (fr ? "Aucun risque rattaché" : "No risk linked")}
                        data-testid={`cra-ir-${row.indexCode}-${cell.assertion}`}
                      >
                        <option value="">—</option>
                        <option value="lower">{fr ? "Faible" : "Lower"}</option>
                        <option value="higher">{fr ? "Élevé" : "Higher"}</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={cell.cr ?? ""}
                        onChange={(e) => { const v = e.target.value as CraCr | ""; patchCell(row.indexCode, cell.assertion, { cr: v === "" ? null : v }); void save(row.indexCode, cell.assertion, { cr: v }); }}
                        className={select}
                        title={
                          cell.controlsCovering === 0
                            ? fr ? "Aucun contrôle sélectionné (S2.1)" : "No control selected for testing (S2.1)"
                            : cell.controlsFailed > 0
                              ? fr ? `${cell.controlsFailed} contrôle(s) en échec (E1.1)` : `${cell.controlsFailed} control(s) failed (E1.1)`
                              : fr ? `${cell.controlsEffective}/${cell.controlsCovering} contrôles efficaces (E1.1)` : `${cell.controlsEffective}/${cell.controlsCovering} controls effective (E1.1)`
                        }
                        data-testid={`cra-cr-${row.indexCode}-${cell.assertion}`}
                      >
                        <option value="">—</option>
                        <option value="rely">{fr ? "Appui" : "Rely"}</option>
                        <option value="not_rely">{fr ? "Sans appui" : "Not rely"}</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <CraChip cell={cell} fr={fr} />
                        <button
                          type="button"
                          onClick={() => setOpenBasis(basisOpen ? null : basisKey)}
                          className="text-[10.5px] font-semibold text-muted hover:text-ink"
                          title={fr ? "Fondement des cotations" : "Basis for the assessments"}
                          data-testid={`cra-basis-toggle-${row.indexCode}-${cell.assertion}`}
                        >
                          {basisOpen ? "▾" : "✎"}
                        </button>
                      </div>
                      {basisOpen ? (
                        <div className="mt-1 flex w-56 flex-col gap-1">
                          <input
                            defaultValue={cell.irBasis}
                            placeholder={fr ? "Fondement RI…" : "IH basis…"}
                            onBlur={(e) => { if (e.target.value !== cell.irBasis) { patchCell(row.indexCode, cell.assertion, { irBasis: e.target.value }); void save(row.indexCode, cell.assertion, { irBasis: e.target.value }); } }}
                            className={basisInput}
                            data-testid={`cra-irb-${row.indexCode}-${cell.assertion}`}
                          />
                          <input
                            defaultValue={cell.crBasis}
                            placeholder={fr ? "Fondement RC…" : "CR basis…"}
                            onBlur={(e) => { if (e.target.value !== cell.crBasis) { patchCell(row.indexCode, cell.assertion, { crBasis: e.target.value }); void save(row.indexCode, cell.assertion, { crBasis: e.target.value }); } }}
                            className={basisInput}
                            data-testid={`cra-crb-${row.indexCode}-${cell.assertion}`}
                          />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10.5px] text-muted">
        {fr
          ? "Seules les assertions pertinentes retenues lors de la détermination des comptes significatifs (P6.2) apparaissent — les risques importants et de fraude en tête. L'appui sur les contrôles suppose des tests d'efficacité (S2.2 · E1.1) ; un risque important impose un test de détail parmi les réponses (S5.5 · papier E4)."
          : "Only the relevant assertions selected at the significant-accounts determination (P6.2) appear — significant and fraud risks first. Relying on controls requires operating-effectiveness tests (S2.2 · E1.1); a significant risk requires a test of details among the responses (S5.5 · E4 paper)."}
      </p>
    </div>
  );
}
