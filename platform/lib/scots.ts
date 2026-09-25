// SCOT Studio: significant classes of transactions as structured records —
// the SCOT (typed, linked to lead indexes, assignable), its what-can-go-wrongs,
// the controls answering them, and per-control results. Operating conclusions
// are DERIVED from linked control_test rows at read time (cra.ts precedent) so
// they can never diverge from the deviation side-effects in lib/execution.ts.

import { CR_DEFICIENT_BASIS as CR_DEFICIENT_BASIS_TEXT } from "@/lib/cra-model";
import { withTenant } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/tenant";
import { createNotification } from "@/lib/notifications";
import { significantAccounts } from "@/lib/significant-accounts";
import { amountOr } from "@/lib/amount";
import { tocRowsPlanned, tocRowsTested } from "@/lib/toc-grid";

export type TransactionType = "routine" | "non_routine" | "estimation";
export type ScotStrategy = "controls" | "substantive";
export type ControlType = "manual" | "it_dependent" | "automated";

export interface ScotControl {
  id: string;
  scotId: string;
  name: string;
  owner: string | null;
  controlType: ControlType;
  frequency: string | null;
  objective: "prevent" | "detect";
  selectedForTesting: boolean;
  testDesign: string | null;
  designEval: "effective" | "ineffective" | null;
  implemented: boolean | null;
  operatingNotes: string | null;
  /** assigned by the sampling tool (random / MUS) — never typed by hand */
  sampleSize: number | null;
  sampleNote: string | null;
  /** derived from linked control_test rows — null until a test is recorded */
  operating: "effective" | "exceptions" | null;
  testsCount: number;
  wcgwIds: string[];
  /** the documented E1.2 conclusion after evaluating exceptions (CONTROLS 7.3) */
  operatingEval: "effective" | "not_effective" | null;
  /** occurrences of the control in the period — drives the SAMPLE 3.3 minimum */
  tocPopulation: number | null;
  /** occurrence numbers drawn at random by the Sampling tool, ascending */
  tocSampleItems: number[] | null;
  tocSampleDrawnAt: string | null;
  /** transactions tested: {attributes: string[], rows: [{ref,date,desc,results}]} */
  tocGrid: TocGrid | null;
}

export interface TocGridRow {
  ref: string;
  date: string;
  desc: string;
  results: Record<string, "pass" | "fail" | "na" | "">;
}
export interface TocGrid {
  attributes: string[];
  rows: TocGridRow[];
}

export interface Wcgw {
  id: string;
  scotId: string;
  description: string;
  assertions: string[];
  sort: number;
  controlIds: string[];
}

export interface Scot {
  id: string;
  name: string;
  description: string | null;
  transactionType: TransactionType;
  strategy: ScotStrategy;
  applications: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  indexes: { indexCode: string; assertions: string[] }[];
  wcgws: Wcgw[];
  controls: ScotControl[];
}

export interface ScotStudioView {
  scots: Scot[];
  /** significant P6.2 indexes with no SCOT covering them */
  uncoveredIndexes: string[];
  /** WCGWs with no linked control */
  unansweredWcgws: number;
  /** ¶33 violations: substantive-alone-insufficient risk indexes with no selected control */
  para33Violations: { indexCode: string; riskDescription: string }[];
}

export async function listScots(engagementId: string): Promise<Scot[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.query<{
      id: string;
      name: string;
      description: string | null;
      transaction_type: TransactionType;
      strategy: ScotStrategy;
      applications: string | null;
      assignee_user_id: string | null;
      assignee_name: string | null;
      indexes: string | null;
      wcgws: string | null;
      controls: string | null;
    }>(
      `SELECT s.id, s.name, s.description, s.transaction_type, s.strategy, s.applications,
              s.assignee_user_id,
              (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = s.assignee_user_id) AS assignee_name,
              (SELECT json_agg(json_build_object('indexCode', si.index_code, 'assertions', si.assertions) ORDER BY si.index_code)
                 FROM scot_index si WHERE si.scot_id = s.id)::text AS indexes,
              (SELECT json_agg(json_build_object(
                       'id', w.id, 'scotId', w.scot_id, 'description', w.description,
                       'assertions', w.assertions, 'sort', w.sort,
                       'controlIds', coalesce((SELECT json_agg(wc.control_id) FROM wcgw_control wc WHERE wc.wcgw_id = w.id), '[]'::json))
                       ORDER BY w.sort, w.created_at)
                 FROM wcgw w WHERE w.scot_id = s.id)::text AS wcgws,
              (SELECT json_agg(json_build_object(
                       'id', c.id, 'scotId', c.scot_id, 'name', c.name, 'owner', c.owner,
                       'controlType', c.control_type, 'frequency', c.frequency, 'objective', c.objective,
                       'selectedForTesting', c.selected_for_testing, 'testDesign', c.test_design,
                       'designEval', c.design_eval, 'implemented', c.implemented,
                       'operatingNotes', c.operating_notes,
                       'sampleSize', c.sample_size, 'sampleNote', c.sample_note,
                       'operatingEval', c.operating_eval, 'tocPopulation', c.toc_population,
                       'tocSampleItems', c.toc_sample_items, 'tocSampleDrawnAt', c.toc_sample_drawn_at,
                       'tocGrid', c.toc_grid,
                       'operating', tst.operating, 'testsCount', tst.tests_count,
                       'wcgwIds', coalesce((SELECT json_agg(wc.wcgw_id) FROM wcgw_control wc WHERE wc.control_id = c.id), '[]'::json))
                       ORDER BY c.created_at)
                 FROM scot_control c
                 LEFT JOIN LATERAL (
                   SELECT CASE WHEN count(*) = 0 THEN NULL
                               WHEN bool_or(ct.result = 'deviation') THEN 'exceptions'
                               ELSE 'effective' END AS operating,
                          count(*)::int AS tests_count
                     FROM control_test ct WHERE ct.scot_control_id = c.id
                 ) tst ON true
                 WHERE c.scot_id = s.id)::text AS controls
         FROM scot s
        WHERE s.engagement_id = $1
        ORDER BY s.created_at`,
      [engagementId],
    );
    return rows.rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      transactionType: r.transaction_type,
      strategy: r.strategy,
      applications: r.applications,
      assigneeUserId: r.assignee_user_id,
      assigneeName: r.assignee_name,
      indexes: r.indexes ? JSON.parse(r.indexes) : [],
      wcgws: r.wcgws ? JSON.parse(r.wcgws) : [],
      controls: r.controls ? JSON.parse(r.controls) : [],
    }));
  });
}

