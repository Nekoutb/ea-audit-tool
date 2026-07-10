import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { acceptPbcAction, addPbcItemAction } from "@/app/actions/pbc";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner } from "@/components/GatesPanel";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listPbcItems } from "@/lib/pbc";

export default async function PbcPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tp = t.pbc;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [items, fileItems] = await Promise.all([listPbcItems(id), listFileItems(id)]);
  const eSections = fileItems.filter((item) => item.section === "E");

  const btn =
    "rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
  const input =
    "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {engagement.clientName} — {engagement.fiscalYear} · {tp.title}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="pbc" />
      <ErrorBanner error={error} locale={locale} />

      <section className="mt-6 rounded-xl border border-slate-200 p-5 dark:border-slate-800">
        <form action={addPbcItemAction.bind(null, id)} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-slate-500">
            {tp.itemTitle}
            <input name="title" required className={`${input} mt-1 w-72`} data-testid="pbc-title" />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            {tp.note}
            <input name="note" className={`${input} mt-1 w-96`} data-testid="pbc-note" />
          </label>
          <button type="submit" className={btn} data-testid="pbc-add">
            {tp.add}
          </button>
        </form>

        {items.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm" data-testid="pbc-table">
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200 first:border-t-0 dark:border-slate-800">
                    <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{item.title}</td>
                    <td className="w-28 px-3 py-2 text-xs" data-testid={`pbc-status-${item.title}`}>
                      {t.portal.statuses[item.status]}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{item.filename ?? ""}</td>
                    <td className="px-3 py-2 text-right">
                      {item.status === "uploaded" ? (
                        <form
                          action={acceptPbcAction.bind(null, id, item.id)}
                          className="flex items-center justify-end gap-1.5"
                        >
                          <select name="fileItemId" className={input} data-testid={`pbc-attach-${item.title}`}>
                            <option value="">{tp.noAttach}</option>
                            {eSections.map((section) => (
                              <option key={section.id} value={section.id}>
                                {tp.attachTo} {section.code}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className={btn} data-testid={`pbc-accept-${item.title}`}>
                            {tp.accept}
                          </button>
                        </form>
                      ) : item.documentId ? (
                        <a
                          href={`/documents/${item.documentId}`}
                          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                          data-testid={`pbc-doc-${item.title}`}
                        >
                          {tp.attachTo} ✓
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
