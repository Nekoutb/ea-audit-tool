import Link from "next/link";
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
import { PaperWizard } from "@/components/PaperWizard";
import { PracticalTips, type TipEntry } from "@/components/PracticalTips";
import { ReviewNotes } from "@/components/ReviewNotes";
import { SignificantAccounts } from "@/components/SignificantAccounts";
import { PlanningRas } from "@/components/PlanningRas";
import { SECTION_A, SECTION_B, SECTION_C, SIGNATURE_ROLES, planningRas } from "@/lib/planning-ras";
import { atLeast, isRole } from "@/lib/rbac";
import { listTaskNotes } from "@/lib/task-notes";
import { significantAccounts, specificThresholds } from "@/lib/significant-accounts";
import { craBoard, craRollupByIndex } from "@/lib/cra";
import { craTone, todLabel, type CraLevel } from "@/lib/cra-model";
import { dspView } from "@/lib/design-procedures";
import { DesignProceduresBoard } from "@/components/DesignProceduresBoard";
import { listEstimates, listRelatedParties } from "@/lib/registers";
import { fscpValues, scotStudio, scotSummary, walkthroughValues } from "@/lib/scots";
import { indexesForTask, pspResults } from "@/lib/psp";
import { apLeadSchedules } from "@/lib/analytical-procedures";
import { AccountWorkpaper } from "@/components/AccountWorkpaper";
import { ScotRegister } from "@/components/ScotRegister";
import { WcgwBuilder } from "@/components/WcgwBuilder";
import { WalkthroughBoard } from "@/components/WalkthroughBoard";
import { FscpForm } from "@/components/FscpForm";
import { EstimatesRegister, RelatedPartyRegister } from "@/components/PlanningRegisters";
import { TriggerPanel } from "@/components/TriggerPanel";
import { FORM_DEFINITIONS, loadForm } from "@/lib/forms";
import { listRisks } from "@/lib/risks";
import { CraBoard } from "@/components/CraBoard";
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
import { approvedMateriality } from "@/lib/materiality";
import { groupOfTask, type SectionKey } from "@/lib/task-groups";
import { signOffPreparerAction, signOffReviewerAction } from "@/app/actions/audit-file";
import { listAttachments } from "@/lib/attachments";
import { taskForItem, engagementTasks } from "@/lib/engagement-dashboard";
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
  // The Independence task (P2.1) embeds the campaign. Rendering it also runs
  // the 24-hour reminder sweep — idempotent per day, so simply working the
  // file keeps reminders flowing without a separate scheduler.
  const isIndependenceTask = section.code === "P2.1";
  // Tool-filled values for the blue auto fields: P6.1 shows the approved
  // (or latest) materiality version computed from the trial-balance basis.
  const autoValues: Record<string, string> = {};
  // only PARTNER-APPROVED thresholds reach the working paper
  let approvedM: Awaited<ReturnType<typeof approvedMateriality>> = null;
  if (section.code === "P6.1") {
    approvedM = await approvedMateriality(id);
    const m = approvedM;
    if (m) {
      const n = (x: number) => new Intl.NumberFormat("fr-FR").format(x);
      autoValues.benchmark = `${m.benchmark} · ${m.percentage}% × ${n(m.benchmarkAmount)} → PM ${n(m.overall)} · TE ${n(m.performance)} · SAD ${n(m.trivial)} FCFA (${m.status}${m.approvedByName ? " · " + m.approvedByName : ""})`;
      const sm = await specificThresholds(id);
      if (sm.size > 0) autoValues.benchmark += ` · ${sm.size} specific threshold${sm.size > 1 ? "s" : ""} (P6.2)`;
    }
  }
  if (section.code === "S6.1") {
    const [m, risks] = await Promise.all([approvedMateriality(id), listRisks(id)]);
    const live = risks.filter((r) => !r.rebutted);
    const sig = live.filter((r) => r.significant).length;
    const n = (x: number) => new Intl.NumberFormat("fr-FR").format(x);
    autoValues.context = m
      ? `${m.benchmark} · PM ${n(m.overall)} · TE ${n(m.performance)} FCFA · ${live.length} risk(s), ${sig} significant`
      : `Materiality not approved yet · ${live.length} risk(s), ${sig} significant`;
  }
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

  // The fixed working-paper screen (non-execution tasks): sign-off state,
  // deadline, and the linked tasks resolved to their pages.
  // Practical considerations per questionnaire item: bespoke tips where the
  // paper carries them, otherwise the procedure&apos;s expected sources.
  const isFr = locale === "fr";
  const practicalTips: TipEntry[] = [];
  for (const sec of paperDef.sections ?? []) {
    if (sec.kind === "proc") {
      for (const proc of sec.procs) {
        const tip = isFr ? (proc.tipFr ?? proc.tipEn) : (proc.tipEn ?? proc.tipFr);
        const src = isFr ? proc.srcFr : proc.srcEn;
        const text = tip ?? (src ? (isFr ? "Sources attendues : " : "Expected sources: ") + src : null);
        if (text) practicalTips.push({ key: "p:" + proc.key, text });
      }
    }
    if (sec.kind === "yn") {
      for (const item of sec.items) {
        const tip = isFr ? (item.tipFr ?? item.tipEn) : (item.tipEn ?? item.tipFr);
        if (tip) practicalTips.push({ key: "q:" + item.key, text: tip });
      }
    }
  }
  const taskNotes = await listTaskNotes(itemId);
  // P6.2 (P6.2): the significance grid drives the task itself

  const sigAccounts = section.code === "P6.2" ? await significantAccounts(id) : null;
  // S3.1 — the combined risk assessment matrix IS the first page of the paper
  const craView = section.code === "S3.1" ? await craBoard(id) : null;
  // S5.5 — the substantive-procedures design board rides the same way
  const dspV = section.code === "S5.5" ? await dspView(id) : null;
  // S4.3/S4.4 — the planning sub-registers ride with the paper
  const relatedParties = section.code === "S4.3" ? await listRelatedParties(id) : null;
  const estimates = section.code === "S4.4" ? await listEstimates(id) : null;
  // S6.1/S4.2 — legacy scoping triggers surfaced on the working paper
  const triggerDef = section.code === "S6.1" || section.code === "S4.2" ? FORM_DEFINITIONS[section.code] : null;
  const triggerValues = triggerDef ? (await loadForm(id, section.code)).values : {};
  // S1.x/S2.x + E1.1 — the SCOT Studio rides on the working papers: register
  // on S1.1, WCGW/controls builder on S1.2, walkthroughs on S1.3, selection on
  // S2.1, test design on S2.2, and the results view + control link on E1.1's
  // execution page. S1.1/S1.2/S1.3 own the whole first page via the wizard's
  // embed slot; S2.x keep the compact strip above the paper.
  const SCOT_MODES: Record<string, "wcgw" | "select" | "design" | "results"> = {
    "S1.2": "wcgw", "S2.1": "select", "S2.2": "design", "E1.1": "results",
  };
  const scotView =
    section.code === "S1.1" || section.code === "S1.3" || section.code in SCOT_MODES
      ? await scotStudio(id)
      : null;
  if (scotView) autoValues.context = scotSummary(scotView);
  const wtValues = scotView && section.code === "S1.3" ? await walkthroughValues(id) : null;
  // S1.4 — the close process form (one per engagement, code 'fscp')
  const fscpVals = section.code === "S1.4" ? await fscpValues(id) : null;
  // E4.x — the account workpaper: lead-schedule tab + substantive procedures
  const isAccountTask = section.code.startsWith("E4.");
  // ONE index per account task — its letter is the working paper's identity
  const accountIndex = isAccountTask ? (indexesForTask(section.code)[0] ?? null) : null;
  // the account's CRA from the S3.1 matrix, shown beside the title
  const accountCra =
    isAccountTask && accountIndex
      ? ((await craRollupByIndex(id).catch((): Record<string, never> => ({})))[accountIndex] ?? null)
      : null;
  const accountInIndex =
    isAccountTask && accountIndex
      ? (await apLeadSchedules(id)).some((s) => s.def.code === accountIndex)
      : isAccountTask; // non-index tasks (Leases, TFT) stay usable
  const pspVals = isAccountTask ? await pspResults(id, section.code) : {};
  // P7 — the planning review & approval summary takes over the centre column
  const ras = section.code === "P7.2" ? await planningRas(id) : null;
  // Appendix 1 rows: the engagement team by seniority, then three free rows
  // for specialists brought in from outside the core team.
  const rasTeam = ras
    ? [
        ...(await listEngagementTeam(id))
          .filter((m) => m.status !== "declined")
          .map((m) => ({
            key: m.userId,
            name: m.userName,
            role: m.teamRole.replace(/_/g, " "),
            fixed: true,
          })),
        { key: "x1", name: "", role: "", fixed: false },
        { key: "x2", name: "", role: "", fixed: false },
        { key: "x3", name: "", role: "", fixed: false },
      ]
    : [];
  const userRole = isRole(session.user.role) ? session.user.role : null;
  const taskInfo = await taskForItem(id, section.code);
  const CROSS_LINKS: Record<string, string[]> = {
    "P1.1": ["P1.2", "P2.1"], "P2.1": ["P1.1", "P1.5"], "P1.2": ["P1.1", "E6.5"],
    "P1.5": ["P2.1", "C4.2"], "P6.1": ["C1.1", "S3.1"], "S4.1": ["E4.15"],
    "P5.1": ["E3.1", "E4.1"], "S4.2": ["E6.3", "C2.2"], "S4.3": ["E6.2"], "S4.4": ["E6.7"],
    "S3.1": ["P5.1", "E1.1"], "C1.1": ["P6.1", "C1.2"], "C2.2": ["E6.6", "E6.3", "C5.1"],
    "S1.1": ["P6.2", "S1.2"], "S1.2": ["S1.3", "E1.1"], "S1.3": ["S1.2", "E1.1"], "S1.4": ["E3.1", "C2.1"],
    "S2.1": ["S2.2", "E1.1"], "S2.2": ["E1.1", "S3.1"], "S5.1": ["P2.2"], "S5.2": ["P4.3"], "S5.3": ["E1.1"],
    "S6.1": ["P7.2", "P6.1", "S3.1"], "S6.2": ["P7.2", "S6.1"],
    "C3.1": ["C1.1", "E4.15"], "C3.2": ["E4.1", "E4.8"], "C4.2": ["P1.5", "C5.1"], "C5.1": ["C1.1", "C2.2", "C4.2"],
    "C4.1": ["C4.3", "C6.1"], "C1.2": ["C1.1", "C1.3"], "C5.3": ["E6.2"], "C5.8": ["E4.16", "E6.3"],
  };
  let linkedTasks: { code: string; title: string; href: string }[] = [];
  if (phaseKey !== "execution") {
    const [allTasks, condTasks] = await Promise.all([engagementTasks(id), engagementTasks(id, true)]);
    const byCode = new Map([...allTasks, ...condTasks].map((x) => [x.code, x]));
    const siblings = (groupOfTask(section.code)?.members ?? []).filter((c) => c !== section.code);
    const wanted = [...new Set([...(CROSS_LINKS[section.code] ?? []), ...siblings])].slice(0, 6);
    linkedTasks = wanted
      .map((c) => byCode.get(c))
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .map((x) => ({
        code: x.code,
        title: locale === "fr" ? x.titleFr : x.titleEn,
        href: `/engagements/${id}/sections/${x.id}`,
      }));
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

  const hasTools = (paperDef.tools?.length ?? 0) > 0;
  const req = ((locale === "fr" ? paperDef.reqFr : paperDef.reqEn) ?? []) as string[];
  const dueDate = taskInfo?.dueDate ?? null;
  const overdue = dueDate !== null && dueDate < new Date().toISOString().slice(0, 10) && taskInfo?.status !== "reviewed";
  const pSigned = Boolean(taskInfo?.preparerName);
  const rSigned = Boolean(taskInfo?.reviewerName);
  const chip = (on: boolean) =>
    `grid h-7 w-7 place-items-center rounded-full text-[12px] font-extrabold transition ${
      on ? "bg-emerald-600 text-white" : "bg-surface-2 text-muted hover:bg-line/70"
    }`;

  // ── E4 account tasks: a clean page — no phase header, no questionnaire,
  //    no legacy panels. Back returns to the Accounts group; the content is
  //    the procedure list (sketch) with each procedure's working paper.
  if (isAccountTask) {
    return (
      <main className="min-h-screen w-full px-6 py-6">
        <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href={`/engagements/${id}/groups/e4`}
            className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
            title={fr ? "Retour aux comptes" : "Back to Accounts"}
            aria-label={fr ? "Retour" : "Back"}
            data-testid="wp-back-accounts"
          >
            ←
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-tight tracking-[-0.02em] text-ink">
            {locale === "fr" ? section.title_fr : section.title_en}
          </h1>
          {accountCra ? (
            <Link href={`/engagements/${id}/cra`} title={fr ? "Évaluation combinée des risques (S3.1)" : "Combined risk assessment (S3.1)"} data-testid="wp-account-cra">
              <Chip tone={craTone(accountCra.replace("_sr", "") as CraLevel)}>
                {(fr ? "ECR : " : "CRA: ") + todLabel(accountCra, fr ? "fr" : "en")}
              </Chip>
            </Link>
          ) : null}
          <span className="flex items-center gap-1.5 text-[12px] text-muted">
            {fr ? "Assigné à" : "Assigned to"}
            {canAssign ? (
              <form action={assignTaskAction.bind(null, id, itemId)} className="flex items-center gap-1">
                <select name="assignee" defaultValue={assignee?.userId ?? ""} className={input} data-testid="task-assignee">
                  <option value="">—</option>
                  {team.map((member) => (
                    <option key={member.userId} value={member.userId}>{member.userName}</option>
                  ))}
                </select>
                <SubmitButton className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-2 py-1 text-[11.5px] text-ink-soft hover:bg-surface-2" testId="task-assign-save">OK</SubmitButton>
              </form>
            ) : (
              <b className="text-ink-soft" data-testid="task-assignee">{assignee?.name ?? "—"}</b>
            )}
          </span>
        </div>
        <ErrorBanner error={error} locale={locale} />
        <Panel className="mt-4">
          <AccountWorkpaper
            engagementId={id}
            fileItemId={itemId}
            taskCode={section.code}
            indexCode={accountIndex}
            inIndex={accountInIndex}
            steps={steps.filter((s) => s.source === "psp" || s.description.startsWith("OSP-"))}
            results={pspVals}
            attachmentsSlot={<TaskAttachments fileItemId={itemId} initial={attachments} locale={fr ? "fr" : "en"} compact />}
            locale={isFr ? "fr" : "en"}
          />
        </Panel>

        {/* the account's conclusion — every working paper concludes (prepare + review) */}
        <Panel className="mt-4" data-testid="account-conclusion">
          <PanelHeader title={te.conclusionTitle} />
          {conclusion?.conclusion ? (
            <div className="mt-2 text-sm text-ink-soft" data-testid="conclusion-state">
              <p>{conclusion.conclusion}</p>
              <p className="mt-1 text-xs text-muted">
                {te.preparedBy}: {conclusion.preparedByName ?? "—"} · {te.reviewedBy}: {conclusion.reviewedByName ?? "—"}
              </p>
            </div>
          ) : null}
          <form action={saveConclusionAction.bind(null, id, itemId)} className="mt-3 flex flex-wrap items-end gap-2">
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
          {conclusion?.conclusion && !conclusion.reviewedByName ? (
            <form action={reviewConclusionAction.bind(null, id, itemId, false)} className="mt-2">
              <button type="submit" className={btn} data-testid="review-conclusion">
                {te.review}
              </button>
            </form>
          ) : null}
        </Panel>
      </main>
    );
  }

  // ── The fixed working-paper screen: header band + 25/50/25, no page scroll.
  //    Execution tasks keep the legacy page below (their tools stay untouched).
  if (phaseKey !== "execution") {
    return (
      <main className="flex min-h-screen w-full flex-col gap-3 px-4 py-4 xl:h-screen xl:overflow-hidden xl:px-6" data-testid="wp-screen">
        <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-atlas)] border border-glass-border bg-surface px-4 py-2.5 shadow-atlas-sm backdrop-blur-xl">
          <Link
            href={group ? `/engagements/${id}/groups/${group.id}` : `/engagements/${id}/dashboard`}
            className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-[15px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
            title={
              group
                ? fr
                  ? `Retour à ${group.titleFr}`
                  : `Back to ${group.titleEn}`
                : fr
                  ? "Retour au tableau de bord"
                  : "Back to dashboard"
            }
            aria-label={fr ? "Retour" : "Back"}
            data-testid="wp-back-dashboard"
          >
            ←
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.01em] text-ink">
            {section.code} — {locale === "fr" ? section.title_fr : section.title_en}
            {hasTools ? (
              <span
                className="ml-2 inline-flex items-center rounded-md bg-[var(--color-warn-soft)] px-1.5 py-0.5 align-middle text-[10px] font-extrabold text-warn"
                title={fr ? "Des outils sont utilisés sur cette tâche" : "Tools are used on this task"}
                data-testid="tl-badge"
              >
                TL
              </span>
            ) : null}
          </h1>
          <span className="hidden max-w-[220px] truncate text-[12px] text-muted lg:block">
            {engagement.name ?? engagement.clientName}
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-muted tnum">
            {fr ? "Échéance" : "Deadline"}: {dueDate ?? "—"}
            <Chip tone={overdue ? "rose" : "good"}>{overdue ? (fr ? "En retard" : "Overdue") : fr ? "Dans les temps" : "On track"}</Chip>
          </span>
          <span className="flex items-center gap-1.5">
            <form action={signOffPreparerAction}>
              <input type="hidden" name="fileItemId" value={itemId} />
              <input type="hidden" name="engagementId" value={id} />
              <input type="hidden" name="returnTo" value={`/engagements/${id}/sections/${itemId}`} />
              <button type="submit" className={chip(pSigned)} title={pSigned ? `${taskInfo?.preparerName} · ${taskInfo?.preparerAt}` : fr ? "Signer préparateur" : "Sign as preparer"} data-testid="chip-preparer" data-signed={String(pSigned)}>
                P
              </button>
            </form>
            <form action={signOffReviewerAction}>
              <input type="hidden" name="fileItemId" value={itemId} />
              <input type="hidden" name="engagementId" value={id} />
              <input type="hidden" name="returnTo" value={`/engagements/${id}/sections/${itemId}`} />
              <button type="submit" className={chip(rSigned)} title={rSigned ? `${taskInfo?.reviewerName} · ${taskInfo?.reviewerAt}` : fr ? "Signer réviseur" : "Sign as reviewer"} data-testid="chip-reviewer" data-signed={String(rSigned)}>
                R
              </button>
            </form>
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-muted">
            {fr ? "Assigné à" : "Assigned to"}
            {canAssign ? (
              <form action={assignTaskAction.bind(null, id, itemId)} className="flex items-center gap-1">
                <select name="assignee" defaultValue={assignee?.userId ?? ""} className={input} data-testid="task-assignee">
                  <option value="">—</option>
                  {team.map((member) => (
                    <option key={member.userId} value={member.userId}>{member.userName}</option>
                  ))}
                </select>
                <SubmitButton className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-2 py-1 text-[11.5px] text-ink-soft hover:bg-surface-2" testId="task-assign-save">OK</SubmitButton>
              </form>
            ) : (
              <b className="text-ink-soft" data-testid="task-assignee">{assignee?.name ?? "—"}</b>
            )}
          </span>
        </div>

        <ErrorBanner error={error} locale={locale} />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[25fr_50fr_25fr] xl:overflow-hidden">
          <div className="flex min-h-0 flex-col gap-3 xl:overflow-hidden">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-atlas)] border border-glass-border bg-surface px-4 py-3 shadow-atlas-sm backdrop-blur-xl xl:max-h-[50%]" data-testid="wp-guidance">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">Guidance</h2>
            <p className="mt-1 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-400">{paperDef.std}</p>
            <ul className="mt-2 flex min-h-0 flex-col gap-1.5 overflow-y-auto">
              {req.slice(0, 4).map((g, i) => (
                <li key={i} className="flex gap-1.5 text-[11.8px] leading-snug text-ink-soft">
                  <span className="text-emerald-700 dark:text-emerald-400">•</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
            <PracticalTips tips={practicalTips} locale={isFr ? "fr" : "en"} />
          </section>
          <ReviewNotes
            engagementId={id}
            fileItemId={itemId}
            notes={taskNotes}
            canRaise={canReview(session.user.role)}
            locale={isFr ? "fr" : "en"}
          />
          </div>

          <section className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-[var(--radius-atlas)] border border-glass-border bg-surface px-4 py-3 shadow-atlas backdrop-blur-xl xl:min-h-0">
            {sigAccounts ? (
              <div className="mb-2 min-h-0 overflow-auto" data-testid="wp-sig-accounts">
                <SignificantAccounts engagementId={id} view={sigAccounts} locale={isFr ? "fr" : "en"} />
              </div>
            ) : null}
            {triggerDef ? (
              <TriggerPanel engagementId={id} definition={triggerDef} values={triggerValues} returnTo={`/engagements/${id}/sections/${itemId}`} locale={isFr ? "fr" : "en"} />
            ) : null}
            {relatedParties ? (
              <div className="mb-2 min-h-0 max-h-[45%] overflow-auto" data-testid="wp-related-parties">
                <RelatedPartyRegister engagementId={id} rows={relatedParties} returnTo={`/engagements/${id}/sections/${itemId}`} locale={isFr ? "fr" : "en"} carriedForwardLabel={t.planning.carriedForward ?? "Carried forward"} title={isFr ? "Registre des parties liées" : "Related-party register"} />
              </div>
            ) : null}
            {estimates ? (
              <div className="mb-2 min-h-0 max-h-[45%] overflow-auto" data-testid="wp-estimates">
                <EstimatesRegister engagementId={id} rows={estimates} returnTo={`/engagements/${id}/sections/${itemId}`} locale={isFr ? "fr" : "en"} title={isFr ? "Inventaire des estimations" : "Estimates inventory"} />
              </div>
            ) : null}
            {approvedM ? (
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius-atlas-sm)] border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-[12px] dark:bg-emerald-950/30" data-testid="wp-materiality-strip">
                <span className="text-muted">{fr ? "Base approuvée" : "Approved basis"}: <b className="text-ink">{approvedM.benchmark}</b> · {approvedM.percentage}%</span>
                <span className="text-muted">{fr ? "Seuil global" : "Planning Materiality"}: <b className="text-ink tnum">{new Intl.NumberFormat("fr-FR").format(approvedM.overall)}</b></span>
                <span className="text-muted">{fr ? "Seuil de travail" : "Tolerable Error"}: <b className="text-ink tnum">{new Intl.NumberFormat("fr-FR").format(approvedM.performance)}</b></span>
                <span className="text-muted">SAD: <b className="text-ink tnum">{new Intl.NumberFormat("fr-FR").format(approvedM.trivial)}</b></span>
              </div>
            ) : null}
            {ras ? (
              <PlanningRas
                engagementId={id}
                view={ras}
                sections={[
                  { key: "A", titleEn: "Section A — prepared by the fieldwork lead and the manager", titleFr: "Section A — préparée par le responsable des travaux et le manager", items: SECTION_A },
                  { key: "B", titleEn: "Section B — the engagement partner", titleFr: "Section B — l'associé responsable", items: SECTION_B },
                  { key: "C", titleEn: "Section C — the engagement quality reviewer", titleFr: "Section C — le réviseur qualité", items: SECTION_C },
                ]}
                signatureRoles={SIGNATURE_ROLES.map((r) => ({
                  role: r.role,
                  en: r.en,
                  fr: r.fr,
                  allowed: userRole !== null && atLeast(userRole, r.min),
                }))}
                canSign={userRole !== null}
                team={rasTeam}
                locale={isFr ? "fr" : "en"}
              />
            ) : (
            <PaperWizard
              code={section.code}
              def={paperDef}
              values={paperValues}
              autoValues={autoValues}
              locale={fr ? "fr" : "en"}
              action={savePaperAction.bind(null, id, itemId, section.code)}
              embed={
                // The structured work owns the whole first page. On S1.2,
                // S1.3, S2.1 and S2.2 it IS the paper (embedOnly).
                scotView && section.code === "S1.1" ? (
                  <ScotRegister
                    engagementId={id}
                    view={scotView}
                    team={team.map((m) => ({ userId: m.userId, userName: m.userName }))}
                    locale={isFr ? "fr" : "en"}
                  />
                ) : scotView && wtValues && section.code === "S1.3" ? (
                  <WalkthroughBoard engagementId={id} view={scotView} values={wtValues} locale={isFr ? "fr" : "en"} />
                ) : scotView && section.code in SCOT_MODES && section.code !== "E1.1" ? (
                  <WcgwBuilder engagementId={id} view={scotView} mode={SCOT_MODES[section.code]} locale={isFr ? "fr" : "en"} />
                ) : fscpVals ? (
                  <FscpForm engagementId={id} values={fscpVals} locale={isFr ? "fr" : "en"} />
                ) : craView ? (
                  <CraBoard engagementId={id} view={craView} locale={isFr ? "fr" : "en"} />
                ) : dspV ? (
                  <DesignProceduresBoard engagementId={id} view={dspV} locale={isFr ? "fr" : "en"} />
                ) : undefined
              }
              embedOnly={["S1.2", "S1.3", "S2.1", "S2.2"].includes(section.code)}
              embedTitle={
                section.code === "S1.1"
                  ? fr ? "Registre des SCOT" : "SCOT register"
                  : section.code === "S1.3"
                    ? fr ? "Cheminements par SCOT" : "Walkthroughs by SCOT"
                    : section.code === "S1.4"
                      ? fr ? "Processus de clôture" : "The close process"
                      : section.code === "S2.1"
                        ? fr ? "Sélection des contrôles à tester" : "Select controls to test"
                        : section.code === "S2.2"
                          ? fr ? "Conception des tests de contrôles" : "Design tests of controls"
                          : section.code === "S3.1"
                            ? fr ? "Matrice d'évaluation combinée des risques" : "Combined risk assessment matrix"
                            : section.code === "S5.5"
                              ? fr ? "Conception des procédures substantives" : "Design substantive procedures"
                              : fr ? "Flux, WCGW & contrôles" : "Flows, WCGWs & controls"
              }
            />
            )}
          </section>

          <section className="flex min-h-0 flex-col gap-3 xl:overflow-hidden">
            <TaskAttachments fileItemId={itemId} initial={attachments} locale={fr ? "fr" : "en"} compact />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-atlas)] border border-glass-border bg-surface px-4 py-3 shadow-atlas-sm backdrop-blur-xl" data-testid="wp-linked">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                {fr ? "Tâches liées" : "Linked tasks"}
              </h2>
              <ul className="mt-1.5 flex min-h-0 flex-col overflow-hidden">
                {["S2.2", "S2.4", "S5.5"].includes(section.code) ? (
                  <li>
                    <Link href={`/engagements/${id}/tools/sampling`} className="flex items-baseline gap-1.5 rounded-[var(--radius-atlas-xs)] px-1.5 py-1 text-[12.3px] font-semibold text-emerald-700 transition hover:bg-surface-2 dark:text-emerald-400" data-testid="linked-sampling-tool">
                      <span className="font-mono text-[10.5px] text-muted">TL</span>
                      <span className="min-w-0 flex-1 truncate">{fr ? "Outil d'échantillonnage — déterminer l'échantillon" : "Sampling tool — determine the sample"}</span>
                    </Link>
                  </li>
                ) : null}
                {linkedTasks.length === 0 && section.code !== "S2.2" ? (
                  <li className="text-[12px] text-muted">—</li>
                ) : (
                  linkedTasks.map((l) => (
                    <li key={l.code}>
                      <Link href={l.href} className="flex items-baseline gap-1.5 rounded-[var(--radius-atlas-xs)] px-1.5 py-1 text-[12.3px] text-ink-soft transition hover:bg-surface-2 hover:text-emerald-700" data-testid={`linked-${l.code}`}>
                        <span className="font-mono text-[10.5px] text-muted">{l.code}</span>
                        <span className="min-w-0 flex-1 truncate">{l.title}</span>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
              {isIndependenceTask ? (
                <div className="mt-auto border-t border-line pt-2" data-testid="independence-campaign">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                    {fr ? "Campagne d'indépendance" : "Independence campaign"}
                  </h3>
                  <ul className="mt-1 flex flex-col gap-0.5" data-testid="campaign-list">
                    {campaign.slice(0, 5).map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-[11.5px]" data-testid={`campaign-row-${c.userId}`}>
                        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${c.status === "completed" ? "bg-emerald-600" : c.status === "exception" ? "bg-[var(--color-rose)]" : "border border-line-strong"}`} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-ink-soft">{c.userName}</span>
                        <span className="flex-shrink-0 text-[10.5px] text-muted tnum">
                          {c.signedAt ? `Completed · ${c.signedAt}` : fr ? "En attente" : "Awaiting"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {campaignTeam.some((m) => !campaign.some((c) => c.userId === m.userId)) || campaign.length === 0 ? (
                    <form action={launchIndependenceToTeamAction.bind(null, id, `/engagements/${id}/sections/${itemId}`)} className="mt-1.5">
                      <SubmitButton className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1 text-[11.5px] font-medium text-white hover:bg-emerald-800" testId="launch-campaign-team">
                        {fr ? `Lancer à l'équipe (${campaignTeam.length})` : `Issue to the team (${campaignTeam.length})`}
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} />
      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-ink">
          {section.code} — {locale === "fr" ? section.title_fr : section.title_en}
          {hasTools ? (
            <span className="ml-2 inline-flex items-center rounded-md bg-[var(--color-warn-soft)] px-1.5 py-0.5 align-middle text-[10px] font-extrabold text-warn" title={fr ? "Des outils sont utilisés sur cette tâche" : "Tools are used on this task"} data-testid="tl-badge">TL</span>
          ) : null}
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

      {false ? (
        <div className="mt-6" data-testid="wp-account-workpaper-legacy">
          <AccountWorkpaper
            engagementId={id}
            fileItemId={itemId}
            taskCode={section.code}
            indexCode={accountIndex}
            inIndex={accountInIndex}
            steps={steps.filter((s) => s.source === "psp" || s.description.startsWith("OSP-"))}
            results={pspVals}
            locale={isFr ? "fr" : "en"}
          />
        </div>
      ) : null}

      {/* account tasks: the tabbed workpaper IS the paper — no questionnaire block */}
      {isAccountTask ? null : (
      <WorkingPaper
        code={section.code}
        def={paperDef}
        values={paperValues}
        autoValues={autoValues}
        locale={locale}
        action={savePaperAction.bind(null, id, itemId, section.code)}
      />
      )}

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
          {scotView ? (
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
                      {dataset.kind === "journal_entries" ? `${dataset.name} (${dataset.timing === "pre_audit" ? "pre-audit" : "post-audit"})` : dataset.name}
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
