import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { instantiateGroupTasksAction } from "@/app/actions/audit-file";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { NavLink } from "@/components/NavLink";
import { PhaseTaskRow, type PhaseRowData } from "@/components/PhaseTaskRow";
import { SubmitButton } from "@/components/SubmitButton";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import {
  PHASE_SLUG_OF,
  engagementReviewer,
  engagementTasks,
  existingTaskCodes,
  initials,
  phaseDeadline,
  phaseOfTask,
  type PhaseTask,
} from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { shortTitle } from "@/lib/file-index";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { canReview } from "@/lib/rbac";
import { GROUP_BY_ID, displayCode, groupTitle, sectionLabel } from "@/lib/task-groups";
import { dspDesignGaps, dspDesignedIndexes } from "@/lib/design-procedures";
import { indexesForTask } from "@/lib/psp";

export async function generateMetadata(props: { params: Promise<{ group: string }> }) {
  const { group } = await props.params;
  const g = GROUP_BY_ID[group];
  return { title: `${g ? `${g.code} ${g.titleEn}` : "Task group"} · AuditISA` };
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
 * Group task page — the only place a group's detail tasks are listed (framework
 * §7). Same sign-off table as the phase view, scoped to the group's members and
 * showing ST/E/C display codes.
 */
export default async function GroupTasksPage(props: {
  params: Promise<{ id: string; group: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id, group } = await props.params;
  const { error } = await props.searchParams;
  const g = GROUP_BY_ID[group];
  if (!g) notFound();

  const locale = await getLocale();
  const t = getMessages(locale);
  const td = t.dashboard;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [allTasks, reviewerName, existingCodes] = await Promise.all([
    engagementTasks(id),
    engagementReviewer(id),
    existingTaskCodes(id),
  ]);
  const missing = g.members.filter((code) => !existingCodes.has(code));
  const byCode = new Map(allTasks.map((task) => [task.code, task]));
  // E4 discloses only the accounts whose substantive procedures were DESIGNED
  // in S5.5 — an index nobody designed for has no performable work here. The
  // design gaps (key assertions, nothing selected) are surfaced separately.
  const designedIndexes = group === "e4" ? await dspDesignedIndexes(id) : null;
  const designGaps = group === "e4" ? await dspDesignGaps(id).catch(() => []) : [];
  const memberCodes = designedIndexes
    ? g.members.filter((code) => indexesForTask(code).some((idx) => designedIndexes.has(idx)))
    : g.members;
  const tasks = memberCodes.map((code) => byCode.get(code)).filter((task): task is PhaseTask => Boolean(task));
  const reviewedCount = tasks.filter((task) => task.status === "reviewed").length;

  // Section deadline as the default; per-task due dates win.
  const sectionPhase =
    g.section === "acceptance" || g.section === "strategy"
      ? ("planning" as const)
      : g.section === "execution"
        ? ("execution" as const)
        : ("conclusion" as const);
  const deadlineIso = phaseDeadline(engagement.periodEnd, sectionPhase);
  const deadlineDate = fmtDate(deadlineIso, locale);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const sg = td.signoff;
  const reviewerIni = reviewerName ? initials(reviewerName) : "";
  const returnTo = `/engagements/${id}/groups/${group}`;

  const rows: PhaseRowData[] = tasks.map((task) => {
    // Every task opens its working-paper screen; the legacy /forms and hub
    // routes remain reachable for direct links but are no longer the way in.
    const href = `/engagements/${id}/sections/${task.id}`;

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
      code: displayCode(task.code),
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

  const th =
    "border-b border-line bg-surface-2 px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";

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
            <span className="text-base font-extrabold text-emerald-700/55 tnum dark:text-emerald-400/55">{g.code}</span>
            {groupTitle(g, locale)}
          </h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {sectionLabel(g.section, locale)}
            <span className="px-2 text-line-strong">·</span>
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

      <ErrorBanner error={error} locale={locale} />

      {designGaps.length > 0 ? (
        <div
          className="rounded-[var(--radius-atlas-sm)] border border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
          data-testid="e4-design-gaps"
        >
          {locale === "fr"
            ? `⚠ ${designGaps.length} compte(s) significatif(s) avec assertions clés SANS procédures substantives conçues : ${designGaps.join(", ")} — à concevoir en S5.5 avant exécution.`
            : `⚠ ${designGaps.length} significant account(s) with key assertions and NO designed substantive procedures: ${designGaps.join(", ")} — design them in S5.5 before performing.`}
        </div>
      ) : null}

      <Panel flush className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <PanelHeader title={td.taskList} right={<span className="text-xs font-semibold text-muted tnum">{tasks.length}</span>} />
          {missing.length > 0 && canReview(session.user.role) ? (
            <form action={instantiateGroupTasksAction}>
              <input type="hidden" name="engagementId" value={id} />
              <input type="hidden" name="group" value={group} />
              <SubmitButton
                className="rounded-full border border-line-strong px-3.5 py-1.5 text-[12px] font-semibold text-ink-soft hover:bg-surface-2"
                testId="add-group-tasks"
              >
                {td.stage.addMissing.replace("{n}", String(missing.length))}
              </SubmitButton>
            </form>
          ) : null}
        </div>
        <div className="overflow-x-auto" data-testid="group-task-list">
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
                {rows.map((row, i) => (
                  <PhaseTaskRow
                    key={row.id}
                    row={row}
                    engagementId={id}
                    phaseSlug={PHASE_SLUG_OF[phaseOfTask(tasks[i].section, tasks[i].code)]}
                    returnTo={returnTo}
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
