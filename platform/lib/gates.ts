// Phase-transition gates (spec §19.2: "Gates, not guidance" — where the
// methodology says must, the tool BLOCKS with a clear explanation).
//
// acceptance → planning:  P1.1 form complete & concluded "accept", partner
//                         sign-off on the P1.1 working paper, an independence
//                         campaign launched with every confirmation completed
//                         and exceptions disposed.
// planning → execution:   materiality approved; partner sign-offs on P2.2,
//                         P5.2, S3.1; every significant risk linked to ≥1
//                         program step (or validly rebutted with partner
//                         approval); every material E-section has planned
//                         coverage (stand-back). Closing takes a snapshot.
//
// Transitions run gate-check + mutation in ONE transaction with the engagement
// row locked, so double-submits and check-then-act races cannot slip through.
// [Adversarial-review fix]

import type { PoolClient } from "pg";
import { recordActivity } from "@/lib/activity";
import { withTenant } from "@/lib/db";
import { FORM_DEFINITIONS, isFormComplete, p11FailedChecks, type FormValues } from "@/lib/forms";
import { requireTenant, requireWrite } from "@/lib/tenant";

export interface GateResult {
  key: string;
  ok: boolean;
  /** what is still in the way, e.g. the codes carrying open review notes (UAT B141) */
  detail?: string;
  /** where to clear it */
  href?: string;
}

const PHASE_RANK: Record<string, number> = {
  acceptance: 0,
  planning: 1,
  execution: 2,
  conclusion: 3,
  archived: 4,
};

/** Conclusion-phase tasks that belong after the report date (assembly and archive). */
export const POST_REPORT_CODES = new Set(["C6.1", "C6.2"]);

/**
 * Gates, not guidance (UAT B15): work that belongs to a later phase cannot be
 * signed or recorded while an earlier phase is still open — the gates would
 * otherwise only flip a flag while the file filled up behind them. Returns
 * null when a task of `taskPhase` may proceed with the engagement in
 * `currentPhase`, otherwise the error code naming the phase still open
 * ("acceptance-open", "planning-open", "execution-open"). Acceptance tasks
 * are always open: they are what the first gate is built from.
 */
export function phaseStillOpen(taskPhase: string, currentPhase: string, code?: string): string | null {
  let need = PHASE_RANK[taskPhase] ?? 0;
  // The conclusion phase only begins when the report is issued, and issuing
  // it requires the completion papers (C4.1, the EQR on C4.2, C4.3 …) signed
  // first (ISA 220 ¶36, ISQM 2 ¶26). Those papers are therefore open from
  // execution; only the post-report assembly and archive work (C6.x) waits
  // for the report. Requiring "conclusion" for all of them was circular
  // (UAT run 2 B06). With no code (a whole phase screen) the same applies.
  if (taskPhase === "conclusion" && !(code && POST_REPORT_CODES.has(code))) need = PHASE_RANK.execution;
  const have = PHASE_RANK[currentPhase] ?? 0;
  if (need <= have) return null;
  return `${currentPhase}-open`;
}

async function formValues(
  tx: PoolClient,
  engagementId: string,
  code: string,
): Promise<FormValues> {
  const result = await tx.query<{ field_key: string; value: unknown }>(
    "SELECT field_key, value FROM form_response WHERE engagement_id = $1 AND code = $2",
    [engagementId, code],
  );
  const values: FormValues = {};
  for (const row of result.rows) values[row.field_key] = row.value;
  return values;
}

/**
 * Active (non-voided) partner sign-off on the WORKING PAPER of a file-index
 * code. kind='workpaper' matters: letters filed under the same index (e.g. the
 * engagement letter under P1.1) must not satisfy the gate.
 */
