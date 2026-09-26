// Phase 7: completion (C4.1) gates, report issuance, the 60-day assembly clock,
// the immutable archive, and rollforward (spec §7, §8.6, §9.6). Gates BLOCK
// (spec §19.2): the report cannot be issued until every gate passes.

import type { PoolClient } from "pg";
import { createNotification } from "@/lib/notifications";
import { listTeam } from "@/lib/team";
import { MGMT_OVERRIDE_PROCEDURE } from "@/lib/risks";
import { withTenant } from "@/lib/db";
import { carryForwardFromPriorYear } from "@/lib/forms";
import type { GateResult } from "@/lib/gates";
import { uncorrectedMisstatementThreshold } from "@/lib/materiality-model";
import { canPartnerSignoff } from "@/lib/rbac";
import { assertMutable } from "@/lib/mutability";
import { requireRole, requireTenant, requireWrite } from "@/lib/tenant";
import { logArchive, logEngagementFinalised, recordActivity } from "@/lib/activity";
import { enqueueBackup } from "@/lib/backup-jobs";
import { stampRetention } from "@/lib/retention";

export class CompletionError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "CompletionError";
  }
}

/**
 * Keys the system owns. archive_manifest is the snapshot proving what the file
 * contained when it closed; completion_record is deliberately exempt from the
 * archive-immutability triggers so archiveEngagement can write it, which means
 * nothing but this check stops that record being rewritten afterwards.
 */
const SYSTEM_COMPLETION_KEYS = new Set(["archive_manifest"]);

export async function recordCompletion(
  engagementId: string,
  key: string,
  data: Record<string, unknown> = {},
  /**
   * The record's version as the form loaded it (completionRecordVersion) —
   * "" when there was none. Given, the write is refused with "stale-edit" if
   * somebody else saved in between, instead of overwriting them (UAT B104).
   */
  expectedVersion?: string,
): Promise<void> {
  // Four of these keys ARE completion gates, and recordExists() tests existence
  // rather than content — so writing the key is passing the gate. Senior is the
  // floor: in a small firm the senior running fieldwork legitimately performs
  // and records the final analytical review and the tie-out.
  const { tenantId, userId, role } = await requireRole("senior");
  if (key === "partner_conclusion" && !canPartnerSignoff(role)) {
    throw new CompletionError("forbidden");
  }
  if (SYSTEM_COMPLETION_KEYS.has(key)) throw new CompletionError("system-key");
  // points_forward is written for NEXT year's file and is the reason
  // completion_record is exempt from the archive triggers (see the header of
  // migrations/20260820000002_archive_immutability.sql) — it must stay writable
  // across the rollforward boundary. Everything else is part of this file.
  if (key !== "points_forward") await assertMutable(engagementId);
  const existed = await withTenant(tenantId, async (tx) => {
    if (expectedVersion !== undefined) {
      // Lock the row and compare its version with the one the form was built
      // on: last-write-wins silently lost two of three concurrent edits.
      const current = await tx.query<{ v: string }>(
        `SELECT extract(epoch FROM done_at)::text AS v FROM completion_record
          WHERE engagement_id = $1 AND key = $2 FOR UPDATE`,
        [engagementId, key],
      );
      if ((current.rows[0]?.v ?? "") !== expectedVersion) throw new CompletionError("stale-edit");
    }
    const r = await tx.query<{ existed: boolean }>(
      `INSERT INTO completion_record (tenant_id, engagement_id, key, data, done_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (engagement_id, key)
       DO UPDATE SET data = EXCLUDED.data, done_by = EXCLUDED.done_by, done_at = now()
       RETURNING (xmax <> 0) AS existed`,
      [tenantId, engagementId, key, JSON.stringify(data), userId],
    );
    return r.rows[0]?.existed ?? false;
  });
  // Completion records are gate evidence (final analytical review, tie-out,
  // partner conclusion …): the trail names each one written (UAT B62).
  await recordActivity({
    engagementId,
    entityType: "completion_record",
    entityId: null,
    action: existed ? "completion_record_updated" : "completion_record_recorded",
    summary: `Completion record ${key} ${existed ? "updated" : "recorded"}`,
    meta: { key },
  });
}

/** The version token of a completion record, for the form's hidden field ("" when none). */
export async function completionRecordVersion(engagementId: string, key: string): Promise<string> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ v: string }>(
      "SELECT extract(epoch FROM done_at)::text AS v FROM completion_record WHERE engagement_id = $1 AND key = $2",
      [engagementId, key],
    );
    return r.rows[0]?.v ?? "";
  });
}

export async function getCompletionRecord(
  engagementId: string,
  key: string,
): Promise<Record<string, unknown> | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ data: Record<string, unknown> }>(
      "SELECT data FROM completion_record WHERE engagement_id = $1 AND key = $2",
      [engagementId, key],
    );
    return result.rows[0]?.data ?? null;
  });
}

