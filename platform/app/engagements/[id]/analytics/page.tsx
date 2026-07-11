import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { raiseAnalyticsRiskAction } from "@/app/actions/data";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner } from "@/components/GatesPanel";
import { Panel } from "@/components/ui/atlas";
import { analyticalReview } from "@/lib/analytics";
import { getEngagement } from "@/lib/engagements";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function AnalyticsPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const ta = t.planning.analyticsPage;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const review = await analyticalReview(id);

  const btn =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold tracking-[-0.01em] text-ink">
        {engagement.clientName} — {engagement.fiscalYear} · {ta.title}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="analytics" />
      <ErrorBanner error={error} locale={locale} />

      <Panel className="mt-6">
        {!review.hasTb ? (
          <p className="text-sm text-muted" data-testid="analytics-no-tb">
            {t.planning.dataPage.noTb}
          </p>
        ) : (
          <>
            {review.performanceMateriality === null ? (
              <p className="mb-3 text-sm text-warn">{ta.noPm}</p>
            ) : null}
            <div className="overflow-x-auto rounded-[var(--radius-atlas)] border border-line">
              <table className="w-full text-sm" data-testid="variance-table">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2">{ta.section}</th>
                    <th className="px-4 py-2 text-right">{ta.closing}</th>
                    <th className="px-4 py-2 text-right">{ta.prior}</th>
                    <th className="px-4 py-2 text-right">{ta.movement}</th>
                    <th className="px-4 py-2 text-right">{ta.variance}</th>
                    <th className="px-4 py-2">{ta.flag}</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {review.lines.map((line) => (
                    <tr
                      key={line.sectionCode}
                      data-testid={`variance-${line.sectionCode}`}
                      className={`border-t border-line ${
                        line.flagged ? "bg-[var(--color-warn-soft)]" : ""
                      }`}
                    >
                      <td className="px-4 py-2 font-mono text-xs font-semibold text-ink">
                        {line.sectionCode}
                      </td>
                      <td className="px-4 py-2 text-right tnum">{formatFCFA(line.closing)}</td>
                      <td className="px-4 py-2 text-right text-muted tnum">{formatFCFA(line.prior)}</td>
                      <td className="px-4 py-2 text-right tnum">{formatFCFA(line.movement)}</td>
                      <td className="px-4 py-2 text-right tnum">
                        {line.variancePct === null ? "—" : `${line.variancePct.toFixed(1)} %`}
                      </td>
                      <td className="px-4 py-2">
                        {line.flagged ? (
                          <span
                            data-testid={`flag-${line.sectionCode}`}
                            className="rounded-[var(--radius-atlas-xs)] bg-[var(--color-warn-soft)] px-1.5 py-0.5 text-xs font-semibold text-warn"
                          >
                            ⚑
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <form action={raiseAnalyticsRiskAction.bind(null, id)} className="inline">
                          <input
                            type="hidden"
                            name="description"
                            value={`D4.3 variance ${line.sectionCode}: movement ${formatFCFA(line.movement)} (${line.variancePct === null ? "n/a" : `${line.variancePct.toFixed(1)} %`})`}
                          />
                          <button type="submit" className={btn} data-testid={`raise-${line.sectionCode}`}>
                            {ta.raise}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="mt-6 text-lg font-semibold tracking-[-0.01em] text-ink">{ta.ratios}</h2>
            <div className="mt-2 overflow-x-auto rounded-[var(--radius-atlas)] border border-line">
              <table className="w-full text-sm" data-testid="ratios-table">
                <tbody>
                  {review.ratios.map((ratio) => (
                    <tr key={ratio.key} className="border-t border-line first:border-t-0">
                      <td className="px-4 py-2 text-ink-soft">
                        {ta.ratioNames[ratio.key as keyof typeof ta.ratioNames] ?? ratio.key}
                      </td>
                      <td className="px-4 py-2 text-right tnum">
                        {ratio.current === null
                          ? "—"
                          : ratio.key === "revenue"
                            ? formatFCFA(ratio.current)
                            : `${ratio.current.toFixed(1)} %`}
                      </td>
                      <td className="px-4 py-2 text-right text-muted tnum">
                        {ratio.prior === null
                          ? "—"
                          : ratio.key === "revenue"
                            ? formatFCFA(ratio.prior)
                            : `${ratio.prior.toFixed(1)} %`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </main>
  );
}
