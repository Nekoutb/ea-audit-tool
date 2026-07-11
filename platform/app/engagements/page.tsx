import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { listEngagements } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function EngagementsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const locale = await getLocale();
  const t = getMessages(locale);
  const engagements = await listEngagements();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold tracking-[-0.02em] text-ink">
        {t.engagements.title}
      </h1>

      {engagements.length === 0 ? (
        <Panel className="mt-6">
          <p className="text-sm text-muted">{t.engagements.empty}</p>
        </Panel>
      ) : (
        <Panel className="mt-6" flush>
          <div className="border-b border-line px-5 py-4">
            <PanelHeader
              title={t.engagements.title}
              hint={String(engagements.length)}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="engagements-table">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">{t.engagements.client}</th>
                  <th className="px-5 py-3 font-semibold">{t.engagements.fiscalYear}</th>
                  <th className="px-5 py-3 font-semibold">{t.engagements.periodEnd}</th>
                  <th className="px-5 py-3 font-semibold">{t.engagements.phase}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {engagements.map((engagement) => (
                  <tr
                    key={engagement.id}
                    className="border-t border-line transition-colors hover:bg-surface-2"
                  >
                    <td className="px-5 py-3 font-medium text-ink">
                      {engagement.clientName}
                    </td>
                    <td className="px-5 py-3 text-ink-soft tnum">
                      {engagement.fiscalYear}
                    </td>
                    <td className="px-5 py-3 text-ink-soft tnum">
                      {engagement.periodEnd}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      {t.engagements.phases[engagement.phase]}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/engagements/${engagement.id}`}
                        className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        {t.engagements.open}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </main>
  );
}