async function count(tx: PoolClient, sql: string, params: unknown[]): Promise<number> {
  const result = await tx.query<{ n: string }>(sql, params);
  return Number(result.rows[0].n);
}

async function recordExists(tx: PoolClient, engagementId: string, key: string): Promise<boolean> {
  return (
    (await count(
      tx,
      "SELECT count(*)::text AS n FROM completion_record WHERE engagement_id = $1 AND key = $2 AND done",
      [engagementId, key],
    )) > 0
  );
}

/**
 * Whether the engagement requires an engagement quality review: P1.5 concluded
 * so, or a quality reviewer sits on the team. Where it does, C4.2 belongs on
 * the file whatever the complexity tier (UAT run 2 B13).
 */
export async function eqrRequiredTx(tx: PoolClient, engagementId: string): Promise<boolean> {
  const r = await tx.query<{ required: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM team_member WHERE engagement_id = $1 AND team_role = 'eqr_reviewer')
         OR EXISTS (SELECT 1 FROM form_response
                     WHERE engagement_id = $1 AND code = 'wp:P1.5' AND field_key = 'q_eqr'
                       AND btrim(value #>> '{}') = 'yes') AS required`,
    [engagementId],
  );
  return Boolean(r.rows[0]?.required);
}

export async function eqrRequired(engagementId: string): Promise<boolean> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, (tx) => eqrRequiredTx(tx, engagementId));
}

