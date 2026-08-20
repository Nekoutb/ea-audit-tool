// Phase 4: execution/fieldwork. Program-step execution with conclusions and
// evidence, findings routing (spec §8.3 — every matter arising goes to exactly
// ONE of C1.2 / C1.1 / C5.1 / revise-approach with a backlink), misstatement
// accumulation against materiality (ISA 450), control tests whose deviations
// force a decision, the revise-approach loop (§8.4), and section conclusions
// with the two-stage (+ partner on significant risk) review chain (§6.3).

import { withTenant } from "@/lib/db";
import { hasOtherReviewer } from "@/lib/documents";
import { createNotification } from "@/lib/notifications";
import { canPartnerSignoff, canReview } from "@/lib/rbac";
import { requireTenant, requireWrite } from "@/lib/tenant";
import { invalidateStaleSignoffs, reportInvalidatedSignoffs } from "@/lib/working-papers";
import { logMisstatementChange } from "@/lib/activity";

export class ExecutionError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ExecutionError";
  }
}

// ---- 4.2 program-step execution ----

/**
 * Complete a program step: the conclusion, who reached it and when are recorded
 * together — a step is never "done" without them (assurance finding C7).
 * `engagementId`, where the caller knows it, scopes the step to that engagement
 * on top of the tenant isolation RLS already provides.
 */
export async function completeStep(
  stepId: string,
  conclusion: string,
  engagementId?: string,
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!conclusion.trim()) throw new ExecutionError("conclusion-required");
  await withTenant(tenantId, async (tx) => {
    const updated = await tx.query(
      `UPDATE program_step
          SET status = 'complete', conclusion = $2, completed_by = $3, completed_at = now()
        WHERE id = $1 AND status = 'planned'
          AND ($4::uuid IS NULL OR engagement_id = $4)`,
      [stepId, conclusion, userId, engagementId ?? null],
    );
    if (updated.rowCount === 0) throw new ExecutionError("not-found");
  });
}

/**
 * Undo a completion (the account workpaper's "procedure done" tick, unticked):
 * the step returns to planned and the conclusion/preparer/timestamp it carried
 * are cleared, so a completed step can never show a stale attribution.
 */
export async function uncompleteStep(stepId: string, engagementId?: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const updated = await tx.query(
      `UPDATE program_step
          SET status = 'planned', conclusion = NULL, completed_by = NULL, completed_at = NULL
        WHERE id = $1 AND status = 'complete'
          AND ($2::uuid IS NULL OR engagement_id = $2)`,
      [stepId, engagementId ?? null],
    );
    if (updated.rowCount === 0) throw new ExecutionError("not-found");
  });
}

export async function markStepNa(stepId: string, rationale: string): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!rationale.trim()) throw new ExecutionError("rationale-required");
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `UPDATE program_step SET status = 'na', conclusion = $2, completed_by = $3, completed_at = now()
        WHERE id = $1 AND status = 'planned'`,
      [stepId, `N/A: ${rationale}`, userId],
    );
  });
}

// ---- 4.3 evidence ----

export interface EvidenceInfo {
  id: string;
  kind: "file" | "dataset" | "document";
  title: string;
}

export async function addEvidenceFile(
  stepId: string,
  filename: string,
  mime: string,
  content: Buffer,
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const step = await tx.query<{ engagement_id: string }>(
      "SELECT engagement_id FROM program_step WHERE id = $1",
      [stepId],
    );
    if (!step.rows[0]) throw new ExecutionError("not-found");
    await tx.query(
      `INSERT INTO evidence (tenant_id, engagement_id, program_step_id, kind, title, mime, content, created_by)
       VALUES ($1, $2, $3, 'file', $4, $5, $6, $7)`,
      [tenantId, step.rows[0].engagement_id, stepId, filename, mime, content, userId],
    );
  });
}

