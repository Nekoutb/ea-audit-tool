import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Chip, Panel, PanelHeader } from "@/components/ui/atlas";
import { engagementTasks, type PhaseTask, type PhaseTaskStatus } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { shortTitle } from "@/lib/file-index";
import { getLocale } from "@/lib/locale";
import {
  SECTION_GATE,
  SECTION_ORDER,
  displayCode,
  groupsOfSection,
  groupTitle,
  sectionLabel,
  type SectionKey,
} from "@/lib/task-groups";
import { PHASE_INTRO, paperFor } from "@/lib/working-papers";

export const metadata = { title: "Phase · AuditISA" };

const STATUS_LABEL: Record<"en" | "fr", Record<PhaseTaskStatus, string>> = {
  en: { reviewed: "Reviewed", in_review: "For review", in_progress: "In progress", not_started: "Not started" },
  fr: { reviewed: "Revu", in_review: "À revoir", in_progress: "En cours", not_started: "Non démarré" },
};

const DOT: Record<PhaseTaskStatus, string> = {
  reviewed: "bg-emerald-600",
  in_review: "bg-[var(--color-warn)]",
  in_progress: "bg-[#34467f] dark:bg-[#93a4dd]",
  not_started: "border-[1.5px] border-line-strong bg-transparent",
};

/** Which phases feed this one, and which it feeds — derived from the order. */
function linkedPhases(key: SectionKey): { before: SectionKey[]; after: SectionKey[] } {
  const i = SECTION_ORDER.indexOf(key);
  return { before: SECTION_ORDER.slice(0, i), after: SECTION_ORDER.slice(i + 1) };
}