async function partnerSigned(
  tx: PoolClient,
  engagementId: string,
  code: string,
): Promise<boolean> {
  const result = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM signoff s
       JOIN document d ON d.id = s.document_id
       JOIN file_item fi ON fi.id = d.file_item_id
      WHERE fi.engagement_id = $1 AND fi.code = $2
        AND d.kind = 'workpaper'
        AND s.role = 'partner' AND s.voided_at IS NULL`,
    [engagementId, code],
  );
  return Number(result.rows[0].n) > 0;
}

/** The task is on the file and active (not an untriggered conditional). */
async function taskActive(tx: PoolClient, engagementId: string, code: string): Promise<boolean> {
  const result = await tx.query(
    "SELECT 1 FROM file_item WHERE engagement_id = $1 AND code = $2 AND conditional = false",
    [engagementId, code],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Open review notes on the tasks whose codes match one of the patterns,
 * whichever way the note was raised (on a document, on a task, or on a task
 * through its file item) — the same three shapes the archive gate resolves.
 */
async function openReviewNotes(
  tx: PoolClient,
  engagementId: string,
  codePatterns: string[],
): Promise<{ n: number; codes: string[] }> {
  const result = await tx.query<{ n: string; codes: string[] | null }>(
    `SELECT count(*)::text AS n, array_agg(DISTINCT fi.code ORDER BY fi.code) AS codes
       FROM review_note rn
       LEFT JOIN document d ON d.id = rn.document_id
       LEFT JOIN file_item fi ON fi.id = coalesce(rn.file_item_id, d.file_item_id)
      WHERE rn.status = 'open'
        AND coalesce(d.engagement_id, rn.engagement_id, fi.engagement_id) = $1
        AND fi.code LIKE ANY($2::text[])`,
    [engagementId, codePatterns],
  );
  return { n: Number(result.rows[0].n), codes: result.rows[0].codes ?? [] };
}

/** The review-notes gate, naming the notes in the way and linking to them (UAT B141). */
function reviewNotesGate(engagementId: string, open: { n: number; codes: string[] }): GateResult {
  return open.n === 0
    ? { key: "review_notes_cleared", ok: true }
    : {
        key: "review_notes_cleared",
        ok: false,
        detail: `${open.n} · ${open.codes.join(", ")}`,
        href: `/engagements/${engagementId}/tools/review-notes`,
      };
}

async function acceptanceGatesTx(tx: PoolClient, engagementId: string): Promise<GateResult[]> {
  const d31 = await formValues(tx, engagementId, "P1.1");
  const formComplete = isFormComplete(FORM_DEFINITIONS["P1.1"], d31);
  const concludedAccept = d31.conclusion === "accept";
  const checksPassed = p11FailedChecks(d31).length === 0;
  const signed = await partnerSigned(tx, engagementId, "P1.1");

  const independence = await tx.query<{ total: string; open: string; undisposed: string }>(
    `SELECT
       count(*)::text AS total,
       count(*) FILTER (WHERE ic.status IN ('sent', 'opened'))::text AS open,
       count(*) FILTER (WHERE ic.status = 'exception' AND ic.disposition IS NULL)::text AS undisposed
       FROM independence_confirmation ic
       JOIN independence_campaign c ON c.id = ic.campaign_id
      WHERE c.engagement_id = $1`,
    [engagementId],
  );
  const indep = independence.rows[0];

  // Every active team member (invited or accepted — a declined invitation is
  // not on the team) must hold a completed or dispositioned confirmation: two
  // confirmations out of twenty-two used to turn the gate green (UAT B13).
  const { independenceEligibleSql } = await import("@/lib/independence");
  const notAsked = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM team_member tm
      WHERE tm.engagement_id = $1
        AND coalesce(tm.status, 'accepted') <> 'declined'
        -- a client contact or read-only observer declares nothing (UAT run 3 B04)
        AND ${independenceEligibleSql("tm.user_id", "tm.tenant_id")}
        AND NOT EXISTS (
          SELECT 1 FROM independence_confirmation ic
            JOIN independence_campaign c ON c.id = ic.campaign_id
           WHERE c.engagement_id = $1 AND ic.user_id = tm.user_id
             AND (ic.status = 'completed' OR (ic.status = 'exception' AND ic.disposition IS NOT NULL))
        )`,
    [engagementId],
  );
  const membersMissing = Number(notAsked.rows[0].n);
  const openNotes = await openReviewNotes(tx, engagementId, ["P1.%"]);

  return [
    { key: "d31_form_complete", ok: formComplete && concludedAccept },
    { key: "d31_checks_passed", ok: formComplete && checksPassed },
    { key: "d31_partner_signed", ok: signed },
    // Not vacuous: a campaign must exist AND be fully completed, for everyone on the team.
    { key: "independence_complete", ok: Number(indep.total) > 0 && Number(indep.open) === 0 && membersMissing === 0 },
    { key: "independence_exceptions_disposed", ok: Number(indep.undisposed) === 0 },
    reviewNotesGate(engagementId, openNotes),
  ];
}