export async function linkEvidence(
  stepId: string,
  kind: "dataset" | "document",
  targetId: string,
  title: string,
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const step = await tx.query<{ engagement_id: string }>(
      "SELECT engagement_id FROM program_step WHERE id = $1",
      [stepId],
    );
    if (!step.rows[0]) throw new ExecutionError("not-found");
    await tx.query(
      `INSERT INTO evidence (tenant_id, engagement_id, program_step_id, kind, title, dataset_id, document_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        step.rows[0].engagement_id,
        stepId,
        kind,
        title,
        kind === "dataset" ? targetId : null,
        kind === "document" ? targetId : null,
        userId,
      ],
    );
  });
}

export async function listEvidence(stepId: string): Promise<EvidenceInfo[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<EvidenceInfo>(
      "SELECT id, kind, title FROM evidence WHERE program_step_id = $1 ORDER BY created_at",
      [stepId],
    );
    return result.rows;
  });
}

// ---- 4.4/4.5 findings routing + misstatements ----

export type FindingRoute = "b4" | "c1" | "b5" | "revise";

export interface RouteFindingInput {
  engagementId: string;
  fileItemId?: string;
  programStepId?: string;
  route: FindingRoute;
  title: string;
  detail?: string;
  // b5 only:
  amount?: number;
  accounts?: string;
  mtype?: "factual" | "judgmental" | "projected" | "classification" | "disclosure";
  /** Required confirmation when a b5 amount is below the clearly-trivial threshold. */
  trivialConfirmed?: boolean;
  // revise only:
  significant?: boolean;
}

export interface RouteResult {
  destination: "b4" | "c1" | "b5" | "b5-trivial" | "risk";
}

export async function routeFinding(input: RouteFindingInput): Promise<RouteResult> {
  const { tenantId, userId } = await requireTenant();
  if (!input.title.trim()) throw new ExecutionError("title-required");

  return withTenant(tenantId, async (tx) => {
    if (input.route === "b4" || input.route === "c1") {
      await tx.query(
        `INSERT INTO finding (tenant_id, engagement_id, file_item_id, program_step_id, route, title, detail, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [tenantId, input.engagementId, input.fileItemId ?? null, input.programStepId ?? null, input.route, input.title, input.detail ?? null, userId],
      );
      return { destination: input.route };
    }

    if (input.route === "b5") {
      const amount = Number(input.amount);
      if (!Number.isFinite(amount) || amount === 0) throw new ExecutionError("amount-required");
      const materiality = await tx.query<{ trivial: string }>(
        `SELECT trivial::text FROM materiality
          WHERE engagement_id = $1 AND status = 'approved'
          ORDER BY version_no DESC LIMIT 1`,
        [input.engagementId],
      );
      const trivialThreshold = materiality.rows[0] ? Number(materiality.rows[0].trivial) : null;
      const isTrivial = trivialThreshold !== null && Math.abs(amount) < trivialThreshold;
      // Below clearly-trivial: refuse to accumulate; log as trivial only with
      // the "not indicative of a pervasive issue" confirmation (spec §6.2).
      if (isTrivial && !input.trivialConfirmed) throw new ExecutionError("trivial-confirm-required");
      await tx.query(
        `INSERT INTO misstatement
           (tenant_id, engagement_id, file_item_id, program_step_id, description, accounts, amount, mtype, trivial, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [tenantId, input.engagementId, input.fileItemId ?? null, input.programStepId ?? null, input.title, input.accounts ?? null, amount, input.mtype ?? "factual", isTrivial, userId],
      );
      return { destination: isTrivial ? "b5-trivial" : "b5" };
    }

    // revise-approach (spec §8.4): a dated risk appended after planning
    // approval, requiring partner re-approval of the addition.
    const risk = await tx.query<{ id: string }>(
      `INSERT INTO risk (tenant_id, engagement_id, description, source, significant, added_after_planning, created_by)
       VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING id`,
      [tenantId, input.engagementId, input.title, "Revise-approach (execution)", input.significant ?? false, userId],
    );
    if (input.fileItemId) {
      await tx.query(
        "INSERT INTO risk_section (tenant_id, risk_id, file_item_id, assertions) VALUES ($1, $2, $3, '{}') ON CONFLICT DO NOTHING",
        [tenantId, risk.rows[0].id, input.fileItemId],
      );
    }
    await tx.query(
      `INSERT INTO revise_log (tenant_id, engagement_id, file_item_id, description, risk_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [tenantId, input.engagementId, input.fileItemId ?? null, input.detail ?? input.title, risk.rows[0].id, userId],
    );
    const partners = await tx.query<{ user_id: string }>(
      "SELECT user_id FROM team_member WHERE engagement_id = $1 AND team_role = 'partner'",
      [input.engagementId],
    );
    for (const partner of partners.rows) {
      await createNotification({
        tenantId,
        userId: partner.user_id,
        kind: "risk-addition",
        title: "Risk added during execution — approval required",
        body: input.title,
        href: `/engagements/${input.engagementId}/risks`,
      });
    }
    return { destination: "risk" };
  });
}

