// The CRA matrix table (EY-Canvas-style structure): one row per section-E
// account/cycle with its combined-risk state. Rendered full-size on the /cra
// tool page and compact inside the S3.1 working paper.

import { NavLink } from "@/components/NavLink";
import { Chip } from "@/components/ui/atlas";
import type { CraRow } from "@/lib/cra";
import { shortTitle } from "@/lib/file-index";
import { displayCode } from "@/lib/task-groups";

/** Page-local labels — the CRA matrix has no strings in messages/*.json. */
export const CRA_LABELS = {
  en: {
    title: "Combined Risk Assessment",
    subtitle: "Section E — risk coverage per account and cycle",
    cols: {
      account: "Accounts / Cycles",
      cra: "CRA",
      risks: "Risks",
      wcgw: "WCGWs",
      steps: "SCOTs / Steps",
      testing: "Testing",
      controls: "Controls",
    },
    significant: "Significant risk",
    riskIdentified: "Risk identified",
    noRisk: "No risk mapped",
    noSteps: "Material account without program steps",
    empty: "No section E accounts in this file.",
  },
  fr: {
    title: "Évaluation combinée des risques",
    subtitle: "Section E — couverture des risques par compte et cycle",
    cols: {
      account: "Comptes / Cycles",
      cra: "ECR",
      risks: "Risques",
      wcgw: "WCGW",
      steps: "SCOT / Diligences",
      testing: "Tests",
      controls: "Contrôles",
    },
    significant: "Risque significatif",
    riskIdentified: "Risque identifié",
    noRisk: "Aucun risque rattaché",
    noSteps: "Compte significatif sans diligences",
    empty: "Aucun compte de section E dans ce dossier.",
  },
} as const;

export function CraMatrix({
  engagementId,
  rows,
  locale,
  compact = false,
}: {
  engagementId: string;
  rows: CraRow[];
  locale: "en" | "fr";
  compact?: boolean;
}) {
  const l = CRA_LABELS[locale];
  const th = compact
    ? "border-b border-line bg-surface-2 px-2.5 py-1.5 text-left text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-muted"
    : "border-b border-line bg-surface-2 px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const td = compact
    ? "border-t border-line px-2.5 py-1.5 text-[11.5px] text-ink-soft tnum"
    : "border-t border-line px-5 py-3 text-[13px] text-ink-soft tnum";

  if (rows.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted">{l.empty}</p>;
  }

  return (
    <div className="overflow-x-auto" data-testid="cra-table">
      <table className={`w-full table-fixed ${compact ? "min-w-[620px]" : "min-w-[880px]"}`}>
        <colgroup>
          <col style={{ width: "32%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "11%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className={th}>{l.cols.account}</th>
            <th className={th}>{l.cols.cra}</th>
            <th className={th}>{l.cols.risks}</th>
            <th className={th}>{l.cols.wcgw}</th>
            <th className={th}>{l.cols.steps}</th>
            <th className={th}>{l.cols.testing}</th>
            <th className={`${th} text-right`}>{l.cols.controls}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const title = shortTitle(row.code, locale, locale === "fr" ? row.title_fr : row.title_en);
            const noSteps = row.material && row.steps_total === 0;
            return (
              <tr key={row.id} data-testid={`cra-${row.code}`} className="hover:bg-surface-2">
                <td className={`${td} truncate`}>
                  <NavLink
                    href={`/engagements/${engagementId}/sections/${row.id}`}
                    className="inline-flex max-w-full items-baseline gap-2 hover:underline"
                  >
                    <span className="font-mono text-[11.5px] font-extrabold text-emerald-700/70 tnum dark:text-emerald-400/70">
                      {displayCode(row.code)}
                    </span>
                    <span className="truncate font-medium text-ink">{title}</span>
                  </NavLink>
                </td>
                <td className={td}>
                  {row.significant ? (
                    <span title={l.significant}>
                      <Chip tone="rose">S</Chip>
                    </span>
                  ) : row.risks_count > 0 ? (
                    <span title={l.riskIdentified}>
                      <Chip tone="warn">R</Chip>
                    </span>
                  ) : (
                    <span title={l.noRisk}>
                      <Chip tone="muted">—</Chip>
                    </span>
                  )}
                </td>
                <td className={td}>
                  {row.risks_count > 0 ? (
                    <NavLink
                      href={`/engagements/${engagementId}/risks`}
                      className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {row.risks_count}
                    </NavLink>
                  ) : (
                    <span className="text-muted">0</span>
                  )}
                </td>
                <td className={td}>{row.wcgw > 0 ? row.wcgw : <span className="text-muted">0</span>}</td>
                <td className={td}>
                  {row.scots > 0 ? (
                    <span
                      className="mr-1 rounded bg-emerald-50 px-1 py-[0.5px] text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      title={locale === "fr" ? "SCOT couvrant ce compte (S1.1)" : "SCOTs covering this account (S1.1)"}
                      data-testid={`cra-scots-${row.code}`}
                    >
                      {row.scots}S
                    </span>
                  ) : null}
                  {noSteps ? (
                    <span className="font-bold text-rose" title={l.noSteps}>
                      0
                    </span>
                  ) : (
                    row.steps_total
                  )}
                </td>
                <td className={td}>
                  <span className={row.steps_total > 0 && row.steps_done === row.steps_total ? "font-semibold text-good" : ""}>
                    {row.steps_done}
                  </span>
                  <span className="text-muted">/{row.steps_total}</span>
                </td>
                <td className={`${td} text-right`}>
                  {row.scot_controls > 0 ? (
                    <span
                      className="mr-1 text-[10.5px] text-muted"
                      title={locale === "fr" ? "Contrôles SCOT sélectionnés pour test (S2.1)" : "SCOT controls selected for testing (S2.1)"}
                    >
                      {row.scot_controls} sel ·
                    </span>
                  ) : null}
                  {row.controls > 0 ? row.controls : <span className="text-muted">0</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
