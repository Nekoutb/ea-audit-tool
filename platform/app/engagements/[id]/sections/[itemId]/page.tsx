import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { addStepAction, generateProgramAction, linkRiskStepAction } from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner } from "@/components/GatesPanel";
import { withTenant } from "@/lib/db";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listProgramSteps, sectionCoverage } from "@/lib/programs";
import { ASSERTIONS, risksForSection } from "@/lib/risks";
import { requireTenant } from "@/lib/tenant";

async function sectionInfo(itemId: string) {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      engagement_id: string;
      code: string;
      title_en: string;
      title_fr: string;
      material: boolean;
    }>(
      "SELECT id, engagement_id, code, title_en, title_fr, material FROM file_item WHERE id = $1",
      [itemId],
    );
    return result.rows[0] ?? null;
  });
}

export default async function SectionPage(props: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id, itemId } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const ts = t.planning.sections;

  const [engagement, section] = await Promise.all([getEngagement(id), sectionInfo(itemId)]);
  if (!engagement || !section || section.engagement_id !== id) notFound();

  const [risks, steps, coverage] = await Promise.all([
    risksForSection(itemId),
    listProgramSteps(itemId),
    sectionCoverage(itemId),
  ]);

  const input =
    "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const btn =
    "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
  const card = "mt-6 rounded-xl border border-slate-200 p-5 dark:border-slate-800";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <AppNav locale={locale} />
      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {section.code} — {locale === "fr" ? section.title_fr : section.title_en}
        </h1>
        {section.material ? (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {ts.material}
          </span>
        ) : null}
      </div>
      <EngagementTabs engagementId={id} locale={locale} active="planning" />
      <ErrorBanner error={error} locale={locale} />

      {/* Linked risks pinned at the top of the section (spec §8.1) */}
      <section className={`${card} border-l-4 border-l-red-400 dark:border-l-red-700`}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{ts.linkedRisks}</h2>
        {risks.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{ts.noRisks}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" data-testid="section-risks">
            {risks.map((risk) => (
              <li key={risk.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={
                    risk.significant
                      ? "rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300"
                      : "rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }
                >
                  {risk.rating.toUpperCase()}
                  {risk.significant ? ` · ${t.planning.risks.significant}` : ""}
                </span>
                <span className="text-slate-900 dark:text-slate-100">{risk.description}</span>
                <span className="font-mono text-xs text-slate-500">[{risk.assertions.join("")}]</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{ts.program}</h2>
          {steps.length === 0 ? (
            <form action={generateProgramAction.bind(null, id, itemId)}>
              <button type="submit" className={btn} data-testid="generate-program">
                {ts.generateProgram}
              </button>
            </form>
          ) : null}
        </div>
        {steps.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm" data-testid="program-table">
              <tbody>
                {steps.map((step) => (
                  <tr key={step.id} className="border-t border-slate-200 first:border-t-0 dark:border-slate-800">
                    <td className="w-14 px-3 py-2 font-mono text-xs text-slate-500">{step.seq}</td>
                    <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                      {step.description}
                      {step.source === "risk_extension" ? (
                        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                          {ts.sourceLabels.risk_extension}
                        </span>
                      ) : null}
                    </td>
                    <td className="w-20 px-3 py-2 font-mono text-xs text-slate-500">
                      [{step.assertions.join("")}]
                    </td>
                    <td className="w-24 px-3 py-2 text-xs text-slate-500">
                      {step.linkedRiskIds.length > 0 ? `⚑ ${step.linkedRiskIds.length}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <form action={addStepAction.bind(null, id, itemId)} className="mt-3 flex flex-wrap items-end gap-2">
          <input
            name="description"
            placeholder={ts.stepDescription}
            required
            className={`${input} w-96 max-w-full`}
            data-testid="custom-step-description"
          />
          <span className="flex items-center gap-1 text-xs text-slate-500">
            {ASSERTIONS.map((assertion) => (
              <label key={assertion} className="flex items-center gap-0.5">
                <input type="checkbox" name="assertions" value={assertion} />
                {assertion}
              </label>
            ))}
          </span>
          <button type="submit" className={btn} data-testid="add-custom-step">
            {ts.addStep}
          </button>
        </form>

        {risks.length > 0 && steps.length > 0 ? (
          <form action={linkRiskStepAction.bind(null, id, itemId)} className="mt-4 flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs text-slate-500">
              {ts.risk}
              <select name="riskId" className={input} data-testid="link-risk">
                {risks.map((risk) => (
                  <option key={risk.id} value={risk.id}>
                    {risk.description.slice(0, 60)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs text-slate-500">
              {ts.program}
              <select name="stepId" className={input} data-testid="link-step">
                {steps.map((step) => (
                  <option key={step.id} value={step.id}>
                    {step.seq} — {step.description.slice(0, 50)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={btn} data-testid="link-risk-step">
              {ts.linkStep}
            </button>
          </form>
        ) : null}
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{ts.coverage}</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm" data-testid="coverage-table">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">{ts.risk}</th>
                <th className="px-4 py-2">{t.planning.risks.assertions}</th>
                <th className="px-4 py-2">{ts.covered}</th>
                <th className="px-4 py-2">{t.planning.risks.linkedSteps}</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((row) => (
                <tr key={row.riskId} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-800 dark:text-slate-200">
                    {row.riskDescription}
                    {row.significant && row.linkedSteps === 0 ? (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300" data-testid="unlinked-significant">
                        ✗
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{row.assertions.join(" ")}</td>
                  <td className="px-4 py-2 font-mono text-xs">{row.coveredAssertions.join(" ")}</td>
                  <td className="px-4 py-2">{row.linkedSteps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
