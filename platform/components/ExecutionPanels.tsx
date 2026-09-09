// The seven execution panels — linked risks, the audit program, risk coverage,
// the matter-arising router, control tests, the automation engines, and the
// section conclusion with its review chain. They used to be written inline at
// the bottom of the section page, on a screen only execution tasks reached.
// When every task moved to the shared working-paper screen those panels lost
// their home, so they live here instead and the page renders them for exactly
// the tasks that used to reach that screen. The markup, the test ids, the
// server actions and the guards are the ones they already had.
//
// This stays a server component: every panel posts to a server action bound to
// the engagement and the file item, and binding arguments that way is only
// possible from the server.

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
import { WcgwBuilder } from "@/components/WcgwBuilder";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import type { SectionConclusionInfo, listControlTests } from "@/lib/execution";
import type { RunInfo } from "@/lib/engines";
import type { Messages } from "@/lib/i18n";
import type { CoverageRow, ProgramStep } from "@/lib/programs";
import { ASSERTIONS } from "@/lib/risks";
import type { risksForSection } from "@/lib/risks";
import type { ScotStudioView } from "@/lib/scots";
import type { DatasetSummary } from "@/lib/subledgers";

export interface ExecutionPanelsProps {
  engagementId: string;
  fileItemId: string;
  locale: "en" | "fr";
  /** The message bundle the panels read: planning.sections, .execution, .engines and .risks. */
  messages: Messages;
  /**
   * Execution work always shows every panel. Any other task shows a panel only
   * where it already holds records, so nothing filed elsewhere is ever hidden.
   */
  isExecution: boolean;
  risks: Awaited<ReturnType<typeof risksForSection>>;
  steps: ProgramStep[];
  coverage: CoverageRow[];
  controlTests: Awaited<ReturnType<typeof listControlTests>>;
  runs: RunInfo[];
  conclusion: SectionConclusionInfo | null;
  datasets: DatasetSummary[];
  /** Non-null on tasks that carry a SCOT record; it fills the control link. */
  scotView: ScotStudioView | null;
  /**
   * E1.1 already carries the tested-controls results board in the wizard above,
   * so the control-tests panel leaves that board out rather than repeat it.
   */
  showScotResults: boolean;
  /** The engagement period end — the default date on the recon and JE engines. */
  periodEnd: string;
}

const input =
  "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
const btn =
  "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2";

