import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { assignSectionAction, generateLeadScheduleAction } from "@/app/actions/data";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner } from "@/components/GatesPanel";
import { DatasetAnalyzer } from "@/components/DatasetAnalyzer";
import { TbAnalyzer } from "@/components/TbAnalyzer";
import { Panel, Chip } from "@/components/ui/atlas";
import { withTenant } from "@/lib/db";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { sectionBalances } from "@/lib/leadsheets";
import { getLocale } from "@/lib/locale";
import { listDatasets } from "@/lib/subledgers";
import { diffTbVersions, listTbVersions } from "@/lib/tb";
import { leadRef } from "@/lib/lead-taxonomy";
import { listFirmUsers } from "@/lib/team";
import { requireTenant } from "@/lib/tenant";

export const metadata = { title: "Data · AuditISA" };

async function leadsheetDocs(
  engagementId: string,
): Promise<Map<string, { id: string; version: number; updatedAt: string }>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ file_item_id: string; id: string; current_version: number; updated_at: string }>(
      `SELECT d.file_item_id, d.id, d.current_version,
              (SELECT max(v.created_at)::text FROM document_version v WHERE v.document_id = d.id) AS updated_at
         FROM document d WHERE d.engagement_id = $1 AND d.kind = 'leadsheet'`,
      [engagementId],
    );
    return new Map(
      result.rows.map((r) => [r.file_item_id, { id: r.id, version: r.current_version, updatedAt: r.updated_at }]),
    );
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

  const [datasets, balances, items, docs, users, tbVersions] =
    await Promise.all([
      listDatasets(id),
      sectionBalances(id),
      listFileItems(id),
      leadsheetDocs(id),
      listFirmUsers(),
      listTbVersions(id),
    ]);
  const latestSummary = tbVersions.find((v) => v.summary)?.summary ?? null;

  // Wave 1 (A3): version-diff visibility + stale lead-schedule detection.
  const currentVersionRow = tbVersions.find((v) => v.isCurrent) ?? null;
  const currentTbVersion = currentVersionRow?.versionNo ?? 0;
  const currentTbAt = currentVersionRow?.createdAt ?? null;
  const diff =
    currentTbVersion >= 2
      ? (await diffTbVersions(id, currentTbVersion - 1, currentTbVersion))
          .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
          .slice(0, 10)
      : [];

  const eSections = items.filter((item) => item.section === "E");
  const withBalances = eSections.filter((section) => balances.has(section.code));
  const unmapped = [...balances.values()][0]?.unmappedAccounts ?? [];

  const btn =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2";
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="min-h-screen w-full px-6 py-8">
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
          <TbAnalyzer
            engagementId={id}
            locale={locale}
            messages={t.planning}
            sectionOptions={eSections.map((sec) => ({ code: sec.code, title: locale === "fr" ? sec.titleFr : sec.titleEn }))}
          />
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

        {diff.length > 0 ? (
          <div className="mt-4" data-testid="tb-diff">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {t.planning.tbPage.diffTitle} (v{currentTbVersion - 1} → v{currentTbVersion})
            </h3>
            <ul className="mt-2 flex flex-col gap-0.5 text-xs">
              {diff.map((line) => (
                <li key={line.account} className="flex gap-3 font-mono">
                  <span className="w-20 font-semibold text-ink">{line.account}</span>
                  <span className="text-muted tnum">{formatFCFA(line.closingA)} → {formatFCFA(line.closingB)}</span>
                  <span className={`tnum ${line.difference >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose"}`}>
                    {line.difference >= 0 ? "+" : ""}{formatFCFA(line.difference)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

      </Panel>

      <Panel className="mt-6" id="subledgers">
        <h2 className="text-lg font-semibold text-ink">{td.subledgers}</h2>
        <div className="mt-3">
          <DatasetAnalyzer engagementId={id} locale={locale} messages={t.planning} />
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
                          <span className="text-emerald-700 dark:text-emerald-400">{leadRef(section.code)}</span>{" "}
                          {section.code}
                        </Link>
                        {doc && currentTbAt && doc.updatedAt < currentTbAt ? (
                          <span className="ml-2 rounded-full bg-[var(--color-warn-soft)] px-2 py-0.5 text-[10px] font-bold text-warn" data-testid={`stale-lead-${section.code}`}>
                            {t.planning.tbPage.staleLead.replace("{n}", String(currentTbVersion))}
                          </span>
                        ) : null}
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
