import Link from "next/link";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import type { ActivityRow } from "@/lib/activity";
import { shortTitle } from "@/lib/file-index";
import { displayCode } from "@/lib/task-groups";
import type { PhaseTask, PhaseTaskStatus } from "@/lib/engagement-dashboard";

// The dashboard's summary block: five boxes in three columns, filling the
// rest of the screen so the page itself never scrolls. My tasks stands alone
// on the left; review notes sit above the engagement timetable; findings sit
// above the engagement feed. The task lists show no scrollbar — they fit the
// box on a normal screen and still reach every row on a small one — while the
// feed, which is long by nature, keeps its scroller.

export interface DashboardListsProps {
  engagementId: string;
  locale: "en" | "fr";
  today: string;
  /** every task of the file, as the dashboard already loads them */
  tasks: PhaseTask[];
  /** effective deadline of a task: its own due date, else the phase's */
  deadlineOf: (task: PhaseTask) => string;
  userId: string;
  notes: { forMe: number; byMe: number };
  findings: { deficiencies: number; misstatements: number };
  feed: ActivityRow[];
}

const PANEL = "flex min-h-0 flex-col px-5 py-4";
const LIST = "mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 scrollbar-none";
const FEED = "mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1";
const ROW = "flex items-start justify-between gap-3 border-b border-line py-1.5 text-[12.5px] last:border-b-0";
const SUB = "text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-muted";

