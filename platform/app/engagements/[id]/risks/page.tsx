import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  dismissPotentialAction,
  mapRiskAction,
  promotePotentialAction,
  rebutRiskAction,
  updateRiskAction,
} from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner } from "@/components/GatesPanel";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { ASSERTIONS, listPotentialRisks, listRisks } from "@/lib/risks";

export default async function RisksPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tr = t.planning.risks;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [potential, risks, items] = await Promise.all([
    listPotentialRisks(id),
    listRisks(id),
    listFileItems(id),
  ]);
  const eSections = items.filter((item) => item.section === "E");

  const input =
    "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const btn =
    "rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {engagement.clientName} — {engagement.fiscalYear} · {t.planning.risksTitle}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="risks" />
      <ErrorBanner error={error} locale={locale} />

      <section className="mt-6 rounded-xl border border-slate-200 p-5 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{tr.potential}</h2>
        {potential.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{tr.empty}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" data-testid="potential-risks">
            {potential.map((risk) => (
              <li key={risk.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <p className="text-slate-900 dark:text-slate-100">
                  {risk.description}
                  <span className="ml-2 text-xs text-slate-500">
                    {tr.source}: {risk.sourceCode} · {risk.raisedByName} · {risk.status}
                  </span>
                </p>
                {risk.status === "open" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <form action={promotePotentialAction.bind(null, id, risk.id)}>
                      <button type="submit" className={btn} data-testid={`promote-${risk.id}`}>
                        {tr.promote}
                      </button>
                    </form>
                    <form action={dismissPotentialAction.bind(null, id, risk.id)} className="flex items-center gap-2">
                      <input name="rationale" placeholder={tr.dismissRationale} required className={input} />
                      <button type="submit" className={btn}>
                        {tr.dismiss}
                      </button>
                    </form>
                  </div>
                ) : risk.dismissalRationale ? (
                  <p className="mt-1 text-xs text-slate-500">{risk.dismissalRationale}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 p-5 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{tr.register}</h2>
        <ul className="mt-3 flex flex-col gap-3" data-testid="risk-register">
          {risks.map((risk) => (
            <li key={risk.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800" data-testid={`risk-${risk.presumedType ?? risk.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {risk.description}
                  {risk.presumedType ? (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {tr.presumed}
                    </span>
                  ) : null}
                  {risk.significant && !risk.rebutted ? (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                      {tr.significant}
                    </span>
                  ) : null}
                  {risk.rebutted ? (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                      {tr.rebutted}
                    </span>
                  ) : null}
                </p>
                <span className="text-xs text-slate-500">
                  {tr.rating}: <b className="uppercase">{risk.rating}</b> · {tr.statuses[risk.status]} ·{" "}
                  {risk.linkedStepCount} {tr.linkedSteps}
                </span>
              </div>
              {risk.sections.length > 0 ? (
                <p className="mt-1 text-xs text-slate-500">
                  {risk.sections.map((section) => `${section.code} [${section.assertions.join("")}]`).join(" · ")}
                </p>
              ) : null}

              {!risk.rebutted ? (
                <div className="mt-3 flex flex-wrap items-end gap-4">
                  <form action={updateRiskAction.bind(null, id, risk.id)} className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col text-xs text-slate-500">
                      {tr.likelihood}
                      <select name="likelihood" defaultValue={risk.likelihood} className={input}>
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                      </select>
                    </label>
                    <label className="flex flex-col text-xs text-slate-500">
                      {tr.magnitude}
                      <select name="magnitude" defaultValue={risk.magnitude} className={input}>
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1 text-xs text-slate-500">
                      <input type="checkbox" name="significant" defaultChecked={risk.significant} />
                      {tr.significant}
                    </label>
                    <button type="submit" className={btn}>
                      {tr.update}
                    </button>
                  </form>

                  <form action={mapRiskAction.bind(null, id, risk.id)} className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col text-xs text-slate-500">
                      {tr.mapSection}
                      <select name="fileItemId" className={input} data-testid={`map-section-${risk.id}`}>
                        {eSections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.code}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      {ASSERTIONS.map((assertion) => (
                        <label key={assertion} className="flex items-center gap-0.5">
                          <input type="checkbox" name="assertions" value={assertion} />
                          {assertion}
                        </label>
                      ))}
                    </span>
                    <button type="submit" className={btn}>
                      {tr.mapSection}
                    </button>
                  </form>

                  {risk.presumedType === "revenue_fraud" ? (
                    <form action={rebutRiskAction.bind(null, id, risk.id)} className="flex items-end gap-2">
                      <input name="justification" placeholder={tr.rebutJustification} required className={input} />
                      <button type="submit" className={btn}>
                        {tr.rebut}
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        <Link href={`/engagements/${id}/forms/D7.1`} className="text-emerald-700 hover:underline dark:text-emerald-400">
          D7.1
        </Link>
      </p>
    </main>
  );
}