/**
 * The full studio view with the coverage numbers the strips display:
 * uncovered significant accounts, unanswered WCGWs, and the ISA 315 ¶33
 * violations (substantive-alone-insufficient risk with no selected control on
 * its index). A rendered warning, never a constraint — an abandoned reliance
 * legitimately creates a transient violation the auditor must resolve.
 */
export async function scotStudio(engagementId: string): Promise<ScotStudioView> {
  const scots = await listScots(engagementId);
  // the same significance basis P6.2 and the Risk Console use — defaults from
  // TE and risk linkage included, not just explicitly recorded decisions
  const sigView = await significantAccounts(engagementId).catch(() => null);
  const { tenantId } = await requireTenant();

  const covered = new Set(scots.flatMap((s) => s.indexes.map((i) => i.indexCode)));
  const selectedByIndex = new Set(
    scots.flatMap((s) =>
      s.controls.some((c) => c.selectedForTesting) ? s.indexes.map((i) => i.indexCode) : [],
    ),
  );

  return withTenant(tenantId, async (tx) => {
    let significant: string[];
    if (sigView) {
      significant = sigView.rows.filter((r) => r.status === "significant").map((r) => r.index);
    } else {
      // no trial balance yet — fall back to explicitly recorded P6.2 decisions
      const sig = await tx.query<{ field_key: string; value: string }>(
        `SELECT field_key, value #>> '{}' AS value FROM form_response
          WHERE engagement_id = $1 AND code = 'wp:P6.2' AND field_key ~ '^sa_[A-Z0-9]{1,4}$'`,
        [engagementId],
      );
      significant = sig.rows
        .filter((r) => r.value === "significant")
        .map((r) => r.field_key.slice(3));
    }
    const uncoveredIndexes = significant.filter((code) => !covered.has(code));

    const unansweredWcgws = scots.reduce(
      (n, s) => n + s.wcgws.filter((w) => w.controlIds.length === 0).length,
      0,
    );

    // ¶33: substantive-alone-insufficient risks must keep a selected control on their index
    const p33 = await tx.query<{ index_code: string; description: string }>(
      `SELECT DISTINCT li.index_code, rk.description
         FROM risk rk
         JOIN risk_lead_index li ON li.risk_id = rk.id
        WHERE rk.engagement_id = $1 AND rk.substantive_alone_insufficient AND rk.rebutted = false`,
      [engagementId],
    );
    const para33Violations = p33.rows
      .filter((r) => !selectedByIndex.has(r.index_code))
      .map((r) => ({ indexCode: r.index_code, riskDescription: r.description }));

    return { scots, uncoveredIndexes, unansweredWcgws, para33Violations };
  });
}

/** The one-line registry summary for the papers' blue auto fields. */
export function scotSummary(view: ScotStudioView): string {
  const controls = view.scots.reduce((n, s) => n + s.controls.length, 0);
  const selected = view.scots.reduce(
    (n, s) => n + s.controls.filter((c) => c.selectedForTesting).length,
    0,
  );
  const wcgws = view.scots.reduce((n, s) => n + s.wcgws.length, 0);
  return `${view.scots.length} SCOT(s) · ${wcgws} WCGW(s) · ${controls} control(s) · ${selected} selected for testing`;
}

// ------------------------------------------------------------ walkthroughs --

// S1.3: each SCOT carries an "Understand the SCOT & Walkthrough" form. The
// answers are key-value rows in form_response under code `wt:<scot_id>` —
// tenant- and engagement-scoped like every paper answer, and free to evolve
// with the firm's standard form without migrations.

const WT_KEY = /^[a-z_]{1,40}$/;

