import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  completeStepAction,
  recordControlTestAction,
  reviewConclusionAction,
  routeFindingAction,
  saveConclusionAction,
} from "@/app/actions/execution";
import {
  evaluateSamplingAction,
  runAnalyticAction,
  runJeTestingAction,
  runReconAction,
  runSamplingAction,
} from "@/app/actions/engines";
import { addStepAction, generateProgramAction, linkRiskStepAction } from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner } from "@/components/GatesPanel";
import { withTenant } from "@/lib/db";
import { getEngagement } from "@/lib/engagements";
import { listRuns } from "@/lib/engines";
import { getSectionConclusion, listControlTests } from "@/lib/execution";
import { listDatasets } from "@/lib/subledgers";
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

  const [risks, steps, coverage, controlTests, conclusion, datasets, runs] = await Promise.all([
    risksForSection(itemId),
    listProgramSteps(itemId),
    sectionCoverage(itemId),
    listControlTests(itemId),
    getSectionConclusion(itemId),
    listDatasets(id),
    listRuns(itemId),
  ]);
  const te = t.planning.execution;
  const tg = t.planning.engines;

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
                    <td className="px-3 py-2">
                      {step.status === "planned" ? (
                        <form
                          action={completeStepAction.bind(null, id, itemId, step.id)}
                          className="flex items-center gap-1.5"
                        >
                          <input
                            name="conclusion"
                            required
                            placeholder={te.conclusionPlaceholder}
                            className={input}
                            data-testid={`step-conclusion-${step.seq}`}
                          />
                          <button type="submit" className={btn} data-testid={`complete-step-${step.seq}`}>
                            {te.complete}
                          </button>
                        </form>
                      ) : (
                        <span
                          className={
                            step.status === "complete"
                              ? "rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800"
                          }
                          data-testid={`step-status-${step.seq}`}
                        >
                          {step.status === "complete" ? "✓" : "N/A"}
                        </span>
                      )}
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

      {/* 4.4 matter arising: route to exactly one destination */}
      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {te.matterArising}
        </h2>
        <form
          action={routeFindingAction.bind(null, id, itemId)}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <label className="flex flex-col text-xs text-slate-500">
            {te.routeTo}
            <select name="route" className={input} data-testid="finding-route">
              <option value="b4">{te.routes.b4}</option>
              <option value="c1">{te.routes.c1}</option>
              <option value="b5">{te.routes.b5}</option>
              <option value="revise">{te.routes.revise}</option>
            </select>
          </label>
          <input name="title" required placeholder={te.titleField} className={`${input} w-72`} data-testid="finding-title" />
          <input name="detail" placeholder={te.detailField} className={input} />
          <input name="amount" type="number" placeholder={te.amount} className={input} data-testid="finding-amount" />
          <input name="accounts" placeholder={te.accountsField} className={input} />
          <label className="flex flex-col text-xs text-slate-500">
            {te.mtype}
            <select name="mtype" className={input}>
              {(["factual", "judgmental", "projected", "classification", "disclosure"] as const).map((mtype) => (
                <option key={mtype} value={mtype}>
                  {te.mtypes[mtype]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            <input type="checkbox" name="trivialConfirmed" data-testid="trivial-confirm" /> {te.trivialConfirm}
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            <input type="checkbox" name="significant" /> {te.significantFlag}
          </label>
          <button type="submit" className={btn} data-testid="route-finding">
            {te.raise}
          </button>
        </form>
      </section>

      {/* 4.7 control tests */}
      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{te.controls}</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm" data-testid="control-tests">
          {controlTests.map((test) => (
            <li key={test.id} className="rounded border border-slate-200 px-3 py-1.5 dark:border-slate-800">
              {test.description} —{" "}
              {test.result === "effective" ? (
                <span className="text-emerald-700 dark:text-emerald-400">{te.results.effective}</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">
                  {te.results.deviation} → {te.decisions[test.deviationDecision as keyof typeof te.decisions]}
                </span>
              )}
            </li>
          ))}
        </ul>
        <form
          action={recordControlTestAction.bind(null, id, itemId)}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <input name="description" required placeholder={te.controlDescription} className={`${input} w-72`} data-testid="control-description" />
          <label className="flex flex-col text-xs text-slate-500">
            {te.result}
            <select name="result" className={input} data-testid="control-result">
              <option value="effective">{te.results.effective}</option>
              <option value="deviation">{te.results.deviation}</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            {te.deviationDecision}
            <select name="deviationDecision" className={input} data-testid="control-decision">
              <option value="" />
              <option value="extend">{te.decisions.extend}</option>
              <option value="abandon">{te.decisions.abandon}</option>
              <option value="deficiency">{te.decisions.deficiency}</option>
            </select>
          </label>
          <button type="submit" className={btn} data-testid="record-control">
            {te.record}
          </button>
        </form>
      </section>

      {/* 5.x automation engines */}
      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{tg.title}</h2>

        {runs.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1 text-sm" data-testid="engine-runs">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-1.5 dark:border-slate-800">
                <span className="font-mono text-xs">{run.engine}</span>
                <span className="text-xs text-slate-500">{JSON.stringify(run.summary).slice(0, 120)}</span>
                <span className="flex items-center gap-2">
                  {run.engine === "sampling" && !("projected" in run.summary) ? (
                    <form action={evaluateSamplingAction.bind(null, id, itemId, run.id)} className="flex items-center gap-1">
                      <input name="misstatement" type="number" placeholder={tg.misstatementFound} className={input} data-testid={`evaluate-input-${run.id}`} />
                      <button type="submit" className={btn} data-testid={`evaluate-run-${run.id}`}>
                        {tg.evaluate}
                      </button>
                    </form>
                  ) : null}
                  {run.outputDocumentId ? (
                    <a href={`/documents/${run.outputDocumentId}`} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                      {tg.output}
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <form action={runSamplingAction.bind(null, id, itemId)} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tg.sampling}</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <select name="datasetId" required className={input} data-testid="sampling-dataset">
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
              <select name="method" className={input} data-testid="sampling-method">
                {(["random", "systematic", "mus", "criteria"] as const).map((method) => (
                  <option key={method} value={method}>
                    {tg.methods[method]}
                  </option>
                ))}
              </select>
              <input name="sampleSize" type="number" min="1" defaultValue="5" className={input} data-testid="sampling-size" />
              <input name="seed" placeholder={tg.seed} required className={input} data-testid="sampling-seed" />
              <input name="threshold" type="number" placeholder={tg.threshold} className={input} />
              <button type="submit" className={btn} data-testid="run-sampling">
                {tg.run}
              </button>
            </div>
          </form>

          <form action={runReconAction.bind(null, id, itemId)} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tg.recon}</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <select name="datasetId" required className={input} data-testid="recon-dataset">
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
              <input name="staleDays" type="number" placeholder={tg.staleDays} className={input} />
              <input name="periodEnd" type="date" defaultValue={engagement.periodEnd} className={input} />
              <button type="submit" className={btn} data-testid="run-recon">
                {tg.run}
              </button>
            </div>
          </form>

          <form action={runJeTestingAction.bind(null, id, itemId)} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tg.je}</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <select name="datasetId" required className={input} data-testid="je-dataset">
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
              <input name="periodEnd" type="date" defaultValue={engagement.periodEnd} className={input} />
              <input name="largeThreshold" type="number" placeholder={tg.largeThreshold} className={input} />
              <button type="submit" className={btn} data-testid="run-je">
                {tg.run}
              </button>
            </div>
          </form>

          <form action={runAnalyticAction.bind(null, id, itemId)} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tg.analytics}</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <input name="expectation" type="number" placeholder={tg.expectation} required className={input} data-testid="analytic-expectation" />
              <input name="tolerance" type="number" placeholder={tg.tolerance} required className={input} data-testid="analytic-tolerance" />
              <input name="basis" placeholder={tg.basis} required className={input} data-testid="analytic-basis" />
              <button type="submit" className={btn} data-testid="run-analytic">
                {tg.run}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* 4.11 section conclusion + review chain */}
      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {te.conclusionTitle}
        </h2>
        {conclusion?.partnerRequired ? (
          <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-400" data-testid="partner-required">
            {te.partnerRequired}
          </p>
        ) : null}
        {conclusion?.conclusion ? (
          <div className="mt-2 text-sm text-slate-700 dark:text-slate-300" data-testid="conclusion-state">
            <p>{conclusion.conclusion}</p>
            <p className="mt-1 text-xs text-slate-500">
              {te.preparedBy}: {conclusion.preparedByName ?? "—"} · {te.reviewedBy}:{" "}
              {conclusion.reviewedByName ?? "—"}
              {conclusion.partnerRequired ? ` · ${te.partnerBy}: ${conclusion.partnerReviewedByName ?? "—"}` : ""}
            </p>
          </div>
        ) : null}
        <form
          action={saveConclusionAction.bind(null, id, itemId)}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <input
            name="conclusion"
            required
            placeholder={te.conclusionTitle}
            defaultValue={conclusion?.conclusion ?? ""}
            className={`${input} w-96 max-w-full`}
            data-testid="section-conclusion"
          />
          <label className="flex items-center gap-1 text-xs text-slate-500">
            <input type="checkbox" name="objectivesAchieved" defaultChecked={conclusion?.objectivesAchieved ?? true} />
            {te.objectivesAchieved}
          </label>
          <button type="submit" className={btn} data-testid="save-conclusion">
            {te.saveConclusion}
          </button>
        </form>
        {conclusion?.conclusion ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {!conclusion.reviewedByName ? (
              <form action={reviewConclusionAction.bind(null, id, itemId, false)}>
                <button type="submit" className={btn} data-testid="review-conclusion">
                  {te.review}
                </button>
              </form>
            ) : null}
            {conclusion.partnerRequired && !conclusion.partnerReviewedByName ? (
              <form action={reviewConclusionAction.bind(null, id, itemId, true)}>
                <button type="submit" className={btn} data-testid="partner-review-conclusion">
                  {te.partnerReview}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
