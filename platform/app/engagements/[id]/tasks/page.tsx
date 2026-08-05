import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { NavLink } from "@/components/NavLink";
import { Panel } from "@/components/ui/atlas";
import { withTenant } from "@/lib/db";
import { engagementTasks, type PhaseTask, type PhaseTaskStatus } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { shortTitle } from "@/lib/file-index";
import { FORM_DEFINITIONS } from "@/lib/forms";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { displayCode } from "@/lib/task-groups";
import { requireTenant } from "@/lib/tenant";

export const metadata = { title: "My Tasks · AuditISA" };

// Page-local labels (the framework doc's "My Tasks" queue is not in messages/*.json yet).
const LABELS = {
  en: {
    title: "My Tasks",
    all: "All",
    review: "For my review",
    todo: "To-dos",
    hideCompleted: "Hide completed",
    due: "Due",
  },
  fr: {
    title: "Mes tâches",
    all: "Toutes",
    review: "Pour ma revue",
    todo: "À faire",
    hideCompleted: "Masquer les terminées",
    due: "Échéance",
  },
} as const;

const MONTHS: Record<"en" | "fr", string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  fr: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
};
function fmtDate(iso: string, locale: "en" | "fr"): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[locale][m - 1]} ${y}`;
}

/** Status dot per work-queue row (reviewed → filled emerald, not started → grey ring). */
const DOT_CLASS: Record<PhaseTaskStatus, string> = {
  reviewed: "bg-emerald-500",
  in_review: "bg-amber-500",
  in_progress: "bg-[#34467f]",
  not_started: "border-[1.5px] border-line-strong bg-transparent",
};

type Filter = "all" | "review" | "todo" | "open";

function applyFilter(tasks: PhaseTask[], filter: Filter): PhaseTask[] {
  if (filter === "review") return tasks.filter((t) => t.status === "in_review");
  if (filter === "todo") return tasks.filter((t) => t.status === "not_started");
  if (filter === "open") return tasks.filter((t) => t.status !== "reviewed");
  return tasks;
}

/** Same destination branching as the group task rows. */
function taskHref(engagementId: string, task: PhaseTask): string {
  return task.documentId
    ? `/documents/${task.documentId}`
    : FORM_DEFINITIONS[task.code]
      ? `/engagements/${engagementId}/forms/${task.code}`
      : task.code === "D5.1"
        ? `/engagements/${engagementId}/planning`
        : task.code === "D7.2"
          ? `/engagements/${engagementId}/risks`
          : task.section === "F"
            ? `/engagements/${engagementId}/legal`
            : `/engagements/${engagementId}/sections/${task.id}`;
}

/** Open review-note counts per file item, in one query (fi.id → n). */
async function openNoteCounts(engagementId: string): Promise<Map<string, number>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string; n: string }>(
      `SELECT fi.id, count(*)::text AS n
         FROM review_note rn
         JOIN document d ON d.id = rn.document_id
         JOIN file_item fi ON fi.id = d.file_item_id
        WHERE fi.engagement_id = $1 AND rn.status = 'open'
        GROUP BY fi.id`,
      [engagementId],
    );
    return new Map(result.rows.map((row) => [row.id, Number(row.n)]));
  });
}

/**
 * "My Tasks" — the engagement-wide work queue (EY-Canvas-style task list):
 * every task in one dense list with count chips, review-note badges and a
 * status dot, each row linking straight to where the work happens.
 */
export default async function MyTasksPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { filter: rawFilter } = await props.searchParams;

  const locale = await getLocale();
  const t = getMessages(locale);
  const L = LABELS[locale];

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [tasks, noteCounts] = await Promise.all([engagementTasks(id), openNoteCounts(id)]);

  const filter: Filter =
    rawFilter === "review" || rawFilter === "todo" || rawFilter === "open" ? rawFilter : "all";
  const visible = applyFilter(tasks, filter);

  const base = `/engagements/${id}/tasks`;
  const chips: { key: Filter; label: string; count: number; href: string }[] = [
    { key: "all", label: L.all, count: tasks.length, href: base },
    {
      key: "review",
      label: L.review,
      count: tasks.filter((task) => task.status === "in_review").length,
      href: `${base}?filter=review`,
    },
    {
      key: "todo",
      label: L.todo,
      count: tasks.filter((task) => task.status === "not_started").length,
      href: `${base}?filter=todo`,
    },
    {
      key: "open",
      label: L.hideCompleted,
      count: tasks.filter((task) => task.status !== "reviewed").length,
      // Toggle: clicking again while active returns to the unfiltered list.
      href: filter === "open" ? base : `${base}?filter=open`,
    },
  ];

  const chipBase =
    "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition";
  const chipActive = `${chipBase} border-emerald-600/40 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300`;
  const chipIdle = `${chipBase} border-line-strong text-ink-soft hover:bg-surface-2`;

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-4">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />

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
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">{L.title}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          {engagement.clientName}
          <span className="px-2 text-line-strong">·</span>
          {t.engagements.fiscalYear} {engagement.fiscalYear}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" data-testid="task-chips">
        {chips.map((chip) => (
          <NavLink
            key={chip.key}
            href={chip.href}
            className={filter === chip.key ? chipActive : chipIdle}
          >
            {chip.label}
            <span className="tnum opacity-70">{chip.count}</span>
          </NavLink>
        ))}
      </div>

      <Panel flush className="flex flex-col">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">{t.dashboard.emptyTasks}</p>
        ) : (
          <div className="flex flex-col">
            {visible.map((task) => {
              const notes = noteCounts.get(task.id);
              return (
                <NavLink
                  key={task.id}
                  href={taskHref(id, task)}
                  testId={`mytask-${task.code}`}
                  className="flex items-center gap-3 border-t border-line px-5 py-2.5 first:border-t-0 hover:bg-surface-2"
                >
                  <span
                    title={task.code}
                    className="min-w-[52px] rounded-[var(--radius-atlas-xs)] border border-line bg-surface-2 px-1.5 py-0.5 text-center font-mono text-[11px] font-extrabold text-ink-soft"
                  >
                    {displayCode(task.code)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
                    {shortTitle(task.code, locale, locale === "fr" ? task.titleFr : task.titleEn)}
                  </span>
                  {notes ? (
                    <span
                      data-testid={`note-badge-${task.code}`}
                      className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 tnum dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      {notes} ✎
                    </span>
                  ) : null}
                  <span className="w-[120px] flex-shrink-0 text-right text-[12px] text-muted tnum">
                    {task.dueDate ? `${L.due} ${fmtDate(task.dueDate, locale)}` : "—"}
                  </span>
                  <span
                    title={t.dashboard.rowStatus[task.status]}
                    className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${DOT_CLASS[task.status]}`}
                  />
                </NavLink>
              );
            })}
          </div>
        )}
      </Panel>
    </main>
  );
}
