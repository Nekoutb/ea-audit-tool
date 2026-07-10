import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { clearFindingAction, setCorrectedAction } from "@/app/actions/execution";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner } from "@/components/GatesPanel";
import { getEngagement } from "@/lib/engagements";
import { evaluateB5, listFindings } from "@/lib/execution";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function FindingsPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tf = t.planning.findings;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [findings, b5] = await Promise.all([listFindings(id), evaluateB5(id)]);

  const btn =
    "rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
  const input =
    "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const card = "mt-6 rounded-xl border border-slate-200 p-5 dark:border-slate-800";

  const renderFindings = (route: "b4" | "c1", title: string) => {
    const list = findings.filter((finding) => finding.route === route);
    return (
      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{tf.empty}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" data-testid={`${route}-list`}>
            {list.map((finding) => (
              <li key={finding.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <p className="text-slate-900 dark:text-slate-100">
                  {finding.title}
                  {finding.sectionCode ? (
                    <span className="ml-2 font-mono text-xs text-slate-500">[{finding.sectionCode}]</span>
                  ) : null}
                  <span
                    className={
                      finding.status === "open"
                        ? "ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    }
                  >
                    {finding.status === "open" ? tf.openLabel : tf.clearedLabel}
                  </span>
                </p>
                {finding.detail ? <p className="mt-1 text-slate-600 dark:text-slate-400">{finding.detail}</p> : null}
                {finding.response ? (
                  <p className="mt-1 text-xs text-slate-500">{tf.response}: {finding.response}</p>
                ) : null}
                {finding.status === "open" ? (
                  <form
                    action={clearFindingAction.bind(null, id, finding.id)}
                    className="mt-2 flex flex-wrap items-center gap-2"
                  >
                    <input name="response" required placeholder={tf.response} className={input} />
                    <button type="submit" className={btn} data-testid={`clear-finding-${finding.id}`}>
                      {tf.clear}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {engagement.clientName} — {engagement.fiscalYear} · {tf.title}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="findings" />
      <ErrorBanner error={error} locale={locale} />

      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{tf.b5}</h2>
        <div className="mt-3 flex flex-wrap gap-4 text-sm" data-testid="b5-totals">
          <span>
            {tf.uncorrected}: <b>{formatFCFA(b5.uncorrectedTotal)}</b>
          </span>
          <span>
            {tf.corrected}: {formatFCFA(b5.correctedTotal)}
          </span>
          <span>
            {tf.vsMateriality}: {b5.finalMateriality !== null ? formatFCFA(b5.finalMateriality) : "—"}
          </span>
          <span
            data-testid="b5-verdict"
            className={
              b5.exceedsMateriality
                ? "font-semibold text-red-600 dark:text-red-400"
                : "text-emerald-700 dark:text-emerald-400"
            }
          >
            {b5.exceedsMateriality ? tf.exceeds : tf.within}
          </span>
          {b5.trivialCount > 0 ? (
            <span className="text-slate-500">
              {b5.trivialCount} {tf.trivialNote}
            </span>
          ) : null}
        </div>
        {b5.items.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm" data-testid="b5-table">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">{tf.section}</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">{tf.amountCol}</th>
                  <th className="px-4 py-2">{tf.typeCol}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {b5.items.map((item) => (
                  <tr key={item.id} className={`border-t border-slate-200 dark:border-slate-800 ${item.trivial ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2 font-mono text-xs">{item.sectionCode ?? "—"}</td>
                    <td className="px-4 py-2">
                      {item.description}
                      {item.accounts ? <span className="ml-1 text-xs text-slate-500">({item.accounts})</span> : null}
                      {item.trivial ? <span className="ml-1 text-xs text-slate-500">· trivial</span> : null}
                    </td>
                    <td className="px-4 py-2 text-right">{formatFCFA(item.amount)}</td>
                    <td className="px-4 py-2 text-xs">{t.planning.execution.mtypes[item.mtype as keyof typeof t.planning.execution.mtypes]}</td>
                    <td className="px-4 py-2 text-right">
                      {!item.trivial ? (
                        <form action={setCorrectedAction.bind(null, id, item.id, !item.corrected)}>
                          <button type="submit" className={btn} data-testid={`toggle-corrected-${item.id}`}>
                            {item.corrected ? tf.markUncorrected : tf.markCorrected}
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {renderFindings("b4", tf.b4)}
      {renderFindings("c1", tf.c1)}
    </main>
  );
}
