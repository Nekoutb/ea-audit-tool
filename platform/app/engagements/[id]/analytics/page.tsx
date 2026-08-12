import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { ApSchedules } from "@/components/ApSchedules";
import { apComments, apLeadSchedules } from "@/lib/analytical-procedures";
import { getEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Analytical Procedures · AuditISA" };


// The Excel look: hard grid lines, dense rows, bold header, double-ruled total.

/**
 * Analytical procedures over the lead schedules: for each index, the accounts
 * of the pre-audit TB that sum to its total — closing (TB closing), prior year
 * (TB opening), movement, variance — read-only like a locked spreadsheet,
 * except the Commentary column at account and total level.
 */
export default async function AnalyticsPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const fr = locale === "fr";

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [schedules, comments] = await Promise.all([apLeadSchedules(id), apComments(id)]);

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools/data-analytics`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour à l'analyse de données" : "Back to Data Analytics"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="analytics-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Procédures analytiques" : "Analytical Procedures"}
        </h1>
      </div>
      <ErrorBanner error={error} locale={locale} />

      {schedules.length === 0 ? (
        <p className="mt-6 text-sm text-muted" data-testid="analytics-no-tb">
          {fr
            ? "Aucune balance pré-audit valide — importer la balance dans l'Analyseur de balance."
            : "No valid pre-audit trial balance yet — import one in the Trial Balance Analyzer."}
        </p>
      ) : (
        <div className="mt-4">
          <ApSchedules engagementId={id} schedules={schedules} comments={comments} locale={fr ? "fr" : "en"} />
        </div>
      )}
    </main>
  );
}
