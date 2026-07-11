import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { NavLink } from "@/components/NavLink";
import { Chip, Panel, PanelHeader } from "@/components/ui/atlas";
import {
  PHASE_ORDER,
  PHASE_SLUGS,
  engagementPhaseProgress,
  phaseTasks,
  type PhaseTaskStatus,
} from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

const STATUS_TONE: Record<PhaseTaskStatus, "good" | "warn" | "muted"> = {
  complete: "good",
  in_progress: "warn",
  not_started: "muted",
};

/**
 * Phase drill-down: the exhaustive, sequentially-ordered task list behind one
 * dashboard gauge. Reached by clicking the gauge (with the transition spinner).
 */
export default async function PhaseTasksPage(props: {
  params: Promise<{ id: string; phase: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id, phase: slug } = await props.params;
  const phase = PHASE_SLUGS[slug];
  if (!phase) notFound();

  const locale = await getLocale();
  const t = getMessages(locale);
  const td = t.dashboard;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [tasks, progress] = await Promise.all([
    phaseTasks(id, phase),
    engagementPhaseProgress(id, engagement.phase),
  ]);
  const summary = progress.find((p) => p.phase === phase);
  const index = `0${PHASE_ORDER.indexOf(phase) + 1}`;
  const phaseChip =
    summary?.status === "complete" ? (
      <Chip tone="good">{td.taskStatus.complete}</Chip>
    ) : summary?.status === "current" ? (
      <Chip tone="warn" pulse>
        {td.taskStatus.in_progress}
      </Chip>
    ) : (
      <Chip tone="muted">{td.taskStatus.not_started}</Chip>
    );

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-4">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <NavLink
            href={`/engagements/${id}/dashboard`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            testId="back-to-dashboard"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            {td.backToDashboard}
          </NavLink>
          <h1 className="mt-2 flex items-baseline gap-2.5 text-2xl font-bold tracking-[-0.02em] text-ink">
            <span className="text-base font-extrabold text-emerald-700/55 tnum dark:text-emerald-400/55">
              {index}
            </span>
            {td.phaseNames[phase]}
            <span className="ml-1">{phaseChip}</span>
          </h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {engagement.clientName}
            <span className="px-2 text-line-strong">·</span>
            {t.engagements.fiscalYear} {engagement.fiscalYear}
          </p>
        </div>
        {summary ? (
          <div className="text-right">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">
              {td.overallCompletion}
            </div>
            <div className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-emerald-800 tnum dark:text-emerald-300">
              {summary.done}
              <span className="text-muted">/{summary.total}</span>
            </div>
          </div>
        ) : null}
      </div>

      <Panel flush className="flex flex-col">
        <div className="border-b border-line px-5 py-3.5">
          <PanelHeader
            title={td.taskList}
            right={<span className="text-xs font-semibold text-muted tnum">{tasks.length}</span>}
          />
        </div>
        <div className="p-1.5" data-testid="phase-task-list">
          {tasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{t.planning.findings.empty}</p>
          ) : (
            tasks.map((task, i) => {
              const href = task.documentId
                ? `/documents/${task.documentId}`
                : task.section === "E"
                  ? `/engagements/${id}/sections/${task.id}`
                  : `/engagements/${id}`;
              // Mirror the gauge semantics: a closed phase reads complete, a
              // future phase not started; only the current phase shows live
              // working-paper status.
              const status: PhaseTaskStatus =
                summary?.status === "complete"
                  ? "complete"
                  : summary?.status === "upcoming"
                    ? "not_started"
                    : task.status;
              return (
                <div
                  key={task.id}
                  data-testid={`phase-task-${task.code}`}
                  className="flex items-center gap-3.5 rounded-[var(--radius-atlas-xs)] px-3.5 py-2.5 transition hover:bg-surface-2"
                >
                  <span className="w-7 flex-shrink-0 text-right text-[11px] font-extrabold text-emerald-700/45 tnum dark:text-emerald-400/45">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="w-12 flex-shrink-0 font-mono text-[11px] font-bold text-ink-soft">
                    {task.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
                    {locale === "fr" ? task.titleFr : task.titleEn}
                  </span>
                  <Chip tone={STATUS_TONE[status]}>{td.taskStatus[status]}</Chip>
                  <Link
                    href={href}
                    data-testid={`open-phase-task-${task.code}`}
                    className="flex-shrink-0 rounded-[var(--radius-atlas-xs)] border border-line-strong px-2.5 py-1 text-[12px] font-semibold text-ink-soft transition hover:bg-surface-2"
                  >
                    {td.openTask}
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </Panel>
    </main>
  );
}
