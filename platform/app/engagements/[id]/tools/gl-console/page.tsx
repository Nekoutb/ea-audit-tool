import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { GlConsole, type GlDatasetOption } from "@/components/GlConsole";
import { getEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";
import { listDatasets } from "@/lib/subledgers";

export const metadata = { title: "GL Correlation Console · AuditISA" };

/**
 * The GL Correlation Console: the imported general ledger interrogated three
 * ways — what else moves with a selected set of accounts, how two accounts move
 * against one another, and the thirty-analytic catalogue — each figure computed
 * by SQL over the typed gl_line projection and drillable to the underlying
 * lines. The page itself only names the file; every aggregate is fetched by the
 * console from app/api/engagements/[id]/gl-analytics.
 */
export default async function GlConsolePage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const datasets: GlDatasetOption[] = (await listDatasets(id))
    .filter((d) => d.kind === "journal_entries")
    .map((d) => ({
      id: d.id,
      sourceFilename: d.sourceFilename,
      timing: d.timing,
      rowCount: d.rowCount,
      createdAt: d.createdAt,
    }));

  return (
    <main className="min-h-screen w-full overflow-x-hidden px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour aux outils" : "Back to tools"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="gl-console-back"
        >
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">
            {fr ? "Console de corrélation du grand livre" : "GL Correlation Console"}
          </h1>
          <p className="text-[12.5px] text-ink-soft">
            {fr
              ? "Analyse des écritures · corrélation entre deux comptes · catalogue des trente analyses — chaque montant est signé (débit positif, crédit négatif) et remonte aux lignes source"
              : "Entry analysis · two-account correlation · the thirty-analytic catalogue — every amount is signed (debits positive, credits negative) and drills through to the source lines"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <GlConsole
          engagementId={id}
          locale={locale}
          datasets={datasets}
          entity={engagement.clientName}
          engagementName={engagement.name ?? engagement.clientName}
          periodEnd={engagement.periodEnd}
          fiscalYear={engagement.fiscalYear}
          analyzerHref={`/engagements/${id}/analyzers/journal_entries`}
        />
      </div>
    </main>
  );
}