/** Partner re-approval of a mid-audit risk addition (spec §8.4). */
export async function approveRiskAddition(riskId: string): Promise<void> {
  const { tenantId, userId, role } = await requireTenant();
  if (!canPartnerSignoff(role)) throw new ExecutionError("forbidden");
  await withTenant(tenantId, async (tx) => {
    const updated = await tx.query(
      "UPDATE risk SET addition_approved_by = $2 WHERE id = $1 AND added_after_planning AND addition_approved_by IS NULL",
      [riskId, userId],
    );
    if (updated.rowCount === 0) throw new ExecutionError("not-found");
  });
}

// ---- 4.6 C1.1 evaluation ----

export interface MisstatementInfo {
  id: string;
  description: string;
  accounts: string | null;
  amount: number;
  mtype: string;
  corrected: boolean;
  trivial: boolean;
  sectionCode: string | null;
}

export interface B5Evaluation {
  items: MisstatementInfo[];
  uncorrectedTotal: number;
  correctedTotal: number;
  trivialCount: number;
  finalMateriality: number | null;
  trivialThreshold: number | null;
  exceedsMateriality: boolean;
}

export async function evaluateB5(engagementId: string): Promise<B5Evaluation> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.query<{
      id: string;
      description: string;
      accounts: string | null;
      amount: string;
      mtype: string;
      corrected: boolean;
      trivial: boolean;
      section_code: string | null;
    }>(
      `SELECT m.id, m.description, m.accounts, m.amount::text, m.mtype, m.corrected, m.trivial,
              fi.code AS section_code
         FROM misstatement m
         LEFT JOIN file_item fi ON fi.id = m.file_item_id
        WHERE m.engagement_id = $1
        ORDER BY m.created_at`,
      [engagementId],
    );
    const materiality = await tx.query<{ overall: string; trivial: string }>(
      `SELECT overall::text, trivial::text FROM materiality
        WHERE engagement_id = $1 AND status = 'approved'
        ORDER BY version_no DESC LIMIT 1`,
      [engagementId],
    );
    const items = rows.rows.map((row) => ({
      id: row.id,
      description: row.description,
      accounts: row.accounts,
      amount: Number(row.amount),
      mtype: row.mtype,
      corrected: row.corrected,
      trivial: row.trivial,
      sectionCode: row.section_code,
    }));
    const uncorrectedTotal = items
      .filter((item) => !item.trivial && !item.corrected)
      .reduce((sum, item) => sum + item.amount, 0);
    const correctedTotal = items
      .filter((item) => !item.trivial && item.corrected)
      .reduce((sum, item) => sum + item.amount, 0);
    const finalMateriality = materiality.rows[0] ? Number(materiality.rows[0].overall) : null;
    return {
      items,
      uncorrectedTotal,
      correctedTotal,
      trivialCount: items.filter((item) => item.trivial).length,
      finalMateriality,
      trivialThreshold: materiality.rows[0] ? Number(materiality.rows[0].trivial) : null,
      exceedsMateriality:
        finalMateriality !== null && Math.abs(uncorrectedTotal) > finalMateriality,
    };
  });
}

export async function setMisstatementCorrected(id: string, corrected: boolean): Promise<void> {
  const { tenantId } = await requireWrite();
  const engagementId = await withTenant(tenantId, async (tx) => {
    const row = await tx.query<{ engagement_id: string; corrected: boolean }>(
      "SELECT engagement_id, corrected FROM misstatement WHERE id = $1",
      [id],
    );
    if (!row.rows[0]) throw new ExecutionError("not-found");
    await tx.query("UPDATE misstatement SET corrected = $2 WHERE id = $1", [id, corrected]);
    return row.rows[0].engagement_id;
  });
  // Whether a difference was put right is what the C1.1 evaluation turns on, so
  // the change belongs in the trail alongside who made it.
  await logMisstatementChange(engagementId, id, corrected ? "corrected" : "uncorrected", {
    before: { corrected: !corrected },
    after: { corrected },
  });
}

// ---- 4.7 control tests ----

