import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { deleteTimeAction, logTimeAction } from "@/app/actions/time";
import { AppNav } from "@/components/AppNav";
import { NavLink } from "@/components/NavLink";
import { Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { budgetVsActual, listMyTime } from "@/lib/time";

export default async function TimePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tt = t.time;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [entries, ba] = await Promise.all([listMyTime(id), budgetVsActual(id)]);

  const myTotal = entries.reduce((s, e) => s + Number(e.hours), 0);
  const totBudget = ba.reduce((s, r) => s + r.budget, 0);
  const totActual = ba.reduce((s, r) => s + r.actual, 0);
  const gradeName = (g: string) =>
    g === "unassigned" ? tt.unassigned : ((t.users.roles as Record<string, string>)[g] ?? g);

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const label = "flex flex-col gap-1 text-sm text-ink-soft";

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-4">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div>
        <NavLink
          href={`/engagements/${id}/dashboard`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          testId="back-to-dashboard"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
          {t.dashboard.backToDashboard}
        </NavLink>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">{tt.title}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">{tt.subtitle}</p>
      </div>

      {error ? (
        <p data-testid="time-error" className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-[var(--color-rose-soft)] px-4 py-3 text-sm text-rose">
          {(tt.errors as Record<string, string>)[error] ?? error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel flush className="flex min-w-0 flex-col">
          <div className="border-b border-line px-5 py-3.5">
            <PanelHeader title={tt.myTime} right={<span className="text-xs font-semibold text-muted tnum">{myTotal.toFixed(1)}h</span>} />
          </div>
          <div className="p-5">
            <form action={logTimeAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <input type="hidden" name="engagementId" value={id} />
              <label className={label}>{tt.date}<input name="date" type="date" required defaultValue={engagement.periodEnd} className={input} data-testid="time-date" /></label>
              <label className={label}>{tt.hours}<input name="hours" type="number" min="0.25" max="24" step="0.25" required className={input} data-testid="time-hours" /></label>
              <label className={`${label} col-span-2 sm:col-span-1`}>{tt.note}<input name="note" className={input} data-testid="time-note" /></label>
              <button type="submit" className={`self-end ${btnPrimary}`} data-testid="time-submit">{tt.logButton}</button>
            </form>

            {entries.length > 0 ? (
              <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm" data-testid="time-entries">
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr><th className="py-2 font-semibold">{tt.date}</th><th className="py-2 font-semibold">{tt.task}</th><th className="py-2 font-semibold">{tt.note}</th><th className="py-2 text-right font-semibold">{tt.hours}</th><th /></tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-line">
                      <td className="py-2 text-ink-soft tnum">{e.date}</td>
                      <td className="py-2 font-mono text-xs text-ink-soft">{e.code ?? "—"}</td>
                      <td className="py-2 text-ink-soft">{e.note ?? ""}</td>
                      <td className="py-2 text-right font-semibold text-ink tnum">{Number(e.hours).toFixed(2)}</td>
                      <td className="py-2 text-right">
                        <form action={deleteTimeAction}>
                          <input type="hidden" name="engagementId" value={id} />
                          <input type="hidden" name="id" value={e.id} />
                          <button type="submit" className="text-xs font-semibold text-rose hover:underline">{tt.remove}</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted">{tt.empty}</p>
            )}
          </div>
        </Panel>

        <Panel flush className="flex min-w-0 flex-col">
          <div className="border-b border-line px-5 py-3.5">
            <PanelHeader title={tt.budgetVsActual} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="budget-actual">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-5 py-3 font-semibold">{tt.grade}</th><th className="px-5 py-3 text-right font-semibold">{tt.budget}</th><th className="px-5 py-3 text-right font-semibold">{tt.actual}</th><th className="px-5 py-3 text-right font-semibold">{tt.variance}</th></tr>
              </thead>
              <tbody>
                {ba.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-6 text-center text-sm text-muted">{tt.noBudget}</td></tr>
                ) : (
                  ba.map((r) => {
                    const v = r.actual - r.budget;
                    return (
                      <tr key={r.grade} className="border-t border-line">
                        <td className="px-5 py-2.5 text-ink">{gradeName(r.grade)}</td>
                        <td className="px-5 py-2.5 text-right text-ink-soft tnum">{r.budget.toFixed(1)}</td>
                        <td className="px-5 py-2.5 text-right text-ink-soft tnum">{r.actual.toFixed(1)}</td>
                        <td className={`px-5 py-2.5 text-right font-semibold tnum ${v > 0 ? "text-rose" : "text-emerald-700 dark:text-emerald-400"}`}>{v > 0 ? "+" : ""}{v.toFixed(1)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {ba.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-line-strong font-semibold">
                    <td className="px-5 py-2.5 text-ink">{tt.total}</td>
                    <td className="px-5 py-2.5 text-right text-ink tnum">{totBudget.toFixed(1)}</td>
                    <td className="px-5 py-2.5 text-right text-ink tnum">{totActual.toFixed(1)}</td>
                    <td className={`px-5 py-2.5 text-right tnum ${totActual - totBudget > 0 ? "text-rose" : "text-emerald-700 dark:text-emerald-400"}`}>{totActual - totBudget > 0 ? "+" : ""}{(totActual - totBudget).toFixed(1)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </Panel>
      </div>
    </main>
  );
}
