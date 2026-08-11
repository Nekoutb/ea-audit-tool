import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Panel } from "@/components/ui/atlas";
import { engagementTasks } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Data Analytics · AuditISA" };

/** The Data Analytics section: the six analyzers, each on its own screen. */
const ANALYZERS: {
  id: string;
  nameEn: string;
  nameFr: string;
  descEn: string;
  descFr: string;
  feeds: string[];
  href: (id: string) => string;
}[] = [
  { id: "trial-balance", nameEn: "Trial Balance Analyzer", nameFr: "Analyseur de balance générale", descEn: "Upload, confirm the four columns, map account classes to lead schedules, ingest", descFr: "Importer, confirmer les quatre colonnes, rattacher les classes aux feuilles maîtresses, ingérer", feeds: ["D5.1", "D5.8", "D5.2"], href: (id) => `/engagements/${id}/data` },
  { id: "gl-analyzer", nameEn: "General Ledger Analyzer", nameFr: "Analyseur du grand livre", descEn: "Journal-entry population for the fraud procedures and close-process work", descFr: "Population d'écritures pour les procédures de fraude et l'arrêté", feeds: ["E350", "D8.4"], href: (id) => `/engagements/${id}/analyzers/journal_entries` },
  { id: "ar-analyzer", nameEn: "Accounts Receivable Analyzer", nameFr: "Analyseur des créances clients", descEn: "Open-items ageing, concentrations and circularisation candidates", descFr: "Balance âgée, concentrations et candidats à la circularisation", feeds: ["E100"], href: (id) => `/engagements/${id}/analyzers/ar_open_items` },
  { id: "ap-analyzer", nameEn: "Accounts Payable Analyzer", nameFr: "Analyseur des dettes fournisseurs", descEn: "Open items, supplier statements and the unrecorded-liabilities search", descFr: "Postes ouverts, relevés fournisseurs et recherche de passifs non comptabilisés", feeds: ["E110"], href: (id) => `/engagements/${id}/analyzers/ap_open_items` },
  { id: "inventory-analyzer", nameEn: "Inventory Analyzer", nameFr: "Analyseur des stocks", descEn: "Inventory listing against the ledger, count support and valuation checks", descFr: "État des stocks contre la comptabilité, appui d'inventaire et contrôles de valorisation", feeds: ["E130"], href: (id) => `/engagements/${id}/analyzers/inventory_listing` },
  { id: "analytics", nameEn: "Analytical Procedures", nameFr: "Procédures analytiques", descEn: "Current against prior period, by lead schedule, with ratios", descFr: "Exercice courant contre antérieur, par feuille maîtresse", feeds: ["D4.3", "A1"], href: (id) => `/engagements/${id}/analytics` },
];

export default async function DataAnalyticsPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const tasks = await engagementTasks(id);
  const byCode = new Map(tasks.map((x) => [x.code, x]));

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour aux outils" : "Back to tools"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="analytics-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Analyse de données" : "Data Analytics"}
        </h1>
      </div>

      <Panel className="mt-4">
        <ul className="divide-y divide-line" data-testid="analyzer-list">
          {ANALYZERS.map((tool) => (
            <li key={tool.id}>
              <Link
                href={tool.href(id)}
                data-testid={`tool-${tool.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 transition hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{fr ? tool.nameFr : tool.nameEn}</span>
                  <span className="block text-xs text-muted">{fr ? tool.descFr : tool.descEn}</span>
                </span>
                <span className="flex flex-shrink-0 flex-wrap items-center gap-1">
                  {tool.feeds.map((code) => {
                    const task = byCode.get(code);
                    return (
                      <span
                        key={code}
                        className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        title={task ? (fr ? task.titleFr : task.titleEn) : code}
                      >
                        {code}
                      </span>
                    );
                  })}
                </span>
                <span className="flex-shrink-0 text-muted" aria-hidden>›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