/** C4.1 completion gates (spec §7, items 1–13 mapped to computable checks). */
async function completionGatesTx(tx: PoolClient, engagementId: string): Promise<GateResult[]> {
  // 1. Every E-section with a designed program has a REVIEWED conclusion.
  //
  // The one step that does not count as a designed program is the ISA 240 ¶32
  // procedure seeded on E3.1 with the management-override risk. That task's
  // conclusion is its own working paper — the step is completed by concluding
  // the paper, and the paper's review is what the papers-signed gates below
  // enforce. Counting it here as well would demand a second, separate section
  // conclusion that no screen can write since the panel that wrote them was
  // retired. The step itself is still held to 1b: it must be completed.
  const unconcluded = await count(
    tx,
    `SELECT count(DISTINCT ps.file_item_id)::text AS n
       FROM program_step ps
      WHERE ps.engagement_id = $1 AND ps.status <> 'na'
        AND NOT (ps.source = 'risk_extension' AND ps.description = $2)
        AND NOT EXISTS (
          SELECT 1 FROM section_conclusion sc
           WHERE sc.file_item_id = ps.file_item_id AND sc.reviewed_by IS NOT NULL
        )`,
    [engagementId, MGMT_OVERRIDE_PROCEDURE],
  );
  // 1b. No program step left in 'planned'.
  const openSteps = await count(
    tx,
    "SELECT count(*)::text AS n FROM program_step WHERE engagement_id = $1 AND status = 'planned'",
    [engagementId],
  );
  // 2. All risks concluded (or validly rebutted); mid-audit additions approved.
  const openRisks = await count(
    tx,
    `SELECT count(*)::text AS n FROM risk
      WHERE engagement_id = $1 AND rebutted = false AND status <> 'concluded'`,
    [engagementId],
  );
  const unapprovedAdditions = await count(
    tx,
    `SELECT count(*)::text AS n FROM risk
      WHERE engagement_id = $1 AND added_after_planning AND addition_approved_by IS NULL`,
    [engagementId],
  );
  // 3. C1.1: no uncorrected misstatements above the uncorrected-misstatement
  // threshold (PM − TE) — the same line the register and the SAD use (UAT B50).
  const materiality = await tx.query<{ overall: string; performance: string }>(
    `SELECT overall::text, performance::text FROM materiality
      WHERE engagement_id = $1 AND status = 'approved'
      ORDER BY version_no DESC LIMIT 1`,
    [engagementId],
  );
  const uncorrected = await tx.query<{ total: string | null }>(
    `SELECT sum(amount)::text AS total FROM misstatement
      WHERE engagement_id = $1 AND trivial = false AND corrected = false`,
    [engagementId],
  );
  const umt = materiality.rows[0]
    ? uncorrectedMisstatementThreshold({
        overall: Number(materiality.rows[0].overall),
        performance: Number(materiality.rows[0].performance),
      })
    : null;
  // The register is only "as on the SAD" when every uncorrected SAD entry above
  // the trivial line is posted and still matches its working paper (UAT run 2
  // B12): an unposted or out-of-date entry fails the check rather than letting
  // a stale, smaller register total read as within the threshold.
  const { sadViewTx } = await import("@/lib/sad");
  const sad = await sadViewTx(tx, engagementId);
  const trivialLine = sad.materiality?.trivial ?? 0;
  const sadOutOfRegister = sad.entries.filter(
    (e) =>
      e.stale ||
      (!e.posted && !e.corrected && Math.max(Math.abs(e.drAmount), Math.abs(e.crAmount)) >= trivialLine),
  ).length;
  const b5Ok = umt !== null && Math.abs(Number(uncorrected.rows[0]?.total ?? 0)) <= umt && sadOutOfRegister === 0;
  // 10. C1.2 all cleared.
  const openB4 = await count(
    tx,
    "SELECT count(*)::text AS n FROM finding WHERE engagement_id = $1 AND route = 'b4' AND status = 'open'",
    [engagementId],
  );
  // 9. OHADA two-letter representation layering generated under C3.1.
  const repLetters = await count(
    tx,
    `SELECT count(DISTINCT d.title)::text AS n
       FROM document d JOIN file_item fi ON fi.id = d.file_item_id
      WHERE fi.engagement_id = $1 AND fi.code = 'C3.1' AND d.kind = 'letter'`,
    [engagementId],
  );
  // 11. Engagement quality review (ISQM 2 ¶25): where P1.5 requires one (or an
  // EQR reviewer sits on the team), the C4.2 paper must be signed with the
  // review confirmed complete and every matter resolved.
  const paperAnswer = async (code: string, key: string): Promise<string> => {
    const r = await tx.query<{ v: string | null }>(
      `SELECT value #>> '{}' AS v FROM form_response
        WHERE engagement_id = $1 AND code = $2 AND field_key = $3`,
      [engagementId, `wp:${code}`, key],
    );
    return (r.rows[0]?.v ?? "").trim();
  };
  //
  // The review is the appointed reviewer's own (ISQM 2 ¶24-27, ISA 220 ¶36):
  // the team completing and signing C4.2 used to turn the gate green although
  // the EQR never opened it (UAT run 3 B02). Now it takes the reviewer's own
  // active "eqr" sign-off on C4.2 — by a team member who is the engagement's
  // EQR (team role, or a firm-role EQR on the team) — with q_complete and
  // q_resolved answered yes and last written by that same reviewer.
  const eqrRequired = await eqrRequiredTx(tx, engagementId);
  const eqrSigned = eqrRequired
    ? await count(
        tx,
        `SELECT count(*)::text AS n
           FROM signoff s
           JOIN document d ON d.id = s.document_id
           JOIN file_item fi ON fi.id = d.file_item_id
          WHERE fi.engagement_id = $1 AND fi.code = 'C4.2'
            AND d.kind IN ('workpaper', 'leadsheet')
            AND s.role = 'eqr' AND s.voided_at IS NULL AND s.invalidated_at IS NULL
            AND EXISTS (
              SELECT 1 FROM team_member tm
               WHERE tm.engagement_id = $1 AND tm.user_id = s.user_id
                 AND coalesce(tm.status, 'accepted') <> 'declined'
                 AND (tm.team_role = 'eqr_reviewer'
                      OR EXISTS (SELECT 1 FROM membership m
                                  WHERE m.user_id = tm.user_id AND m.tenant_id = tm.tenant_id
                                    AND m.role = 'eqr_reviewer')))
            AND (SELECT count(*) FROM form_response r
                  WHERE r.engagement_id = $1 AND r.code = 'wp:C4.2'
                    AND r.field_key IN ('q_complete', 'q_resolved')
                    AND btrim(r.value #>> '{}') = 'yes'
                    AND r.updated_by = s.user_id) = 2`,
        [engagementId],
      )
    : 0;
  const eqrOk = !eqrRequired || eqrSigned > 0;
  // 12. C4.3: no point outstanding at the report date.
  const c43Ok = (await paperAnswer("C4.3", "q_none_open")) === "yes";

  return [
    { key: "sections_concluded", ok: unconcluded === 0 && openSteps === 0 },
    { key: "risks_concluded", ok: openRisks === 0 && unapprovedAdditions === 0 },
    { key: "b5_within_materiality", ok: b5Ok },
    { key: "final_analytical_review", ok: await recordExists(tx, engagementId, "final_analytical_review") },
    { key: "fs_tieout_passed", ok: await recordExists(tx, engagementId, "fs_tieout") },
    { key: "disclosure_checklist", ok: await recordExists(tx, engagementId, "disclosure_checklist") },
    { key: "subsequent_events", ok: await recordExists(tx, engagementId, "subsequent_events") },
    { key: "rep_letters_generated", ok: repLetters >= 2 },
    { key: "b4_cleared", ok: openB4 === 0 },
    { key: "eqr_complete", ok: eqrOk },
    { key: "c43_cleared", ok: c43Ok },
    { key: "partner_conclusion", ok: await recordExists(tx, engagementId, "partner_conclusion") },
  ];
}

export async function completionGates(engagementId: string): Promise<GateResult[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, (tx) => completionGatesTx(tx, engagementId));
}

export interface ConclusionState {
  reportDate: string | null;
  opinion: string | null;
  archivedAt: string | null;
  /** the date the archived file may first be considered for destruction */
  retentionUntil: string | null;
}

