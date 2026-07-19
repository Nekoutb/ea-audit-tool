import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { SectionStage, type StageSection } from "@/components/SectionStage";
import { TilesToggle } from "@/components/TilesToggle";
import { Chip, Panel, PanelHeader, StatCell } from "@/components/ui/atlas";
import { engagementDashboard } from "@/lib/dashboards";
import {
  dashboardStats,
  engagementAttention,
  engagementTasks,
  phaseDeadline,
  type AttentionTone,
  type DashboardPhase,
  type PhaseTask,
} from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import {
  SECTION_ORDER,
  displayCode,
  groupsOfSection,
  groupTitle,
  sectionLabel,
  type SectionKey,
} from "@/lib/task-groups";

export const metadata = { title: "Engagement dashboard · AuditISA" };

const ROUTE_TONE: Record<AttentionTone, string> = {
  rose: "text-rose bg-[var(--color-rose-soft)]",
  warn: "text-warn bg-[var(--color-warn-soft)]",
  accent: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40",
};

/** Deadline source phase per section (framework §6: strategy pre-year-end). */
const SECTION_DEADLINE_PHASE: Record<SectionKey, DashboardPhase> = {
  strategy: "planning",
  execution: "execution",
  conclusion: "conclusion",
};

function buildSections(
  tasks: PhaseTask[],
  engagementId: string,
  periodEnd: string,
  locale: "en" | "fr",
  dueLabel: string,
): StageSection[] {
  const byCode = new Map(tasks.map((t) => [t.code, t]));
  return SECTION_ORDER.map((key) => {
    const groups = groupsOfSection(key).map((g) => {
      const members = g.members.map((code) => byCode.get(code)).filter((t): t is PhaseTask => Boolean(t));
      return {
        id: g.id,
        code: g.code,
        title: groupTitle(g, locale),
        done: members.filter((t) => t.status === "reviewed").length,
        total: members.length,
        href: `/engagements/${engagementId}/groups/${g.id}`,
      };
    });
    const done = groups.reduce((sum, g) => sum + g.done, 0);
    const total = groups.reduce((sum, g) => sum + g.total, 0);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      key,
      label: sectionLabel(key, locale),
      done,
      total,
      pct,
      deadline: `${dueLabel} ${phaseDeadline(periodEnd, SECTION_DEADLINE_PHASE[key])}`,
      color: pct >= 70 ? "var(--color-emerald-600)" : pct > 0 ? "var(--color-warn)" : "var(--color-muted)",
      groups,
    };
  });
}

