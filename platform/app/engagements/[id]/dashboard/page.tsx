import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { SectionStage, type StageSection } from "@/components/SectionStage";
import { TilesToggle } from "@/components/TilesToggle";
import { Panel, PanelHeader } from "@/components/ui/atlas";
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
import { respondEngagementAction } from "@/app/actions/team-independence";
import { SubmitButton } from "@/components/SubmitButton";
import { getEngagement } from "@/lib/engagements";
import { myTeamStatus } from "@/lib/team";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { shortTitle } from "@/lib/file-index";
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
  acceptance: "acceptance",
  strategy: "planning",
  execution: "execution",
  conclusion: "conclusion",
};

const STATUS_LABEL: Record<"en" | "fr", Record<PhaseTask["status"], string>> = {
  en: { reviewed: "Reviewed", in_review: "For review", in_progress: "In progress", not_started: "Not started" },
  fr: { reviewed: "Revu", in_review: "À revoir", in_progress: "En cours", not_started: "Non démarré" },
};

function buildSections(
  tasks: PhaseTask[],
  engagementId: string,
  locale: "en" | "fr",
): (StageSection & { done: number; total: number })[] {
  const byCode = new Map(tasks.map((t) => [t.code, t]));
  return SECTION_ORDER.map((key) => {
    const groups = groupsOfSection(key).map((g) => {
      const members = g.members.map((code) => byCode.get(code)).filter((t): t is PhaseTask => Boolean(t));
      const done = members.filter((t) => t.status === "reviewed").length;
      return {
        id: g.id,
        title: groupTitle(g, locale),
        pct: members.length > 0 ? Math.round((done / members.length) * 100) : 0,
        href: `/engagements/${engagementId}/groups/${g.id}`,
        done,
        total: members.length,
      };
    });
    const done = groups.reduce((sum, g) => sum + g.done, 0);
    const total = groups.reduce((sum, g) => sum + g.total, 0);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      key,
      label: sectionLabel(key, locale),
      pct,
      color: pct >= 70 ? "var(--color-emerald-600)" : pct > 0 ? "var(--color-warn)" : "var(--color-muted)",
      groups,
      done,
      total,
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
  const fr = locale === "fr";

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const myStatus = await myTeamStatus(id);
  const [tasks, attention, dash, stats] = await Promise.all([
    engagementTasks(id),
    engagementAttention(id, locale),
    engagementDashboard(id),
    dashboardStats(id),
  ]);

  // An engagement with no file items has not been classified yet — the
  // nature-of-entity screen must conclude before any task exists.
  if (tasks.length === 0) redirect(`/engagements/${id}/nature`);

  const sections = buildSections(tasks, id, locale);
  const doneTasks = sections.reduce((sum, s) => sum + s.done, 0);
  const totalTasks = sections.reduce((sum, s) => sum + s.total, 0);
  const overall = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  // One stage vocabulary everywhere (register, hub, entity history).
  const phaseLabel = t.engagements.stages[engagement.phase];

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} hideLinks />

      {myStatus === "invited" ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-atlas)] border border-emerald-600/40 bg-emerald-50 px-5 py-3.5 dark:bg-emerald-950/30"
          data-testid="engagement-invite-banner"
        >
          <p className="text-sm font-medium text-ink">
            {fr
              ? "Vous avez été ajouté à cette mission. L’acceptez-vous ?"
              : "You have been added to this engagement. Do you accept it?"}
          </p>
          <span className="flex gap-2">
            <form action={respondEngagementAction.bind(null, id, true)}>
              <SubmitButton
                className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
                testId="accept-engagement"
              >
                {fr ? "Accepter" : "Accept"}
              </SubmitButton>
            </form>
            <form action={respondEngagementAction.bind(null, id, false)}>
              <SubmitButton
                className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-surface-2"
                testId="decline-engagement"
              >
                {fr ? "Refuser" : "Decline"}
              </SubmitButton>
            </form>
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-ink">
            {engagement.name ?? engagement.clientName}
          </h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {phaseLabel}
            <span className="px-2 text-line-strong">·</span>
            {t.engagements.fiscalYear} {engagement.fiscalYear}
            <span className="px-2 text-line-strong">·</span>
            {t.engagements.periodEnd}: {engagement.periodEnd}
            <span className="px-2 text-line-strong">·</span>
            <Link
              href={`/clients/${engagement.clientId}`}
              data-testid="entity-link"
              className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              {td.aboutEntity.replace("{name}", engagement.clientName)} →
            </Link>
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
        </div>
      </div>

      {/* The four phases, filling the row — click one to slide its six
          grouped tasks open beside it. */}
      <SectionStage sections={sections} />

      {/* The sketch's summary row: my tasks · review notes · findings · tools */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={`/engagements/${id}/tasks`} className="block">
          <Panel className="h-full px-5 py-4 transition hover:border-emerald-600/40">
            <PanelHeader title={fr ? "Mes tâches" : "My tasks"} />
            <div className="mt-2 text-[30px] font-extrabold leading-tight tracking-[-0.03em] text-ink tnum">
              {stats.my.myTasks}
            </div>
            <div className="text-[11.5px] text-muted">{fr ? "qui me sont affectées" : "assigned to me"}</div>
          </Panel>
        </Link>
        <Panel className="px-5 py-4" data-testid="review-notes-box">
          <PanelHeader title={fr ? "Notes de revue" : "Review notes"} />
          <div className="mt-2 flex flex-col">
            <span className="flex items-center justify-between border-b border-line py-1.5 text-[12.5px] text-ink-soft">
              {fr ? "Pour moi" : "For me"} <b className="tnum">{stats.my.notesForMe}</b>
            </span>
            <span className="flex items-center justify-between py-1.5 text-[12.5px] text-ink-soft">
              {fr ? "Par moi" : "By me"} <b className="tnum">{stats.my.notesByMe}</b>
            </span>
          </div>
        </Panel>
        <Panel className="px-5 py-4" data-testid="findings-band">
          <PanelHeader title={td.findingsBand.title} />
          <div className="mt-2 flex flex-col">
            <Link href={`/engagements/${id}/findings`} className="flex items-center justify-between border-b border-line py-1.5 text-[12.5px] text-ink-soft hover:text-emerald-700">
              {td.findingsBand.deficiencies} <b className="tnum">{dash.deficiencyCount}</b>
            </Link>
            <Link href={`/engagements/${id}/findings`} className="flex items-center justify-between py-1.5 text-[12.5px] text-ink-soft hover:text-emerald-700">
              {td.findingsBand.misstatements} <b className="tnum">{dash.misstatementCount}</b>
            </Link>
          </div>
        </Panel>
        <Panel className="px-5 py-4">
          <PanelHeader title={fr ? "Outils" : "Tools"} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { href: `/engagements/${id}/tools`, label: fr ? "Campagne d’indépendance" : "Independence campaign" },
              { href: `/engagements/${id}/tools`, label: fr ? "Échantillonnage" : "Sampling" },
              { href: `/engagements/${id}/confirmations`, label: fr ? "Circularisation" : "Circularisation" },
              { href: `/engagements/${id}/data`, label: fr ? "Balance" : "Trial balance" },
              { href: `/engagements/${id}`, label: fr ? "Dossier" : "Audit file" },
              { href: `/engagements/${id}/team`, label: fr ? "Équipe" : "Team" },
            ].map((r, i) => (
              <Link
                key={i}
                href={r.href}
                className="inline-flex min-h-[26px] items-center rounded-full border border-line bg-surface-2 px-3 py-0.5 text-[11.5px] font-semibold text-ink-soft transition hover:border-emerald-600 hover:text-emerald-700"
              >
                {r.label}
              </Link>
            ))}
          </div>
        </Panel>
      </section>
    </main>
  );
}