export async function getConclusionState(engagementId: string): Promise<ConclusionState> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ report_date: string | null; opinion: string | null; archived_at: string | null; retention_until: string | null }>(
      `SELECT report_date::text, opinion, to_char(archived_at, 'YYYY-MM-DD') AS archived_at,
              to_char(retention_until, 'YYYY-MM-DD') AS retention_until
         FROM engagement WHERE id = $1`,
      [engagementId],
    );
    if (!result.rows[0]) throw new CompletionError("not-found");
    return {
      reportDate: result.rows[0].report_date,
      opinion: result.rows[0].opinion,
      archivedAt: result.rows[0].archived_at,
      retentionUntil: result.rows[0].retention_until,
    };
  });
}

export class CompletionGateError extends Error {
  constructor(public readonly failed: string[]) {
    super(`gates-failed:${failed.join(",")}`);
    this.name = "CompletionGateError";
  }
}

/**
 * Issue the report: gates + phase check + report-date stamp in ONE transaction.
 * Starts the 60-day assembly clock (spec §9.6).
 */
export async function issueReport(
  engagementId: string,
  opinion: "unmodified" | "qualified" | "adverse" | "disclaimer",
  reportDate: string,
): Promise<void> {
  const { tenantId, role } = await requireWrite();
  if (!canPartnerSignoff(role)) throw new CompletionError("forbidden");
  await withTenant(tenantId, async (tx) => {
    const engagement = await tx.query<{ phase: string; report_date: string | null }>(
      "SELECT phase, report_date::text FROM engagement WHERE id = $1 FOR UPDATE",
      [engagementId],
    );
    if (!engagement.rows[0]) throw new CompletionError("not-found");
    if (engagement.rows[0].phase !== "execution" && engagement.rows[0].phase !== "conclusion") {
      throw new CompletionError("wrong-phase");
    }
    if (engagement.rows[0].report_date) throw new CompletionError("already-issued");
    const gates = await completionGatesTx(tx, engagementId);
    const failed = gates.filter((gate) => !gate.ok).map((gate) => gate.key);
    if (failed.length > 0) throw new CompletionGateError(failed);
    await tx.query(
      "UPDATE engagement SET phase = 'conclusion', report_date = $2, opinion = $3 WHERE id = $1",
      [engagementId, reportDate, opinion],
    );
  });
  await logEngagementFinalised(engagementId, opinion, reportDate);
}

/** 60-day assembly deadline from the report date (spec §7 item 11). */
export function assemblyDeadline(reportDate: string): string {
  const date = new Date(reportDate);
  date.setDate(date.getDate() + 60);
  return date.toISOString().slice(0, 10);
}

/**
 * Archive gates (ISA 230 ¶14–16): what must hold before the file locks —
 * report issued, every worked task carrying a signed and reviewed paper,
 * review notes cleared, and the C6.2 assembly checklist concluded. The 60-day
 * window is shown, not enforced: a late file must still be archivable.
 */
export interface ArchiveGate extends GateResult {
  /** how many items still block the gate (0 when ok) */
  pending: number;
  /** file-index codes still blocking, so the UI can name them (capped) */
  codes?: string[];
}

/** How many failing codes travel back to the UI before the list is cut. */
const CODE_CAP = 20;

/**
 * Which file items still owe a signed paper (assurance finding C5: the archive
 * gates counted DOCUMENTS, so a file with 114 tasks and 4 documents archived
 * clean — the 110 tasks that held work but never produced a paper were invisible
 * to the gate).
 *
 * A task owes a paper when it is NOT conditional (an inapplicable task is not
 * expected to produce one) and it carries work: program steps, a section
 * conclusion, a paper document, or saved working-paper values under `wp:<code>`.
 *
 * "Paper" means a document of kind 'workpaper' or 'leadsheet'. Letters, the
 * statutory report and engine output are filed on file items too, but they are
 * deliverables or tool output rather than papers the team prepares and reviews —
 * they carry their own gates (rep_letters_generated, report_issued). This
 * mirrors the kind filter the phase gates already apply in lib/gates.ts.
 *
 * Concludedness is not re-tested here and must not be: completionGatesTx's
 * sections_concluded already demands a REVIEWED section conclusion for every
 * task carrying program steps, C4.1/C6.2 have their own gates, and
 * completion_gates is itself one of the archive gates below. What this function
 * adds is the paper — present, prepared, reviewed — for every worked task.
 */
