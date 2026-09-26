import Link from "next/link";
import { ArchiveChecklist } from "@/components/ArchiveChecklist";
import { archiveChecklist } from "@/lib/archive-checklist";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { reviewConclusionAction, routeFindingAction, saveConclusionAction } from "@/app/actions/execution";
import { assignTaskAction, markNotApplicableAction, savePaperAction } from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { launchIndependenceToTeamAction } from "@/app/actions/team-independence";
import { PaperWizard } from "@/components/PaperWizard";
import { PracticalTips, type TipEntry } from "@/components/PracticalTips";
import { ReviewNotes } from "@/components/ReviewNotes";
import { Fold, MaybeFold } from "@/components/Fold";
import { SignificantAccounts } from "@/components/SignificantAccounts";
import { PlanningRas } from "@/components/PlanningRas";
import { SrmMattersPanel } from "@/components/SrmMattersPanel";
import { srmMatters } from "@/lib/summary-review-memo";
import { SECTION_A, SECTION_B, SECTION_C, SIGNATURE_ROLES, planningRas } from "@/lib/planning-ras";
import { atLeast, isRole, canPartnerSignoff } from "@/lib/rbac";
import { listTaskNotes } from "@/lib/task-notes";
import { significantAccounts, specificThresholds } from "@/lib/significant-accounts";
import { craBoard, craRollupByIndex } from "@/lib/cra";
import { craTone, todLabel, type CraLevel } from "@/lib/cra-model";
import { dspHasSelection, dspView, s55ItemId } from "@/lib/design-procedures";
import { DesignProceduresBoard } from "@/components/DesignProceduresBoard";
import { itAppsView } from "@/lib/itgc";
import { ItAppsBoard } from "@/components/ItAppsBoard";
import { listEstimates, listRelatedParties } from "@/lib/registers";
import { fscpValues, scotStudio, scotSummary, walkthroughValues } from "@/lib/scots";
import { generatePsp, indexesForTask, localizePspSteps, pspResults } from "@/lib/psp";
import { apLeadSchedules } from "@/lib/analytical-procedures";
import { runFsTieout } from "@/lib/fs-tieout";
import { AccountWorkpaper } from "@/components/AccountWorkpaper";
import { ScotRegister } from "@/components/ScotRegister";
import { WcgwBuilder } from "@/components/WcgwBuilder";
import { WalkthroughBoard } from "@/components/WalkthroughBoard";
import { TocBoard } from "@/components/TocBoard";
import { FscpForm } from "@/components/FscpForm";
import { EstimatesRegister, RelatedPartyRegister } from "@/components/PlanningRegisters";
import { TriggerPanel } from "@/components/TriggerPanel";
import { FORM_DEFINITIONS, loadForm } from "@/lib/forms";
import { listRisks } from "@/lib/risks";
import { CraBoard } from "@/components/CraBoard";
import { SubmitButton } from "@/components/SubmitButton";
import { TaskAttachments } from "@/components/TaskAttachments";
import { ErrorBanner } from "@/components/GatesPanel";
import { Panel, PanelHeader, Chip } from "@/components/ui/atlas";
import { withTenant } from "@/lib/db";
import { getEngagement } from "@/lib/engagements";
import { FINDING_SEVERITIES, getSectionConclusion } from "@/lib/execution";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { cookies } from "next/headers";
import { decodePaperDraft, paperDraftCookie, paperFieldLabel } from "@/lib/paper-drafts";
import { equityConclusionOf, equityStatus, listDeadlines } from "@/lib/legal";
import { getLocale } from "@/lib/locale";
import { approvedMateriality } from "@/lib/materiality";
import { groupOfTask } from "@/lib/task-groups";
import { signOffEqrAction, signOffPreparerAction, signOffReviewerAction } from "@/app/actions/audit-file";
import { listAttachments, listDeletedAttachments } from "@/lib/attachments";
import { listItemDocuments } from "@/lib/documents";
import { ensureDefaultWorkpaper, templateForCode } from "@/lib/wp-templates";
import { effectiveDueDate, taskForItem, engagementTasks } from "@/lib/engagement-dashboard";
import { listConfirmations, sendDueReminders } from "@/lib/independence";
import { listTeam as listEngagementTeam } from "@/lib/team";
import { EQR_OWN_PAPER, loadPaper, paperBaseDigests, paperFor, paperVersion } from "@/lib/working-papers";
import { EQR_C42_KEYS, eqrStanding } from "@/lib/eqr";
import { paperKeys } from "@/lib/papers/types";
import { listProgramSteps } from "@/lib/programs";
import { canReview, canWrite } from "@/lib/rbac";
import { getTaskAssignee, listTeam } from "@/lib/team";
import { requireTenant } from "@/lib/tenant";

