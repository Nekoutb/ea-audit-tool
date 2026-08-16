import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { DatasetAnalyzer } from "@/components/DatasetAnalyzer";
import { AgingGrid } from "@/components/AgingGrid";
import { agingFor } from "@/lib/aging";
import { Panel } from "@/components/ui/atlas";
import { getEngagement } from "@/lib/engagements";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listDatasets } from "@/lib/subledgers";
import { isSubLedgerKind, type SubLedgerKind } from "@/lib/subledger-kinds";

export const metadata = { title: "Analyzer · AuditISA" };

// The dedicated analyzer pages: each tool uploads ONLY its own data kind and
// lists only its own datasets. Back returns to the Tools list, not the dashboard.
const ANALYZER_TITLES: Partial<Record<SubLedgerKind, { en: string; fr: string }>> = {
  journal_entries: { en: "General Ledger Analyzer", fr: "Analyseur du grand livre" },
  ar_open_items: { en: "Accounts Receivable Analyzer", fr: "Analyseur des créances clients" },
  ap_open_items: { en: "Accounts Payable Analyzer", fr: "Analyseur des dettes fournisseurs" },
  inventory_listing: { en: "Inventory Analyzer", fr: "Analyseur des stocks" },
  fixed_asset_register: { en: "Fixed Asset Analyzer", fr: "Analyseur des immobilisations" },
  payroll_register: { en: "Payroll Analyzer", fr: "Analyseur de la paie" },
  bank_statement: { en: "Bank Statement Analyzer", fr: "Analyseur des relevés bancaires" },
  supplier_statements: { en: "Supplier Statements Analyzer", fr: "Analyseur des relevés fournisseurs" },
};

export default async function AnalyzerPage(props: {
  params: Promise<{ id: string; kind: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id, kind } = await props.params;
  if (!isSubLedgerKind(kind)) notFound();
  const locale = await getLocale();
  const t = getMessages(locale);
  const fr = locale === "fr";

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const datasets = (await listDatasets(id)).filter((d) => d.kind === kind);
  const aging = kind === "ar_open_items" || kind === "ap_open_items" ? await agingFor(id, kind) : null;
  const title = ANALYZER_TITLES[kind] ?? { en: kind, fr: kind };

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-6 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools/data-analytics`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour à l'analyse de données" : "Back to Data Analytics"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="analyzer-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? title.fr : title.en}
        </h1>
      </div>

      <Panel className="mt-5">
        <DatasetAnalyzer engagementId={id} locale={locale} messages={t.planning} fixedKind={kind} />
        {aging ? (
          <div className="mt-4">
            <AgingGrid
              aging={aging}
              title={kind === "ar_open_items" ? (fr ? "Balance âgée clients" : "Receivables aging") : (fr ? "Balance âgée fournisseurs" : "Payables aging")}
              partyLabel={kind === "ar_open_items" ? (fr ? "Client" : "Customer") : (fr ? "Fournisseur" : "Supplier")}
              locale={fr ? "fr" : "en"}
            />
          </div>
        ) : null}
        {datasets.length > 0 ? (
          <div className="mt-5 overflow-x-auto rounded-[var(--radius-atlas)] border border-line">
            <table className="w-full text-sm" data-testid="analyzer-datasets">
              <tbody>
                {datasets.map((dataset) => (
                  <tr key={dataset.id} className="border-t border-line first:border-t-0 hover:bg-surface-2" data-testid={`dataset-${dataset.timing}`}>
                    {kind === "journal_entries" ? (
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${dataset.timing === "pre_audit" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-[var(--color-warn-soft)] text-warn"}`}>
                          {dataset.timing === "pre_audit" ? (fr ? "Pré-audit" : "Pre-audit") : fr ? "Post-audit" : "Post-audit"}
                        </span>
                      </td>
                    ) : null}
                    <td className="px-4 py-2 font-medium text-ink">{dataset.sourceFilename}</td>
                    <td className="px-4 py-2 text-ink-soft tnum">
                      {dataset.rowCount} {fr ? "lignes" : "rows"}
                    </td>
                    <td className="px-4 py-2 text-ink-soft tnum">
                      {dataset.totalAmount !== null ? formatFCFA(dataset.totalAmount) : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted tnum">{dataset.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-[12.5px] text-muted" data-testid="analyzer-empty">
            {fr
              ? "Aucun jeu de données de ce type — importer le fichier ci-dessus."
              : "No dataset of this kind yet — upload the file above."}
          </p>
        )}
      </Panel>
    </main>
  );
}
