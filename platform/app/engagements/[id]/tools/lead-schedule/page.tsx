import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { ApSchedules } from "@/components/ApSchedules";
import { apComments, apLeadSchedules } from "@/lib/analytical-procedures";
import { getEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Lead Schedule · AuditISA" };

/**
 * The Lead Schedule tool: the index-named schedules exactly as the analytical
 * procedures present them, plus the Excel extract — one Introduction tab, then
 * one tab per index with the full on-screen detail.
 */
export default async function LeadSchedulePage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [schedules, comments] = await Promise.all([apLeadSchedules(id), apComments(id)]);

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour aux outils" : "Back to tools"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="leadschedule-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Feuilles maîtresses" : "Lead Schedule"}
        </h1>
        {schedules.length > 0 ? (
          <a
            href={`/api/engagements/${id}/lead-schedule-export`}
            className="ml-auto rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-800"
            data-testid="leadschedule-export"
          >
            {fr ? "Extraire vers Excel" : "Extract to Excel"}
          </a>
        ) : null}
      </div>

      {schedules.length === 0 ? (
        <p className="mt-6 text-sm text-muted" data-testid="leadschedule-empty">
          {fr
            ? "Aucune balance pré-audit valide — importer la balance dans l'Analyseur de balance."
            : "No valid pre-audit trial balance yet — import one in the Trial Balance Analyzer."}
        </p>
      ) : (
        <div className="mt-4">
          <ApSchedules
            engagementId={id}
            schedules={schedules}
            comments={comments}
            locale={fr ? "fr" : "en"}
            showOverall={false}
          />
        </div>
      )}
    </main>
  );
}