async function paperGapsTx(
  tx: PoolClient,
  engagementId: string,
): Promise<{ unsigned: string[]; unreviewed: string[] }> {
  const preparer =
    "EXISTS (SELECT 1 FROM signoff s WHERE s.document_id = d.id AND s.role = 'preparer' AND s.voided_at IS NULL)";
  const reviewer =
    "EXISTS (SELECT 1 FROM signoff s WHERE s.document_id = d.id AND s.role IN ('reviewer', 'partner') AND s.voided_at IS NULL)";
  const rows = await tx.query<{
    code: string;
    conditional: boolean;
    worked: boolean;
    prepared: boolean;
    reviewed: boolean;
    half_reviewed: boolean;
  }>(
    `SELECT fi.code,
            fi.conditional,
            (EXISTS (SELECT 1 FROM program_step ps WHERE ps.file_item_id = fi.id AND ps.status <> 'na')
             OR EXISTS (SELECT 1 FROM section_conclusion sc WHERE sc.file_item_id = fi.id)
             OR EXISTS (SELECT 1 FROM document d WHERE d.file_item_id = fi.id AND d.kind IN ('workpaper', 'leadsheet'))
             OR EXISTS (SELECT 1 FROM form_response fr
                         WHERE fr.engagement_id = fi.engagement_id
                           AND fr.code = 'wp:' || fi.code
                           AND btrim(coalesce(fr.value #>> '{}', '')) <> '')) AS worked,
            EXISTS (SELECT 1 FROM document d
                     WHERE d.file_item_id = fi.id AND d.kind IN ('workpaper', 'leadsheet') AND ${preparer}) AS prepared,
            EXISTS (SELECT 1 FROM document d
                     WHERE d.file_item_id = fi.id AND d.kind IN ('workpaper', 'leadsheet') AND ${reviewer}) AS reviewed,
            EXISTS (SELECT 1 FROM document d
                     WHERE d.file_item_id = fi.id AND ${preparer} AND NOT ${reviewer}) AS half_reviewed
       FROM file_item fi
      WHERE fi.engagement_id = $1
      ORDER BY fi.sort_order, fi.code`,
    [engagementId],
  );
  const unsigned: string[] = [];
  const unreviewed: string[] = [];
  for (const row of rows.rows) {
    const owes = !row.conditional && row.worked;
    if (owes && !row.prepared) unsigned.push(row.code);
    // a paper someone prepared but nobody reviewed blocks the file whether or
    // not the task itself owed a paper
    if ((owes && !row.reviewed) || row.half_reviewed) unreviewed.push(row.code);
  }
  return { unsigned, unreviewed };
}

/**
 * Tasks nobody addressed (UAT B63): the paper gates count only tasks that
 * already hold work, so a file with 67 untouched tasks archived "17/17 green".
 * Every non-conditional task must either carry work or be marked not
 * applicable with a reason (file_item.na_reason).
 */
async function untouchedTasksTx(tx: PoolClient, engagementId: string): Promise<string[]> {
  const rows = await tx.query<{ code: string }>(
    `SELECT fi.code
       FROM file_item fi
      WHERE fi.engagement_id = $1
        AND fi.conditional = false
        AND btrim(coalesce(fi.na_reason, '')) = ''
        AND NOT EXISTS (SELECT 1 FROM program_step ps WHERE ps.file_item_id = fi.id AND ps.status <> 'na')
        AND NOT EXISTS (SELECT 1 FROM section_conclusion sc WHERE sc.file_item_id = fi.id)
        AND NOT EXISTS (SELECT 1 FROM document d WHERE d.file_item_id = fi.id AND d.kind IN ('workpaper', 'leadsheet'))
        AND NOT EXISTS (SELECT 1 FROM form_response fr
                         WHERE fr.engagement_id = fi.engagement_id
                           AND fr.code = 'wp:' || fi.code
                           AND btrim(coalesce(fr.value #>> '{}', '')) <> '')
      ORDER BY fi.sort_order, fi.code`,
    [engagementId],
  );
  return rows.rows.map((r) => r.code);
}