export async function walkthroughValues(
  engagementId: string,
): Promise<Record<string, Record<string, string>>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ code: string; field_key: string; value: string }>(
      `SELECT code, field_key, value #>> '{}' AS value
         FROM form_response
        WHERE engagement_id = $1 AND code LIKE 'wt:%'`,
      [engagementId],
    );
    const out: Record<string, Record<string, string>> = {};
    for (const row of r.rows) {
      const scotId = row.code.slice(3);
      (out[scotId] ??= {})[row.field_key] = row.value;
    }
    return out;
  });
}

export async function saveWalkthrough(
  engagementId: string,
  scotId: string,
  key: string,
  value: string,
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!WT_KEY.test(key)) throw new Error("invalid-key");
  await withTenant(tenantId, async (tx) => {
    // the scot must belong to this engagement — never trust the id pair blindly
    const owner = await tx.query("SELECT 1 FROM scot WHERE id = $1 AND engagement_id = $2", [scotId, engagementId]);
    if (!owner.rows[0]) throw new Error("not-found");
    if (value.trim() === "") {
      await tx.query(
        "DELETE FROM form_response WHERE engagement_id = $1 AND code = $2 AND field_key = $3",
        [engagementId, `wt:${scotId}`, key],
      );
      return;
    }
    await tx.query(
      `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by)
       VALUES ($1, $2, $3, $4, to_jsonb($5::text), $6)
       ON CONFLICT (engagement_id, code, field_key)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [tenantId, engagementId, `wt:${scotId}`, key, value, userId],
    );
  });
  await voidStaleScotSignoffs(tenantId, userId, engagementId, ["S1.3"]);
}

// ------------------------------------------------------------------- FSCP --

// S1.4: the financial statement close process is ONE process per engagement —
// a separate non-routine class of transactions in its own right. Its
// structured answers live in form_response under the fixed code 'fscp'.

export async function fscpValues(engagementId: string): Promise<Record<string, string>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ field_key: string; value: string }>(
      "SELECT field_key, value #>> '{}' AS value FROM form_response WHERE engagement_id = $1 AND code = 'fscp'",
      [engagementId],
    );
    return Object.fromEntries(r.rows.map((row) => [row.field_key, row.value]));
  });
}

export async function saveFscp(engagementId: string, key: string, value: string): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!WT_KEY.test(key)) throw new Error("invalid-key");
  await withTenant(tenantId, async (tx) => {
    if (value.trim() === "") {
      await tx.query(
        "DELETE FROM form_response WHERE engagement_id = $1 AND code = 'fscp' AND field_key = $2",
        [engagementId, key],
      );
      return;
    }
    await tx.query(
      `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by)
       VALUES ($1, $2, 'fscp', $3, to_jsonb($4::text), $5)
       ON CONFLICT (engagement_id, code, field_key)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [tenantId, engagementId, key, value, userId],
    );
  });
  await voidStaleScotSignoffs(tenantId, userId, engagementId, ["S1.4"]);
}

// ------------------------------------------------- tests of details sampling --

export type { TodAssurance, TodCra } from "@/lib/tod-plan";
import { planTod, type GlLine, type TodAssurance, type TodCra } from "@/lib/tod-plan";
import { jeIdentity, jeKeyColumns } from "@/lib/dataset-mapping";

async function glLines(
  tx: { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> },
  engagementId: string,
  prefix: string,
): Promise<GlLine[] | "no-gl" | "no-mapping"> {
  const gl = await tx.query<{ id: string; mapping: Record<string, string> | null }>(
    `SELECT id, mapping FROM sub_ledger_dataset
      WHERE engagement_id = $1 AND kind = 'journal_entries'
      ORDER BY (timing = 'pre_audit') DESC, created_at DESC LIMIT 1`,
    [engagementId],
  );
  if (!gl.rows[0]) return "no-gl";
  const mapping = gl.rows[0].mapping;
  if (!mapping?.account || !mapping.amount) return "no-mapping";
  const rows = await tx.query<{ data: Record<string, unknown> }>(
    "SELECT data FROM sub_ledger_row WHERE dataset_id = $1",
    [gl.rows[0].id],
  );
  const clean = prefix.replace(/[^0-9]/g, "");
  const keyCols = jeKeyColumns(mapping);
  const jeHeader = typeof mapping.jeNumber === "string" ? mapping.jeNumber : null;
  const text = (v: unknown): string | null => (v === null || v === undefined ? null : String(v).trim() || null);
  const out: GlLine[] = [];
  for (const { data } of rows.rows) {
    const account = String(data[mapping.account] ?? "").trim();
    if (clean && !account.startsWith(clean)) continue;
    const n = amountOr(data[mapping.amount], 0);
    if (!Number.isFinite(n) || n === 0) continue;
    out.push({
      ref: jeIdentity(data, keyCols, jeHeader, text) ?? account,
      account,
      amount: Math.abs(n),
    });
  }
  return out;
}

