import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { generateDocumentAction } from "@/app/actions/audit-file";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { Chip, Panel, StatCell } from "@/components/ui/atlas";
import { engagementDashboard } from "@/lib/dashboards";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { SECTIONS } from "@/lib/file-index";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Audit file · AuditISA" };

export default async function EngagementFilePage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const t = getMessages(locale);

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [items, dash] = await Promise.all([listFileItems(id), engagementDashboard(id)]);
  const td = t.engagementDashboard;

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} />
      <div className="mt-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
          {engagement.clientName} — {engagement.fiscalYear}
        </h1>
        <span className="text-sm text-muted tnum">
          {t.engagements.phase}: {t.engagements.stages[engagement.phase]} ·{" "}
          {t.engagements.periodEnd}: {engagement.periodEnd}
        </span>
      </div>
      <EngagementTabs engagementId={id} locale={locale} active="file" />

      {/* 9.3 engagement dashboard strip */}
      <section
        className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"
        data-testid="engagement-dashboard"
      >
        {[
          { label: td.steps, value: `${dash.steps.complete + dash.steps.na}/${dash.steps.total}` },
          {
            label: td.risks,
            value: `${dash.risks.identified} / ${dash.risks.concluded} / ${dash.risks.significant}`,
          },
          {
            label: td.b5,
            value:
              dash.b5.materiality === null
                ? formatFCFA(dash.b5.uncorrected)
                : `${formatFCFA(dash.b5.uncorrected)} / ${formatFCFA(dash.b5.materiality)}`,
          },
          { label: td.unsigned, value: String(dash.documentsUnsigned) },
          { label: td.pbcOpen, value: String(dash.pbcOpen) },
        ].map((card) => (
          <Panel key={card.label} className="p-3">
            <StatCell label={card.label} value={card.value} />
          </Panel>
        ))}
        <Panel className="p-3">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted">{td.deadlines}</p>
          <p className="mt-1.5 text-xs text-ink-soft tnum">
            {dash.nextDeadlines.map((deadline) => `${deadline.key} ${deadline.dueDate}`).join(" · ") || "—"}
          </p>
          <a
            href={`/api/engagements/${id}/export`}
            className="mt-1.5 inline-block text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            data-testid="export-file-index"
          >
            {td.export}
          </a>
        </Panel>
      </section>

      {SECTIONS.map((section) => {
        const sectionItems = items.filter((item) => item.section === section.section);
        if (sectionItems.length === 0) return null;
        return (
          <section key={section.section} className="mt-8">
            <h3 className="text-lg font-semibold tracking-[-0.01em] text-ink">
              {section.section} — {locale === "fr" ? section.titleFr : section.titleEn}
            </h3>
            <Panel flush className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {sectionItems.map((item) => (
                    <tr
                      key={item.id}
                      data-testid={`file-item-${item.code}`}
                      className="border-t border-line first:border-t-0 hover:bg-surface-2"
                    >
                      <td className="w-24 px-4 py-2.5 font-mono text-xs font-semibold text-ink tnum">
                        {item.code}
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft">
                        {item.section === "E" ? (
                          <Link
                            href={`/engagements/${id}/sections/${item.id}`}
                            data-testid={`open-section-${item.code}`}
                            className="hover:text-emerald-700 hover:underline dark:hover:text-emerald-400"
                          >
                            {locale === "fr" ? item.titleFr : item.titleEn}
                          </Link>
                        ) : (
                          <>{locale === "fr" ? item.titleFr : item.titleEn}</>
                        )}
                        {item.conditional ? (
                          <span className="ml-2">
                            <Chip tone="muted">{t.fileIndex.conditional}</Chip>
                          </span>
                        ) : null}
                      </td>
                      <td className="w-40 px-4 py-2.5 text-right">
                        {item.documentId ? (
                          <Link
                            href={`/documents/${item.documentId}`}
                            data-testid={`open-doc-${item.code}`}
                            className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            {t.fileIndex.openDocument} ({t.fileIndex.version}
                            {item.documentVersion})
                          </Link>
                        ) : (
                          <form
                            action={async () => {
                              "use server";
                              await generateDocumentAction(item.id);
                            }}
                            className="inline"
                          >
                            <button
                              type="submit"
                              data-testid={`generate-doc-${item.code}`}
                              className="rounded-[var(--radius-atlas-sm)] border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                            >
                              {t.fileIndex.generate}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </section>
        );
      })}
    </main>
  );
}
