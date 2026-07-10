import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { generateDocumentAction } from "@/app/actions/audit-file";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { SECTIONS } from "@/lib/file-index";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function EngagementFilePage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const t = getMessages(locale);

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const items = await listFileItems(id);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <AppNav locale={locale} />
      <div className="mt-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {engagement.clientName} — {engagement.fiscalYear}
        </h1>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {t.engagements.phase}: {t.engagements.phases[engagement.phase]} ·{" "}
          {t.engagements.periodEnd}: {engagement.periodEnd}
        </span>
      </div>
      <EngagementTabs engagementId={id} locale={locale} active="file" />

      {SECTIONS.map((section) => {
        const sectionItems = items.filter((item) => item.section === section.section);
        if (sectionItems.length === 0) return null;
        return (
          <section key={section.section} className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {section.section} — {locale === "fr" ? section.titleFr : section.titleEn}
            </h3>
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <tbody>
                  {sectionItems.map((item) => (
                    <tr
                      key={item.id}
                      data-testid={`file-item-${item.code}`}
                      className="border-t border-slate-200 first:border-t-0 dark:border-slate-800"
                    >
                      <td className="w-24 px-4 py-2.5 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {item.code}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
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
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {t.fileIndex.conditional}
                          </span>
                        ) : null}
                      </td>
                      <td className="w-40 px-4 py-2.5 text-right">
                        {item.documentId ? (
                          <Link
                            href={`/documents/${item.documentId}`}
                            data-testid={`open-doc-${item.code}`}
                            className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
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
                              className="rounded-md border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
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
            </div>
          </section>
        );
      })}
    </main>
  );
}