/** The accounts the ToD dropdown offers: GL 3-digit prefixes by value. */
export async function listGlAccounts(
  engagementId: string,
): Promise<{ prefix: string; label: string; total: number; lines: number }[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const lines = await glLines(tx, engagementId, "");
    if (typeof lines === "string") return [];
    const byPrefix = new Map<string, { total: number; lines: number; sample: string }>();
    for (const l of lines) {
      const p = l.account.slice(0, 3);
      if (!/^[0-9]{3}$/.test(p)) continue;
      const cur = byPrefix.get(p) ?? { total: 0, lines: 0, sample: l.account };
      cur.total += l.amount;
      cur.lines += 1;
      byPrefix.set(p, cur);
    }
    return [...byPrefix.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 40)
      .map(([prefix, v]) => ({ prefix, label: prefix, total: Math.round(v.total), lines: v.lines }));
  });
}

/**
 * Tests-of-details sampling plan: base sample = (population − key items) ÷ TE,
 * multiplied by the MUS audit-risk-table factor for the CRA, the assurance
 * from other substantive procedures and the achieved key-item coverage.
 * Key items default to lines ≥ TE (examined in full). Selection is systematic
 * (MUS) over the remaining population with a random start.
 */
export async function todPreview(
  engagementId: string,
  prefix: string,
  cra: TodCra,
  assurance: TodAssurance,
  thresholdInput?: number,
): Promise<
  | {
      ok: true;
      populationValue: number;
      populationCount: number;
      te: number;
      threshold: number;
      keyItemCount: number;
      keyItemValue: number;
      coveragePct: number;
      baseSize: number;
      factor: number | null;
      sampleSize: number;
      interval: number | null;
      items: { ref: string; account: string; amount: number; kind: "key" | "sample" }[];
    }
  | { ok: false; error: "no-gl" | "no-mapping" | "empty-population" | "no-materiality" }
> {
  const { tenantId } = await requireTenant();
  const { approvedMateriality } = await import("@/lib/materiality");
  const m = await approvedMateriality(engagementId);
  if (!m) return { ok: false, error: "no-materiality" };
  const te = m.performance;
  return withTenant(tenantId, async (tx) => {
    const lines = await glLines(tx, engagementId, prefix);
    if (typeof lines === "string") return { ok: false, error: lines };
    if (lines.length === 0) return { ok: false, error: "empty-population" };

    const p = planTod({ lines, te, threshold: thresholdInput, cra, assurance });
    return {
      ok: true,
      populationValue: p.populationValue,
      populationCount: p.populationCount,
      te,
      threshold: p.threshold,
      keyItemCount: p.keyItems.length,
      keyItemValue: p.keyItemValue,
      coveragePct: p.coveragePct,
      baseSize: p.baseSize,
      factor: p.factor,
      sampleSize: p.sampleSize,
      interval: p.interval,
      items: [
        ...p.keyItems.slice(0, 30).map((l) => ({ ref: l.ref, account: l.account, amount: Math.round(l.amount), kind: "key" as const })),
        ...p.sample.slice(0, 60).map((l) => ({ ref: l.ref, account: l.account, amount: Math.round(l.amount), kind: "sample" as const })),
      ],
    };
  });
}

// ---------------------------------------------------------------- mutations --

const TYPES: TransactionType[] = ["routine", "non_routine", "estimation"];
const STRATEGIES: ScotStrategy[] = ["controls", "substantive"];
const CONTROL_TYPES: ControlType[] = ["manual", "it_dependent", "automated"];
const ASSERTION_CODES = new Set(["C", "E", "A", "V", "P"]);
const cleanAssertions = (a: unknown): string[] =>
  Array.isArray(a) ? a.map(String).filter((x) => ASSERTION_CODES.has(x)) : [];

/**
 * The SCOT Studio writes land on papers that may already be signed: the
 * register on S1.1, WCGWs and controls on S1.2, the selection on S2.1, the
 * test design on S2.2, the results on E1.2. Each writer names the papers its
 * write reaches; the signatures whose content moved are voided the way
 * savePaper voids them — after the write committed, in a transaction of its
 * own, then the trail entry and the signers' notices (lib/working-papers.ts).
 */
async function voidStaleScotSignoffs(
  tenantId: string,
  userId: string,
  engagementId: string | null | undefined,
  codes: string[],
): Promise<void> {
  if (!engagementId) return;
  const { invalidateStaleSignoffs, reportInvalidatedSignoffs } = await import("@/lib/working-papers");
  for (const code of codes) {
    const rows = await withTenant(tenantId, (tx) => invalidateStaleSignoffs(tx, engagementId, code));
    await reportInvalidatedSignoffs(tenantId, engagementId, code, rows, userId);
  }
}
type Q = { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> };
const engagementOfScot = async (tx: Q, scotId: string) =>
  (await tx.query<{ engagement_id: string }>("SELECT engagement_id FROM scot WHERE id = $1", [scotId])).rows[0]?.engagement_id ?? null;
const engagementOfWcgw = async (tx: Q, wcgwId: string) =>
  (await tx.query<{ engagement_id: string }>("SELECT s.engagement_id FROM wcgw w JOIN scot s ON s.id = w.scot_id WHERE w.id = $1", [wcgwId])).rows[0]?.engagement_id ?? null;
const engagementOfControl = async (tx: Q, controlId: string) =>
  (await tx.query<{ engagement_id: string }>("SELECT s.engagement_id FROM scot_control c JOIN scot s ON s.id = c.scot_id WHERE c.id = $1", [controlId])).rows[0]?.engagement_id ?? null;

