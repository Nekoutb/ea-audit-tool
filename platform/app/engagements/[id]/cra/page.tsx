import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { NavLink } from "@/components/NavLink";
import { Panel, PanelHeader, Chip } from "@/components/ui/atlas";
import { withTenant } from "@/lib/db";
import { getEngagement } from "@/lib/engagements";
import { shortTitle } from "@/lib/file-index";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { displayCode } from "@/lib/task-groups";
import { requireTenant } from "@/lib/tenant";

export const metadata = { title: "CRA · AuditISA" };

/** Page-local labels — the CRA matrix has no strings in messages/*.json. */
const LABELS = {
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

interface CraRow {
  id: string;
  code: string;
  title_en: string;
  title_fr: string;
  material: boolean;
  significant: boolean;
  risks_count: number;
  wcgw: number;
  steps_total: number;
  steps_done: number;
  controls: number;
}

/**
 * The whole matrix in one aggregate query: every non-conditional section-E
 * item, with its non-rebutted risk links (count / significance / WCGW
 * assertion tally), program-step progress, and control tests (control_test
 * links to the section directly via file_item_id).
 */
async function craRows(engagementId: string): Promise<CraRow[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<CraRow>(
      `SELECT fi.id, fi.code, fi.title_en, fi.title_fr, fi.material,
              r.significant, r.risks_count, r.wcgw,
              ps.steps_total, ps.steps_done,
              ct.controls
         FROM file_item fi
         LEFT JOIN LATERAL (
           SELECT coalesce(bool_or(rk.significant), false) AS significant,
                  count(DISTINCT rs.risk_id)::int AS risks_count,
                  coalesce(sum(coalesce(array_length(rs.assertions, 1), 0)), 0)::int AS wcgw
             FROM risk_section rs
             JOIN risk rk ON rk.id = rs.risk_id AND rk.rebutted = false
            WHERE rs.file_item_id = fi.id
         ) r ON true
         LEFT JOIN LATERAL (
           SELECT count(*)::int AS steps_total,
                  count(*) FILTER (WHERE p.status = 'complete')::int AS steps_done
             FROM program_step p
            WHERE p.file_item_id = fi.id
         ) ps ON true
         LEFT JOIN LATERAL (
           SELECT count(*)::int AS controls
             FROM control_test c
            WHERE c.file_item_id = fi.id
         ) ct ON true
        WHERE fi.engagement_id = $1 AND fi.section = 'E' AND fi.conditional = false
        ORDER BY fi.sort_order`,
      [engagementId],
    );
    return result.rows;
  });
}

/** Read-only CRA matrix (EY-Canvas-style structure): one row per E-section. */
export default async function CraPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const t = getMessages(locale);
  const l = LABELS[locale];

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const rows = await craRows(id);
  const significantCount = rows.filter((row) => row.significant).length;

  const th =
    "border-b border-line bg-surface-2 px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const td = "border-t border-line px-5 py-3 text-[13px] text-ink-soft tnum";

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <NavLink
            href={`/engagements/${id}/dashboard`}
            className="inline-flex min-h-[24px] items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            testId="back-to-dashboard"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            {t.dashboard.backToDashboard}
          </NavLink>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">{l.title}</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {l.subtitle}
            <span className="px-2 text-line-strong">·</span>
            {engagement.clientName}
            <span className="px-2 text-line-strong">·</span>
            {t.engagements.fiscalYear} {engagement.fiscalYear}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">{l.significant}</div>
          <div className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-rose tnum">
            {significantCount}
            <span className="text-muted">/{rows.length}</span>
          </div>
        </div>
      </div>

      <Panel flush className="flex flex-col">
        <div className="border-b border-line px-5 py-3.5">
          <PanelHeader
            title={l.cols.account}
            right={<span className="text-xs font-semibold text-muted tnum">{rows.length}</span>}
          />
        </div>
        <div className="overflow-x-auto" data-testid="cra-table">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{l.empty}</p>
          ) : (
            <table className="w-full min-w-[880px] table-fixed">
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
                          href={`/engagements/${id}/sections/${row.id}`}
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
                            href={`/engagements/${id}/risks`}
                            className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            {row.risks_count}
                          </NavLink>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </td>
                      <td className={td}>
                        {row.wcgw > 0 ? row.wcgw : <span className="text-muted">0</span>}
                      </td>
                      <td className={td}>
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
                        {row.controls > 0 ? row.controls : <span className="text-muted">0</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </main>
  );
}