export async function archiveGates(engagementId: string): Promise<ArchiveGate[]> {
  const { tenantId } = await requireTenant();
  const { paperFor, paperComplete, loadPaper } = await import("@/lib/working-papers");
  const [c62, c41] = await Promise.all([
    loadPaper(engagementId, "C6.2").then((v) => paperComplete(paperFor("C6.2"), v)),
    loadPaper(engagementId, "C4.1").then((v) => paperComplete(paperFor("C4.1"), v)),
  ]);
  const completion = await completionGates(engagementId);
  return withTenant(tenantId, async (tx) => {
    const reportDate = await tx.query<{ report_date: string | null }>(
      "SELECT report_date::text FROM engagement WHERE id = $1",
      [engagementId],
    );
    // FILE-ITEM based, not document based: every task that holds work must hold
    // a paper, and that paper must be prepared and reviewed (finding C5)
    const gaps = await paperGapsTx(tx, engagementId);
    const untouched = await untouchedTasksTx(tx, engagementId);
    // review notes, whichever way they were raised: on a document, on a task
    // (engagement_id set), or on a task through its file item. Resolving all
    // three shapes keeps the gate consistent with the item-based paper gates —
    // a note is open until someone clears it, wherever it hangs.
    const openNotes = await count(
      tx,
      `SELECT count(*)::text AS n FROM review_note rn
         LEFT JOIN document d ON d.id = rn.document_id
         LEFT JOIN file_item fi ON fi.id = rn.file_item_id
        WHERE rn.status = 'open'
          AND coalesce(d.engagement_id, rn.engagement_id, fi.engagement_id) = $1`,
      [engagementId],
    );
    // every control selected for testing is concluded on: design evaluated and
    // operating effectiveness tested (or the selection reversed in S2.1)
    const openControls = await count(
      tx,
      `SELECT count(*)::text AS n FROM scot_control c
         JOIN scot s ON s.id = c.scot_id
        WHERE s.engagement_id = $1 AND c.selected_for_testing
          AND (c.design_eval IS NULL
            OR NOT EXISTS (SELECT 1 FROM control_test ct WHERE ct.scot_control_id = c.id))`,
      [engagementId],
    );
    const completionPending = completion.filter((g) => !g.ok).length;
    return [
      { key: "report_issued", ok: reportDate.rows[0]?.report_date != null, pending: reportDate.rows[0]?.report_date ? 0 : 1 },
      { key: "completion_gates", ok: completionPending === 0, pending: completionPending },
      { key: "controls_concluded", ok: openControls === 0, pending: openControls },
      {
        key: "tasks_addressed",
        ok: untouched.length === 0,
        pending: untouched.length,
        codes: untouched.slice(0, CODE_CAP),
      },
      {
        key: "reviews_complete",
        ok: gaps.unreviewed.length === 0,
        pending: gaps.unreviewed.length,
        codes: gaps.unreviewed.slice(0, CODE_CAP),
      },
      {
        key: "papers_signed",
        ok: gaps.unsigned.length === 0,
        pending: gaps.unsigned.length,
        codes: gaps.unsigned.slice(0, CODE_CAP),
      },
      { key: "review_approval", ok: c41, pending: c41 ? 0 : 1 },
      { key: "review_notes_cleared", ok: openNotes === 0, pending: openNotes },
      { key: "c62_checklist", ok: c62, pending: c62 ? 0 : 1 },
    ];
  });
}

/**
 * Archive: snapshot the whole file (structured data as JSON) and lock it.
 * Post-archive modifications are impossible (guards in the document layer).
 */
