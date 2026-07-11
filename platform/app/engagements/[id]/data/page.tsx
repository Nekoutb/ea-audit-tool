import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { assignSectionAction, generateLeadScheduleAction } from "@/app/actions/data";
import {
  addOverrideAction,
  createJournalAction,
  deactivateOverrideAction,
  postJournalAction,
} from "@/app/actions/tb";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner } from "@/components/GatesPanel";
import { UploadDataset } from "@/components/UploadDataset";
import { UploadTb } from "@/components/UploadTb";
import { Panel, Chip } from "@/components/ui/atlas";
import { withTenant } from "@/lib/db";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { sectionBalances } from "@/lib/leadsheets";
import { getLocale } from "@/lib/locale";
import { listDatasets } from "@/lib/subledgers";
import { listJournals, listOverrides, listTbVersions } from "@/lib/tb";
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

  const [datasets, balances, items, docs, users, tbVersions, journals, overrides] =
    await Promise.all([
      listDatasets(id),
      sectionBalances(id),
      listFileItems(id),
      leadsheetDocs(id),
      listFirmUsers(),
      listTbVersions(id),
      listJournals(id),
      listOverrides((await getEngagement(id))!.clientId),
    ]);
  const latestSummary = tbVersions.find((v) => v.summary)?.summary ?? null;

  const eSections = items.filter((item) => item.section === "E");
  const withBalances = eSections.filter((section) => balances.has(section.code));
  const unmapped = [...balances.values()][0]?.unmappedAccounts ?? [];

  const btn =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2";
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="min-h-screen w-full px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold text-ink">
        {engagement.clientName} — {engagement.fiscalYear} · {t.planning.dataTitle}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="data" />
      <ErrorBanner error={error} locale={locale} />

      <Panel className="mt-6">
        <h2 className="text-lg font-semibold text-ink">
          {t.planning.tbPage.title}
        </h2>
        <div className="mt-3">
          <UploadTb engagementId={id} messages={t.planning} />
        </div>
        {tbVersions.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-atlas)] border border-line">
            <table className="w-full text-sm" data-testid="tb-versions">
              <tbody>
                {tbVersions.map((version) => (
                  <tr key={version.id} className="border-t border-line first:border-t-0 hover:bg-surface-2">
                    <td className="px-4 py-2 font-mono text-xs font-semibold">
                      v{version.versionNo}
                      {version.isCurrent ? (
                        <span className="ml-1.5 inline-flex">
                          <Chip tone="accent">{t.planning.tbPage.current}</Chip>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-ink-soft">{t.planning.tbPage.kind[version.kind]}</td>
                    <td className="px-4 py-2 text-ink-soft" data-testid={`tb-status-${version.versionNo}`}>
                      {t.planning.tbPage.statusLabel[version.status]}
                    </td>
                    <td className="px-4 py-2 text-muted tnum">
                      {version.rowCount} · D {formatFCFA(version.totalDebit)} / C {formatFCFA(version.totalCredit)}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted tnum">{version.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {latestSummary ? (
          <ul className="mt-3 flex flex-col gap-1 text-sm" data-testid="tb-checks">
            {(
              [
                ["balanced", latestSummary.checks.balanced.ok],
                ["openingBalanced", latestSummary.checks.openingBalanced.ok],
                ["closingEquation", latestSummary.checks.closingEquation.ok],
                ["codification", latestSummary.checks.codification.ok],
              ] as const
            ).map(([key, ok]) => (
              <li key={key} className="flex items-center gap-2">
                <span className={ok ? "text-good" : "text-rose"}>{ok ? "✓" : "✗"}</span>
                <span className="text-ink-soft">
                  {t.planning.tbPage.checks[key]}
                </span>
              </li>
            ))}
            {latestSummary.checks.unknownAccounts.length > 0 ? (
              <li className="text-warn">
                ⚠ {t.planning.tbPage.checks.unknownAccounts}:{" "}
                {latestSummary.checks.unknownAccounts.slice(0, 10).join(", ")}
              </li>
            ) : null}
            {latestSummary.checks.openingTiesToPrior.checked &&
            latestSummary.checks.openingTiesToPrior.exceptions.length > 0 ? (
              <li className="text-warn" data-testid="opening-tie-exceptions">
                ⚠ {t.planning.tbPage.checks.openingTiesToPrior}:{" "}
                {latestSummary.checks.openingTiesToPrior.exceptions
                  .slice(0, 5)
                  .map((e) => e.account)
                  .join(", ")}
              </li>
            ) : null}
          </ul>
        ) : null}

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">
          {t.planning.tbPage.journals}
        </h3>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm" data-testid="journals-list">
          {journals.map((journal) => (
            <li key={journal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-atlas-sm)] border border-line bg-surface px-3 py-1.5">
              <span>
                #{journal.journalNo} — {journal.description} · {formatFCFA(journal.total)} ·{" "}
                {journal.status === "posted" ? t.planning.tbPage.postedAs : journal.status}
              </span>
              {journal.status === "draft" ? (
                <form action={postJournalAction.bind(null, id, journal.id)} className="flex items-center gap-2">
                  <select name="kind" className={input}>
                    <option value="adjusted">{t.planning.tbPage.kind.adjusted}</option>
                    <option value="final">{t.planning.tbPage.kind.final}</option>
                  </select>
                  <button type="submit" className={btn} data-testid={`post-journal-${journal.journalNo}`}>
                    {t.planning.tbPage.post}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        <form action={createJournalAction.bind(null, id)} className="mt-3 flex flex-col gap-2">
          <input
            name="description"
            placeholder={t.planning.tbPage.journalDescription}
            required
            className={`${input} max-w-md`}
            data-testid="journal-description"
          />
          <textarea
            name="lines"
            placeholder={t.planning.tbPage.journalLines}
            rows={3}
            required
            className={`${input} max-w-md font-mono`}
            data-testid="journal-lines"
          />
          <div>
            <button type="submit" className={btn} data-testid="create-journal">
              {t.planning.tbPage.createJournal}
            </button>
          </div>
        </form>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">
          {t.planning.tbPage.overrides}
        </h3>
        <ul className="mt-2 flex flex-col gap-1 text-sm" data-testid="overrides-list">
          {overrides
            .filter((o) => o.active)
            .map((override) => (
              <li key={override.id} className="flex items-center justify-between rounded-[var(--radius-atlas-sm)] border border-line bg-surface px-3 py-1.5">
                <span>
                  {override.accountPrefix} ({override.matchType}) → {override.sectionCode} — {override.rationale}
                </span>
                <form action={deactivateOverrideAction.bind(null, id, override.id)}>
                  <button type="submit" className="text-xs text-rose hover:underline">
                    {t.planning.tbPage.deactivate}
                  </button>
                </form>
              </li>
            ))}
        </ul>
        <form
          action={addOverrideAction.bind(null, id, engagement.clientId)}
          className="mt-2 flex flex-wrap items-end gap-2"
        >
          <input name="accountPrefix" placeholder={t.planning.tbPage.prefix} required className={input} data-testid="override-prefix" />
          <select name="matchType" className={input}>
            <option value="prefix">prefix</option>
            <option value="exact">exact</option>
          </select>
          <input name="sectionCode" placeholder="E100" required className={input} data-testid="override-section" />
          <input name="rationale" placeholder={t.planning.tbPage.rationale} required className={input} data-testid="override-rationale" />
          <button type="submit" className={btn} data-testid="add-override">
            {t.planning.tbPage.addOverride}
          </button>
        </form>
      </Panel>

      <Panel className="mt-6">
        <h2 className="text-lg font-semibold text-ink">{td.subledgers}</h2>
        <div className="mt-3">
          <UploadDataset engagementId={id} messages={t.planning} />
        </div>
        {datasets.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-atlas)] border border-line">
            <table className="w-full text-sm" data-testid="datasets-table">
              <tbody>
                {datasets.map((dataset) => (
                  <tr key={dataset.id} className="border-t border-line first:border-t-0 hover:bg-surface-2">
                    <td className="px-4 py-2 font-medium text-ink">
                      {td.kinds[dataset.kind]}
                    </td>
                    <td className="px-4 py-2 text-ink-soft">{dataset.sourceFilename}</td>
                    <td className="px-4 py-2 text-ink-soft tnum">
                      {dataset.rowCount} {td.rows}
                    </td>
                    <td className="px-4 py-2 text-ink-soft tnum">
                      {dataset.totalAmount !== null
                        ? `${td.total}: ${formatFCFA(dataset.totalAmount)} (${dataset.amountColumn})`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted tnum">{dataset.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      <Panel className="mt-6">
        <h2 className="text-lg font-semibold text-ink">{td.leadSchedules}</h2>
        {withBalances.length === 0 ? (
          <p className="mt-2 text-sm text-muted" data-testid="no-tb-note">
            {td.noTb}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[var(--radius-atlas)] border border-line">
            <table className="w-full text-sm" data-testid="leadsheets-table">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
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
                    <tr key={section.id} className="border-t border-line hover:bg-surface-2">
                      <td className="px-4 py-2 font-mono text-xs font-semibold text-ink">
                        <Link href={`/engagements/${id}/sections/${section.id}`} className="hover:underline">
                          {section.code}
                        </Link>
                      </td>
                      <td className="px-4 py-2 tnum">{formatFCFA(balance.total)}</td>
                      <td className="px-4 py-2 text-muted tnum">{formatFCFA(balance.priorTotal)}</td>
                      <td className="px-4 py-2">
                        <form
                          action={assignSectionAction.bind(null, id, section.id)}
                          className="flex items-center gap-1.5"
                        >
                          <select
                            name="userId"
                            defaultValue={section.ownerId ?? undefined}
                            className={input}
                            data-testid={`owner-${section.code}`}
                          >
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className={btn} data-testid={`assign-${section.code}`}>
                            {td.assign}
                          </button>
                          {section.ownerName ? (
                            <span data-testid={`owner-badge-${section.code}`}>
                              <Chip tone="accent">{section.ownerName}</Chip>
                            </span>
                          ) : null}
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
          <p className="mt-3 text-sm text-warn" data-testid="unmapped-note">
            {td.unmapped}: {unmapped.slice(0, 20).join(", ")}
            {unmapped.length > 20 ? "…" : ""}
          </p>
        ) : null}
      </Panel>
    </main>
  );
}