/** Benchmark label for the S6.1 auto field, in the reader's language (UAT B74). */
function benchmarkLabel(benchmark: string, fr: boolean): string {
  const L: Record<string, [string, string]> = {
    pbt: ["Profit before tax", "Résultat avant impôt"],
    revenue: ["Revenue", "Chiffre d'affaires"],
    total_assets: ["Total assets", "Total de l'actif"],
    equity: ["Equity", "Capitaux propres"],
    expenses: ["Total expenses", "Total des charges"],
  };
  const pair = L[benchmark];
  return pair ? (fr ? pair[1] : pair[0]) : benchmark;
}

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
      na_reason: string | null;
      archived_at: string | null;
    }>(
      `SELECT fi.id, fi.engagement_id, fi.code, fi.title_en, fi.title_fr, fi.material, fi.na_reason,
              e.archived_at::text AS archived_at
         FROM file_item fi JOIN engagement e ON e.id = fi.engagement_id
        WHERE fi.id = $1`,
      [itemId],
    );
    return result.rows[0] ?? null;
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SectionPage(props: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<{ error?: string; back?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id, itemId } = await props.params;
  const { error, back } = await props.searchParams;
  // The task is keyed by the file item's uuid; a code or a stray value is a
  // missing page, not a database error (UAT B26).
  if (!UUID_RE.test(itemId)) notFound();
  // Return-context navigation (e.g. CRA → E4 paper → back to CRA). Only
  // engagement-internal paths are honoured — anything else is dropped.
  const backHref = back && back.startsWith(`/engagements/${id}/`) && !back.includes("//") ? back : null;
  const locale = await getLocale();
  const t = getMessages(locale);

  const [engagement, section] = await Promise.all([getEngagement(id), sectionInfo(itemId)]);
  if (!engagement || !section || section.engagement_id !== id) notFound();

  const group = groupOfTask(section.code);
  const paperDef = paperFor(section.code);
  // version BEFORE values: a save in between then refuses (safe), never overwrites
  const paperBaseVersion = await paperVersion(id, section.code);
  const paperValues = await loadPaper(id, section.code);
  // What the form is built from, posted back so a concurrent save holds back
  // only a field both people changed (UAT run 3 firm.perf-concurrent) …
  const paperDigests = paperBaseDigests(paperValues);
  // … and the user's own text for such a field, given back after the refusal.
  const heldBack =
    error === "stale-edit-conflict" ? decodePaperDraft((await cookies()).get(paperDraftCookie(itemId))?.value) : null;
  const wizardValues = heldBack ? { ...paperValues, ...heldBack.drafts } : paperValues;
  // C5.8 shows the /legal equity monitor's figures and conclusion (UAT run 3 firm.stat.c5-8)
  const c58 =
    section.code === "C5.8"
      ? await Promise.all([equityStatus(id), listDeadlines(id)])
          .then(([figures, deadlines]) => ({
            figures,
            conclusion: equityConclusionOf(figures, deadlines.find((d) => d.key === "egm_equity") ?? null),
          }))
          .catch(() => null)
      : null;
  const attachments = await listAttachments(itemId);
  // The Independence task (P2.1) embeds the campaign. Rendering it also runs
  // the 24-hour reminder sweep — idempotent per day, so simply working the
  // file keeps reminders flowing without a separate scheduler.
  const isIndependenceTask = section.code === "P2.1";
  // The CRA cluster needs the width: no attachments/linked-tasks rail there.
  const wideBoard = section.code === "S3.1" || section.code === "S5.5";
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
      autoValues.benchmark = `${m.benchmark} · PM ${n(m.overall)} (${m.percentage}% × ${n(m.benchmarkAmount)}) · TE ${n(m.performance)} (${m.performancePct}% PM) · SAD Nominal ${n(m.trivial)} (${m.trivialPct}% PM) FCFA (${m.status}${m.approvedByName ? " · " + m.approvedByName : ""})`;
      const sm = await specificThresholds(id);
      if (sm.size > 0) autoValues.benchmark += ` · ${sm.size} specific threshold${sm.size > 1 ? "s" : ""} (P6.2)`;
    }
  }
  if (section.code === "S6.1") {
    const [m, risks] = await Promise.all([approvedMateriality(id), listRisks(id)]);
    const live = risks.filter((r) => !r.rebutted);
    const sig = live.filter((r) => r.significant).length;
    const n = (x: number) => new Intl.NumberFormat("fr-FR").format(x);
    // In the reader's language (UAT B74: Part C came out in English on a French file).
    const fr61 = locale === "fr";
    const risksLine = fr61
      ? `${live.length} risque(s), dont ${sig} important(s)`
      : `${live.length} risk(s), ${sig} significant`;
    autoValues.context = m
      ? `${benchmarkLabel(m.benchmark, fr61)} · PM ${n(m.overall)} · TE ${n(m.performance)} (${m.performancePct}% PM) · SAD ${n(m.trivial)} (${m.trivialPct}% PM) FCFA · ${risksLine}`
      : `${fr61 ? "Seuil de signification non encore approuvé" : "Materiality not approved yet"} · ${risksLine}`;
  }
  // S5.4 — the journal-entry selection design recorded by the JE engine (UAT B76)
  if (section.code === "S5.4" && paperValues.je_design) {
    try {
      const d = JSON.parse(paperValues.je_design) as { criteria?: string[]; userRules?: unknown[]; selectedLines?: number; populationLines?: number; recordedBy?: string; recordedAt?: string };
      const when = d.recordedAt ? d.recordedAt.slice(0, 16).replace("T", " ") : "";
      autoValues.je_design = locale === "fr"
        ? `Critères : ${(d.criteria ?? []).join(", ") || "—"} · règles : ${d.userRules?.length ?? 0} · ${d.selectedLines ?? 0} ligne(s) sélectionnée(s) sur ${d.populationLines ?? 0} · par ${d.recordedBy ?? "—"} le ${when}`
        : `Criteria: ${(d.criteria ?? []).join(", ") || "—"} · rules: ${d.userRules?.length ?? 0} · ${d.selectedLines ?? 0} line(s) selected of ${d.populationLines ?? 0} · by ${d.recordedBy ?? "—"} on ${when}`;
      // earlier designs stay on file as dated history (UAT run 2 B16)
      let earlier = 0;
      try {
        const h = JSON.parse(paperValues.je_design_history ?? "[]") as unknown;
        earlier = Array.isArray(h) ? h.length : 0;
      } catch {
        earlier = 0;
      }
      if (earlier > 0) {
        autoValues.je_design += locale === "fr"
          ? ` · ${earlier} conception(s) antérieure(s) conservée(s) au dossier`
          : ` · ${earlier} earlier design(s) kept on file`;
      }
    } catch {
      autoValues.je_design = paperValues.je_design;
    }
  }
  // E6.10 — the tie-out of the trial balance rides beside the paper (UAT B114)
  const tieout = section.code === "E6.10" ? await runFsTieout(id).catch(() => null) : null;
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
  // S2.3 — the IT-applications register (editable); S2.5 reads the same record
  const itApps = section.code === "S2.3" || section.code === "S2.5" ? await itAppsView(id) : null;
  // C6.1 is the archive checklist; C6.2 carries the same board with the
  // Archive button, so the decision sits beside the list of what would stop it.
  const archiveView =
    section.code === "C6.1" || section.code === "C6.2" ? await archiveChecklist(id, isFr ? "fr" : "en") : null;
  // S4.3/S4.4 — the planning sub-registers ride with the paper, and again on
  // the execution papers that take them over (E6.2 related parties, E6.7
  // estimates): one register, read and updated from either end.
  const relatedParties = section.code === "S4.3" || section.code === "E6.2" ? await listRelatedParties(id) : null;
  const estimates = section.code === "S4.4" || section.code === "E6.7" ? await listEstimates(id) : null;
  // An archived file is read-only everywhere: the paper, the boards, the
  // sign-off chips, the conclusion and the evidence (ISA 230 ¶15-16).
  const archived = Boolean(section.archived_at);
  // S6.1/S4.2 — legacy scoping triggers surfaced on the working paper
  const triggerDef = section.code === "S6.1" || section.code === "S4.2" ? FORM_DEFINITIONS[section.code] : null;
  const triggerValues = triggerDef ? (await loadForm(id, section.code)).values : {};
  // S1.x/S2.x + E1.1 — the SCOT Studio rides on the working papers: register
  // on S1.1, WCGW/controls builder on S1.2, walkthroughs on S1.3, selection on
  // S2.1 and test design on S2.2. Each takes the wizard's embed slot, so the
  // board is the first page of the paper rather than a screen beside it.
  //
  // E1.1 is not among them. It used to open on the tested-controls board, which
  // lists the business cycles — order to cash, purchase to pay — and those are
  // not what an ITGC paper is about: it tests change, access, operations and
  // support over the applications the audit depends on.
  const SCOT_MODES: Record<string, "wcgw" | "select" | "design" | "results"> = {
    "S1.2": "wcgw", "S2.1": "select", "S2.2": "design",
  };
  // E1.2 embeds the test-of-controls board (SCOTs -> selected controls).
  const isToc = section.code === "E1.2";
  const scotView =
    section.code === "S1.1" || section.code === "S1.3" || isToc || section.code in SCOT_MODES
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
  // the design the paper executes — the return path to S5.5
  const designItemId = isAccountTask ? await s55ItemId(id).catch(() => null) : null;
  const accountHasSelection =
    isAccountTask && accountIndex ? await dspHasSelection(id, accountIndex).catch(() => false) : false;
  // the account's lead schedule from the working TB: its total heads the
  // paper and links to the Lead Schedule tool
  const accountSchedule =
    isAccountTask && accountIndex
      ? ((await apLeadSchedules(id)).find((s) => s.def.code === accountIndex) ?? null)
      : null;
  const accountInIndex =
    isAccountTask && accountIndex
      ? accountSchedule !== null
      : isAccountTask; // non-index tasks (Leases, TFT) stay usable
  // The S5.5 design IS the program: materialise it the moment the paper is
  // opened (generatePsp is idempotent and exits on existing steps), so nobody
  // is ever asked to click "generate" for work already designed.
  if (isAccountTask && accountIndex && accountHasSelection && accountInIndex) {
    await generatePsp(id, itemId, section.code, [accountIndex]).catch(() => {});
  }
  const pspVals = isAccountTask ? await pspResults(id, section.code) : {};
  // P7 — the planning review & approval summary takes over the centre column
  const ras = section.code === "P7.2" ? await planningRas(id) : null;
  // C1.2 — the significant matters the memo covers, read from the file (UAT B151)
  const srm = section.code === "C1.2" ? await srmMatters(id).catch(() => null) : null;
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
  // renaming or deleting evidence is a manager-and-above action (server-enforced)
  const canManageEvidence = userRole !== null && atLeast(userRole, "manager");
  // soft-deleted evidence still inside the recovery window, for Restore
  const deletedAttachments = canManageEvidence ? await listDeletedAttachments(itemId) : [];
  // A read-only account never edits; the EQR reads the team's work and writes
  // only their own review record, C4.2 (UAT run 2 B01/B18). The server refuses
  // either way — this keeps the page from offering what it will refuse.
  // The EQR is the firm-role reviewer OR whoever holds the team role on this
  // engagement (UAT run 3 B03). On C4.2 the review part (EQR_C42_KEYS) is the
  // appointed reviewer's alone where an EQR is required, and the reviewer
  // writes nothing else there (B02) — the server refuses either way.
  const eqr = await eqrStanding(id);
  const isEqr = eqr.actsAsEqr;
  const isC42 = section.code === EQR_OWN_PAPER;
  const mayWrite = userRole !== null && canWrite(userRole);
  const viewOnly =
    archived || !mayWrite || (isEqr && !isC42) || (isC42 && userRole === "eqr_reviewer" && !eqr.appointed);
  const lockedKeys = !isC42
    ? undefined
    : eqr.appointed
      ? [...paperKeys(paperFor(section.code))].filter((k) => !EQR_C42_KEYS.includes(k))
      : eqr.required
        ? [...EQR_C42_KEYS]
        : undefined;
  // the EQR signs nothing through the P/R chips (signDocument refuses them)
  const chipsLocked = archived || !mayWrite || isEqr;
  // the appointed reviewer's own sign-off chip, on C4.2 only
  const showEqrChip = isC42 && (eqr.appointed || eqr.required || eqr.signoff !== null);
  const eqrChipActive = showEqrChip && eqr.appointed && !archived && mayWrite && eqr.signoff === null;
  const canMarkNa = userRole !== null && canReview(userRole) && !isEqr;
  const taskInfo = await taskForItem(id, section.code);
  const CROSS_LINKS: Record<string, string[]> = {
    "P1.1": ["P1.2", "P2.1"], "P2.1": ["P1.1", "P1.5"], "P1.2": ["P1.1", "E6.5"],
    "P1.5": ["P2.1", "C4.2"], "P6.1": ["C1.1", "S3.1"], "S4.1": ["E6.9"],
    "P5.1": ["E3.1", "E4.1"], "S4.2": ["E6.3", "C2.2"], "S4.3": ["E6.2"], "S4.4": ["E6.7"],
    "S3.1": ["P5.1", "E1.1"], "C1.1": ["P6.1", "C1.2"], "C2.2": ["E6.6", "E6.3", "C5.1"],
    "S1.1": ["P6.2", "S1.2"], "S1.2": ["S1.3", "E1.1"], "S1.3": ["S1.2", "E1.1"], "S1.4": ["E3.1", "C2.1"],
    "S2.1": ["S2.2", "E1.1"], "S2.2": ["E1.1", "S3.1"], "S5.1": ["P2.2"], "S5.2": ["P4.3"], "S5.3": ["E1.1"],
    "S6.1": ["P7.2", "P6.1", "S3.1"], "S6.2": ["P7.2", "S6.1"],
    "C3.1": ["C1.1", "E6.9"], "C4.2": ["P1.5", "C5.1"], "C5.1": ["C1.1", "C2.2", "C4.2"],
    "C4.1": ["C4.3", "C6.1"], "C1.2": ["C1.1", "C1.3"], "C5.3": ["E6.2"], "C5.8": ["E4.9", "E6.3"],
    "E6.2": ["S4.3", "C5.3"], "E6.7": ["S4.4"],
  };
  // The E4 account papers carry no linked-tasks rail, so the two task lookups
  // that fill it are worth making only for every other task.
  let linkedTasks: { code: string; title: string; href: string }[] = [];
  if (!isAccountTask) {
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
  // evidence filed as documents on the task (accepted PBC uploads, letters)
  const itemDocuments = await listItemDocuments(itemId);
  const [steps, conclusion, team, assignee] = await Promise.all([
    listProgramSteps(itemId),
    getSectionConclusion(itemId),
    listTeam(id),
    getTaskAssignee(itemId),
  ]);
  const te = t.planning.execution;
  const tfd = t.planning.findings;
  const fr = locale === "fr";
  const canAssign = canReview(session.user.role) && !isEqr;

  // Tasks driven by a dedicated tool link to it right on the task header —
  // the reader never hunts through Tools for the screen that feeds the paper.
  const TOOL_LINKS: Record<string, { path: string; en: string; fr: string }> = {
    "P6.1": { path: "tools/materiality", en: "Materiality tool", fr: "Outil de matérialité" },
    "P6.2": { path: "tools/materiality", en: "Materiality tool", fr: "Outil de matérialité" },
    "C1.1": { path: "tools/sad", en: "SAD tool", fr: "Outil SAD" },
    "S3.1": { path: "risks", en: "Risk register", fr: "Registre des risques" },
    "P1.1": { path: "tools/independence", en: "Independence tool", fr: "Outil d'indépendance" },
    "S2.1": { path: "data", en: "Trial balance analyzer", fr: "Analyseur de balance" },
    "S2.2": { path: "tools/gl-console", en: "GL console", fr: "Console grand livre" },
  };
  const toolLink = TOOL_LINKS[section.code] ?? null;
  const toolChip = toolLink ? (
    <Link
      href={`/engagements/${id}/${toolLink.path}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/40 bg-emerald-50 px-3 py-1 text-[11.5px] font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
      data-testid="linked-tool"
    >
      🔧 {fr ? toolLink.fr : toolLink.en}
    </Link>
  ) : null;

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const naForm = (
    <form action={markNotApplicableAction.bind(null, id, itemId)} className="flex items-center gap-1" data-testid="task-na-form">
      {section.na_reason ? (
        <>
          <input type="hidden" name="clear" value="1" />
          <span className="max-w-[260px] truncate text-[11.5px] text-warn" title={section.na_reason} data-testid="task-na-reason">
            {fr ? "Non applicable : " : "Not applicable: "}{section.na_reason}
          </span>
          {canMarkNa ? (
            <SubmitButton className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-2 py-1 text-[11.5px] text-ink-soft hover:bg-surface-2" testId="task-na-clear">
              {fr ? "Réactiver" : "Reinstate"}
            </SubmitButton>
          ) : null}
        </>
      ) : canMarkNa ? (
        <>
          <input name="naReason" required maxLength={500} placeholder={fr ? "Motif de non-application…" : "Why it does not apply…"} className={`${input} w-52`} data-testid="task-na-input" />
          <SubmitButton className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-2 py-1 text-[11.5px] text-ink-soft hover:bg-surface-2" testId="task-na-save">
            {fr ? "Marquer non applicable" : "Mark not applicable"}
          </SubmitButton>
        </>
      ) : null}
    </form>
  );
  const btn =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2";

  const hasTools = (paperDef.tools?.length ?? 0) > 0;
  const req = ((locale === "fr" ? paperDef.reqFr : paperDef.reqEn) ?? []) as string[];
  // The same due date the group list and the form page show for this task.
  const dueDate = taskInfo ? effectiveDueDate(taskInfo, engagement.periodEnd) : null;
  const overdue = dueDate !== null && dueDate < new Date().toISOString().slice(0, 10) && taskInfo?.status !== "reviewed";
  const pSigned = Boolean(taskInfo?.preparerName);
  const rSigned = Boolean(taskInfo?.reviewerName);
  const chip = (on: boolean) =>
    `grid h-7 w-7 place-items-center rounded-full text-[12px] font-extrabold transition ${
      on ? "bg-emerald-600 text-white" : "bg-surface-2 text-muted hover:bg-line/70"
    }`;

  // ── E4 account tasks: the one screen that is not the shared working-paper
  //    screen — a clean page with no questionnaire and no guidance rail,
  //    because the lead schedule needs the width. Back returns to the Accounts
  //    group; the content is the procedure list with each procedure's paper.
  if (isAccountTask) {
    // The account's default working paper (E/F/K/N) is attached on first open,
    // so the documents list below already carries it.
    await ensureDefaultWorkpaper(id, itemId, section.code).catch(() => {});
    const accountAttachments = templateForCode(section.code) ? await listAttachments(itemId) : attachments;
    return (
      <main className="min-h-screen w-full px-6 py-6">
        <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href={backHref ?? `/engagements/${id}/groups/e4`}
            className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
            title={backHref ? (fr ? "Retour" : "Back") : fr ? "Retour aux comptes" : "Back to Accounts"}
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
          {designItemId ? (
            <Link
              href={`/engagements/${id}/sections/${designItemId}`}
              className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-2 py-1 text-[11.5px] font-semibold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
              title={fr ? "Retour à la conception des procédures substantives" : "Back to the substantive-procedures design"}
              data-testid="wp-back-design"
            >
              ← {fr ? "Conception (S5.5)" : "Design (S5.5)"}
            </Link>
          ) : null}
          {/* the same P / R sign-off chips as every other working paper: the
              account's status reads off these, and the archive checklist's
              "fix" link lands here to sign */}
          <span className="flex items-center gap-1.5 text-[12px] text-muted tnum">
            {fr ? "Échéance" : "Deadline"}: {dueDate ?? "—"}
            <Chip tone={overdue ? "rose" : "good"}>{overdue ? (fr ? "En retard" : "Overdue") : fr ? "Dans les temps" : "On track"}</Chip>
          </span>
          <span className="flex items-center gap-1.5">
            {chipsLocked ? (
              <>
                <span className={chip(pSigned)} title={pSigned ? `${taskInfo?.preparerName} · ${taskInfo?.preparerAt}` : ""} data-testid="chip-preparer" data-signed={String(pSigned)}>P</span>
                <span className={chip(rSigned)} title={rSigned ? `${taskInfo?.reviewerName} · ${taskInfo?.reviewerAt}` : ""} data-testid="chip-reviewer" data-signed={String(rSigned)}>R</span>
              </>
            ) : (
              <>
                <form action={signOffPreparerAction}>
                  <input type="hidden" name="fileItemId" value={itemId} />
                  <input type="hidden" name="engagementId" value={id} />
                  <input type="hidden" name="returnTo" value={`/engagements/${id}/sections/${itemId}`} />
                  <button type="submit" className={chip(pSigned)} title={pSigned ? `${taskInfo?.preparerName} · ${taskInfo?.preparerAt}` : fr ? "Signer préparateur" : "Sign as preparer"} data-testid="chip-preparer" data-signed={String(pSigned)}>
                    P
                  </button>
                </form>
                {rSigned || canReview(session.user.role) ? (
                  <form action={signOffReviewerAction}>
                    <input type="hidden" name="fileItemId" value={itemId} />
                    <input type="hidden" name="engagementId" value={id} />
                    <input type="hidden" name="returnTo" value={`/engagements/${id}/sections/${itemId}`} />
                    <button type="submit" className={chip(rSigned)} title={rSigned ? `${taskInfo?.reviewerName} · ${taskInfo?.reviewerAt}` : fr ? "Signer réviseur" : "Sign as reviewer"} data-testid="chip-reviewer" data-signed={String(rSigned)}>
                      R
                    </button>
                  </form>
                ) : (
                  <span className={chip(false)} title={fr ? "Revue réservée aux seniors et rangs supérieurs" : "Review is for seniors and above"} data-testid="chip-reviewer" data-signed="false">
                    R
                  </span>
                )}
              </>
            )}
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-muted">
            {fr ? "Assigné à" : "Assigned to"}
            {canAssign && !viewOnly ? (
              <form action={assignTaskAction.bind(null, id, itemId)} className="flex items-center gap-1">
                <select name="assignee" defaultValue={assignee?.userId ?? ""} className={input} data-testid="task-assignee">
                  <option value="">—</option>
                  {team.map((member) => (
                    <option key={member.userId} value={member.userId}>{member.userName}</option>
                  ))}
                  {/* an assignee no longer on the team is shown, not hidden behind "—" (UAT run 2 B04) */}
                  {assignee && !team.some((member) => member.userId === assignee.userId) ? (
                    <option value={assignee.userId}>
                      {assignee.name} {fr ? "(hors équipe)" : "(not on team)"}
                    </option>
                  ) : null}
                </select>
                <SubmitButton className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-2 py-1 text-[11.5px] text-ink-soft hover:bg-surface-2" testId="task-assign-save">OK</SubmitButton>
              </form>
            ) : (
              <b className="text-ink-soft" data-testid="task-assignee">{assignee?.name ?? "—"}</b>
            )}
          </span>
          {naForm}
        </div>
        <ErrorBanner error={error} locale={locale} />
        <Panel className="mt-4">
          <AccountWorkpaper
            engagementId={id}
            fileItemId={itemId}
            taskCode={section.code}
            indexCode={accountIndex}
            inIndex={accountInIndex}
            hasSelection={accountHasSelection}
            designHref={designItemId ? `/engagements/${id}/sections/${designItemId}` : null}
            steps={localizePspSteps(steps.filter((s) => s.source === "psp" || s.description.startsWith("OSP-")), locale)}
            results={pspVals}
            attachmentsSlot={<TaskAttachments fileItemId={itemId} initial={accountAttachments} deletedInitial={deletedAttachments} documents={itemDocuments} locale={fr ? "fr" : "en"} canManage={canManageEvidence && !viewOnly} readOnly={viewOnly} compact />}
            leadSchedule={
              accountSchedule
                ? {
                    href: `/engagements/${id}/tools/lead-schedule#${encodeURIComponent(accountSchedule.def.code)}`,
                    closing: accountSchedule.closing,
                    prior: accountSchedule.prior,
                    movement: accountSchedule.movement,
                    variancePct: accountSchedule.variancePct,
                    accounts: accountSchedule.accounts.length,
                  }
                : null
            }
            readOnly={viewOnly}
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
          {viewOnly ? null : (
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
            {/* no procedure retained: "objectives achieved" needs a written rationale (UAT B45) */}
            {steps.filter((s) => s.status !== "na").length === 0 ? (
              <label className="flex w-full flex-col text-xs text-muted">
                {fr
                  ? "Aucune procédure retenue — motif d'une conclusion sans procédure (obligatoire)"
                  : "No procedure retained — rationale for concluding without procedures (required)"}
                <textarea
                  name="noProceduresRationale"
                  rows={2}
                  defaultValue={conclusion?.noProceduresRationale ?? ""}
                  className={`${input} mt-1 w-full`}
                  data-testid="no-procedures-rationale"
                />
              </label>
            ) : null}
            <button type="submit" className={btn} data-testid="save-conclusion">
              {te.saveConclusion}
            </button>
          </form>
          )}
          {conclusion?.conclusion && !conclusion.reviewedByName && !viewOnly ? (
            <form action={reviewConclusionAction.bind(null, id, itemId, false)} className="mt-2">
              <button type="submit" className={btn} data-testid="review-conclusion">
                {te.review}
              </button>
            </form>
          ) : null}
        </Panel>

        {/* a matter arising on this account: C1.2 significant matter or C5.1 deficiency (UAT B21) */}
        {viewOnly ? null : (
        <Panel className="mt-4" data-testid="account-finding">
          <PanelHeader title={te.matterArising} />
          <form action={routeFindingAction.bind(null, id, itemId)} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs text-muted">
              {te.routeTo}
              <select name="route" defaultValue="c1" className={`${input} mt-1`} data-testid="finding-route">
                <option value="c1">{te.routes.c1}</option>
                <option value="b4">{te.routes.b4}</option>
              </select>
            </label>
            <label className="flex flex-col text-xs text-muted">
              {tfd.severity}
              <select name="severity" defaultValue="deficiency" className={`${input} mt-1`} data-testid="finding-severity">
                {FINDING_SEVERITIES.map((s) => (
                  <option key={s} value={s}>{tfd.severities[s]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs text-muted">
              {te.titleField}
              <input name="title" required className={`${input} mt-1 w-72 max-w-full`} data-testid="finding-title" />
            </label>
            <label className="flex flex-col text-xs text-muted">
              {te.detailField}
              <input name="detail" className={`${input} mt-1 w-72 max-w-full`} data-testid="finding-detail" />
            </label>
            <label className="flex flex-col text-xs text-muted">
              {tfd.recommendation}
              <input name="recommendation" className={`${input} mt-1 w-72 max-w-full`} data-testid="finding-recommendation" />
            </label>
            <button type="submit" className={btn} data-testid="raise-finding">
              {te.raise}
            </button>
          </form>
        </Panel>
        )}
      </main>
    );
  }

  // ── The one working-paper screen every task in the file shares: header band
  //    + 25/50/25, no page scroll. The E4 account family returned above; each
  //    task-specific board rides in the wizard's embed slot rather than in a
  //    screen of its own, so the reader always finds the same furniture.
  return (
    <main className="flex min-h-screen w-full flex-col gap-3 px-4 py-4 xl:h-screen xl:overflow-hidden xl:px-6" data-testid="wp-screen">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-atlas)] border border-glass-border bg-surface px-4 py-2.5 shadow-atlas-sm backdrop-blur-xl">
        {toolChip}
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
          {chipsLocked ? (
            <>
              <span className={chip(pSigned)} title={pSigned ? `${taskInfo?.preparerName} · ${taskInfo?.preparerAt}` : ""} data-testid="chip-preparer" data-signed={String(pSigned)}>P</span>
              <span className={chip(rSigned)} title={rSigned ? `${taskInfo?.reviewerName} · ${taskInfo?.reviewerAt}` : ""} data-testid="chip-reviewer" data-signed={String(rSigned)}>R</span>
            </>
          ) : (
          <>
          <form action={signOffPreparerAction}>
            <input type="hidden" name="fileItemId" value={itemId} />
            <input type="hidden" name="engagementId" value={id} />
            <input type="hidden" name="returnTo" value={`/engagements/${id}/sections/${itemId}`} />
            <button type="submit" className={chip(pSigned)} title={pSigned ? `${taskInfo?.preparerName} · ${taskInfo?.preparerAt}` : fr ? "Signer préparateur" : "Sign as preparer"} data-testid="chip-preparer" data-signed={String(pSigned)}>
              P
            </button>
          </form>
          {rSigned || canReview(session.user.role) ? (
            <form action={signOffReviewerAction}>
              <input type="hidden" name="fileItemId" value={itemId} />
              <input type="hidden" name="engagementId" value={id} />
              <input type="hidden" name="returnTo" value={`/engagements/${id}/sections/${itemId}`} />
              <button type="submit" className={chip(rSigned)} title={rSigned ? `${taskInfo?.reviewerName} · ${taskInfo?.reviewerAt}` : fr ? "Signer réviseur" : "Sign as reviewer"} data-testid="chip-reviewer" data-signed={String(rSigned)}>
                R
              </button>
            </form>
          ) : (
            // below senior there is nothing to press and be refused (UAT B129)
            <span className={chip(false)} title={fr ? "Revue réservée aux seniors et rangs supérieurs" : "Review is for seniors and above"} data-testid="chip-reviewer" data-signed="false">
              R
            </span>
          )}
          </>
          )}
          {showEqrChip ? (
            eqrChipActive ? (
              <form action={signOffEqrAction}>
                <input type="hidden" name="fileItemId" value={itemId} />
                <input type="hidden" name="engagementId" value={id} />
                <input type="hidden" name="returnTo" value={`/engagements/${id}/sections/${itemId}`} />
                <button type="submit" className={chip(false)} title={fr ? "Signer en tant que réviseur qualité (EQR)" : "Sign as engagement quality reviewer"} data-testid="chip-eqr" data-signed="false">
                  EQR
                </button>
              </form>
            ) : (
              <span
                className={chip(eqr.signoff !== null)}
                title={eqr.signoff ? `${eqr.signoff.name} · ${eqr.signoff.at}` : fr ? "Réservé au réviseur qualité désigné" : "For the appointed quality reviewer only"}
                data-testid="chip-eqr"
                data-signed={String(eqr.signoff !== null)}
              >
                EQR
              </span>
            )
          ) : null}
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-muted">
          {fr ? "Assigné à" : "Assigned to"}
          {canAssign && !viewOnly ? (
            <form action={assignTaskAction.bind(null, id, itemId)} className="flex items-center gap-1">
              <select name="assignee" defaultValue={assignee?.userId ?? ""} className={input} data-testid="task-assignee">
                <option value="">—</option>
                {team.map((member) => (
                  <option key={member.userId} value={member.userId}>{member.userName}</option>
                ))}
                {assignee && !team.some((member) => member.userId === assignee.userId) ? (
                  <option value={assignee.userId}>
                    {assignee.name} {fr ? "(hors équipe)" : "(not on team)"}
                  </option>
                ) : null}
              </select>
              <SubmitButton className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-2 py-1 text-[11.5px] text-ink-soft hover:bg-surface-2" testId="task-assign-save">OK</SubmitButton>
            </form>
          ) : (
            <b className="text-ink-soft" data-testid="task-assignee">{assignee?.name ?? "—"}</b>
          )}
        </span>
        {naForm}
      </div>

      <ErrorBanner error={error} locale={locale} />
      {heldBack ? (
        <div className="mb-3 rounded-[var(--radius-atlas-sm)] border border-line bg-[var(--color-warn-soft)] px-3 py-2 text-[12.5px] text-ink" data-testid="wp-held-back">
          <p className="font-semibold">
            {fr
              ? "Vos autres modifications ont été enregistrées. Votre texte pour les champs ci-dessous a été conservé dans le formulaire ; un collègue les a modifiés entre-temps. Comparez avec sa version, fusionnez, puis enregistrez."
              : "Your other changes were saved. Your text for the fields below is kept in the form; a colleague changed them meanwhile. Compare with their version, merge, then save."}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {Object.keys(heldBack.drafts).map((key) => (
              <li key={key}>
                <b>{paperFieldLabel(paperDef, key, fr)}</b>
                {" — "}
                {fr ? "version enregistrée par le collègue : " : "colleague's saved version: "}
                <span className="whitespace-pre-wrap text-ink-soft">{(paperValues[key] ?? "").slice(0, 600) || "—"}</span>
              </li>
            ))}
          </ul>
          {heldBack.truncated ? (
            <p className="mt-1 text-warn">
              {fr ? "Votre texte était trop long pour être conservé en entier : la fin a été coupée." : "Your text was too long to keep in full: its end was cut."}
            </p>
          ) : null}
        </div>
      ) : null}
      {c58 ? (
        <div className="mb-3 rounded-[var(--radius-atlas-sm)] border border-line bg-surface px-3 py-2 text-[12.5px]" data-testid="c58-equity">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-ink">{fr ? "Suivi des capitaux propres (art. 664)" : "Net equity monitor (art. 664)"}</b>
            <Link href={`/engagements/${id}/legal`} className="text-emerald-700 underline dark:text-emerald-400" data-testid="c58-legal-link">
              {fr ? "Ouvrir le suivi juridique" : "Open the legal monitor"}
            </Link>
          </div>
          {c58.figures.hasTb ? (
            <p className="mt-1 text-ink-soft tnum" data-testid="c58-figures">
              {t.planning.legal.equityValue}: <b>{formatFCFA(c58.figures.equity)}</b>
              {c58.figures.halfCapital !== null ? (
                <>
                  {" "}· {t.planning.legal.halfCapital}: <b>{formatFCFA(c58.figures.halfCapital)}</b>
                </>
              ) : (
                <> · {fr ? "capital social non renseigné" : "share capital not recorded"}</>
              )}
            </p>
          ) : (
            <p className="mt-1 text-muted" data-testid="c58-figures">{t.planning.legal.noTbYet}</p>
          )}
          {c58.conclusion === "breach" ? (
            <p className="mt-1 font-medium text-rose" data-testid="c58-conclusion" data-conclusion="breach">{t.planning.legal.equityBreach}</p>
          ) : c58.conclusion === "unchecked-breach" ? (
            <p className="mt-1 font-medium text-rose" data-testid="c58-conclusion" data-conclusion="unchecked-breach">{t.planning.legal.equityBelowUnchecked}</p>
          ) : c58.conclusion === "stale" ? (
            <p className="mt-1 font-medium text-warn" data-testid="c58-conclusion" data-conclusion="stale">{t.planning.legal.equityStale}</p>
          ) : c58.conclusion === "ok" ? (
            <p className="mt-1 font-medium text-emerald-700 dark:text-emerald-400" data-testid="c58-conclusion" data-conclusion="ok">{t.planning.legal.equityOk}</p>
          ) : null}
        </div>
      ) : null}

      <div className={`wp-print-flow grid min-h-0 flex-1 grid-cols-1 gap-3 xl:overflow-hidden ${wideBoard ? "xl:grid-cols-[22fr_78fr]" : "xl:grid-cols-[25fr_50fr_25fr]"}`}>
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
            <Fold
              title={isFr ? "Identification des comptes significatifs" : "Identification of significant accounts"}
              hint={isFr ? "replier pour faire place au questionnaire" : "fold to make room for the questionnaire"}
              className="mb-2"
              testId="fold-sig-accounts"
            >
              <div className="min-h-0 max-h-[52vh] overflow-auto" data-testid="wp-sig-accounts">
                <SignificantAccounts engagementId={id} view={sigAccounts} locale={isFr ? "fr" : "en"} />
              </div>
            </Fold>
          ) : null}
          {triggerDef ? (
            <TriggerPanel engagementId={id} definition={triggerDef} values={triggerValues} returnTo={`/engagements/${id}/sections/${itemId}`} locale={isFr ? "fr" : "en"} />
          ) : null}
          {relatedParties ? (
            <div className="mb-2 min-h-0 max-h-[45%] overflow-auto" data-testid="wp-related-parties">
              <RelatedPartyRegister engagementId={id} rows={relatedParties} returnTo={`/engagements/${id}/sections/${itemId}`} locale={isFr ? "fr" : "en"} carriedForwardLabel={t.planning.carriedForward ?? "Carried forward"} title={isFr ? "Registre des parties liées" : "Related-party register"} readOnly={viewOnly} />
            </div>
          ) : null}
          {estimates ? (
            <div className="mb-2 min-h-0 max-h-[45%] overflow-auto" data-testid="wp-estimates">
              <EstimatesRegister engagementId={id} rows={estimates} returnTo={`/engagements/${id}/sections/${itemId}`} locale={isFr ? "fr" : "en"} title={isFr ? "Inventaire des estimations" : "Estimates inventory"} readOnly={viewOnly} />
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
          {/* E6.10 tie-out board (UAT B114): the trial balance's own aggregates,
              the equilibrium checks with their differences, and any client-FS
              differences — so "column N agrees" is answered against figures. */}
          {section.code === "E6.10" ? (
            <div className="mb-2 min-h-0 max-h-[45%] overflow-auto rounded-[var(--radius-atlas-sm)] border border-line" data-testid="wp-tieout-board">
              {tieout ? (
                <table className="w-full text-[11.8px]">
                  <thead className="bg-surface-2 text-left text-[10px] uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-2 py-1.5">{fr ? "Poste (balance)" : "Caption (trial balance)"}</th>
                      <th className="px-2 py-1.5 text-right">{fr ? "Balance" : "TB total"}</th>
                      <th className="px-2 py-1.5 text-right">{fr ? "Publié" : "Published"}</th>
                      <th className="px-2 py-1.5 text-right">{fr ? "Écart" : "Difference"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tieout.checks.map((c) => (
                      <tr key={c.key} className={`border-t border-line ${c.ok ? "" : "bg-[var(--color-rose-soft)]"}`} data-testid={`tieout-check-${c.key}`}>
                        <td className="px-2 py-1 text-ink">
                          {c.key === "tb_balanced" ? (fr ? "Balance équilibrée (classes 1–8)" : "Trial balance balanced (classes 1–8)") : fr ? "Équilibre du bilan = résultat du CR" : "Balance sheet equilibrium = income-statement result"}
                        </td>
                        <td className="px-2 py-1 text-right tnum">—</td>
                        <td className="px-2 py-1 text-right tnum">—</td>
                        <td className={`px-2 py-1 text-right tnum ${c.ok ? "text-emerald-700" : "font-semibold text-rose"}`}>{c.ok ? "0" : new Intl.NumberFormat("fr-FR").format(Math.round(c.amount))}</td>
                      </tr>
                    ))}
                    {tieout.clientDiffs.map((d) => (
                      <tr key={d.ref} className="border-t border-line bg-[var(--color-rose-soft)]" data-testid={`tieout-diff-${d.ref}`}>
                        <td className="px-2 py-1 text-ink">{d.ref}</td>
                        <td className="px-2 py-1 text-right tnum">{new Intl.NumberFormat("fr-FR").format(d.recomputed)}</td>
                        <td className="px-2 py-1 text-right tnum">{new Intl.NumberFormat("fr-FR").format(d.client)}</td>
                        <td className="px-2 py-1 text-right font-semibold text-rose tnum">{new Intl.NumberFormat("fr-FR").format(d.difference)}</td>
                      </tr>
                    ))}
                    {tieout.bilan.map((l) => (
                      <tr key={l.ref} className="border-t border-line" data-testid={`tieout-line-${l.ref}`}>
                        <td className="px-2 py-1 text-ink-soft">{l.ref} · {l.label}</td>
                        <td className="px-2 py-1 text-right tnum">{new Intl.NumberFormat("fr-FR").format(Math.round(l.amount))}</td>
                        <td className="px-2 py-1 text-right text-muted tnum">{fr ? "à pointer" : "to tie"}</td>
                        <td className="px-2 py-1 text-right tnum">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-3 py-2 text-[11.8px] text-muted">
                  {fr ? "Aucune balance ingérée — le pointage se fait à partir de la balance importée dans l'Analyseur." : "No trial balance ingested — the tie-out runs on the balance imported in the Analyzer."}
                </p>
              )}
              {tieout && !tieout.pass ? (
                <p className="px-3 py-1.5 text-[11px] font-semibold text-rose" data-testid="tieout-unexplained">
                  {fr ? "Écarts non expliqués : la question « la colonne N concorde » ne peut être répondue Oui tant que la procédure de pointage ne les explique pas." : "Unexplained differences: “column N agrees” cannot be answered Yes until the tie-out procedure explains them."}
                </p>
              ) : null}
            </div>
          ) : null}
          {/* The paper owns the column on its own. When the execution panels
              ride below it the two share the height and each scrolls, so the
              wizard never pushes the panels off the screen. */}
          <MaybeFold
            when={section.code === "P6.2"}
            title={isFr ? "Conclusions & points clés" : "Conclusions & key findings"}
            hint={isFr ? "le questionnaire à revoir et compléter" : "the questionnaire to review and complete"}
            grow
            testId="fold-paper"
          >
          <div className="flex min-h-0 flex-1 flex-col">
          {srm ? <SrmMattersPanel matters={srm} locale={isFr ? "fr" : "en"} /> : null}
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
            readOnly={viewOnly}
            def={paperDef}
            values={wizardValues}
            baseVersion={paperBaseVersion}
            baseDigests={paperDigests}
            lockedKeys={lockedKeys}
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
              ) : archiveView ? (
                <ArchiveChecklist
                  engagementId={id}
                  checklist={archiveView}
                  locale={isFr ? "fr" : "en"}
                  archive={section.code === "C6.2" ? { canArchive: canPartnerSignoff(session.user.role), fiscalYear: engagement.fiscalYear } : undefined}
                />
              ) : scotView && isToc ? (
                <TocBoard engagementId={id} view={scotView} locale={isFr ? "fr" : "en"} />
              ) : scotView && section.code in SCOT_MODES ? (
                <WcgwBuilder engagementId={id} view={scotView} mode={SCOT_MODES[section.code]} locale={isFr ? "fr" : "en"} />
              ) : fscpVals ? (
                <FscpForm engagementId={id} values={fscpVals} locale={isFr ? "fr" : "en"} />
              ) : craView ? (
                <CraBoard engagementId={id} view={craView} locale={isFr ? "fr" : "en"} />
              ) : dspV ? (
                <DesignProceduresBoard engagementId={id} view={dspV} locale={isFr ? "fr" : "en"} />
              ) : itApps ? (
                <ItAppsBoard engagementId={id} view={itApps} locale={isFr ? "fr" : "en"} readOnly={section.code === "S2.5" || viewOnly} />
              ) : undefined
            }
            embedOnly={["S1.2", "S1.3", "S2.1", "S2.2"].includes(section.code)}
            embedTitle={
              section.code === "S1.1"
                ? fr ? "Registre des SCOT" : "SCOT register"
                : section.code === "C6.1"
                  ? fr ? "Portes d'archivage et points ouverts" : "Archive gates and open items"
                  : section.code === "C6.2"
                    ? fr ? "Portes d'archivage et archivage" : "Archive gates and the archive"
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
                            : section.code === "S2.3"
                              ? fr ? "Applications IT & stratégie par application" : "IT applications & the strategy per application"
                              : section.code === "S2.5"
                                ? fr ? "Décisions S2.3 — évaluer contre ce tableau" : "S2.3 decisions — evaluate against this record"
                                : fr ? "Flux, WCGW & contrôles" : "Flows, WCGWs & controls"
            }
          />
          )}
          </div>
          </MaybeFold>
        </section>

        {wideBoard ? null : (
        <section className="flex min-h-0 flex-col gap-3 xl:overflow-hidden">
          <TaskAttachments fileItemId={itemId} initial={attachments} deletedInitial={deletedAttachments} documents={itemDocuments} locale={fr ? "fr" : "en"} canManage={canManageEvidence && !viewOnly} readOnly={viewOnly} compact />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-atlas)] border border-glass-border bg-surface px-4 py-3 shadow-atlas-sm backdrop-blur-xl" data-testid="wp-linked">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
              {fr ? "Tâches liées" : "Linked tasks"}
            </h2>
            <ul className="mt-1.5 flex min-h-0 flex-col overflow-hidden">
              {isToc ? (
                <li>
                  {/* the E1.2 paper built from this file's controls, grids and
                      exceptions — the pre-filled one, not the blank template */}
                  <a href={`/api/engagements/${id}/toc/export`} className="flex items-baseline gap-1.5 rounded-[var(--radius-atlas-xs)] px-1.5 py-1 text-[12.3px] font-semibold text-emerald-700 transition hover:bg-surface-2 dark:text-emerald-400" data-testid="linked-toc-export">
                    <span className="font-mono text-[10.5px] text-muted">TL</span>
                    <span className="min-w-0 flex-1 truncate">{fr ? "Générer le papier E1.2 (pré-rempli, .xlsx)" : "Generate the E1.2 paper (pre-filled, .xlsx)"}</span>
                  </a>
                </li>
              ) : null}
              {["S2.2", "S2.4", "S5.5"].includes(section.code) ? (
                <li>
                  <Link href={`/engagements/${id}/tools/sampling`} className="flex items-baseline gap-1.5 rounded-[var(--radius-atlas-xs)] px-1.5 py-1 text-[12.3px] font-semibold text-emerald-700 transition hover:bg-surface-2 dark:text-emerald-400" data-testid="linked-sampling-tool">
                    <span className="font-mono text-[10.5px] text-muted">TL</span>
                    <span className="min-w-0 flex-1 truncate">{fr ? "Outil d'échantillonnage — déterminer l'échantillon" : "Sampling tool — determine the sample"}</span>
                  </Link>
                </li>
              ) : null}
              {section.code === "C1.1" ? (
                <li>
                  <Link href={`/engagements/${id}/tools/sad`} className="flex items-baseline gap-1.5 rounded-[var(--radius-atlas-xs)] px-1.5 py-1 text-[12.3px] font-semibold text-emerald-700 transition hover:bg-surface-2 dark:text-emerald-400" data-testid="linked-sad-tool">
                    <span className="font-mono text-[10.5px] text-muted">TL</span>
                    <span className="min-w-0 flex-1 truncate">{fr ? "Récapitulatif des écarts d'audit (SAD)" : "Summary of Audit Differences (SAD)"}</span>
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
        )}
      </div>
    </main>
  );
}