export async function archiveEngagement(engagementId: string): Promise<void> {
  const { tenantId, userId, role } = await requireWrite();
  if (!canPartnerSignoff(role)) throw new CompletionError("forbidden");
  const gates = await archiveGates(engagementId);
  const failedGates = gates.filter((gate) => !gate.ok).map((gate) => gate.key);
  if (failedGates.length > 0) throw new CompletionGateError(failedGates);
  await withTenant(tenantId, async (tx) => {
    const engagement = await tx.query<{ report_date: string | null; archived_at: string | null }>(
      "SELECT report_date::text, archived_at::text FROM engagement WHERE id = $1 FOR UPDATE",
      [engagementId],
    );
    if (!engagement.rows[0]) throw new CompletionError("not-found");
    if (!engagement.rows[0].report_date) throw new CompletionError("no-report");
    if (engagement.rows[0].archived_at) throw new CompletionError("already-archived");

    // Fix the retention date in the same transaction that closes the file, from
    // the firm's period as it stands today — and BEFORE the manifest is built,
    // so the manifest records the date rather than null. Stamping it here
    // rather than reading the firm setting later means a change to that
    // setting cannot retrospectively shorten the life of a file already
    // archived.
    const policy = await tx.query<{ retention_years: number }>(
      "SELECT coalesce(t.retention_years, 10) AS retention_years FROM tenant t WHERE t.id = $1",
      [tenantId],
    );
    await stampRetention(tx, engagementId, Number(policy.rows[0]?.retention_years ?? 10));

    /*
     * The archive manifest: what this file contained at the moment it closed.
     *
     * v1 held six lists and no identity — no client, no period, no report date,
     * no opinion, no sign-offs, no working papers, no conclusions — so it could
     * not be read on its own and could not answer what an inspection asks.
     * fileIndex also lacked a coalesce, so an engagement with no items
     * serialised as null rather than an empty list.
     *
     * Captured INSIDE the archiving transaction, so it describes the file as
     * archived rather than as it looked whenever somebody later asked.
     */
    const snapshot = await tx.query<{ data: unknown }>(
      `SELECT json_build_object(
         'manifestVersion', 2,
         'generatedAt', now(),

         'engagement', (SELECT json_build_object(
                          'id', e.id, 'name', e.name,
                          'client', c.name, 'clientLegalForm', c.legal_form,
                          'fiscalYear', e.fiscal_year,
                          'periodEnd', e.period_end, 'reportDate', e.report_date,
                          'opinion', e.opinion, 'framework', e.framework,
                          'firstYear', e.first_year, 'complexity', e.complexity,
                          'retentionUntil', e.retention_until)
                         FROM engagement e JOIN client c ON c.id = e.client_id WHERE e.id = $1),
         'firm', (SELECT json_build_object('name', t.name, 'slug', t.slug,
                                           'retentionYears', t.retention_years)
                    FROM tenant t WHERE t.id = $2),
         'archivedBy', (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = $3),

         'fileIndex', (SELECT coalesce(json_agg(json_build_object(
                          'id', fi.id, 'code', fi.code, 'section', fi.section,
                          'titleEn', fi.title_en, 'titleFr', fi.title_fr,
                          'conditional', fi.conditional, 'material', fi.material,
                          'owner', (SELECT coalesce(o.name, o.email) FROM app_user o WHERE o.id = fi.owner_id),
                          'assignee', (SELECT coalesce(a.name, a.email) FROM app_user a WHERE a.id = fi.assignee_user_id)
                        ) ORDER BY fi.sort_order), '[]'::json)
                        FROM file_item fi WHERE fi.engagement_id = $1),

         'workingPapers', (SELECT coalesce(json_agg(json_build_object(
                              'code', fr.code, 'field', fr.field_key, 'value', fr.value,
                              'updatedAt', fr.updated_at,
                              'updatedBy', (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = fr.updated_by)
                            ) ORDER BY fr.code, fr.field_key), '[]'::json)
                            FROM form_response fr WHERE fr.engagement_id = $1),

         'sectionConclusions', (SELECT coalesce(json_agg(to_jsonb(sc) - 'tenant_id'), '[]'::json)
                                  FROM section_conclusion sc WHERE sc.engagement_id = $1),

         'signoffs', (SELECT coalesce(json_agg(json_build_object(
                         'documentId', sg.document_id, 'role', sg.role, 'versionNo', sg.version_no,
                         'by', (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = sg.user_id),
                         'signedAt', sg.signed_at, 'contentHash', sg.content_hash,
                         'voidedAt', sg.voided_at, 'voidReason', sg.void_reason,
                         'invalidatedAt', sg.invalidated_at, 'invalidatedReason', sg.invalidated_reason
                       ) ORDER BY sg.signed_at), '[]'::json)
                       FROM signoff sg
                       JOIN document d2 ON d2.id = sg.document_id
                      WHERE d2.engagement_id = $1),

         'documents', (SELECT coalesce(json_agg(json_build_object(
                          'id', d.id, 'title', d.title, 'kind', d.kind, 'status', d.status,
                          'fileItemCode', (SELECT fi2.code FROM file_item fi2 WHERE fi2.id = d.file_item_id),
                          'currentVersion', d.current_version,
                          'versions', (SELECT coalesce(json_agg(json_build_object(
                                          'versionNo', v.version_no, 'sha256', v.sha256,
                                          'bytes', v.byte_size, 'note', v.note,
                                          'createdAt', v.created_at,
                                          'createdBy', (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = v.created_by)
                                        ) ORDER BY v.version_no), '[]'::json)
                                        FROM document_version v WHERE v.document_id = d.id)
                        ) ORDER BY d.title), '[]'::json)
                        FROM document d WHERE d.engagement_id = $1),

         'attachments', (SELECT coalesce(json_agg(json_build_object(
                            'name', ta.name, 'mime', ta.mime, 'bytes', ta.size_bytes,
                            'version', ta.version, 'uploadedAt', ta.uploaded_at,
                            'sha256', encode(sha256(ta.content), 'hex'),
                            'deletedAt', ta.deleted_at
                          ) ORDER BY ta.name, ta.version), '[]'::json)
                          FROM task_attachment ta WHERE ta.engagement_id = $1),

         'reviewNotes', (SELECT coalesce(json_agg(json_build_object(
                            'body', rn.body, 'status', rn.status, 'response', rn.response,
                            'raisedAt', rn.created_at, 'clearedAt', rn.cleared_at,
                            'author', (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = rn.author_id)
                          ) ORDER BY rn.created_at), '[]'::json)
                          FROM review_note rn WHERE rn.engagement_id = $1),

         'materiality', (SELECT coalesce(json_agg(to_jsonb(m2) - 'tenant_id' ORDER BY m2.version_no), '[]'::json)
                           FROM materiality m2 WHERE m2.engagement_id = $1),

         'team', (SELECT coalesce(json_agg(json_build_object(
                     'name', (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = tm.user_id),
                     'role', tm.team_role, 'status', tm.status)), '[]'::json)
                   FROM team_member tm WHERE tm.engagement_id = $1),

         'risks', (SELECT coalesce(json_agg(to_jsonb(r) - 'tenant_id'), '[]'::json) FROM risk r WHERE engagement_id = $1),
         'misstatements', (SELECT coalesce(json_agg(to_jsonb(m) - 'tenant_id'), '[]'::json) FROM misstatement m WHERE engagement_id = $1),
         'findings', (SELECT coalesce(json_agg(to_jsonb(f) - 'tenant_id'), '[]'::json) FROM finding f WHERE engagement_id = $1),
         'confirmations', (SELECT coalesce(json_agg(to_jsonb(c2) - 'tenant_id'), '[]'::json) FROM confirmation c2 WHERE engagement_id = $1),

         'counts', json_build_object(
            'fileItems', (SELECT count(*) FROM file_item WHERE engagement_id = $1),
            'documents', (SELECT count(*) FROM document WHERE engagement_id = $1),
            'documentVersions', (SELECT count(*) FROM document_version v2 JOIN document d3 ON d3.id = v2.document_id WHERE d3.engagement_id = $1),
            'signoffs', (SELECT count(*) FROM signoff sg2 JOIN document d4 ON d4.id = sg2.document_id WHERE d4.engagement_id = $1),
            'attachments', (SELECT count(*) FROM task_attachment WHERE engagement_id = $1),
            'activityEntries', (SELECT count(*) FROM activity_log WHERE engagement_id = $1))
       ) AS data`,
      [engagementId, tenantId, userId],
    );
    await tx.query(
      `INSERT INTO completion_record (tenant_id, engagement_id, key, data, done_by)
       VALUES ($1, $2, 'archive_manifest', $3, $4)
       ON CONFLICT (engagement_id, key) DO NOTHING`,
      [tenantId, engagementId, JSON.stringify(snapshot.rows[0].data), userId],
    );
    await tx.query(
      "UPDATE engagement SET phase = 'archived', archived_at = now() WHERE id = $1",
      [engagementId],
    );
  });
  // After COMMIT: an audit entry must not be rolled back with the work it
  // describes, and recordActivity opens its own transaction.
  await logArchive(engagementId);
  // And the file leaves the box. Queued rather than uploaded here on purpose:
  // this function must not wait on object storage, or a storage outage would
  // stop a partner archiving a file — a compliance failure caused by the
  // compliance tooling. enqueueBackup never throws.
  await enqueueBackup({ tenantId, engagementId, kind: "engagement-archive" });
  // Everyone invited to the engagement hears that the file has closed. Best
  // effort, and after the lock: a notification that fails must never undo an
  // archive that succeeded, and the archive must never wait on one.
  try {
    const members = await listTeam(engagementId);
    await Promise.all(
      members.map((m) =>
        createNotification({
          tenantId,
          userId: m.userId,
          kind: "engagement_archived",
          title: "Engagement archived · Mission archivée",
          body: "The file is now frozen: nothing on it can be changed. It stays readable and can be rolled forward from the archived register. · Le dossier est figé : plus aucune modification n'est possible. Il reste consultable et peut être reconduit depuis la liste des missions archivées.",
          href: `/engagements/${engagementId}/dashboard`,
        }),
      ),
    );
  } catch (error) {
    console.error("[archive] notifications failed:", error instanceof Error ? error.message : error);
  }
}