export default async function EngagementDashboardPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const t = getMessages(locale);
  const td = t.dashboard;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [tasks, attention, dash, stats] = await Promise.all([
    engagementTasks(id),
    engagementAttention(id, locale),
    engagementDashboard(id),
    dashboardStats(id),
  ]);

  const sections = buildSections(tasks, id, engagement.periodEnd, locale, td.stage.due);
  const doneTasks = sections.reduce((sum, s) => sum + s.done, 0);
  const totalTasks = sections.reduce((sum, s) => sum + s.total, 0);
  const overall = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const nextDeadline = dash.nextDeadlines[0] ?? null;
  const phaseLabel =
    engagement.phase === "archived" ? t.engagements.phases.archived : td.phaseNames[engagement.phase];

  return (
    <main className="flex min-h-screen w-full flex-col gap-3 px-4 py-4 sm:px-6">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            {td.resumed}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-ink">
            {engagement.name ?? engagement.clientName}
          </h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {engagement.name ? (
              <>
                {engagement.clientName}
                <span className="px-2 text-line-strong">·</span>
              </>
            ) : null}
            {phaseLabel}
            <span className="px-2 text-line-strong">·</span>
            {t.engagements.fiscalYear} {engagement.fiscalYear}
            <span className="px-2 text-line-strong">·</span>
            {t.engagements.periodEnd}: {engagement.periodEnd}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">
            {td.overallCompletion}
          </div>
          <div className="text-[40px] font-extrabold leading-none tracking-[-0.04em] text-emerald-800 tnum dark:text-emerald-300">
            {overall}
            <span className="text-lg text-muted">%</span>
          </div>
          <div className="mt-1.5 flex w-[220px] gap-1">
            {sections.map((s) => (
              <div key={s.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${s.pct}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <SectionStage
        sections={sections}
        hint={td.stage.groupsHint}
        reviewedLabel={td.stage.reviewed}
        groupsLabel={td.stage.groups}
      />

      <section className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex min-w-0 flex-col gap-3">
          <TilesToggle my={stats.my} all={stats.all} labels={td.tiles} />

          <Panel flush className="flex flex-col">
            <div className="border-b border-line px-5 py-3.5">
              <PanelHeader
                title={td.requiresAttention}
                right={<span className="text-xs font-semibold text-muted">{attention.length}</span>}
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto p-1.5" data-testid="attention-queue">
              {attention.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">{t.planning.findings.empty}</p>
              ) : (
                attention.map((item, idx) => (
                  <div
                    key={`${item.code}-${idx}`}
                    className="flex items-center gap-3 rounded-[var(--radius-atlas-xs)] px-3.5 py-2.5 transition hover:bg-surface-2"
                  >
                    <span
                      className={`grid h-6 w-12 flex-shrink-0 place-items-center rounded-md text-[10px] font-extrabold ${ROUTE_TONE[item.tone]}`}
                    >
                      {displayCode(item.code)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{item.title}</span>
                      <span className="block truncate text-[11.5px] text-muted">{item.meta}</span>
                    </span>
                    <span className="flex-shrink-0 text-[11px] text-muted tnum">
                      {item.ageDays === 0 ? "today" : `${item.ageDays}d`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel className="px-5 py-4">
            <PanelHeader title={td.stage.refDocs} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                { href: `/engagements/${id}/data`, label: t.planning.dataTitle },
                { href: `/engagements/${id}/pbc`, label: t.pbc.title },
                { href: `/engagements/${id}/legal`, label: t.planning.legal.title },
                { href: `/api/engagements/${id}/export`, label: t.engagementDashboard.export },
              ].map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="inline-flex min-h-[28px] items-center rounded-full bg-line/60 px-3.5 py-1 text-[12px] font-semibold text-ink-soft transition hover:bg-surface-2"
                >
                  {r.label}
                </Link>
              ))}
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <Panel flush className="flex flex-col">
            <div className="border-b border-line px-5 py-3.5">
              <PanelHeader title={td.activity.title} />
            </div>
            <div className="flex flex-col gap-3.5 p-5">
              <StatCell label={td.currentPhase} value={phaseLabel} right={<Chip tone="warn">Active</Chip>} />
              <StatCell
                label={td.nextDeadline}
                value={nextDeadline ? nextDeadline.dueDate : "—"}
                sub={
                  nextDeadline
                    ? `${nextDeadline.key} · ${nextDeadline.daysLeft} ${t.planning.legal.daysLeft.toLowerCase()}`
                    : undefined
                }
              />
              <StatCell
                label={t.dashboard.portfolioRisks}
                value={`${dash.risks.significant}`}
                right={
                  dash.risks.significant > 0 ? <Chip tone="rose">open</Chip> : <Chip tone="good">clear</Chip>
                }
                sub={`${dash.risks.identified} open · ${dash.risks.concluded} concluded`}
              />
              <StatCell
                label={t.engagementDashboard.b5}
                value={formatFCFA(dash.b5.uncorrected)}
                sub={
                  dash.b5.materiality === null
                    ? t.dashboard.noMateriality
                    : `${t.planning.findings.vsMateriality} ${formatFCFA(dash.b5.materiality)}`
                }
                right={
                  dash.b5.materiality !== null && Math.abs(dash.b5.uncorrected) > dash.b5.materiality ? (
                    <Chip tone="rose">{t.dashboard.exceeds}</Chip>
                  ) : (
                    <Chip tone="good">{t.dashboard.within}</Chip>
                  )
                }
              />
              <StatCell
                label={t.engagementDashboard.pbcOpen}
                value={`${dash.pbcOpen}`}
                sub={`${dash.documentsUnsigned} ${t.engagementDashboard.unsigned.toLowerCase()}`}
              />
              <div className="mt-auto flex flex-wrap items-center gap-4 pt-1">
                <a
                  href={`/api/engagements/${id}/export`}
                  data-testid="dashboard-export-index"
                  className="inline-flex min-h-[24px] items-center text-[12.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {t.engagementDashboard.export}
                </a>
                <Link
                  href={`/engagements/${id}/activity`}
                  data-testid="dashboard-activity-link"
                  className="inline-flex min-h-[24px] items-center text-[12.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {td.activity.link}
                </Link>
                <Link
                  href={`/engagements/${id}/time`}
                  data-testid="dashboard-time-link"
                  className="inline-flex min-h-[24px] items-center text-[12.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {t.time.link}
                </Link>
                <Link
                  href={`/engagements/${id}/discussion`}
                  data-testid="dashboard-discussion-link"
                  className="inline-flex min-h-[24px] items-center text-[12.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {t.discussion.link}
                </Link>
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </main>
  );
}