export default async function PhasePage(props: {
  params: Promise<{ id: string; section: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id, section } = await props.params;
  const key = section as SectionKey;
  if (!SECTION_ORDER.includes(key)) notFound();

  const locale = await getLocale();
  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [tasks, conditionalTasks] = await Promise.all([
    engagementTasks(id),
    engagementTasks(id, true),
  ]);
  const byCode = new Map(tasks.map((x) => [x.code, x]));
  const groups = groupsOfSection(key);
  const ordered: { task: PhaseTask; group: string }[] = [];
  for (const g of groups) {
    for (const code of g.members) {
      const task = byCode.get(code);
      if (task) ordered.push({ task, group: g.code });
    }
  }
  // Conditional papers of this phase — reachable, but outside the count, because
  // they apply only when the engagement's facts call for them.
  const memberCodes = new Set(groups.flatMap((g) => g.members));
  const optional = conditionalTasks.filter((t) => memberCodes.has(t.code));
  const done = ordered.filter((x) => x.task.status === "reviewed").length;
  const links = linkedPhases(key);
  const intro = PHASE_INTRO[key][locale === "fr" ? "fr" : "en"];

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} current={{ id, label: engagement.clientName }} />
      {/* phases are navigated from the dashboard cards — no phase bar here */}
      <div className="mt-4">
        <Link
          href={`/engagements/${id}/dashboard`}
          data-testid="back-to-dashboard"
          className="inline-flex min-h-[28px] items-center gap-1.5 rounded-full bg-surface-2 px-3.5 py-1 text-[12.5px] font-semibold text-ink-soft transition hover:bg-line/60"
        >
          ← {locale === "fr" ? "Tableau de bord" : "Dashboard"}
        </Link>
      </div>

      <header className="mt-8">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {sectionLabel(key, locale)}
        </h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>
            {done} / {ordered.length} {locale === "fr" ? "revus" : "reviewed"}
          </span>
          <span aria-hidden>·</span>
          <span>
            {locale === "fr" ? "Barrière" : "Gate"} {SECTION_GATE[key]}
          </span>
          <span aria-hidden>·</span>
          <span>{intro}</span>
        </p>
      </header>

      {/* linked phases — inline, not on a sidebar */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Panel className="h-full">
          <PanelHeader title={locale === "fr" ? "Alimenté par" : "Fed by"} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {links.before.length === 0 ? (
              <span className="text-sm text-muted">{locale === "fr" ? "Aucune phase antérieure" : "No earlier phase"}</span>
            ) : (
              links.before.map((p) => (
                <Link key={p} href={`/engagements/${id}/phase/${p}`} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-ink-soft transition hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40">
                  {sectionLabel(p, locale)}
                </Link>
              ))
            )}
          </div>
        </Panel>
        <Panel className="h-full">
          <PanelHeader title={locale === "fr" ? "Alimente" : "Feeds"} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {links.after.length === 0 ? (
              <span className="text-sm text-muted">{locale === "fr" ? "Fin de la chaîne" : "End of the chain"}</span>
            ) : (
              links.after.map((p) => (
                <Link key={p} href={`/engagements/${id}/phase/${p}`} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-ink-soft transition hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40">
                  {sectionLabel(p, locale)}
                </Link>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* the tasks, in the order they are performed */}
      <Panel className="mt-4">
        <PanelHeader
          title={locale === "fr" ? "Tâches, dans l’ordre d’exécution" : "Tasks, in the order they are performed"}
          hint={String(ordered.length)}
        />
        {ordered.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            {locale === "fr" ? "Aucune tâche dans cette phase." : "No task in this phase."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line" data-testid="phase-tasks">
            {ordered.map(({ task, group }, i) => {
              const paper = paperFor(task.code);
              return (
                <li key={task.id}>
                  <Link
                    href={`/engagements/${id}/sections/${task.id}`}
                    data-testid={`phase-task-${task.code}`}
                    className="flex items-center gap-3 py-2.5 transition hover:bg-surface-2"
                  >
                    <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-surface-2 font-mono text-[11px] font-semibold text-muted tnum">
                      {i + 1}
                    </span>
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${DOT[task.status]}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">
                        {shortTitle(task.code, locale, locale === "fr" ? task.titleFr : task.titleEn)}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted">
                        {displayCode(task.code)} · {group} · {paper.std}
                      </span>
                    </span>
                    {task.assigneeName ? (
                      <span className="hidden flex-shrink-0 text-xs text-muted sm:block">{task.assigneeName}</span>
                    ) : null}
                    <Chip tone={task.status === "reviewed" ? "good" : task.status === "in_review" ? "warn" : "muted"}>
                      {STATUS_LABEL[locale === "fr" ? "fr" : "en"][task.status]}
                    </Chip>
                    <span className="flex-shrink-0 text-muted" aria-hidden>›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {optional.length > 0 ? (
        <Panel className="mt-4">
          <PanelHeader
            title={locale === "fr" ? "S’applique selon le cas" : "Applies in some engagements"}
            hint={String(optional.length)}
          />
          <p className="mt-2 text-sm text-muted">
            {locale === "fr"
              ? "Ces feuilles ne sont pas comptées dans la phase. Ouvrez-les lorsque les faits de la mission l’exigent."
              : "These papers are not counted in the phase. Open one when the facts of the engagement call for it."}
          </p>
          <ul className="mt-3 divide-y divide-line" data-testid="phase-optional">
            {optional.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/engagements/${id}/sections/${task.id}`}
                  data-testid={`phase-optional-${task.code}`}
                  className="flex items-center gap-3 py-2.5 transition hover:bg-surface-2"
                >
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${DOT[task.status]}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">
                      {shortTitle(task.code, locale, locale === "fr" ? task.titleFr : task.titleEn)}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-muted">
                      {displayCode(task.code)} · {paperFor(task.code).std}
                    </span>
                  </span>
                  <Chip tone="muted">{locale === "fr" ? "Conditionnel" : "Conditional"}</Chip>
                  <span className="flex-shrink-0 text-muted" aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* groups in this phase, for orientation */}
      <Panel className="mt-4">
        <PanelHeader title={locale === "fr" ? "Groupes" : "Groups"} />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const members = g.members.map((c) => byCode.get(c)).filter((x): x is PhaseTask => Boolean(x));
            const gd = members.filter((m) => m.status === "reviewed").length;
            return (
              <Link
                key={g.id}
                href={`/engagements/${id}/groups/${g.id}`}
                className="flex items-center gap-3 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2.5 transition hover:border-emerald-600"
              >
                <span className="font-mono text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">{g.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{groupTitle(g, locale)}</span>
                <span className="font-mono text-[11px] text-muted tnum">
                  {gd}/{members.length}
                </span>
              </Link>
            );
          })}
        </div>
      </Panel>
    </main>
  );
}
