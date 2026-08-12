import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { saveApCommentsAction } from "@/app/actions/data";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { SubmitButton } from "@/components/SubmitButton";
import { apComments, apLeadSchedules } from "@/lib/analytical-procedures";
import { getEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Analytical Procedures · AuditISA" };

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

// The Excel look: hard grid lines, dense rows, bold header, double-ruled total.
const CELL = "border border-[color:var(--line-strong,#c9c9c9)] px-2.5 py-1 text-[12px]";
const NUM = `${CELL} text-right tnum`;

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

  const commentInput =
    "w-full min-w-[180px] bg-transparent px-1 py-0.5 text-[12px] text-ink outline-none placeholder:text-muted focus:bg-[var(--color-warn-soft)]";

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
        <div className="mt-4 flex flex-col gap-5" data-testid="ap-schedules">
          {schedules.map((schedule) => (
            <form
              key={schedule.def.code}
              action={saveApCommentsAction.bind(null, id, schedule.def.code)}
              data-testid={`ap-${schedule.def.code}`}
              className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface p-3 shadow-atlas-sm"
            >
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-[14px] font-extrabold text-emerald-800 dark:text-emerald-300">
                  {schedule.def.code}
                </span>
                <span className="text-[14px] font-bold text-ink">{schedule.def.labelEn}</span>
                <span className="text-[11px] text-muted">
                  {schedule.def.accountType} · {schedule.def.accountClass}
                </span>
                <SubmitButton
                  className="ml-auto rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-1 text-[11.5px] font-medium text-ink-soft hover:bg-surface-2"
                  testId={`ap-save-${schedule.def.code}`}
                >
                  {fr ? "Enregistrer les commentaires" : "Save commentary"}
                </SubmitButton>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-white dark:bg-surface" data-testid={`ap-grid-${schedule.def.code}`}>
                  <thead>
                    <tr className="bg-surface-2 font-bold text-ink">
                      <th className={`${CELL} text-left`}>{fr ? "Compte" : "Account"}</th>
                      <th className={`${CELL} text-left`}>{fr ? "Intitulé" : "Description"}</th>
                      <th className={NUM}>{fr ? "Solde de clôture" : "Closing balance"}</th>
                      <th className={NUM}>{fr ? "Solde antérieur" : "Prior year balance"}</th>
                      <th className={NUM}>{fr ? "Mouvement" : "Movement"}</th>
                      <th className={NUM}>{fr ? "Écart %" : "Variance %"}</th>
                      <th className={`${CELL} text-left`}>{fr ? "Commentaire" : "Commentary"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.accounts.map((row) => (
                      <tr key={row.account}>
                        <td className={`${CELL} font-mono`}>{row.account}</td>
                        <td className={CELL}>{row.name}</td>
                        <td className={NUM}>{fmt(row.closing)}</td>
                        <td className={NUM}>{fmt(row.prior)}</td>
                        <td className={`${NUM} ${row.movement < 0 ? "text-rose" : ""}`}>{fmt(row.movement)}</td>
                        <td className={NUM}>
                          {row.variancePct !== null ? `${row.variancePct >= 0 ? "+" : ""}${row.variancePct}%` : "—"}
                        </td>
                        <td className={`${CELL} p-0`}>
                          <input
                            name={`c_${row.account}`}
                            defaultValue={comments[`${schedule.def.code}|${row.account}`] ?? ""}
                            placeholder="—"
                            className={commentInput}
                            data-testid={`ap-comment-${schedule.def.code}-${row.account}`}
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-bold" style={{ borderTopStyle: "double" }}>
                      <td className={`${CELL} font-mono`}>{fr ? "TOTAL" : "TOTAL"}</td>
                      <td className={CELL}>
                        {schedule.def.code} — {schedule.def.labelEn}
                      </td>
                      <td className={NUM}>{fmt(schedule.closing)}</td>
                      <td className={NUM}>{fmt(schedule.prior)}</td>
                      <td className={`${NUM} ${schedule.movement < 0 ? "text-rose" : ""}`}>{fmt(schedule.movement)}</td>
                      <td className={NUM}>
                        {schedule.variancePct !== null ? `${schedule.variancePct >= 0 ? "+" : ""}${schedule.variancePct}%` : "—"}
                      </td>
                      <td className={`${CELL} p-0`}>
                        <input
                          name="c_total"
                          defaultValue={comments[`${schedule.def.code}|total`] ?? ""}
                          placeholder={fr ? "Commentaire sur le total…" : "Comment on the total…"}
                          className={`${commentInput} font-normal`}
                          data-testid={`ap-comment-${schedule.def.code}-total`}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </form>
          ))}
        </div>
      )}
    </main>
  );
}
