import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { FinAnalysisGrid } from "@/components/FinAnalysisGrid";
import { apComments } from "@/lib/analytical-procedures";
import { getEngagement } from "@/lib/engagements";
import { financialAnalysis } from "@/lib/financial-analysis";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Financial Analysis · AuditISA" };

/** The ratio battery: Current Y vs Prior Y from the pre-audit TB, one page. */
export default async function FinancialAnalysisPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [analysis, comments] = await Promise.all([financialAnalysis(id), apComments(id)]);

  return (
    <main className="min-h-screen w-full px-6 py-5">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-4 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools/data-analytics`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour à l'analyse de données" : "Back to Data Analytics"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="finanalysis-back"
        >
          ←
        </Link>
        <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Analyse financière" : "Financial Analysis"}
        </h1>
        {analysis ? (
          <span className="ml-auto text-[11px] text-muted">
            {fr ? "Bases : balance pré-audit — clôture / ouverture" : "Basis: pre-audit trial balance — closing / opening"}
          </span>
        ) : null}
      </div>

      {!analysis ? (
        <p className="mt-5 text-sm text-muted" data-testid="finanalysis-no-tb">
          {fr
            ? "Aucune balance pré-audit ingérée — les ratios se calculent à partir de la balance."
            : "No pre-audit trial balance ingested yet — the ratios compute from the trial balance."}
        </p>
      ) : (
        <div className="mt-3">
          <FinAnalysisGrid
            engagementId={id}
            rows={analysis.rows}
            comments={comments}
            locale={fr ? "fr" : "en"}
          />
        </div>
      )}
    </main>
  );
}