async function planningCloseGatesTx(tx: PoolClient, engagementId: string): Promise<GateResult[]> {
  const materiality = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM materiality
      WHERE engagement_id = $1 AND status = 'approved'
        AND version_no = (SELECT max(version_no) FROM materiality WHERE engagement_id = $1)`,
    [engagementId],
  );

  // P7.2 is the partner's approval of the plan itself (ISA 300 ¶11, ISA 220
  // ¶30): planning cannot close on the three judgement papers alone (UAT B15).
  const gateDocs: GateResult[] = [];
  for (const code of ["P2.2", "P5.2", "S3.1"]) {
    // A paper gate applies where the task is on this file: a very simple file
    // carries no P2.2, and demanding its sign-off left planning impossible to
    // close (UAT run 2 B09).
    if (!(await taskActive(tx, engagementId, code))) continue;
    gateDocs.push({
      key: `${code.toLowerCase().replace(".", "")}_partner_signed`,
      ok: await partnerSigned(tx, engagementId, code),
    });
  }
  // The plan's approval is the partner signature on the P7.2 summary itself,
  // which requires every confirmation, deliverable and lower tier — a chip on
  // the P7.2 row with 0 of 33 confirmations used to satisfy it (UAT run 2 B07).
  const { rasPartnerApprovedTx } = await import("@/lib/planning-ras");
  gateDocs.push({ key: "p72_partner_signed", ok: await rasPartnerApprovedTx(tx, engagementId) });

  // Every significant, non-rebutted risk must have ≥1 linked program step
  // (spec §8.1: an unlinked significant risk is a blocking error).
  const unlinked = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM risk r
      WHERE r.engagement_id = $1 AND r.significant AND r.rebutted = false
        AND NOT EXISTS (SELECT 1 FROM risk_response rr WHERE rr.risk_id = r.id)`,
    [engagementId],
  );

  // A rebutted presumed revenue-fraud risk requires the partner-approved rebuttal.
  const badRebuttal = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM risk
      WHERE engagement_id = $1 AND rebutted AND rebuttal_approved_by IS NULL`,
    [engagementId],
  );

  // Stand-back (spec §5.3): every material class must receive substantive
  // procedures regardless of risk rating. Material flag is manual in Phase 2;
  // TB-driven from Phase 3.
  const uncovered = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM file_item fi
      WHERE fi.engagement_id = $1 AND fi.section = 'E' AND fi.material
        AND NOT EXISTS (
          SELECT 1 FROM program_step ps
           WHERE ps.file_item_id = fi.id AND ps.status <> 'na'
        )`,
    [engagementId],
  );

  // ISA-engine Wave 1 (A3): a significant account cannot hide in an unmapped
  // TB line — planning cannot close while the CURRENT TB version has accounts
  // matching no active grouping rule or client override. Engagements with no
  // TB yet pass (TB-driven scoping arrives with the full engine).
  const unmapped = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM trial_balance tb
       JOIN trial_balance_version v
         ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
       JOIN trial_balance_row r ON r.version_id = v.id
      WHERE tb.engagement_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM syscohada_grouping_rule g
           WHERE g.active AND r.account_code LIKE g.account_prefix || '%'
        )
        AND NOT EXISTS (
          SELECT 1 FROM client_grouping_override o
           WHERE o.active AND o.client_id = tb.client_id
             AND ((o.match_type = 'exact' AND r.account_code = o.account_prefix)
               OR (o.match_type = 'prefix' AND r.account_code LIKE o.account_prefix || '%'))
        )`,
    [engagementId],
  );

  // An open review note on a planning paper (P or S task) is unfinished
  // planning work; only the archive gate used to count notes (UAT B144).
  const openNotes = await openReviewNotes(tx, engagementId, ["P%", "S%"]);

  // S3.1 (ISA 330 ¶8): a control-risk "rely" must rest on a control selected
  // for testing that covers the assertion — or on a written basis (UAT B44).
  const unsupportedRely = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM cra_assessment ca
      WHERE ca.engagement_id = $1 AND ca.cr = 'rely'
        AND btrim(coalesce(ca.cr_basis, '')) = ''
        AND NOT EXISTS (
          SELECT 1
            FROM scot_control c
            JOIN scot s ON s.id = c.scot_id
            JOIN scot_index si ON si.scot_id = s.id
            JOIN wcgw_control wc ON wc.control_id = c.id
            JOIN wcgw w ON w.id = wc.wcgw_id
           WHERE s.engagement_id = ca.engagement_id
             AND si.index_code = ca.index_code
             AND c.selected_for_testing
             AND ca.assertion = ANY (w.assertions))`,
    [engagementId],
  );

  return [
    { key: "materiality_approved", ok: Number(materiality.rows[0].n) > 0 },
    ...gateDocs,
    { key: "cra_reliance_supported", ok: Number(unsupportedRely.rows[0].n) === 0 },
    { key: "significant_risks_linked", ok: Number(unlinked.rows[0].n) === 0 },
    { key: "rebuttals_approved", ok: Number(badRebuttal.rows[0].n) === 0 },
    { key: "material_sections_covered", ok: Number(uncovered.rows[0].n) === 0 },
    { key: "tb_mapped", ok: Number(unmapped.rows[0].n) === 0 },
    reviewNotesGate(engagementId, openNotes),
  ];
}