export function ExecutionPanels({
  engagementId: id,
  fileItemId: itemId,
  locale,
  messages: t,
  isExecution,
  risks,
  steps,
  coverage,
  controlTests,
  runs,
  conclusion,
  datasets,
  scotView,
  showScotResults,
  periodEnd,
}: ExecutionPanelsProps) {
  const ts = t.planning.sections;
  const te = t.planning.execution;
  const tg = t.planning.engines;
  const fr = locale === "fr";

  // A2: default confidence from the assessed risk band (§04) — high/significant
  // risk → 95%, medium → 85%, purely low → 70%.
  const defaultConfidence = risks.some((risk) => risk.significant || risk.rating === "high")
    ? "95"
    : risks.length > 0 && risks.every((risk) => risk.rating === "low")
      ? "70"
      : "85";

  // Last sampling run — surfaces the computed interval/size/factor line so the
  // extent is visibly "computed, not typed" (R17).
  const lastSampling = runs.find((run) => run.engine === "sampling");
  const lastComputed =
    lastSampling && typeof lastSampling.summary.computed === "object" && lastSampling.summary.computed !== null
      ? (lastSampling.summary.computed as {
          populationValue: number;
          tolerable: number;
          confidence: number;
          factor: number;
          interval: number;
          sampleSize: number;
        })
      : null;
  const lastOverridden = lastSampling?.summary.override === true;

  return (
    <>
      {/* Linked risks pinned at the top of the section (spec §8.1) */}
      {isExecution || risks.length > 0 ? (
        <Panel className="mt-6">
          <PanelHeader title={ts.linkedRisks} />
          {risks.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{ts.noRisks}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2" data-testid="section-risks">
              {risks.map((risk) => (
                <li key={risk.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={
                      risk.significant
                        ? "rounded-[var(--radius-atlas-xs)] bg-[var(--color-rose-soft)] px-1.5 py-0.5 text-xs font-semibold text-rose"
                        : "rounded-[var(--radius-atlas-xs)] bg-surface-2 px-1.5 py-0.5 text-xs text-ink-soft"
                    }
                  >
                    {risk.rating.toUpperCase()}
                    {risk.significant ? ` · ${t.planning.risks.significant}` : ""}
                  </span>
                  <span className="text-ink">{risk.description}</span>
                  <span className="font-mono text-xs text-muted">[{risk.assertions.join("")}]</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      {isExecution || steps.length > 0 ? (
        <Panel className="mt-6">
          <PanelHeader
            title={ts.program}
            right={
              steps.length === 0 ? (
                <form action={generateProgramAction.bind(null, id, itemId)}>
                  <button type="submit" className={btn} data-testid="generate-program">
                    {ts.generateProgram}
                  </button>
                </form>
              ) : null
            }
          />
          {steps.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-[var(--radius-atlas)] border border-line">
              <table className="w-full text-sm" data-testid="program-table">
                <tbody>
                  {steps.map((step) => (
                    <tr key={step.id} className="border-t border-line first:border-t-0">
                      <td className="w-14 px-3 py-2 font-mono text-xs text-muted">{step.seq}</td>
                      <td className="px-3 py-2 text-ink-soft">
                        {step.description}
                        {step.source === "risk_extension" ? (
                          <span className="ml-2 rounded-[var(--radius-atlas-xs)] bg-[var(--color-rose-soft)] px-1.5 py-0.5 text-xs font-semibold text-rose">
                            {ts.sourceLabels.risk_extension}
                          </span>
                        ) : null}
                      </td>
                      <td className="w-20 px-3 py-2 font-mono text-xs text-muted">
                        [{step.assertions.join("")}]
                      </td>
                      <td className="w-24 px-3 py-2 text-xs text-muted">
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
                                ? "rounded-[var(--radius-atlas-xs)] bg-[var(--color-good-soft)] px-1.5 py-0.5 text-xs font-semibold text-good"
                                : "rounded-[var(--radius-atlas-xs)] bg-surface-2 px-1.5 py-0.5 text-xs text-muted"
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
            <span className="flex items-center gap-1 text-xs text-muted">
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
              <label className="flex flex-col text-xs text-muted">
                {ts.risk}
                <select name="riskId" className={input} data-testid="link-risk">
                  {risks.map((risk) => (
                    <option key={risk.id} value={risk.id}>
                      {risk.description.slice(0, 60)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-xs text-muted">
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
        </Panel>
      ) : null}

      {isExecution || coverage.length > 0 ? (
        <Panel className="mt-6">
          <PanelHeader title={ts.coverage} />
          <div className="mt-3 overflow-x-auto rounded-[var(--radius-atlas)] border border-line">
            <table className="w-full text-sm" data-testid="coverage-table">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2">{ts.risk}</th>
                  <th className="px-4 py-2">{t.planning.risks.assertions}</th>
                  <th className="px-4 py-2">{ts.covered}</th>
                  <th className="px-4 py-2">{t.planning.risks.linkedSteps}</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((row) => (
                  <tr key={row.riskId} className="border-t border-line">
                    <td className="px-4 py-2 text-ink-soft">
                      {row.riskDescription}
                      {row.significant && row.linkedSteps === 0 ? (
                        <span className="ml-2 rounded-[var(--radius-atlas-xs)] bg-[var(--color-rose-soft)] px-1.5 py-0.5 text-xs font-semibold text-rose" data-testid="unlinked-significant">
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
        </Panel>
      ) : null}

      {/* 4.4 matter arising: route to exactly one destination */}
      <Panel className="mt-6">
        <PanelHeader title={te.matterArising} />
        <form
          action={routeFindingAction.bind(null, id, itemId)}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <label className="flex flex-col text-xs text-muted">
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
          <label className="flex flex-col text-xs text-muted">
            {te.mtype}
            <select name="mtype" className={input}>
              {(["factual", "judgmental", "projected", "classification", "disclosure"] as const).map((mtype) => (
                <option key={mtype} value={mtype}>
                  {te.mtypes[mtype]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-muted">
            <input type="checkbox" name="trivialConfirmed" data-testid="trivial-confirm" /> {te.trivialConfirm}
          </label>
          <label className="flex items-center gap-1 text-xs text-muted">
            <input type="checkbox" name="significant" /> {te.significantFlag}
          </label>
          <button type="submit" className={btn} data-testid="route-finding">
            {te.raise}
          </button>
        </form>
      </Panel>

      {/* 4.7 control tests */}
      {isExecution || controlTests.length > 0 ? (
        <Panel className="mt-6">
          <PanelHeader title={te.controls} />
          {scotView && showScotResults ? (
            <div className="mt-3" data-testid="wp-scot-results">
              <WcgwBuilder engagementId={id} view={scotView} mode="results" locale={fr ? "fr" : "en"} />
            </div>
          ) : null}
          <ul className="mt-2 flex flex-col gap-1 text-sm" data-testid="control-tests">
            {controlTests.map((test) => (
              <li key={test.id} className="rounded-[var(--radius-atlas-sm)] border border-line px-3 py-1.5">
                {test.description} —{" "}
                {test.result === "effective" ? (
                  <span className="text-emerald-700 dark:text-emerald-400">{te.results.effective}</span>
                ) : (
                  <span className="text-rose">
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
            {scotView ? (
              <label className="flex flex-col text-xs text-muted">
                {fr ? "Contrôle (SCOT)" : "Control (SCOT)"}
                <select name="scotControlId" className={input} data-testid="control-scot-link">
                  <option value="">—</option>
                  {scotView.scots.flatMap((s) =>
                    s.controls
                      .filter((c) => c.selectedForTesting)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {s.name} · {c.name}
                        </option>
                      )),
                  )}
                </select>
              </label>
            ) : null}
            <label className="flex flex-col text-xs text-muted">
              {te.result}
              <select name="result" className={input} data-testid="control-result">
                <option value="effective">{te.results.effective}</option>
                <option value="deviation">{te.results.deviation}</option>
              </select>
            </label>
            <label className="flex flex-col text-xs text-muted">
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
        </Panel>
      ) : null}

      {/* 5.x automation engines */}
      {isExecution || runs.length > 0 ? (
        <Panel className="mt-6">
          <PanelHeader title={tg.title} />

          {runs.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1 text-sm" data-testid="engine-runs">
              {runs.map((run) => (
                <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-atlas-sm)] border border-line px-3 py-1.5">
                  <span className="font-mono text-xs">{run.engine}</span>
                  <span className="text-xs text-muted">
                    {/* the verbose A2 `computed` block has its own line below */}
                    {JSON.stringify(
                      Object.fromEntries(Object.entries(run.summary).filter(([key]) => key !== "computed")),
                    ).slice(0, 120)}
                  </span>
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
            <form action={runSamplingAction.bind(null, id, itemId)} className="rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-3">
              <p className="text-sm font-semibold text-ink">{tg.sampling}</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <select name="datasetId" required className={input} data-testid="sampling-dataset">
                  {datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.kind === "journal_entries" ? `${dataset.name} (${dataset.timing === "pre_audit" ? "pre-audit" : "post-audit"})` : dataset.name}
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
                <select name="confidence" defaultValue={defaultConfidence} className={input} data-testid="sampling-confidence">
                  <option value="95">{fr ? "Élevé 95 %" : "High 95%"}</option>
                  <option value="85">{fr ? "Modéré 85 %" : "Moderate 85%"}</option>
                  <option value="70">{fr ? "Faible 70 %" : "Low 70%"}</option>
                </select>
                <input
                  name="expectedMisstatement"
                  type="number"
                  min="0"
                  placeholder={fr ? "Anomalie attendue" : "Expected misstatement"}
                  className={input}
                  data-testid="sampling-expected"
                />
                <input name="sampleSize" type="number" min="1" defaultValue="5" className={input} data-testid="sampling-size" />
                <input name="seed" placeholder={tg.seed} required className={input} data-testid="sampling-seed" />
                <input name="threshold" type="number" placeholder={tg.threshold} className={input} />
                <input
                  name="overrideSize"
                  type="number"
                  min="1"
                  placeholder={fr ? "Taille dérogée" : "Override size"}
                  className={input}
                  data-testid="sampling-override"
                />
                <input
                  name="overrideRationale"
                  placeholder={fr ? "Justification de la dérogation" : "Override rationale"}
                  className={input}
                  data-testid="sampling-rationale"
                />
                <button type="submit" className={btn} data-testid="run-sampling">
                  {tg.run}
                </button>
              </div>
              {lastComputed ? (
                <p className="mt-2 text-xs text-muted" data-testid="sampling-computed">
                  {fr ? "Calculé, non saisi — " : "Computed, not typed — "}
                  {fr ? "intervalle" : "interval"} {Math.round(lastComputed.interval).toLocaleString(locale)} ·{" "}
                  {fr ? "taille" : "size"} {lastComputed.sampleSize} · {fr ? "facteur" : "factor"}{" "}
                  {lastComputed.factor} ({lastComputed.confidence}% · {fr ? "tolérable" : "tolerable"}{" "}
                  {Math.round(lastComputed.tolerable).toLocaleString(locale)})
                  {lastOverridden ? (
                    <span className="ml-1 font-semibold text-warn">
                      {fr ? "· DÉROGATION — signalée en revue" : "· OVERRIDE — flagged for review"}
                    </span>
                  ) : null}
                </p>
              ) : lastOverridden ? (
                <p className="mt-2 text-xs font-semibold text-warn" data-testid="sampling-computed">
                  {fr
                    ? "Taille dérogée manuellement — justification signalée en revue"
                    : "Sample size manually overridden — rationale flagged for review"}
                </p>
              ) : null}
            </form>

            <form action={runReconAction.bind(null, id, itemId)} className="rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-3">
              <p className="text-sm font-semibold text-ink">{tg.recon}</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <select name="datasetId" required className={input} data-testid="recon-dataset">
                  {datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.kind === "journal_entries" ? `${dataset.name} (${dataset.timing === "pre_audit" ? "pre-audit" : "post-audit"})` : dataset.name}
                    </option>
                  ))}
                </select>
                <input name="staleDays" type="number" placeholder={tg.staleDays} className={input} />
                <input name="periodEnd" type="date" defaultValue={periodEnd} className={input} />
                <button type="submit" className={btn} data-testid="run-recon">
                  {tg.run}
                </button>
              </div>
            </form>

            <form action={runJeTestingAction.bind(null, id, itemId)} className="rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-3">
              <p className="text-sm font-semibold text-ink">{tg.je}</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <select name="datasetId" required className={input} data-testid="je-dataset">
                  {datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.kind === "journal_entries" ? `${dataset.name} (${dataset.timing === "pre_audit" ? "pre-audit" : "post-audit"})` : dataset.name}
                    </option>
                  ))}
                </select>
                <input name="periodEnd" type="date" defaultValue={periodEnd} className={input} />
                <input name="largeThreshold" type="number" placeholder={tg.largeThreshold} className={input} />
                <button type="submit" className={btn} data-testid="run-je">
                  {tg.run}
                </button>
              </div>
            </form>

            <form action={runAnalyticAction.bind(null, id, itemId)} className="rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-3">
              <p className="text-sm font-semibold text-ink">{tg.analytics}</p>
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
        </Panel>
      ) : null}

      {/* 4.11 section conclusion + review chain */}
      <Panel className="mt-6">
        <PanelHeader title={te.conclusionTitle} />
        {conclusion?.partnerRequired ? (
          <p className="mt-1 text-sm font-medium text-warn" data-testid="partner-required">
            {te.partnerRequired}
          </p>
        ) : null}
        {conclusion?.conclusion ? (
          <div className="mt-2 text-sm text-ink-soft" data-testid="conclusion-state">
            <p>{conclusion.conclusion}</p>
            <p className="mt-1 text-xs text-muted">
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
          <label className="flex items-center gap-1 text-xs text-muted">
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
      </Panel>
    </>
  );
}