const STATUS: Record<PhaseTaskStatus, { en: string; fr: string; cls: string }> = {
  not_started: { en: "Not started", fr: "Non commencée", cls: "bg-surface-2 text-muted" },
  in_progress: { en: "In progress", fr: "En cours", cls: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300" },
  in_review: { en: "In review", fr: "En revue", cls: "bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-300" },
  reviewed: { en: "Reviewed", fr: "Revue", cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" },
};

function fmtDate(iso: string, fr: boolean): string {
  const d = new Date(iso + "T00:00:00Z");
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString(fr ? "fr-FR" : "en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86_400_000);
}

export function DashboardLists({ engagementId, locale, today, tasks, deadlineOf, userId, notes, findings, feed }: DashboardListsProps) {
  const fr = locale === "fr";
  const T = (en: string, frText: string) => (fr ? frText : en);
  const base = `/engagements/${engagementId}`;
  const title = (t: PhaseTask) => shortTitle(t.code, locale, fr ? t.titleFr : t.titleEn);

  // Mine: assigned to me, prepared by me or awaiting my approval, and not yet
  // through review — the same definition as the tasks page's ?filter=mine,
  // minus what is done. The approver used to be left out (UAT B94).
  const mine = tasks
    .filter((t) => (t.assigneeUserId === userId || t.ownerUserId === userId || t.approverUserId === userId) && t.status !== "reviewed")
    .map((t) => ({ t, due: deadlineOf(t) }))
    .sort((a, b) => a.due.localeCompare(b.due) || a.t.code.localeCompare(b.t.code));

  const open = tasks.filter((t) => t.status !== "reviewed").map((t) => ({ t, due: deadlineOf(t) }));
  const overdue = open.filter((x) => x.due < today).sort((a, b) => a.due.localeCompare(b.due));
  const soon = open
    .filter((x) => x.due >= today && daysBetween(today, x.due) <= 30)
    .sort((a, b) => a.due.localeCompare(b.due));
  const responsible = (t: PhaseTask) => t.assigneeName ?? t.ownerName ?? "—";

  const TaskRow = ({ t, due, late }: { t: PhaseTask; due: string; late?: boolean }) => (
    <Link href={`${base}/sections/${t.id}`} className={`${ROW} transition hover:text-emerald-700`} data-testid={`dash-task-${t.code}`}>
      <span className="min-w-0 flex-1">
        <span className="font-mono text-[11px] text-muted">{displayCode(t.code)}</span>{" "}
        <span className="text-ink">{title(t)}</span>
        <span className="mt-0.5 block text-[11px] text-muted">
          <span className={late ? "font-semibold text-rose" : ""}>
            {late ? T(`Overdue · ${daysBetween(due, today)} d`, `En retard · ${daysBetween(due, today)} j`) : T("Due", "Échéance")} {fmtDate(due, fr)}
          </span>
          {" · "}
          {responsible(t)}
        </span>
      </span>
      <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold ${STATUS[t.status].cls}`}>
        {fr ? STATUS[t.status].fr : STATUS[t.status].en}
      </span>
    </Link>
  );

  return (
    <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3 sm:grid-rows-[auto_minmax(0,1fr)]" data-testid="dashboard-lists">
      {/* 1. My tasks */}
      <Panel className={`${PANEL} sm:row-span-2`} data-testid="my-tasks-box">
        <PanelHeader
          title={T("My tasks", "Mes tâches")}
          hint={T("open, assigned to me", "ouvertes, qui me sont affectées")}
          right={
            <Link href={`${base}/tasks?filter=mine`} className="text-[20px] font-extrabold leading-none tracking-[-0.03em] text-ink tnum hover:text-emerald-700" data-testid="my-tasks-count">
              {mine.length}
            </Link>
          }
        />
        <div className={LIST} data-testid="my-tasks-list">
          {mine.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-muted" data-testid="my-tasks-empty">
              {T("Nothing open is assigned to you on this file.", "Rien d'ouvert ne vous est affecté sur ce dossier.")}
            </p>
          ) : (
            mine.map(({ t, due }) => <TaskRow key={t.id} t={t} due={due} late={due < today} />)
          )}
        </div>
      </Panel>

      {/* 2. Review notes */}
      <Panel className="px-5 py-4" data-testid="review-notes-box">
        <PanelHeader title={T("Review notes", "Notes de revue")} />
        <div className="mt-2 flex flex-col">
          <Link href={`${base}/tools/review-notes?scope=for_me`} className={`${ROW} transition hover:text-emerald-700`} data-testid="notes-for-me">
            {T("For me", "Pour moi")} <b className="tnum">{notes.forMe}</b>
          </Link>
          <Link href={`${base}/tools/review-notes?scope=by_me`} className={`${ROW} transition hover:text-emerald-700`} data-testid="notes-by-me">
            {T("By me", "Par moi")} <b className="tnum">{notes.byMe}</b>
          </Link>
        </div>
      </Panel>

      {/* 3. Findings */}
      <Panel className="px-5 py-4" data-testid="findings-band">
        <PanelHeader title={T("Findings", "Constats")} />
        <div className="mt-2 flex flex-col">
          <Link href={`${base}/findings`} className={`${ROW} hover:text-emerald-700`}>
            {T("Deficiencies", "Déficiences")} <b className="tnum">{findings.deficiencies}</b>
          </Link>
          <Link href={`${base}/findings`} className={`${ROW} hover:text-emerald-700`}>
            {T("Misstatements", "Anomalies")} <b className="tnum">{findings.misstatements}</b>
          </Link>
        </div>
      </Panel>

      {/* 4. Engagement timetable */}
      <Panel className={PANEL} data-testid="timetable-box">
        <PanelHeader
          title={T("Engagement timetable", "Calendrier de la mission")}
          right={overdue.length > 0 ? <span className="rounded-full bg-rose/10 px-2 py-px text-[11px] font-bold text-rose tnum" data-testid="timetable-overdue-count">{overdue.length} {T("overdue", "en retard")}</span> : null}
        />
        <div className={LIST} data-testid="timetable-list">
          {overdue.length === 0 && soon.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-muted" data-testid="timetable-empty">
              {T("Nothing overdue and nothing due in the next 30 days.", "Rien en retard ni à échéance dans les 30 prochains jours.")}
            </p>
          ) : null}
          {overdue.map(({ t, due }) => <TaskRow key={t.id} t={t} due={due} late />)}
          {soon.length > 0 ? (
            <p className={`pt-2 ${SUB}`}>{T("Next 30 days", "30 prochains jours")}</p>
          ) : null}
          {soon.map(({ t, due }) => <TaskRow key={t.id} t={t} due={due} />)}
        </div>
      </Panel>

      {/* 5. Engagement feed — the one list that keeps its scroller */}
      <Panel className={PANEL} data-testid="feed-box">
        <PanelHeader title={T("Engagement feed", "Fil de la mission")} hint={T("latest actions of the team", "dernières actions de l'équipe")} />
        <div className={FEED} data-testid="engagement-feed">
          {feed.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-muted" data-testid="feed-empty">
              {T("No action recorded on this file yet.", "Aucune action enregistrée sur ce dossier pour l'instant.")}
            </p>
          ) : (
            feed.map((row) => {
              const text = row.summary ?? row.action.replace(/_/g, " ");
              const href = row.entityType === "file_item" && row.entityId ? `${base}/sections/${row.entityId}` : null;
              const body = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-ink">{row.userName ?? T("System", "Système")}</span>{" "}
                    <span className="text-ink-soft">{text}</span>
                    {row.outcome !== "success" ? <span className="ml-1 text-[10px] font-bold uppercase text-rose">{row.outcome}</span> : null}
                  </span>
                  <span className="shrink-0 text-[10.5px] text-muted tnum">{row.at}</span>
                </>
              );
              return href ? (
                <Link key={row.id} href={href} className={`${ROW} transition hover:text-emerald-700`} data-testid="feed-row">{body}</Link>
              ) : (
                <div key={row.id} className={ROW} data-testid="feed-row">{body}</div>
              );
            })
          )}
        </div>
      </Panel>
    </section>
  );
}