/** Guard used by mutating layers: an archived file is immutable (spec §9.6). */
export async function ensureNotArchived(tx: PoolClient, engagementId: string): Promise<void> {
  const result = await tx.query<{ archived_at: string | null }>(
    "SELECT archived_at::text FROM engagement WHERE id = $1",
    [engagementId],
  );
  if (result.rows[0]?.archived_at) throw new CompletionError("archived");
}

/**
 * 7.12 Rollforward N → N+1 (spec §8.6): new engagement + carried-forward
 * understanding/related parties + C6.1 points forward injected.
 */
export async function rollforward(engagementId: string, newYear: number): Promise<string> {
  const { tenantId, userId } = await requireWrite();
  const { createEngagement } = await import("@/lib/engagements");

  const source = await withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ client_id: string; fiscal_year: number; period_end: string }>(
      "SELECT client_id, fiscal_year, to_char(period_end, 'YYYY-MM-DD') AS period_end FROM engagement WHERE id = $1",
      [engagementId],
    );
    if (!result.rows[0]) throw new CompletionError("not-found");
    if (newYear <= result.rows[0].fiscal_year) throw new CompletionError("invalid-year");
    return result.rows[0];
  });

  const periodEnd = source.period_end.replace(String(source.fiscal_year), String(newYear));
  const newEngagementId = await createEngagement({
    clientId: source.client_id,
    fiscalYear: newYear,
    periodEnd,
  });
  await carryForwardFromPriorYear(newEngagementId);

  // C6.1 points forward → injected into the new file (spec §8.6).
  const points = await getCompletionRecord(engagementId, "points_forward");
  if (points) {
    await withTenant(tenantId, async (tx) => {
      await tx.query(
        `INSERT INTO completion_record (tenant_id, engagement_id, key, data, done_by)
         VALUES ($1, $2, 'points_from_prior', $3, $4)
         ON CONFLICT (engagement_id, key) DO UPDATE SET data = EXCLUDED.data`,
        [tenantId, newEngagementId, JSON.stringify(points), userId],
      );
    });
  }
  return newEngagementId;
}
