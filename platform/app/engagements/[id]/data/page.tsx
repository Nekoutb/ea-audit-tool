import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { assignSectionAction, generateLeadScheduleAction } from "@/app/actions/data";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner } from "@/components/GatesPanel";
import { UploadDataset } from "@/components/UploadDataset";
import { withTenant } from "@/lib/db";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { sectionBalances } from "@/lib/leadsheets";
import { getLocale } from "@/lib/locale";
import { listDatasets } from "@/lib/subledgers";
import { listFirmUsers } from "@/lib/team";
import { requireTenant } from "@/lib/tenant";

async function leadsheetDocs(engagementId: string): Promise<Map<string, { id: string; version: number }>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ file_item_id: string; id: string; current_version: number }>(
      "SELECT file_item_id, id, current_version FROM document WHERE engagement_id = $1 AND kind = 'leadsheet'",
      [engagementId],
    );
    return new Map(result.rows.map((r) => [r.file_item_id, { id: r.id, version: r.current_version }]));
  });
}

export default async function DataPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const td = t.planning.dataPage;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [datasets, balances, items, docs, users] = await Promise.all([
    listDatasets(id),
    sectionBalances(id),
    listFileItems(id),
    leadsheetDocs(id),
    listFirmUsers(),
  ]);

  const eSections = items.filter((item) => item.section === "E");
  const withBalances = eSections.filter((section) => balances.has(section.code));
  const unmapped = [...balances.values()][0]?.unmappedAccounts ?? [];

  const btn =
    "rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
  const input =
    "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const card = "mt-6 rounded-xl border border-slate-200 p-5 dark:border-slate-800";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {engagement.clientName} — {engagement.fiscalYear} · {t.planning.dataTitle}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="data" />
      <ErrorBanner error={error} locale={locale} />

      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{td.subledgers}</h2>
        <div className="mt-3">
          <UploadDataset engagementId={id} messages={t.planning} />
        </div>
        {datasets.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm" data-testid="datasets-table">
              <tbody>
                {datasets.map((dataset) => (
                  <tr key={dataset.id} className="border-t border-slate-200 first:border-t-0 dark:border-slate-800">
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                      {td.kinds[dataset.kind]}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{dataset.sourceFilename}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {dataset.rowCount} {td.rows}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {dataset.totalAmount !== null
                        ? `${td.total}: ${formatFCFA(dataset.totalAmount)} (${dataset.amountColumn})`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{dataset.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{td.leadSchedules}</h2>
        {withBalances.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400" data-testid="no-tb-note">
            {td.noTb}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm" data-testid="leadsheets-table">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">§</th>
                  <th className="px-4 py-2">{td.closing}</th>
                  <th className="px-4 py-2">{td.prior}</th>
                  <th className="px-4 py-2">{td.owner}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {withBalances.map((section) => {
                  const balance = balances.get(section.code)!;
                  const doc = docs.get(section.id);
                  return (
                    <tr key={section.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                        <Link href={`/engagements/${id}/sections/${section.id}`} className="hover:underline">
                          {section.code}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{formatFCFA(balance.total)}</td>
                      <td className="px-4 py-2 text-slate-500">{formatFCFA(balance.priorTotal)}</td>
                      <td className="px-4 py-2">
                        <form
                          action={assignSectionAction.bind(null, id, section.id)}
                          className="flex items-center gap-1.5"
                        >
                          <select name="userId" className={input} data-testid={`owner-${section.code}`}>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className={btn} data-testid={`assign-${section.code}`}>
                            {td.assign}
                          </button>
                        </form>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <form action={generateLeadScheduleAction.bind(null, id, section.id)} className="inline">
                          <button type="submit" className={btn} data-testid={`generate-lead-${section.code}`}>
                            {doc ? td.regenerate : td.generate}
                          </button>
                        </form>
                        {doc ? (
                          <Link
                            href={`/documents/${doc.id}`}
                            className="ml-2 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                            data-testid={`open-lead-${section.code}`}
                          >
                            {td.open} (v{doc.version})
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {unmapped.length > 0 ? (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-400" data-testid="unmapped-note">
            {td.unmapped}: {unmapped.slice(0, 20).join(", ")}
            {unmapped.length > 20 ? "…" : ""}
          </p>
        ) : null}
      </section>
    </main>
  );
}
