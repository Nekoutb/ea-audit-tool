import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
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
      <h1 className="mt-8 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {t.engagements.title}
      </h1>

      {engagements.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{t.engagements.empty}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm" data-testid="engagements-table">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">{t.engagements.client}</th>
                <th className="px-4 py-3">{t.engagements.fiscalYear}</th>
                <th className="px-4 py-3">{t.engagements.periodEnd}</th>
                <th className="px-4 py-3">{t.engagements.phase}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {engagements.map((engagement) => (
                <tr
                  key={engagement.id}
                  className="border-t border-slate-200 dark:border-slate-800"
                >
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {engagement.clientName}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {engagement.fiscalYear}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {engagement.periodEnd}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {t.engagements.phases[engagement.phase]}
                  </td>
                  <td className="px-4 py-3 text-right">
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
      )}
    </main>
  );
}