export async function createScot(
  engagementId: string,
  input: { name: string; transactionType: string; strategy: string; applications?: string; description?: string },
): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  const name = input.name.trim();
  if (!name) throw new Error("name-required");
  const type = TYPES.includes(input.transactionType as TransactionType) ? input.transactionType : "routine";
  const strategy = STRATEGIES.includes(input.strategy as ScotStrategy) ? input.strategy : "substantive";
  const scotId = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `INSERT INTO scot (tenant_id, engagement_id, name, description, transaction_type, strategy, applications, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (engagement_id, name) DO NOTHING
       RETURNING id`,
      [tenantId, engagementId, name, input.description?.trim() || null, type, strategy, input.applications?.trim() || null, userId],
    );
    if (!r.rows[0]) throw new Error("duplicate-name");
    return r.rows[0].id;
  });
  await voidStaleScotSignoffs(tenantId, userId, engagementId, ["S1.1"]);
  return scotId;
}

export async function updateScot(
  scotId: string,
  patch: { name?: string; transactionType?: string; strategy?: string; applications?: string; description?: string },
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  const engagementId = await withTenant(tenantId, async (tx) => {
    await tx.query(
      `UPDATE scot SET
         name = coalesce(nullif($2, ''), name),
         transaction_type = CASE WHEN $3 IN ('routine','non_routine','estimation') THEN $3 ELSE transaction_type END,
         strategy = CASE WHEN $4 IN ('controls','substantive') THEN $4 ELSE strategy END,
         applications = coalesce($5, applications),
         description = coalesce($6, description)
       WHERE id = $1`,
      [scotId, patch.name?.trim() ?? "", patch.transactionType ?? "", patch.strategy ?? "", patch.applications ?? null, patch.description ?? null],
    );
    return engagementOfScot(tx, scotId);
  });
  await voidStaleScotSignoffs(tenantId, userId, engagementId, ["S1.1"]);
}

export async function deleteScot(scotId: string): Promise<void> {
  const { tenantId, userId } = await requireRole("senior");
  const engagementId = await withTenant(tenantId, async (tx) => {
    const owner = await engagementOfScot(tx, scotId);
    await tx.query("DELETE FROM scot WHERE id = $1", [scotId]);
    return owner;
  });
  // a SCOT takes its WCGWs and controls with it: S1.2 moved as well
  await voidStaleScotSignoffs(tenantId, userId, engagementId, ["S1.1", "S1.2"]);
}

/** Assign a SCOT; the assignee is notified (outside the tx — house rule). */
export async function assignScot(scotId: string, userIdOrNull: string | null): Promise<void> {
  const { tenantId } = await requireTenant();
  const notify = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ name: string; engagement_id: string; changed: boolean }>(
      `UPDATE scot SET assignee_user_id = $2
        WHERE id = $1
        RETURNING name, engagement_id, (assignee_user_id IS NOT NULL) AS changed`,
      [scotId, userIdOrNull],
    );
    const row = r.rows[0] ?? null;
    if (!row) return null;
    // the register itself lives on the S1.1 task page — link straight to it
    const item = await tx.query<{ id: string }>(
      "SELECT id FROM file_item WHERE engagement_id = $1 AND code = 'S1.1' LIMIT 1",
      [row.engagement_id],
    );
    return { ...row, fileItemId: item.rows[0]?.id ?? null };
  });
  if (notify && userIdOrNull) {
    try {
      await createNotification({
        tenantId,
        userId: userIdOrNull,
        kind: "scot_assignment",
        title: `SCOT assigned: ${notify.name}`,
        body: "Open the SCOT register on task S1.1 to see the class of transactions you now own.",
        href: notify.fileItemId
          ? `/engagements/${notify.engagement_id}/sections/${notify.fileItemId}`
          : `/engagements/${notify.engagement_id}/dashboard`,
      });
    } catch {
      // notification failure never blocks the assignment
    }
  }
}

