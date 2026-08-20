// Phase 7: completion (C4.1) gates, report issuance, the 60-day assembly clock,
// the immutable archive, and rollforward (spec §7, §8.6, §9.6). Gates BLOCK
// (spec §19.2): the report cannot be issued until every gate passes.

import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { carryForwardFromPriorYear } from "@/lib/forms";
import type { GateResult } from "@/lib/gates";
import { canPartnerSignoff } from "@/lib/rbac";
import { assertMutable } from "@/lib/mutability";
import { requireRole, requireTenant } from "@/lib/tenant";
import { logArchive, logEngagementFinalised } from "@/lib/activity";

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
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO completion_record (tenant_id, engagement_id, key, data, done_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (engagement_id, key)
       DO UPDATE SET data = EXCLUDED.data, done_by = EXCLUDED.done_by, done_at = now()`,
      [tenantId, engagementId, key, JSON.stringify(data), userId],
    );
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

/** C4.1 completion gates (spec §7, items 1–13 mapped to computable checks). */
async function completionGatesTx(tx: PoolClient, engagementId: string): Promise<GateResult[]> {
  // 1. Every E-section with program steps has a REVIEWED conclusion.
  const unconcluded = await count(
    tx,
    `SELECT count(DISTINCT ps.file_item_id)::text AS n
       FROM program_step ps
      WHERE ps.engagement_id = $1 AND ps.status <> 'na'
        AND NOT EXISTS (
          SELECT 1 FROM section_conclusion sc
           WHERE sc.file_item_id = ps.file_item_id AND sc.reviewed_by IS NOT NULL
        )`,
    [engagementId],
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
  // 3. C1.1: no uncorrected misstatements above FINAL materiality.
  const materiality = await tx.query<{ overall: string }>(
    `SELECT overall::text FROM materiality
      WHERE engagement_id = $1 AND status = 'approved'
      ORDER BY version_no DESC LIMIT 1`,
    [engagementId],
  );
  const uncorrected = await tx.query<{ total: string | null }>(
    `SELECT sum(amount)::text AS total FROM misstatement
      WHERE engagement_id = $1 AND trivial = false AND corrected = false`,
    [engagementId],
  );
  const b5Ok =
    materiality.rows[0] !== undefined &&
    Math.abs(Number(uncorrected.rows[0]?.total ?? 0)) <= Number(materiality.rows[0].overall);
  // 10. C1.2 all cleared.
  const openB4 = await count(
    tx,
    "SELECT count(*)::text AS n FROM finding WHERE engagement_id = $1 AND route = 'b4' AND status = 'open'",
    [engagementId],
  );
  // 11. C4.3: no confirmations still outstanding.
  const outstandingConfirmations = await count(
    tx,
    `SELECT count(*)::text AS n FROM confirmation
      WHERE engagement_id = $1 AND status IN ('prepared', 'approved', 'sent')`,
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
    { key: "b6_confirmations_closed", ok: outstandingConfirmations === 0 },
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
}

export async function getConclusionState(engagementId: string): Promise<ConclusionState> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ report_date: string | null; opinion: string | null; archived_at: string | null }>(
      `SELECT report_date::text, opinion, to_char(archived_at, 'YYYY-MM-DD') AS archived_at
         FROM engagement WHERE id = $1`,
      [engagementId],
    );
    if (!result.rows[0]) throw new CompletionError("not-found");
    return {
      reportDate: result.rows[0].report_date,
      opinion: result.rows[0].opinion,
      archivedAt: result.rows[0].archived_at,
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
  const { tenantId, role } = await requireTenant();
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
  const { tenantId, userId, role } = await requireTenant();
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

    const snapshot = await tx.query<{ data: unknown }>(
      `SELECT json_build_object(
         'fileIndex', (SELECT json_agg(json_build_object('code', code, 'title', title_en)) FROM file_item WHERE engagement_id = $1),
         'risks', (SELECT coalesce(json_agg(to_jsonb(r) - 'tenant_id'), '[]'::json) FROM risk r WHERE engagement_id = $1),
         'misstatements', (SELECT coalesce(json_agg(to_jsonb(m) - 'tenant_id'), '[]'::json) FROM misstatement m WHERE engagement_id = $1),
         'findings', (SELECT coalesce(json_agg(to_jsonb(f) - 'tenant_id'), '[]'::json) FROM finding f WHERE engagement_id = $1),
         'confirmations', (SELECT coalesce(json_agg(to_jsonb(c) - 'tenant_id'), '[]'::json) FROM confirmation c WHERE engagement_id = $1),
         'documents', (SELECT coalesce(json_agg(json_build_object('title', d.title, 'kind', d.kind, 'versions', d.current_version)), '[]'::json)
                         FROM document d WHERE d.engagement_id = $1)
       ) AS data`,
      [engagementId],
    );
    await tx.query(
      `INSERT INTO completion_record (tenant_id, engagement_id, key, data, done_by)
       VALUES ($1, $2, 'archive_manifest', $3, $4)
       ON CONFLICT (engagement_id, key) DO NOTHING`,
      [tenantId, engagementId, JSON.stringify(snapshot.rows[0].data), userId],
    );
    // Fix the retention date in the same transaction that closes the file, from
    // the firm's period as it stands today. Stamping it here rather than reading
    // the firm setting later means a change to that setting cannot
    // retrospectively shorten the life of a file already archived.
    const policy = await tx.query<{ retention_years: number }>(
      "SELECT coalesce(t.retention_years, 10) AS retention_years FROM tenant t WHERE t.id = $1",
      [tenantId],
    );
    await tx.query(
      `UPDATE engagement
          SET phase = 'archived',
              archived_at = now(),
              retention_until = (coalesce(report_date, period_end) + ($2 || ' years')::interval)::date
        WHERE id = $1`,
      [engagementId, String(policy.rows[0]?.retention_years ?? 10)],
    );
  });
  // After COMMIT: an audit entry must not be rolled back with the work it
  // describes, and recordActivity opens its own transaction.
  await logArchive(engagementId);
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
  const { tenantId, userId } = await requireTenant();
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
