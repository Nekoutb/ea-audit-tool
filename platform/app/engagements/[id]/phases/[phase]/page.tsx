import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { NavLink } from "@/components/NavLink";
import { PhaseTaskRow, type PhaseRowData } from "@/components/PhaseTaskRow";
import { Chip, Panel, PanelHeader } from "@/components/ui/atlas";
import {
  PHASE_ORDER,
  PHASE_SLUGS,
  engagementPhaseProgress,
  engagementReviewer,
  initials,
  phaseDeadline,
  phaseTasks,
  type DashboardPhase,
} from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { shortTitle } from "@/lib/file-index";
import { FORM_DEFINITIONS } from "@/lib/forms";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

const PHASE_TITLES: Record<string, string> = {
  "pre-planning": "Pre-Planning",
  planning: "Planning",
  execution: "Execution",
  conclusion: "Conclusion",
};

export async function generateMetadata(props: { params: Promise<{ phase: string }> }) {
  const { phase } = await props.params;
  return { title: `${PHASE_TITLES[phase] ?? "Phase"} tasks · AuditISA` };
}

const MONTHS: Record<"en" | "fr", string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  fr: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
};
function fmtDate(iso: string, locale: "en" | "fr"): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[locale][m - 1]} ${y}`;
}

/**
 * Phase drill-down: the sign-off task table behind one dashboard gauge. Every
 * row is clickable (opens the task); the P / R squares sign off as preparer /
 * reviewer in place.
 */
export default async function PhaseTasksPage(props: {
  params: Promise<{ id: string; phase: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id, phase: slug } = await props.params;
  const { error } = await props.searchParams;
  const phase = PHASE_SLUGS[slug];
  if (!phase) notFound();

  const locale = await getLocale();
  const t = getMessages(locale);
  const td = t.dashboard;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [tasks, progress, reviewerName] = await Promise.all([
    phaseTasks(id, phase),
    engagementPhaseProgress(id, engagement.phase),
    engagementReviewer(id),
  ]);
  const summary = progress.find((p) => p.phase === phase);
  const index = `0${PHASE_ORDER.indexOf(phase) + 1}`;
  // Header count reflects the real reviewed sign-offs so it always matches the
  // rows on this screen (the dashboard gauge is a separate, position-based read).
  const reviewedCount = tasks.filter((t) => t.status === "reviewed").length;

  // Phase target date + on-track / overdue read (computed against today).
  const deadlineIso = phaseDeadline(engagement.periodEnd, phase);
  const deadlineDate = fmtDate(deadlineIso, locale);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const sg = td.signoff;
  const reviewerIni = reviewerName ? initials(reviewerName) : "";

  const rows: PhaseRowData[] = tasks.map((task) => {
    const href = task.documentId
      ? `/documents/${task.documentId}`
      : FORM_DEFINITIONS[task.code]
        ? `/engagements/${id}/forms/${task.code}`
        : task.code === "D5.1"
          ? `/engagements/${id}/planning`
          : task.code === "D7.2"
            ? `/engagements/${id}/risks`
            : task.section === "F"
              ? `/engagements/${id}/legal`
              : `/engagements/${id}/sections/${task.id}`;

    const preparerSigned = Boolean(task.preparerName);
    const reviewerSigned = Boolean(task.reviewerName);

    const preparer = preparerSigned
      ? { ini: initials(task.preparerName!), line: sg.prepDone, lineTone: "done" as const }
      : task.ownerName
        ? { ini: initials(task.ownerName), line: sg.awaitingHandoff, lineTone: "wait" as const }
        : { ini: "", line: sg.noPreparer, lineTone: "none" as const };

    const reviewer = reviewerSigned
      ? { ini: initials(task.reviewerName!), line: sg.revDone, lineTone: "done" as const }
      : reviewerName
        ? preparerSigned
          ? { ini: reviewerIni, line: sg.awaitingReview, lineTone: "wait" as const }
          : { ini: reviewerIni, line: sg.awaitingPreparer, lineTone: "idle" as const }
        : { ini: "", line: sg.noReviewer, lineTone: "none" as const };

    // Per-task due date wins over the phase-derived deadline.
    const taskIso = task.dueDate ?? deadlineIso;
    const taskDate = task.dueDate ? fmtDate(task.dueDate, locale) : deadlineDate;
    const taskOverdue = Math.round((todayUtc - new Date(taskIso + "T00:00:00Z").getTime()) / 86_400_000);
    const deadline = reviewerSigned
      ? { date: taskDate, tag: td.deadlineTag.completed, tagTone: "done" as const }
      : taskOverdue > 0
        ? {
            date: taskDate,
            tag: `${td.deadlineTag.overdue} · ${taskOverdue} ${taskOverdue === 1 ? td.deadlineTag.day : td.deadlineTag.days}`,
            tagTone: "over" as const,
          }
        : { date: taskDate, tag: td.deadlineTag.onTrack, tagTone: "ok" as const };

    const statusToneMap = { reviewed: "done", in_review: "rev", in_progress: "prog", not_started: "wait" } as const;

    return {
      id: task.id,
      code: task.code,
      title: shortTitle(task.code, locale, locale === "fr" ? task.titleFr : task.titleEn),
      href,
      status: { label: td.rowStatus[task.status], tone: statusToneMap[task.status] },
      deadline,
      preparer,
      reviewer,
      preparerSigned,
      reviewerSigned,
    };
  });

  const WORKSPACE_MAP: Record<DashboardPhase, { href: string; label: string }[]> = {
    acceptance: [{ href: `/engagements/${id}/acceptance`, label: t.planning.acceptanceTitle }],
    planning: [
      { href: `/engagements/${id}/planning`, label: t.planning.planningTitle },
      { href: `/engagements/${id}/risks`, label: t.planning.risksTitle },
    ],
    execution: [
      { href: `/engagements/${id}/data`, label: t.planning.dataTitle },
      { href: `/engagements/${id}/analytics`, label: t.planning.analyticsTitle },
      { href: `/engagements/${id}/confirmations`, label: t.planning.confirmations.title },
      { href: `/engagements/${id}/pbc`, label: t.pbc.title },
    ],
    conclusion: [
      { href: `/engagements/${id}/legal`, label: t.planning.legal.title },
      { href: `/engagements/${id}/conclusion`, label: t.planning.conclusion.title },
      { href: `/engagements/${id}/findings`, label: t.planning.findings.title },
    ],
  };
  const workspaces = WORKSPACE_MAP[phase];
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

  const th = "border-b border-line bg-surface-2 px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";

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
            {td.backToDashboard}
          </NavLink>
          <h1 className="mt-2 flex items-baseline gap-2.5 text-2xl font-bold tracking-[-0.02em] text-ink">
            <span className="text-base font-extrabold text-emerald-700/55 tnum dark:text-emerald-400/55">{index}</span>
            {td.phaseNames[phase]}
            <span className="ml-1">{phaseChip}</span>
          </h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {engagement.clientName}
            <span className="px-2 text-line-strong">·</span>
            {t.engagements.fiscalYear} {engagement.fiscalYear}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">{td.overallCompletion}</div>
          <div className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-emerald-800 tnum dark:text-emerald-300">
            {reviewedCount}
            <span className="text-muted">/{tasks.length}</span>
          </div>
        </div>
      </div>

      {workspaces.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="phase-workspaces">
          {workspaces.map((ws) => (
            <NavLink
              key={ws.href}
              href={ws.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-soft transition hover:bg-surface-2"
            >
              {ws.label}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </NavLink>
          ))}
        </div>
      ) : null}

      <ErrorBanner error={error} locale={locale} />

      <Panel flush className="flex flex-col">
        <div className="border-b border-line px-5 py-3.5">
          <PanelHeader title={td.taskList} right={<span className="text-xs font-semibold text-muted tnum">{tasks.length}</span>} />
        </div>
        <div className="overflow-x-auto" data-testid="phase-task-list">
          {tasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{td.emptyTasks}</p>
          ) : (
            <table className="w-full min-w-[860px] table-fixed">
              <colgroup>
                <col style={{ width: "31%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "13%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={th}>{td.taskCols.task}</th>
                  <th className={th}>{td.taskCols.preparer}</th>
                  <th className={th}>{td.taskCols.reviewer}</th>
                  <th className={th}>{td.taskCols.deadline}</th>
                  <th className={`${th} text-right`}>{td.taskCols.status}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <PhaseTaskRow
                    key={row.id}
                    row={row}
                    engagementId={id}
                    phaseSlug={slug}
                    signPreparerLabel={td.signAsPreparer}
                    signReviewerLabel={td.signAsReviewer}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </main>
  );
}
