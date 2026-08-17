// SCOT Studio: significant classes of transactions as structured records —
// the SCOT (typed, linked to lead indexes, assignable), its what-can-go-wrongs,
// the controls answering them, and per-control results. Operating conclusions
// are DERIVED from linked control_test rows at read time (cra.ts precedent) so
// they can never diverge from the deviation side-effects in lib/execution.ts.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { createNotification } from "@/lib/notifications";
import { significantAccounts } from "@/lib/significant-accounts";

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
  /** derived from linked control_test rows — null until a test is recorded */
  operating: "effective" | "exceptions" | null;
  testsCount: number;
  wcgwIds: string[];
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
}

// ---------------------------------------------------------------- mutations --

const TYPES: TransactionType[] = ["routine", "non_routine", "estimation"];
const STRATEGIES: ScotStrategy[] = ["controls", "substantive"];
const CONTROL_TYPES: ControlType[] = ["manual", "it_dependent", "automated"];
const ASSERTION_CODES = new Set(["C", "E", "A", "V", "P"]);
const cleanAssertions = (a: unknown): string[] =>
  Array.isArray(a) ? a.map(String).filter((x) => ASSERTION_CODES.has(x)) : [];

export async function createScot(
  engagementId: string,
  input: { name: string; transactionType: string; strategy: string; applications?: string; description?: string },
): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  const name = input.name.trim();
  if (!name) throw new Error("name-required");
  const type = TYPES.includes(input.transactionType as TransactionType) ? input.transactionType : "routine";
  const strategy = STRATEGIES.includes(input.strategy as ScotStrategy) ? input.strategy : "substantive";
  return withTenant(tenantId, async (tx) => {
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
}

export async function updateScot(
  scotId: string,
  patch: { name?: string; transactionType?: string; strategy?: string; applications?: string; description?: string },
): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
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
  });
}

export async function deleteScot(scotId: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query("DELETE FROM scot WHERE id = $1", [scotId]);
  });
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
    return r.rows[0] ?? null;
  });
  if (notify && userIdOrNull) {
    try {
      await createNotification({
        tenantId,
        userId: userIdOrNull,
        kind: "scot_assignment",
        title: `SCOT assigned: ${notify.name}`,
        body: "Open the SCOT register on task S1.1 to see the class of transactions you now own.",
      });
    } catch {
      // notification failure never blocks the assignment
    }
  }
}

export async function linkScotIndex(scotId: string, indexCode: string, assertions: unknown): Promise<void> {
  const { tenantId } = await requireTenant();
  if (!/^[A-Z0-9]{1,4}$/.test(indexCode)) throw new Error("invalid-index");
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO scot_index (tenant_id, scot_id, index_code, assertions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (scot_id, index_code) DO UPDATE SET assertions = EXCLUDED.assertions`,
      [tenantId, scotId, indexCode, cleanAssertions(assertions)],
    );
  });
}

export async function unlinkScotIndex(scotId: string, indexCode: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query("DELETE FROM scot_index WHERE scot_id = $1 AND index_code = $2", [scotId, indexCode]);
  });
}

export async function addWcgw(scotId: string, description: string, assertions: unknown): Promise<string> {
  const { tenantId } = await requireTenant();
  if (!description.trim()) throw new Error("description-required");
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `INSERT INTO wcgw (tenant_id, scot_id, description, assertions, sort)
       VALUES ($1, $2, $3, $4, coalesce((SELECT max(sort) + 10 FROM wcgw WHERE scot_id = $2), 10))
       RETURNING id`,
      [tenantId, scotId, description.trim(), cleanAssertions(assertions)],
    );
    return r.rows[0].id;
  });
}

export async function deleteWcgw(wcgwId: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query("DELETE FROM wcgw WHERE id = $1", [wcgwId]);
  });
}

export async function addControl(
  scotId: string,
  input: { name: string; owner?: string; controlType?: string; frequency?: string; objective?: string; wcgwIds?: string[] },
): Promise<string> {
  const { tenantId } = await requireTenant();
  if (!input.name.trim()) throw new Error("name-required");
  const type = CONTROL_TYPES.includes(input.controlType as ControlType) ? input.controlType : "manual";
  const objective = input.objective === "detect" ? "detect" : "prevent";
  return withTenant(tenantId, async (tx) => {
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
    return r.rows[0].id;
  });
}

export async function updateControl(
  controlId: string,
  patch: {
    selectedForTesting?: boolean;
    testDesign?: string;
    designEval?: "effective" | "ineffective" | "";
    implemented?: boolean | null;
    operatingNotes?: string;
  },
): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `UPDATE scot_control SET
         selected_for_testing = coalesce($2, selected_for_testing),
         test_design = coalesce($3, test_design),
         design_eval = CASE WHEN $4 = '' THEN NULL WHEN $4 IN ('effective','ineffective') THEN $4 ELSE design_eval END,
         implemented = CASE WHEN $5::boolean IS NOT NULL THEN $5 ELSE implemented END,
         operating_notes = coalesce($6, operating_notes)
       WHERE id = $1`,
      [
        controlId,
        patch.selectedForTesting ?? null,
        patch.testDesign ?? null,
        patch.designEval ?? null,
        patch.implemented ?? null,
        patch.operatingNotes ?? null,
      ],
    );
  });
}

export async function toggleWcgwControl(wcgwId: string, controlId: string, linked: boolean): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    if (linked) {
      await tx.query(
        `INSERT INTO wcgw_control (tenant_id, wcgw_id, control_id) VALUES ($1, $2, $3)
         ON CONFLICT (wcgw_id, control_id) DO NOTHING`,
        [tenantId, wcgwId, controlId],
      );
    } else {
      await tx.query("DELETE FROM wcgw_control WHERE wcgw_id = $1 AND control_id = $2", [wcgwId, controlId]);
    }
  });
}

export async function deleteControl(controlId: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query("DELETE FROM scot_control WHERE id = $1", [controlId]);
  });
}
