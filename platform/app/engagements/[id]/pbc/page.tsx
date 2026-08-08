import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { acceptPbcAction, addPbcItemAction } from "@/app/actions/pbc";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner } from "@/components/GatesPanel";
import { Panel } from "@/components/ui/atlas";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listPbcItems } from "@/lib/pbc";

export const metadata = { title: "PBC requests · AuditISA" };

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
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2";
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold tracking-[-0.01em] text-ink">
        {engagement.clientName} — {engagement.fiscalYear} · {tp.title}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="pbc" />
      <ErrorBanner error={error} locale={locale} />

      <Panel className="mt-6">
        <form action={addPbcItemAction.bind(null, id)} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-muted">
            {tp.itemTitle}
            <input name="title" required className={`${input} mt-1 w-72`} data-testid="pbc-title" />
          </label>
          <label className="flex flex-col text-xs text-muted">
            {tp.note}
            <input name="note" className={`${input} mt-1 w-96`} data-testid="pbc-note" />
          </label>
          <button type="submit" className={btn} data-testid="pbc-add">
            {tp.add}
          </button>
        </form>

        {items.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-atlas)] border border-line">
            <table className="w-full text-sm" data-testid="pbc-table">
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-line first:border-t-0 hover:bg-surface-2">
                    <td className="px-3 py-2 text-ink">{item.title}</td>
                    <td className="w-28 px-3 py-2 text-xs text-ink-soft" data-testid={`pbc-status-${item.title}`}>
                      {t.portal.statuses[item.status]}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{item.filename ?? ""}</td>
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
      </Panel>
    </main>
  );
}