export async function recordControlTest(input: {
  engagementId: string;
  fileItemId: string;
  description: string;
  result: "effective" | "deviation";
  deviationDecision?: "extend" | "abandon" | "deficiency";
  note?: string;
  /** links the test to a SCOT Studio control — its operating conclusion derives from these rows */
  scotControlId?: string;
}): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!input.description.trim()) throw new ExecutionError("description-required");
  if (input.result === "deviation" && !input.deviationDecision) {
    throw new ExecutionError("deviation-decision-required");
  }
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO control_test
         (tenant_id, engagement_id, file_item_id, description, result, deviation_decision, note, scot_control_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [tenantId, input.engagementId, input.fileItemId, input.description, input.result, input.deviationDecision ?? null, input.note ?? null, input.scotControlId ?? null, userId],
    );

    if (input.result === "deviation") {
      // extend / abandon → the affected program is flagged for extension by an
      // auto-appended step; deficiency → routed to C5.1 (spec §6.2).
      if (input.deviationDecision === "extend" || input.deviationDecision === "abandon") {
        const next = await tx.query<{ v: number }>(
          "SELECT coalesce(max(seq), 0) + 10 AS v FROM program_step WHERE file_item_id = $1",
          [input.fileItemId],
        );
        await tx.query(
          `INSERT INTO program_step (tenant_id, engagement_id, file_item_id, seq, description, assertions, source)
           VALUES ($1, $2, $3, $4, $5, '{C,E,A}', 'risk_extension')`,
          [
            tenantId,
            input.engagementId,
            input.fileItemId,
            next.rows[0].v,
            input.deviationDecision === "extend"
              ? `Extended testing following control deviation: ${input.description}`
              : `Reliance abandoned — substantive extension required: ${input.description}`,
          ],
        );
        if (input.deviationDecision === "abandon") {
          await tx.query(
            `UPDATE risk SET controls_reliance = false
              WHERE id IN (SELECT risk_id FROM risk_section WHERE file_item_id = $1)`,
            [input.fileItemId],
          );
        }
      } else {
        await tx.query(
          `INSERT INTO finding (tenant_id, engagement_id, file_item_id, route, title, detail, created_by)
           VALUES ($1, $2, $3, 'c1', $4, $5, $6)`,
          [tenantId, input.engagementId, input.fileItemId, `Control deficiency: ${input.description}`, input.note ?? null, userId],
        );
      }
    }
  });
}

export async function listControlTests(fileItemId: string): Promise<
  { id: string; description: string; result: string; deviationDecision: string | null }[]
> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      description: string;
      result: string;
      deviation_decision: string | null;
    }>(
      "SELECT id, description, result, deviation_decision FROM control_test WHERE file_item_id = $1 ORDER BY created_at",
      [fileItemId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      description: row.description,
      result: row.result,
      deviationDecision: row.deviation_decision,
    }));
  });
}

// ---- 4.8/4.9 finding lists + clearance ----

export interface FindingInfo {
  id: string;
  route: "b4" | "c1";
  title: string;
  detail: string | null;
  status: "open" | "cleared";
  response: string | null;
  sectionCode: string | null;
}

export async function listFindings(engagementId: string): Promise<FindingInfo[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      route: "b4" | "c1";
      title: string;
      detail: string | null;
      status: "open" | "cleared";
      response: string | null;
      section_code: string | null;
    }>(
      `SELECT f.id, f.route, f.title, f.detail, f.status, f.response, fi.code AS section_code
         FROM finding f LEFT JOIN file_item fi ON fi.id = f.file_item_id
        WHERE f.engagement_id = $1
        ORDER BY f.created_at`,
      [engagementId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      route: row.route,
      title: row.title,
      detail: row.detail,
      status: row.status,
      response: row.response,
      sectionCode: row.section_code,
    }));
  });
}

export async function clearFinding(id: string, response: string): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!response.trim()) throw new ExecutionError("response-required");
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `UPDATE finding SET status = 'cleared', response = $2, cleared_by = $3, cleared_at = now()
        WHERE id = $1 AND status = 'open'`,
      [id, response, userId],
    );
  });
}

// ---- 4.11 section conclusion + review chain ----

export interface SectionConclusionInfo {
  conclusion: string;
  objectivesAchieved: boolean;
  preparedByName: string | null;
  reviewedByName: string | null;
  partnerReviewedByName: string | null;
  partnerRequired: boolean;
}

