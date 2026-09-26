import Link from "next/link";
import { localizedTitle } from "@/lib/page-title";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { JeSelectionStudio, type JeDatasetOption } from "@/components/JeSelectionStudio";
import { getEngagement } from "@/lib/engagements";
import {
  JE_CRITERIA, RULE_FIELDS, RULE_OPERATORS, RULE_OPERATOR_LABELS,
} from "@/lib/je-selection";
import { getLocale } from "@/lib/locale";
import { listDatasets } from "@/lib/subledgers";

export const generateMetadata = localizedTitle("Journal-entry selection", "Sélection des écritures");

/**
 * Risk-directed selection of the journal-entry line items to test (ISA 240 ¶32).
 * The page names the ledgers available and hands the criterion catalogue and the
 * rule-builder vocabulary to the studio; the studio never imports
 * lib/je-selection itself, because that module opens the database pool and has
 * no business in a browser bundle. Every run goes through
 * app/api/engagements/[id]/je-selection.
 */
export default async function JeSelectionPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const datasets: JeDatasetOption[] = (await listDatasets(id))
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
          data-testid="je-selection-back"
        >
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">
            {fr ? "Sélection des écritures comptables" : "Journal-entry selection"}
          </h1>
          <p className="text-[12.5px] text-ink-soft">
            {fr
              ? "Sélection orientée par le risque (ISA 240 ¶32) · chaque ligne retenue porte le critère, les seuils et le motif de son choix"
              : "Risk-directed selection (ISA 240 ¶32) · every selected line carries the criterion, the thresholds and the reason it was chosen"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <JeSelectionStudio
          engagementId={id}
          locale={locale}
          datasets={datasets}
          criteria={[...JE_CRITERIA]}
          ruleFields={[...RULE_FIELDS]}
          ruleOperators={RULE_OPERATORS}
          operatorLabels={RULE_OPERATOR_LABELS}
          analyzerHref={`/engagements/${id}/analyzers/journal_entries`}
          glConsoleHref={`/engagements/${id}/tools/gl-console`}
        />
      </div>
    </main>
  );
}
