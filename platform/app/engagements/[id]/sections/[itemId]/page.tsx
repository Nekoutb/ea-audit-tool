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
import { addStepAction, assignTaskAction, generateProgramAction, linkRiskStepAction, savePaperAction } from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { PhaseNav } from "@/components/PhaseNav";
import { launchIndependenceToTeamAction } from "@/app/actions/team-independence";
import { SubmitButton } from "@/components/SubmitButton";
import { TaskAttachments } from "@/components/TaskAttachments";
import { WorkingPaper } from "@/components/WorkingPaper";
import { ErrorBanner } from "@/components/GatesPanel";
import { Panel, PanelHeader, Chip } from "@/components/ui/atlas";
import { withTenant } from "@/lib/db";
import { getEngagement } from "@/lib/engagements";
import { listRuns } from "@/lib/engines";
import { getSectionConclusion, listControlTests } from "@/lib/execution";
import { listDatasets } from "@/lib/subledgers";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { groupOfTask, type SectionKey } from "@/lib/task-groups";
import { listAttachments } from "@/lib/attachments";
import { listConfirmations, sendDueReminders } from "@/lib/independence";
import { listTeam as listEngagementTeam } from "@/lib/team";
import { loadPaper, paperFor } from "@/lib/working-papers";
import { listProgramSteps, sectionCoverage } from "@/lib/programs";
import { canReview } from "@/lib/rbac";
import { ASSERTIONS, risksForSection } from "@/lib/risks";
import { getTaskAssignee, listTeam } from "@/lib/team";
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

  const group = groupOfTask(section.code);
  const phaseKey: SectionKey = group?.section ?? "strategy";
  const paperDef = paperFor(section.code);
  // Execution constructs belong to execution work. They stay visible on any
  // task that already holds one, so nothing recorded elsewhere is lost.
  const isExecution = phaseKey === "execution";
  const paperValues = await loadPaper(id, section.code);
  const attachments = await listAttachments(itemId);
  // The Independence task (D3.2) embeds the campaign. Rendering it also runs
  // the 24-hour reminder sweep — idempotent per day, so simply working the
  // file keeps reminders flowing without a separate scheduler.
  const isIndependenceTask = section.code === "D3.2";
  let campaign: Awaited<ReturnType<typeof listConfirmations>> = [];
  let campaignTeam: Awaited<ReturnType<typeof listEngagementTeam>> = [];
  if (isIndependenceTask) {
    try {
      await sendDueReminders(id);
    } catch {
      // reminders must never block the task page
    }
    [campaign, campaignTeam] = await Promise.all([listConfirmations(id), listEngagementTeam(id)]);
  }

  const [risks, steps, coverage, controlTests, conclusion, datasets, runs, team, assignee] =
    await Promise.all([
      risksForSection(itemId),
      listProgramSteps(itemId),
      sectionCoverage(itemId),
      listControlTests(itemId),
      getSectionConclusion(itemId),
      listDatasets(id),
      listRuns(itemId),
      listTeam(id),
      getTaskAssignee(itemId),
    ]);
  const te = t.planning.execution;
  const tg = t.planning.engines;
  const fr = locale === "fr";
  const canAssign = canReview(session.user.role);

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

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const btn =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2";

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} />
      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-ink">
          {section.code} — {locale === "fr" ? section.title_fr : section.title_en}
        </h1>
        {section.material ? <Chip tone="warn">{ts.material}</Chip> : null}
      </div>
      <PhaseNav engagementId={id} locale={locale} active={phaseKey} />
      <ErrorBanner error={error} locale={locale} />

      {/* Direct task assignment (six-level ladder): who is doing this task. */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">{fr ? "Assigné à" : "Assigned to"}</span>
        {canAssign ? (
          <form action={assignTaskAction.bind(null, id, itemId)} className="flex flex-wrap items-center gap-1.5">
            <select
              name="assignee"
              defaultValue={assignee?.userId ?? ""}
              className={input}
              data-testid="task-assignee"
            >
              <option value="">—</option>
              {team.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.userName}
                </option>
              ))}
            </select>
            <button type="submit" className={btn} data-testid="save-assignee">
              {fr ? "Enregistrer" : "Save"}
            </button>
          </form>
        ) : (
          <span className="font-medium text-ink" data-testid="task-assignee">
            {assignee?.name ?? "—"}
          </span>
        )}
      </div>

      <WorkingPaper
        code={section.code}
        def={paperDef}
        values={paperValues}
        autoValues={{}}
        locale={locale}
        action={savePaperAction.bind(null, id, itemId, section.code)}
      />

      {/* files of the task: upload · download · versions · edit-locally watcher */}
      <TaskAttachments fileItemId={itemId} initial={attachments} locale={locale === "fr" ? "fr" : "en"} />

      {isIndependenceTask ? (
        <Panel className="mt-6" data-testid="independence-campaign">
          <PanelHeader
            title={locale === "fr" ? "Campagne d’indépendance" : "Independence campaign"}
            hint={`${campaign.filter((c) => c.status === "completed" || c.status === "exception").length}/${campaign.length || campaignTeam.length}`}
          />
          <p className="mt-2 text-[12.5px] text-muted">
            {locale === "fr"
              ? "Chaque membre de l’équipe confirme son indépendance avant le début des travaux. Les réponses sont verrouillées avec leur horodatage ; une relance automatique part après 24 heures sans réponse."
              : "Every team member confirms independence before the work starts. Responses lock with their timestamp; an automatic reminder goes out after 24 hours without a response."}
          </p>
          {campaign.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              {locale === "fr" ? "Aucune invitation envoyée." : "No invitations sent yet."}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line" data-testid="campaign-list">
              {campaign.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2" data-testid={`campaign-row-${c.userId}`}>
                  <span
                    className={`h-2 w-2 flex-shrink-0 rounded-full ${
                      c.status === "completed" ? "bg-emerald-600" : c.status === "exception" ? "bg-[var(--color-rose)]" : "border-[1.5px] border-line-strong bg-transparent"
                    }`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{c.userName}</span>
                  <span className="flex-shrink-0 text-[11.5px] text-muted tnum">
                    {c.status === "completed"
                      ? (locale === "fr" ? `Confirmé · ${c.signedAt}` : `Completed · ${c.signedAt}`)
                      : c.status === "exception"
                        ? (locale === "fr" ? `Exception · ${c.signedAt}` : `Exception · ${c.signedAt}`)
                        : (locale === "fr" ? "Invité — en attente" : "Invited — awaiting response") +
                          (c.reminderCount > 0 ? ` · ${c.reminderCount}× ${locale === "fr" ? "relance" : "reminded"}` : "")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {campaignTeam.some((m) => !campaign.some((c) => c.userId === m.userId)) || campaign.length === 0 ? (
            <form action={launchIndependenceToTeamAction.bind(null, id, `/engagements/${id}/sections/${itemId}`)} className="mt-4">
              <SubmitButton
                className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
                testId="launch-campaign-team"
              >
                {locale === "fr"
                  ? `Lancer la campagne à l’équipe (${campaignTeam.length})`
                  : `Issue the campaign to the team (${campaignTeam.length})`}
              </SubmitButton>
            </form>
          ) : null}
        </Panel>
      ) : null}

      {/* Linked risks pinned at the top of the section (spec §8.1) */}
      {isExecution || phaseKey === "strategy" || risks.length > 0 ? (
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
  
            <form action={runJeTestingAction.bind(null, id, itemId)} className="rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-3">
              <p className="text-sm font-semibold text-ink">{tg.je}</p>
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
    </main>
  );
}
