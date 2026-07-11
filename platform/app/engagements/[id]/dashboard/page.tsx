import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { PhaseLink } from "@/components/PhaseLink";
import {
  Chip,
  Panel,
  PanelHeader,
  PhaseGauge,
  StatCell,
  btnPrimary,
} from "@/components/ui/atlas";
import { engagementDashboard } from "@/lib/dashboards";
import {
  PHASE_SLUG_OF,
  engagementAttention,
  engagementPhaseProgress,
  type AttentionTone,
} from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

const ROUTE_TONE: Record<AttentionTone, string> = {
  rose: "text-rose bg-[var(--color-rose-soft)]",
  warn: "text-warn bg-[var(--color-warn-soft)]",
  accent: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40",
};

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

  const [phases, attention, dash] = await Promise.all([
    engagementPhaseProgress(id, engagement.phase),
    engagementAttention(id, locale),
    engagementDashboard(id),
  ]);

  const totalTasks = phases.reduce((sum, p) => sum + p.total, 0);
  const doneTasks = phases.reduce((sum, p) => sum + p.done, 0);
  const overall = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const nextDeadline = dash.nextDeadlines[0] ?? null;
  const phaseLabel =
    engagement.phase === "archived" ? t.engagements.phases.archived : td.phaseNames[engagement.phase];

  return (
    <main className="flex h-[100dvh] w-full flex-col gap-3 overflow-hidden px-6 py-4">
      <AppNav locale={locale} current={{ id, label: engagement.clientName }} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            {td.resumed}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-ink">
            {engagement.clientName}
          </h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {phaseLabel}
            <span className="px-2 text-line-strong">·</span>
            {t.engagements.fiscalYear} {engagement.fiscalYear}
            <span className="px-2 text-line-strong">·</span>
            {t.engagements.periodEnd}: {engagement.periodEnd}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">
              {td.overallCompletion}
            </div>
            <div className="flex items-baseline justify-end gap-2">
              <span className="text-[40px] font-extrabold leading-none tracking-[-0.04em] text-emerald-800 tnum dark:text-emerald-300">
                {overall}
                <span className="text-lg text-muted">%</span>
              </span>
            </div>
            <div className="mt-1.5 flex w-[220px] gap-1">
              {phases.map((p) => {
                const pct = p.total > 0 ? (p.done / p.total) * 100 : p.status === "complete" ? 100 : 0;
                return (
                  <div key={p.phase} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                  </div>
                );
              })}
            </div>
          </div>
          <Link href={`/engagements/${id}`} className={btnPrimary} data-testid="open-working-file">
            {td.openWorkingFile}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="phase-gauges">
        {phases.map((p, i) => (
          <PhaseLink
            key={p.phase}
            href={`/engagements/${id}/phases/${PHASE_SLUG_OF[p.phase]}`}
            testId={`phase-link-${PHASE_SLUG_OF[p.phase]}`}
          >
            <PhaseGauge
              index={`0${i + 1}`}
              name={td.phaseNames[p.phase]}
              done={p.done}
              total={p.total}
              status={p.status}
            />
          </PhaseLink>
        ))}
      </section>

      <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Panel flush className="flex flex-col">
          <div className="border-b border-line px-5 py-3.5">
            <PanelHeader
              title={td.requiresAttention}
              right={<span className="text-xs font-semibold text-muted">{attention.length}</span>}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-1.5" data-testid="attention-queue">
            {attention.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">{t.planning.findings.empty}</p>
            ) : (
              attention.map((item, idx) => (
                <div
                  key={`${item.code}-${idx}`}
                  className="flex items-center gap-3 rounded-[var(--radius-atlas-xs)] px-3.5 py-2.5 transition hover:bg-surface-2"
                >
                  <span
                    className={`grid h-6 w-9 flex-shrink-0 place-items-center rounded-md text-[10px] font-extrabold ${ROUTE_TONE[item.tone]}`}
                  >
                    {item.code}
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

        <Panel flush className="flex flex-col">
          <div className="border-b border-line px-5 py-3.5">
            <PanelHeader title={td.statusKeyDates} />
          </div>
          <div className="flex flex-col gap-3.5 p-5">
            <StatCell
              label={td.currentPhase}
              value={phaseLabel}
              right={<Chip tone="warn">Active</Chip>}
            />
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
          </div>
        </Panel>
      </section>
    </main>
  );
}
