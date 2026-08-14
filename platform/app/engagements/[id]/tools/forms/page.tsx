import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Panel } from "@/components/ui/atlas";
import { DEFAULT_FILE_INDEX, shortTitle } from "@/lib/file-index";
import { getEngagement } from "@/lib/engagements";
import { engagementTasks } from "@/lib/engagement-dashboard";
import { getLocale } from "@/lib/locale";
import { SECTION_ORDER, groupOfTask, sectionLabel, type SectionKey } from "@/lib/task-groups";

export const metadata = { title: "Forms · AuditISA" };

/**
 * The Forms section: every standard form in the file, grouped by phase, each
 * opening its task. One place to reach a form without walking the phases.
 */
export default async function FormsPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const tasks = await engagementTasks(id);
  const byCode = new Map(tasks.map((x) => [x.code, x]));

  const byPhase = new Map<SectionKey, { code: string; title: string; href: string | null }[]>();
  for (const entry of DEFAULT_FILE_INDEX) {
    const group = groupOfTask(entry.code);
    if (!group) continue;
    const task = byCode.get(entry.code);
    const list = byPhase.get(group.section) ?? [];
    list.push({
      code: entry.code,
      title: shortTitle(entry.code, fr ? "fr" : "en", fr ? entry.titleFr : entry.titleEn),
      href: task ? `/engagements/${id}/sections/${task.id}` : null,
    });
    byPhase.set(group.section, list);
  }

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

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="forms-list">
        {SECTION_ORDER.map((phase) => {
          const forms = byPhase.get(phase) ?? [];
          if (forms.length === 0) return null;
          return (
            <Panel key={phase} className="px-4 py-3">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                {sectionLabel(phase, locale)}
              </h2>
              <ul className="mt-1.5 flex flex-col" data-testid={`forms-${phase}`}>
                {forms.map((form) => (
                  <li key={form.code}>
                    {form.href ? (
                      <Link
                        href={form.href}
                        className="flex items-baseline gap-2 rounded-[var(--radius-atlas-xs)] px-1.5 py-1 text-[12.3px] text-ink-soft transition hover:bg-surface-2 hover:text-emerald-700"
                        data-testid={`form-${form.code}`}
                      >
                        <span className="w-11 flex-shrink-0 font-mono text-[10.5px] font-semibold text-muted">{form.code}</span>
                        <span className="min-w-0 flex-1 truncate">{form.title}</span>
                      </Link>
                    ) : (
                      <span className="flex items-baseline gap-2 px-1.5 py-1 text-[12.3px] text-muted" title={fr ? "Hors périmètre de cette mission" : "Not in this engagement's scope"}>
                        <span className="w-11 flex-shrink-0 font-mono text-[10.5px]">{form.code}</span>
                        <span className="min-w-0 flex-1 truncate">{form.title}</span>
                      </span>
                    )}
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
