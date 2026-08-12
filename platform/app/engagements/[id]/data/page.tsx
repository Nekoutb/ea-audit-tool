import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { TbAnalyzer } from "@/components/TbAnalyzer";
import { Chip, Panel } from "@/components/ui/atlas";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { leadSchedules, listTbTimings } from "@/lib/tb";

export const metadata = { title: "Trial Balance Analyzer · AuditISA" };

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

/**
 * The Trial Balance Analyzer: upload to the Pre-audit or Post-audit slot
 * (each upload replaces that slot), confirm columns and classes, and read the
 * lead schedules in the workbook layout — index-named, with sub-totals,
 * current year, prior year and the variance.
 */
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
  const fr = locale === "fr";

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [timings, schedules] = await Promise.all([listTbTimings(id), leadSchedules(id)]);
  const slotOf = (timing: "pre_audit" | "post_audit") => timings.find((x) => x.timing === timing);

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools/data-analytics`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour à l'analyse de données" : "Back to Data Analytics"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="tb-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Analyseur de balance générale" : "Trial Balance Analyzer"}
        </h1>
      </div>
      <ErrorBanner error={error} locale={locale} />

      <Panel className="mt-4">
        <TbAnalyzer engagementId={id} locale={fr ? "fr" : "en"} messages={t.planning} />

        {/* the two TB slots — one file each, replaced on re-upload */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="tb-timings">
          {(["pre_audit", "post_audit"] as const).map((timing) => {
            const slot = slotOf(timing);
            return (
              <div key={timing} className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2/50 px-4 py-3" data-testid={`tb-slot-${timing}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                    {timing === "pre_audit" ? (fr ? "TB pré-audit" : "Pre-audit TB") : (fr ? "TB post-audit" : "Post-audit TB")}
                  </span>
                  {slot ? (
                    <Chip tone={slot.status === "valid" ? "good" : slot.status === "invalid" ? "rose" : "warn"}>
                      {slot.status}
                    </Chip>
                  ) : null}
                </div>
                {slot ? (
                  <p className="mt-1.5 text-[12.5px] text-ink-soft">
                    {slot.filename}
                    <span className="px-1.5 text-line-strong">·</span>
                    <span className="tnum">{slot.rowCount} {fr ? "lignes" : "rows"}</span>
                    <span className="px-1.5 text-line-strong">·</span>
                    <span className="tnum">{slot.createdAt}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-[12.5px] text-muted">
                    {fr ? "Aucun fichier — importer ci-dessus." : "No file yet — upload above."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* the lead schedules, workbook layout: index → sub-totals → variance */}
      <Panel className="mt-4">
        <h2 className="text-[12px] font-extrabold uppercase tracking-[0.07em] text-muted">
          {fr ? "Feuilles maîtresses" : "Lead schedules"}
        </h2>
        {schedules.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-muted" data-testid="leadschedules-empty">
            {fr
              ? "Aucune balance pré-audit valide — les feuilles maîtresses apparaissent après ingestion."
              : "No valid pre-audit TB yet — the lead schedules appear once one is ingested."}
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2" data-testid="leadschedules">
            {schedules.map((schedule) => (
              <details key={schedule.index} className="rounded-[var(--radius-atlas-sm)] border border-line" data-testid={`lead-${schedule.index}`}>
                <summary className="flex cursor-pointer select-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-surface-2">
                  <span className="font-mono text-[13px] font-extrabold text-emerald-800 dark:text-emerald-300">
                    {schedule.index}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
                    {schedule.label}
                  </span>
                  <span className="hidden text-[11px] text-muted md:block">
                    {schedule.accountType} · {schedule.accountClass}
                  </span>
                  <span className="text-[12.5px] font-semibold text-ink tnum">{fmt(schedule.current)}</span>
                  <span
                    className={`text-[11.5px] tnum ${schedule.variance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose"}`}
                  >
                    {schedule.variance >= 0 ? "+" : ""}{fmt(schedule.variance)}
                    {schedule.variancePct !== null ? ` (${schedule.variancePct >= 0 ? "+" : ""}${schedule.variancePct}%)` : ""}
                  </span>
                </summary>
                <div className="overflow-x-auto border-t border-line">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="bg-surface-2 text-left text-muted">
                        <th className="px-4 py-1.5">{fr ? "Sous-total" : "Sub-total"}</th>
                        <th className="px-4 py-1.5 text-right">{fr ? "Exercice courant" : "Current year"}</th>
                        <th className="px-4 py-1.5 text-right">{fr ? "Exercice antérieur" : "Prior year"}</th>
                        <th className="px-4 py-1.5 text-right">{fr ? "Écart" : "Variance"}</th>
                        <th className="px-4 py-1.5 text-right">{fr ? "Écart %" : "Variance %"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.subtotals.map((sub) => (
                        <tr key={sub.code} className="border-t border-line">
                          <td className="px-4 py-1.5">
                            <span className="font-mono text-[11px] font-bold text-muted">{sub.code}</span>
                            <span className="ml-2 text-ink-soft">{sub.label}</span>
                          </td>
                          <td className="px-4 py-1.5 text-right tnum">{fmt(sub.current)}</td>
                          <td className="px-4 py-1.5 text-right tnum">{fmt(sub.prior)}</td>
                          <td className={`px-4 py-1.5 text-right tnum ${sub.variance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose"}`}>
                            {sub.variance >= 0 ? "+" : ""}{fmt(sub.variance)}
                          </td>
                          <td className="px-4 py-1.5 text-right tnum text-muted">
                            {sub.variancePct !== null ? `${sub.variancePct >= 0 ? "+" : ""}${sub.variancePct}%` : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-line bg-surface-2/60 font-semibold">
                        <td className="px-4 py-1.5 text-ink">{fr ? "Total" : "Total"} {schedule.index}</td>
                        <td className="px-4 py-1.5 text-right tnum">{fmt(schedule.current)}</td>
                        <td className="px-4 py-1.5 text-right tnum">{fmt(schedule.prior)}</td>
                        <td className={`px-4 py-1.5 text-right tnum ${schedule.variance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose"}`}>
                          {schedule.variance >= 0 ? "+" : ""}{fmt(schedule.variance)}
                        </td>
                        <td className="px-4 py-1.5 text-right tnum text-muted">
                          {schedule.variancePct !== null ? `${schedule.variancePct >= 0 ? "+" : ""}${schedule.variancePct}%` : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        )}
      </Panel>
    </main>
  );
}