export async function acceptanceGates(engagementId: string): Promise<GateResult[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, (tx) => acceptanceGatesTx(tx, engagementId));
}

export async function planningCloseGates(engagementId: string): Promise<GateResult[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, (tx) => planningCloseGatesTx(tx, engagementId));
}

export class GateError extends Error {
  constructor(public readonly failed: string[]) {
    super(`gates-failed:${failed.join(",")}`);
    this.name = "GateError";
  }
}

async function lockEngagementPhase(
  tx: PoolClient,
  engagementId: string,
  expected: string,
): Promise<void> {
  const result = await tx.query<{ phase: string }>(
    "SELECT phase FROM engagement WHERE id = $1 FOR UPDATE",
    [engagementId],
  );
  if (!result.rows[0]) throw new Error("not-found");
  if (result.rows[0].phase !== expected) throw new Error("wrong-phase");
}

/** acceptance → planning: gate-check + transition atomically. */
export async function advanceToPlanning(engagementId: string): Promise<void> {
  const { tenantId } = await requireWrite();
  await withTenant(tenantId, async (tx) => {
    await lockEngagementPhase(tx, engagementId, "acceptance");
    const gates = await acceptanceGatesTx(tx, engagementId);
    const failed = gates.filter((g) => !g.ok).map((g) => g.key);
    if (failed.length > 0) throw new GateError(failed);
    await tx.query("UPDATE engagement SET phase = 'planning' WHERE id = $1", [engagementId]);
  });
  // After COMMIT: a phase change is evidence and belongs in the trail (UAT B62).
  await recordActivity({
    engagementId,
    entityType: "engagement",
    entityId: engagementId,
    action: "phase_advanced",
    summary: "Acceptance gates passed — engagement moved to planning",
    before: { phase: "acceptance" },
    after: { phase: "planning" },
  });
}

/** planning → execution: gates + snapshot + transition in one transaction (spec §5.4). */
export async function closePlanning(engagementId: string): Promise<void> {
  const { tenantId, userId } = await requireWrite();
  await withTenant(tenantId, async (tx) => {
    await lockEngagementPhase(tx, engagementId, "planning");
    const gates = await planningCloseGatesTx(tx, engagementId);
    const failed = gates.filter((g) => !g.ok).map((g) => g.key);
    if (failed.length > 0) throw new GateError(failed);

    const snapshot = await tx.query<{ data: unknown }>(
      `SELECT json_build_object(
         'materiality', (SELECT to_jsonb(m) - 'tenant_id' FROM materiality m
                          WHERE m.engagement_id = $1 ORDER BY m.version_no DESC LIMIT 1),
         'risks', (SELECT coalesce(json_agg(to_jsonb(r) - 'tenant_id'), '[]'::json)
                     FROM risk r WHERE r.engagement_id = $1),
         'programSteps', (SELECT coalesce(json_agg(to_jsonb(p) - 'tenant_id'), '[]'::json)
                            FROM program_step p WHERE p.engagement_id = $1)
       ) AS data`,
      [engagementId],
    );
    await tx.query(
      "INSERT INTO planning_snapshot (tenant_id, engagement_id, data, taken_by) VALUES ($1, $2, $3, $4)",
      [tenantId, engagementId, JSON.stringify(snapshot.rows[0].data), userId],
    );
    await tx.query("UPDATE engagement SET phase = 'execution' WHERE id = $1", [engagementId]);
  });
  await recordActivity({
    engagementId,
    entityType: "engagement",
    entityId: engagementId,
    action: "phase_advanced",
    summary: "Planning closed — snapshot taken, engagement moved to execution",
    before: { phase: "planning" },
    after: { phase: "execution" },
  });
}

/** Toggle the (Phase 2 manual) material flag on an E-section. */
export async function setSectionMaterial(fileItemId: string, material: boolean): Promise<void> {
  const { tenantId } = await requireWrite();
  await withTenant(tenantId, async (tx) => {
    await tx.query("UPDATE file_item SET material = $2 WHERE id = $1 AND section = 'E'", [
      fileItemId,
      material,
    ]);
  });
}