export async function linkScotIndex(scotId: string, indexCode: string, assertions: unknown): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!/^[A-Z0-9]{1,4}$/.test(indexCode)) throw new Error("invalid-index");
  const engagementId = await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO scot_index (tenant_id, scot_id, index_code, assertions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (scot_id, index_code) DO UPDATE SET assertions = EXCLUDED.assertions`,
      [tenantId, scotId, indexCode, cleanAssertions(assertions)],
    );
    return engagementOfScot(tx, scotId);
  });
  await voidStaleScotSignoffs(tenantId, userId, engagementId, ["S1.1"]);
}

export async function unlinkScotIndex(scotId: string, indexCode: string): Promise<void> {
  const { tenantId, userId } = await requireRole("senior");
  const engagementId = await withTenant(tenantId, async (tx) => {
    await tx.query("DELETE FROM scot_index WHERE scot_id = $1 AND index_code = $2", [scotId, indexCode]);
    return engagementOfScot(tx, scotId);
  });
  await voidStaleScotSignoffs(tenantId, userId, engagementId, ["S1.1"]);
}

export async function addWcgw(scotId: string, description: string, assertions: unknown): Promise<string> {
  const { tenantId } = await requireTenant();
  if (!description.trim()) throw new Error("description-required");
  // A "what could go wrong" is a risk to an assertion; with none it answers
  // nothing and feeds nothing in S3.1 (UAT B134).
  if (cleanAssertions(assertions).length === 0) throw new Error("assertion-required");
  const { tenantId: t, userId } = await requireTenant();
  const { id, engagementId } = await withTenant(t, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `INSERT INTO wcgw (tenant_id, scot_id, description, assertions, sort)
       VALUES ($1, $2, $3, $4, coalesce((SELECT max(sort) + 10 FROM wcgw WHERE scot_id = $2), 10))
       RETURNING id`,
      [tenantId, scotId, description.trim(), cleanAssertions(assertions)],
    );
    return { id: r.rows[0].id, engagementId: await engagementOfScot(tx, scotId) };
  });
  await voidStaleScotSignoffs(tenantId, userId, engagementId, ["S1.2"]);
  return id;
}

export async function deleteWcgw(wcgwId: string): Promise<void> {
  const { tenantId, userId } = await requireRole("senior");
  const engagementId = await withTenant(tenantId, async (tx) => {
    const owner = await engagementOfWcgw(tx, wcgwId);
    await tx.query("DELETE FROM wcgw WHERE id = $1", [wcgwId]);
    return owner;
  });
  await voidStaleScotSignoffs(tenantId, userId, engagementId, ["S1.2"]);
}

export async function addControl(
  scotId: string,
  input: { name: string; owner?: string; controlType?: string; frequency?: string; objective?: string; wcgwIds?: string[] },
): Promise<string> {
  const { tenantId } = await requireTenant();
  if (!input.name.trim()) throw new Error("name-required");
  const type = CONTROL_TYPES.includes(input.controlType as ControlType) ? input.controlType : "manual";
  const objective = input.objective === "detect" ? "detect" : "prevent";
  const { userId } = await requireTenant();
  const { id, engagementId } = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `INSERT INTO scot_control (tenant_id, scot_id, name, owner, control_type, frequency, objective)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [tenantId, scotId, input.name.trim(), input.owner?.trim() || null, type, input.frequency?.trim() || null, objective],
    );
    for (const wcgwId of input.wcgwIds ?? []) {
      await tx.query(
        `INSERT INTO wcgw_control (tenant_id, wcgw_id, control_id) VALUES ($1, $2, $3)
         ON CONFLICT (wcgw_id, control_id) DO NOTHING`,
        [tenantId, wcgwId, r.rows[0].id],
      );
    }
    return { id: r.rows[0].id, engagementId: await engagementOfScot(tx, scotId) };
  });
  await voidStaleScotSignoffs(tenantId, userId, engagementId, ["S1.2"]);
  return id;
}

/** The basis stamped on S3.1 when E1.2 concludes a control not effective (defined client-safe in lib/cra-model.ts). */
export const CR_DEFICIENT_BASIS = CR_DEFICIENT_BASIS_TEXT;

