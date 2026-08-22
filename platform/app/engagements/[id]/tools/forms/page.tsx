import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { assignFormsTasksAction } from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { SubmitButton } from "@/components/SubmitButton";
import { Panel } from "@/components/ui/atlas";
import { DEFAULT_FILE_INDEX, shortTitle } from "@/lib/file-index";
import { getEngagement } from "@/lib/engagements";
import { engagementTasks } from "@/lib/engagement-dashboard";
import { getLocale } from "@/lib/locale";
import { canReview, type Role } from "@/lib/rbac";
import { listTeam } from "@/lib/team";
import { SECTION_ORDER, groupOfTask, sectionLabel, type SectionKey } from "@/lib/task-groups";

export const metadata = { title: "Forms · AuditISA" };

/**
 * The Forms section: every standard form in the file, grouped by phase, each
 * opening its task. One place to reach a form without walking the phases —
 * and, for reviewers and admins, one place to hand out the work: a whole
 * phase to one person, or any single form to its preparer.
 */
export default async function FormsPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ assigned?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { assigned, error } = await props.searchParams;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const tasks = await engagementTasks(id);
  const byCode = new Map(tasks.map((x) => [x.code, x]));

  const canAssign = canReview(session.user.role as Role);
  const team = canAssign ? await listTeam(id) : [];

  const byPhase = new Map<
    SectionKey,
    { code: string; title: string; href: string | null; itemId: string | null; assigneeUserId: string | null; assigneeName: string | null }[]
  >();
  for (const entry of DEFAULT_FILE_INDEX) {
    const group = groupOfTask(entry.code);
    if (!group) continue;
    const task = byCode.get(entry.code);
    const list = byPhase.get(group.section) ?? [];
    list.push({
      code: entry.code,
      title: shortTitle(entry.code, fr ? "fr" : "en", fr ? entry.titleFr : entry.titleEn),
      href: task ? `/engagements/${id}/sections/${task.id}` : null,
      itemId: task?.id ?? null,
      assigneeUserId: task?.assigneeUserId ?? null,
      assigneeName: task?.assigneeName ?? null,
    });
    byPhase.set(group.section, list);
  }

  const select =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-1.5 py-0.5 text-[11.5px] text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const ok =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong px-1.5 py-0.5 text-[11px] text-ink-soft hover:bg-surface-2";

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour aux outils" : "Back to tools"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="forms-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Formulaires" : "Forms"}
        </h1>
      </div>

      {error ? (
        <p className="mt-3 rounded-[var(--radius-atlas-sm)] border border-red-300 bg-red-50 px-3 py-2 text-[12.5px] text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" data-testid="forms-error">
          {error === "not-found"
            ? fr ? "Cette personne ne fait pas partie de l'équipe de la mission." : "That person is not on the engagement team."
            : error}
        </p>
      ) : null}
      {assigned ? (
        <p className="mt-3 rounded-[var(--radius-atlas-sm)] border border-emerald-300 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" data-testid="forms-assigned">
          {fr ? `${assigned} tâche(s) réassignée(s).` : `${assigned} task(s) reassigned.`}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="forms-list">
        {SECTION_ORDER.map((phase) => {
          const forms = byPhase.get(phase) ?? [];
          if (forms.length === 0) return null;
          const phaseItemIds = forms.map((f) => f.itemId).filter((x): x is string => x !== null);
          return (
            <Panel key={phase} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                  {sectionLabel(phase, locale)}
                </h2>
                {canAssign && team.length > 0 && phaseItemIds.length > 0 ? (
                  <form
                    action={assignFormsTasksAction.bind(null, id, phaseItemIds)}
                    className="flex items-center gap-1"
                    data-testid={`assign-phase-${phase}`}
                  >
                    <label className="text-[11px] text-muted" htmlFor={`assign-phase-select-${phase}`}>
                      {fr ? "Assigner la phase à" : "Assign phase to"}
                    </label>
                    <select id={`assign-phase-select-${phase}`} name="assignee" defaultValue="" className={select} data-testid={`assign-phase-select-${phase}`}>
                      <option value="">—</option>
                      {team.map((member) => (
                        <option key={member.userId} value={member.userId}>{member.userName}</option>
                      ))}
                    </select>
                    <SubmitButton className={ok} testId={`assign-phase-save-${phase}`}>OK</SubmitButton>
                  </form>
                ) : null}
              </div>
              <ul className="mt-1.5 flex flex-col" data-testid={`forms-${phase}`}>
                {forms.map((form) => (
                  <li key={form.code} className="flex items-center gap-1">
                    {form.href ? (
                      <Link
                        href={form.href}
                        className="flex min-w-0 flex-1 items-baseline gap-2 rounded-[var(--radius-atlas-xs)] px-1.5 py-1 text-[12.3px] text-ink-soft transition hover:bg-surface-2 hover:text-emerald-700"
                        data-testid={`form-${form.code}`}
                      >
                        <span className="w-11 flex-shrink-0 font-mono text-[10.5px] font-semibold text-muted">{form.code}</span>
                        <span className="min-w-0 flex-1 truncate">{form.title}</span>
                      </Link>
                    ) : (
                      <span className="flex min-w-0 flex-1 items-baseline gap-2 px-1.5 py-1 text-[12.3px] text-muted" title={fr ? "Hors périmètre de cette mission" : "Not in this engagement's scope"}>
                        <span className="w-11 flex-shrink-0 font-mono text-[10.5px]">{form.code}</span>
                        <span className="min-w-0 flex-1 truncate">{form.title}</span>
                      </span>
                    )}
                    {canAssign && team.length > 0 && form.itemId ? (
                      <form
                        action={assignFormsTasksAction.bind(null, id, [form.itemId])}
                        className="flex flex-shrink-0 items-center gap-1"
                      >
                        <select
                          name="assignee"
                          defaultValue={form.assigneeUserId ?? ""}
                          className={select}
                          aria-label={fr ? `Assigner ${form.code}` : `Assign ${form.code}`}
                          data-testid={`assign-task-${form.code}`}
                        >
                          <option value="">—</option>
                          {team.map((member) => (
                            <option key={member.userId} value={member.userId}>{member.userName}</option>
                          ))}
                        </select>
                        <SubmitButton className={ok} testId={`assign-task-save-${form.code}`}>OK</SubmitButton>
                      </form>
                    ) : form.assigneeName ? (
                      <span className="flex-shrink-0 text-[11px] text-muted" data-testid={`assignee-${form.code}`}>
                        {form.assigneeName}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })}
      </div>
    </main>
  );
}
