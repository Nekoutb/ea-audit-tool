import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Chip } from "@/components/ui/atlas";
import { engagementTasks } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";
import { SECTION_ORDER, sectionLabel } from "@/lib/task-groups";

export const metadata = { title: "Tools · AuditISA" };

/**
 * The tools landing: eight compact section tiles fitting one screen. Each
 * opens its own screen (Data Analytics lists the analyzers; Materiality is the
 * ISA 320 tool alone; Independence Campaign holds the inquiry). Back goes to
 * the dashboard; each section's back returns here — one hierarchy, no tabs.
 */
const TILES: {
  id: string;
  nameEn: string;
  nameFr: string;
  descEn: string;
  descFr: string;
  feeds: string[];
  href: (id: string) => string;
}[] = [
  { id: "data-analytics", nameEn: "Data Analytics", nameFr: "Analyse de données", descEn: "Trial balance, general ledger, AR, AP, inventory and analytical procedures", descFr: "Balance, grand livre, clients, fournisseurs, stocks et procédures analytiques", feeds: ["D5.1", "D5.8", "E350"], href: (id) => `/engagements/${id}/tools/data-analytics` },
  { id: "materiality", nameEn: "Materiality", nameFr: "Seuil de signification", descEn: "PM, TE and SAD nominal amount from the trial-balance bases, with approval", descFr: "PM, TE et seuil SAD à partir des bases de la balance, avec approbation", feeds: ["D5.1"], href: (id) => `/engagements/${id}/tools/materiality` },
  { id: "risk", nameEn: "Risk Register", nameFr: "Registre des risques", descEn: "What can go wrong by assertion, and the strategy against each", descFr: "Ce qui peut mal tourner par assertion et la stratégie retenue", feeds: ["D7.2"], href: (id) => `/engagements/${id}/risks` },
  { id: "cra", nameEn: "Combined Risk Assessment", nameFr: "Évaluation combinée des risques", descEn: "Accounts against assertions, inherent and control risk", descFr: "Comptes par assertions, risque inhérent et de contrôle", feeds: ["D7.2", "E300"], href: (id) => `/engagements/${id}/cra` },
  { id: "findings", nameEn: "Misstatement Schedule", nameFr: "Récapitulatif des anomalies", descEn: "Accumulation, projection and evaluation against materiality", descFr: "Accumulation, extrapolation et évaluation au regard du seuil", feeds: ["B5"], href: (id) => `/engagements/${id}/findings` },
  { id: "sampling", nameEn: "Sampling", nameFr: "Échantillonnage", descEn: "MUS and attribute sampling — run from the cycle tasks, computed not typed", descFr: "Sondage MUS et par attributs — lancé depuis les tâches de cycle", feeds: ["E100", "E110", "E130"], href: (id) => `/engagements/${id}/phase/execution` },
  { id: "confirmations", nameEn: "Circularisation", nameFr: "Circularisation", descEn: "Positive and negative requests, dispatch, replies and exceptions", descFr: "Demandes positives et négatives, envois, réponses et exceptions", feeds: ["E100", "E170", "B9"], href: (id) => `/engagements/${id}/confirmations` },
  { id: "independence", nameEn: "Independence Campaign", nameFr: "Campagne d'indépendance", descEn: "Issue the declaration to the whole team and manage the responses", descFr: "Adresser la déclaration à l'équipe et suivre les réponses", feeds: ["D3.2", "B2"], href: (id) => `/engagements/${id}/tools/independence` },
];

export default async function ToolsPage(props: { params: Promise<{ id: string }> }) {
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

      {/* back to the dashboard + the four phases — nothing else */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/engagements/${id}/dashboard`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour au tableau de bord" : "Back to dashboard"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="tools-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Outils" : "Tools"}
        </h1>
        <nav className="ml-auto flex flex-wrap items-center gap-1.5" data-testid="tools-phase-links">
          {SECTION_ORDER.map((key) => (
            <Link
              key={key}
              href={`/engagements/${id}/phase/${key}`}
              className="rounded-full border border-line px-3 py-1 text-[11.5px] font-semibold text-ink-soft transition hover:border-emerald-600 hover:text-emerald-700"
            >
              {sectionLabel(key, locale)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="tool-tiles">
        {TILES.map((tile) => (
          <Link
            key={tile.id}
            href={tile.href(id)}
            data-testid={`tool-${tile.id}`}
            className="group flex flex-col gap-1.5 rounded-[var(--radius-atlas)] border border-glass-border bg-surface px-4 py-3 shadow-atlas-sm backdrop-blur-xl transition hover:border-emerald-600/50 hover:shadow-atlas"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[13.5px] font-bold text-ink group-hover:text-emerald-800 dark:group-hover:text-emerald-300">
                {fr ? tile.nameFr : tile.nameEn}
              </span>
              <span className="text-muted transition group-hover:translate-x-0.5" aria-hidden>›</span>
            </span>
            <span className="text-[11.5px] leading-snug text-muted">{fr ? tile.descFr : tile.descEn}</span>
            <span className="mt-auto flex flex-wrap items-center gap-1 pt-1">
              {tile.feeds.map((code) => {
                const task = byCode.get(code);
                return (
                  <span
                    key={code}
                    className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    title={task ? (fr ? task.titleFr : task.titleEn) : code}
                  >
                    {code}
                  </span>
                );
              })}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