export async function getSectionConclusion(fileItemId: string): Promise<SectionConclusionInfo | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      conclusion: string;
      objectives_achieved: boolean;
      prepared: string | null;
      reviewed: string | null;
      partner: string | null;
    }>(
      `SELECT sc.conclusion, sc.objectives_achieved,
              (SELECT coalesce(name, email) FROM app_user WHERE id = sc.prepared_by) AS prepared,
              (SELECT coalesce(name, email) FROM app_user WHERE id = sc.reviewed_by) AS reviewed,
              (SELECT coalesce(name, email) FROM app_user WHERE id = sc.partner_reviewed_by) AS partner
         FROM section_conclusion sc WHERE sc.file_item_id = $1`,
      [fileItemId],
    );
    const partnerRequired = await sectionHasSignificantRisk(tx, fileItemId);
    const row = result.rows[0];
    if (!row) {
      return partnerRequired
        ? { conclusion: "", objectivesAchieved: false, preparedByName: null, reviewedByName: null, partnerReviewedByName: null, partnerRequired }
        : null;
    }
    return {
      conclusion: row.conclusion,
      objectivesAchieved: row.objectives_achieved,
      preparedByName: row.prepared,
      reviewedByName: row.reviewed,
      partnerReviewedByName: row.partner,
      partnerRequired,
    };
  });
}

async function sectionHasSignificantRisk(
  tx: import("pg").PoolClient,
  fileItemId: string,
): Promise<boolean> {
  const result = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM risk_section rs JOIN risk r ON r.id = rs.risk_id
      WHERE rs.file_item_id = $1 AND r.significant AND r.rebutted = false`,
    [fileItemId],
  );
  return Number(result.rows[0].n) > 0;
}

export async function saveSectionConclusion(
  fileItemId: string,
  conclusion: string,
  objectivesAchieved: boolean,
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!conclusion.trim()) throw new ExecutionError("conclusion-required");
  const written = await withTenant(tenantId, async (tx) => {
    const item = await tx.query<{ engagement_id: string; code: string }>(
      "SELECT engagement_id, code FROM file_item WHERE id = $1 AND section = 'E'",
      [fileItemId],
    );
    if (!item.rows[0]) throw new ExecutionError("not-found");
    await tx.query(
      `INSERT INTO section_conclusion
         (tenant_id, engagement_id, file_item_id, conclusion, objectives_achieved, prepared_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (file_item_id) DO UPDATE
         SET conclusion = EXCLUDED.conclusion, objectives_achieved = EXCLUDED.objectives_achieved,
             prepared_by = EXCLUDED.prepared_by, prepared_at = now(),
             reviewed_by = NULL, reviewed_at = NULL,
             partner_reviewed_by = NULL, partner_reviewed_at = NULL`,
      [tenantId, item.rows[0].engagement_id, fileItemId, conclusion, objectivesAchieved, userId],
    );
    // The section conclusion is part of what a sign-off on this item attests
    // to, so rewriting it voids any signature given over the earlier text.
    const invalidated = await invalidateStaleSignoffs(tx, item.rows[0].engagement_id, item.rows[0].code);
    return { engagementId: item.rows[0].engagement_id, code: item.rows[0].code, invalidated };
  });

  await reportInvalidatedSignoffs(
    tenantId,
    written.engagementId,
    written.code,
    written.invalidated,
    userId,
  );
}

export async function reviewSectionConclusion(fileItemId: string, asPartner: boolean): Promise<void> {
  const { tenantId, userId, role } = await requireTenant();
  if (asPartner && !canPartnerSignoff(role)) throw new ExecutionError("forbidden");
  if (!asPartner && !canReview(role)) throw new ExecutionError("forbidden");
  await withTenant(tenantId, async (tx) => {
    // No self-review (ISA 220 (Revised) ¶29): whoever prepared the section
    // conclusion cannot also review it while the firm has another reviewer.
    const prepared = await tx.query<{ prepared_by: string | null }>(
      "SELECT prepared_by FROM section_conclusion WHERE file_item_id = $1",
      [fileItemId],
    );
    const preparedBy = prepared.rows[0]?.prepared_by ?? null;
    if (preparedBy === userId && (await hasOtherReviewer(tx, tenantId, userId))) {
      throw new ExecutionError("self-review");
    }

    const column = asPartner ? "partner_reviewed_by" : "reviewed_by";
    const timeColumn = asPartner ? "partner_reviewed_at" : "reviewed_at";
    const updated = await tx.query(
      `UPDATE section_conclusion SET ${column} = $2, ${timeColumn} = now() WHERE file_item_id = $1`,
      [fileItemId, userId],
    );
    if (updated.rowCount === 0) throw new ExecutionError("not-found");
  });
}