export async function updateControl(
  controlId: string,
  patch: {
    selectedForTesting?: boolean;
    testDesign?: string;
    designEval?: "effective" | "ineffective" | "";
    implemented?: boolean | null;
    operatingNotes?: string;
    sampleSize?: number;
    sampleNote?: string;
    operatingEval?: "effective" | "not_effective" | "";
    tocPopulation?: number | null;
    tocGrid?: TocGrid;
    /** a fresh random draw replaces the previous one and dates it */
    tocSampleItems?: number[];
  },
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  const engagementId = await withTenant(tenantId, async (tx) => {
    // Only a control that addresses at least one WCGW can be selected for
    // testing: an orphan control flowed into E1.2 and sampling (UAT B46).
    if (patch.selectedForTesting === true) {
      const linked = await tx.query("SELECT 1 FROM wcgw_control WHERE control_id = $1 LIMIT 1", [controlId]);
      if ((linked.rowCount ?? 0) === 0) throw new Error("control-without-wcgw");
    }
    await tx.query(
      `UPDATE scot_control SET
         selected_for_testing = coalesce($2, selected_for_testing),
         test_design = coalesce($3, test_design),
         design_eval = CASE WHEN $4 = '' THEN NULL WHEN $4 IN ('effective','ineffective') THEN $4 ELSE design_eval END,
         implemented = CASE WHEN $5::boolean IS NOT NULL THEN $5 ELSE implemented END,
         operating_notes = coalesce($6, operating_notes),
         sample_size = coalesce($7, sample_size),
         sample_note = coalesce($8, sample_note),
         operating_eval = CASE WHEN $9 = '' THEN NULL WHEN $9 IN ('effective','not_effective') THEN $9 ELSE operating_eval END,
         toc_population = coalesce($10, toc_population),
         toc_grid = coalesce($11::jsonb, toc_grid),
         toc_sample_items = coalesce($12::int[], toc_sample_items),
         toc_sample_drawn_at = CASE WHEN $12::int[] IS NOT NULL THEN now() ELSE toc_sample_drawn_at END
       WHERE id = $1`,
      [
        controlId,
        patch.selectedForTesting ?? null,
        patch.testDesign ?? null,
        patch.designEval ?? null,
        patch.implemented ?? null,
        patch.operatingNotes ?? null,
        Number.isFinite(patch.sampleSize) ? Math.max(1, Math.round(patch.sampleSize as number)) : null,
        patch.sampleNote ?? null,
        patch.operatingEval ?? null,
        Number.isFinite(patch.tocPopulation as number) ? Math.max(0, Math.round(patch.tocPopulation as number)) : null,
        patch.tocGrid ? JSON.stringify(patch.tocGrid) : null,
        Array.isArray(patch.tocSampleItems) ? patch.tocSampleItems.map((v) => Math.max(1, Math.round(Number(v)))).filter((v) => Number.isFinite(v)) : null,
      ],
    );

    // "Effective" is a conclusion on evidence: it needs the planned sample
    // tested on the grid, every attribute answered (UAT B84). Checked on the
    // row as it stands after this update, so a grid saved in the same call
    // counts; a refusal rolls the whole update back.
    if (patch.operatingEval === "effective") {
      const state = await tx.query<{ sample_size: number | null; toc_grid: TocGrid | null }>(
        "SELECT sample_size, toc_grid FROM scot_control WHERE id = $1",
        [controlId],
      );
      const row = state.rows[0];
      const tested = tocRowsTested(row?.toc_grid ?? null);
      if (tested < tocRowsPlanned(row?.sample_size)) throw new Error("toc-incomplete");
    }

    // A control concluded NOT EFFECTIVE cannot be relied upon: the S3.1
    // matrix is set to not-rely for every assertion that control answered,
    // on every lead index its SCOT feeds, with the reason recorded in the
    // basis. Doing it here — inside the same transaction as the conclusion —
    // means the assessment can never disagree with the test result.
    if (patch.operatingEval === "not_effective") {
      await tx.query(
        `INSERT INTO cra_assessment
           (tenant_id, engagement_id, index_code, assertion, relevant, cr, cr_basis, updated_by)
         SELECT $1, s.engagement_id, si.index_code, a.assertion, true, 'not_rely', $3, $4
           FROM scot_control c
           JOIN scot s ON s.id = c.scot_id
           JOIN scot_index si ON si.scot_id = s.id
           JOIN wcgw_control wc ON wc.control_id = c.id
           JOIN wcgw w ON w.id = wc.wcgw_id
           CROSS JOIN LATERAL unnest(w.assertions) AS a(assertion)
          WHERE c.id = $2
         ON CONFLICT (engagement_id, index_code, assertion) DO UPDATE SET
           cr = 'not_rely',
           cr_basis = CASE
             WHEN coalesce(cra_assessment.cr_basis, '') LIKE '%E1.2%' THEN cra_assessment.cr_basis
             WHEN coalesce(cra_assessment.cr_basis, '') = '' THEN EXCLUDED.cr_basis
             ELSE cra_assessment.cr_basis || ' · ' || EXCLUDED.cr_basis
           END,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
        [tenantId, controlId, CR_DEFICIENT_BASIS, userId],
      );
    }

    // The same conclusion in reverse. Concluding a control effective after it
    // had been concluded not effective has to lift the not-rely this function
    // stamped, or S3.1 keeps a reliance decision the test result no longer
    // supports. Three things keep it honest: only rows carrying the E1.2 basis
    // are touched, so a not-rely reached on other grounds stands; where E1.2's
    // reason was appended to another one, only E1.2's clause is removed and the
    // row stays not-rely; and a pair is released only when no OTHER control
    // answering it is still concluded not effective.
    if (patch.operatingEval === "effective") {
      await tx.query(
        `UPDATE cra_assessment ca SET
           cr = CASE WHEN coalesce(ca.cr_basis, '') = $3 THEN NULL ELSE ca.cr END,
           cr_basis = CASE
             WHEN coalesce(ca.cr_basis, '') = $3 THEN NULL
             WHEN ca.cr_basis LIKE '% · ' || $3
               THEN left(ca.cr_basis, length(ca.cr_basis) - length(' · ' || $3))
             ELSE ca.cr_basis
           END,
           updated_by = $4,
           updated_at = now()
         WHERE ca.tenant_id = $1
           AND ca.cr = 'not_rely'
           AND coalesce(ca.cr_basis, '') LIKE '%' || $3 || '%'
           AND (ca.engagement_id, ca.index_code, ca.assertion) IN (
                 SELECT s.engagement_id, si.index_code, a.assertion
                   FROM scot_control c
                   JOIN scot s ON s.id = c.scot_id
                   JOIN scot_index si ON si.scot_id = s.id
                   JOIN wcgw_control wc ON wc.control_id = c.id
                   JOIN wcgw w ON w.id = wc.wcgw_id
                   CROSS JOIN LATERAL unnest(w.assertions) AS a(assertion)
                  WHERE c.id = $2)
           AND NOT EXISTS (
                 SELECT 1
                   FROM scot_control c2
                   JOIN scot s2 ON s2.id = c2.scot_id
                   JOIN scot_index si2 ON si2.scot_id = s2.id
                   JOIN wcgw_control wc2 ON wc2.control_id = c2.id
                   JOIN wcgw w2 ON w2.id = wc2.wcgw_id
                   CROSS JOIN LATERAL unnest(w2.assertions) AS a2(assertion)
                  WHERE c2.id <> $2
                    AND c2.operating_eval = 'not_effective'
                    AND s2.engagement_id = ca.engagement_id
                    AND si2.index_code = ca.index_code
                    AND a2.assertion = ca.assertion)`,
        [tenantId, controlId, CR_DEFICIENT_BASIS, userId],
      );
    }
    return engagementOfControl(tx, controlId);
  });
  // Which papers this patch reaches: the selection (S2.1), the test design
  // (S2.2) or the results (E1.2) — their signatures are voided if the content
  // they were given over has moved.
  const codes: string[] = [];
  if (patch.selectedForTesting !== undefined) codes.push("S2.1");
  if (["testDesign", "designEval", "implemented", "sampleSize", "sampleNote"].some((k) => patch[k as keyof typeof patch] !== undefined)) codes.push("S2.2");
  if (["operatingNotes", "operatingEval", "tocPopulation", "tocGrid", "tocSampleItems"].some((k) => patch[k as keyof typeof patch] !== undefined)) codes.push("E1.2");
  await voidStaleScotSignoffs(tenantId, userId, engagementId, codes);
}

/**
 * MUS preview for the sampling tool: the population is the pre-audit general
 * ledger filtered by account prefix; the interval defaults to TE/3 (high
 * assurance); items at or above the interval form the top stratum, examined
 * in full. Size = top stratum + ceil(remaining value / interval).
 */
export async function musPreview(
  engagementId: string,
  prefix: string,
  intervalInput?: number,
): Promise<
  | { ok: true; populationValue: number; populationCount: number; interval: number; topStratum: number; sampleSize: number }
  | { ok: false; error: "no-gl" | "no-mapping" | "empty-population" }
> {
  const { tenantId } = await requireTenant();
  const { approvedMateriality } = await import("@/lib/materiality");
  const m = await approvedMateriality(engagementId);
  return withTenant(tenantId, async (tx) => {
    const gl = await tx.query<{ id: string; mapping: Record<string, string> | null }>(
      `SELECT id, mapping FROM sub_ledger_dataset
        WHERE engagement_id = $1 AND kind = 'journal_entries'
        ORDER BY (timing = 'pre_audit') DESC, created_at DESC LIMIT 1`,
      [engagementId],
    );
    if (!gl.rows[0]) return { ok: false, error: "no-gl" };
    const mapping = gl.rows[0].mapping;
    if (!mapping?.account || !mapping.amount) return { ok: false, error: "no-mapping" };
    const rows = await tx.query<{ data: Record<string, unknown> }>(
      "SELECT data FROM sub_ledger_row WHERE dataset_id = $1",
      [gl.rows[0].id],
    );
    const clean = prefix.replace(/[^0-9]/g, "");
    let populationValue = 0;
    let populationCount = 0;
    const amounts: number[] = [];
    for (const { data } of rows.rows) {
      const account = String(data[mapping.account] ?? "").trim();
      if (clean && !account.startsWith(clean)) continue;
      const n = amountOr(data[mapping.amount], 0);
      if (!Number.isFinite(n) || n === 0) continue;
      const abs = Math.abs(n);
      populationValue += abs;
      populationCount += 1;
      amounts.push(abs);
    }
    if (populationCount === 0) return { ok: false, error: "empty-population" };
    const defaultInterval = m ? Math.max(1, Math.round(m.performance / 3)) : Math.max(1, Math.round(populationValue / 25));
    const interval = intervalInput && intervalInput > 0 ? Math.round(intervalInput) : defaultInterval;
    const topStratum = amounts.filter((a) => a >= interval).length;
    const remaining = amounts.filter((a) => a < interval).reduce((s, a) => s + a, 0);
    const sampleSize = topStratum + Math.ceil(remaining / interval);
    return { ok: true, populationValue: Math.round(populationValue), populationCount, interval, topStratum, sampleSize };
  });
}

export async function toggleWcgwControl(wcgwId: string, controlId: string, linked: boolean): Promise<void> {
  const { tenantId, userId } = await requireRole("senior");
  const engagementId = await withTenant(tenantId, async (tx) => {
    if (linked) {
      await tx.query(
        `INSERT INTO wcgw_control (tenant_id, wcgw_id, control_id) VALUES ($1, $2, $3)
         ON CONFLICT (wcgw_id, control_id) DO NOTHING`,
        [tenantId, wcgwId, controlId],
      );
    } else {
      await tx.query("DELETE FROM wcgw_control WHERE wcgw_id = $1 AND control_id = $2", [wcgwId, controlId]);
    }
    return engagementOfWcgw(tx, wcgwId);
  });
  await voidStaleScotSignoffs(tenantId, userId, engagementId, ["S1.2"]);
}

export async function deleteControl(controlId: string): Promise<void> {
  const { tenantId, userId } = await requireRole("senior");
  const engagementId = await withTenant(tenantId, async (tx) => {
    const owner = await engagementOfControl(tx, controlId);
    await tx.query("DELETE FROM scot_control WHERE id = $1", [controlId]);
    return owner;
  });
  await voidStaleScotSignoffs(tenantId, userId, engagementId, ["S1.2", "S2.1", "S2.2", "E1.2"]);
}
