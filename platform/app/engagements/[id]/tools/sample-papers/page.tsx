import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { engagementTasks } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";
import { TEMPLATE_CATEGORIES, listTemplates } from "@/lib/wp-templates";

export const metadata = { title: "Sample working papers · AuditISA" };

/**
 * The shelf of blank working papers. Every standard paper the methodology
 * ships is here in one place, so a preparer can take a copy before starting
 * rather than hunting for the one task that happens to seed it — and so a
 * reviewer can see what the standard paper looks like without opening a file.
 *
 * The copies are blank: a generated paper is built empty and a shipped one is
 * the file as it left the firm. Downloading one changes nothing on the
 * engagement; the paper a task actually works on is the attachment on that
 * task, seeded from the same catalogue.
 */
export default async function SamplePapersPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const templates = listTemplates();
  // The task a paper is the standard one for, named rather than coded: a
  // preparer looking for "the receivables paper" should not have to know that
  // receivables are E4.1 on this file.
  const tasks = await engagementTasks(id);
  const byCode = new Map(tasks.map((t) => [t.code, t]));

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour aux outils" : "Back to tools"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="samples-back"
        >
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">
            {fr ? "Modèles de papiers de travail" : "Sample working papers"}
          </h1>
          <p className="text-[12.5px] text-ink-soft">
            {fr
              ? "Les modèles vierges de la méthodologie · à télécharger et remplir · le papier d'une tâche reste la pièce jointe de cette tâche"
              : "The methodology's blank papers · download and complete · the paper a task works on stays the attachment on that task"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5" data-testid="sample-papers">
        {TEMPLATE_CATEGORIES.map((group) => {
          const inGroup = templates.filter((t) => t.category === group.category);
          if (inGroup.length === 0) return null;
          return (
            <Panel key={group.category} data-testid={`samples-group-${group.category}`}>
              <PanelHeader title={fr ? group.titleFr : group.titleEn} />
              <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
                {inGroup.map((t) => {
                  const standardFor = t.defaultFor
                    .map((code) => {
                      const task = byCode.get(code);
                      return task ? `${code} — ${fr ? task.titleFr : task.titleEn}` : code;
                    });
                  return (
                    <div
                      key={t.key}
                      className="flex flex-col gap-2 rounded-[var(--radius-atlas-sm)] border border-line bg-surface p-3"
                      data-testid={`sample-${t.key}`}
                    >
                      <h3 className="text-[13px] font-bold leading-snug text-ink">
                        {fr ? t.titleFr : t.titleEn}
                      </h3>
                      <p className="text-[11.5px] leading-relaxed text-ink-soft">
                        {fr ? t.descriptionFr : t.descriptionEn}
                      </p>
                      {standardFor.length > 0 ? (
                        <p className="text-[10.5px] leading-snug text-muted">
                          {fr ? "Papier standard de " : "Standard paper for "}
                          <span className="font-semibold text-ink-soft">{standardFor.join(" · ")}</span>
                        </p>
                      ) : null}
                      <a
                        href={`/api/engagements/${id}/wp-templates/${t.key}`}
                        className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-line-strong px-3 py-1 text-[11.5px] font-semibold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
                        data-testid={`sample-download-${t.key}`}
                      >
                        ↓ {t.name}
                      </a>
                    </div>
                  );
                })}
              </div>
            </Panel>
          );
        })}
      </div>
    </main>
  );
}
