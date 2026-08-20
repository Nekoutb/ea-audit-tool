// SCOT Studio: significant classes of transactions as structured records —
// the SCOT (typed, linked to lead indexes, assignable), its what-can-go-wrongs,
// the controls answering them, and per-control results. Operating conclusions
// are DERIVED from linked control_test rows at read time (cra.ts precedent) so
// they can never diverge from the deviation side-effects in lib/execution.ts.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { createNotification } from "@/lib/notifications";
import { significantAccounts } from "@/lib/significant-accounts";
import { amountOr } from "@/lib/amount";

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
}

// ------------------------------------------------- tests of details sampling --

export type TodCra = "minimal" | "low" | "low_sr" | "moderate" | "high" | "high_sr";
export type TodAssurance = "little" | "some" | "corroborative" | "persuasive";

// The audit risk tables: the multiple applied to the base sample size
// (population excluding key items ÷ TE) per CRA × assurance from other
// substantive procedures × key-item coverage (columns 0/10/30/50/70/90/100%).
// null = no representative sample required at that combination.
const ART_COLS = [0, 10, 30, 50, 70, 90, 100];
const N = null;
const ART_MUS: Record<TodCra, Record<TodAssurance, (number | null)[]>> = {
  minimal:  { little: [0.5, 0.4, 0.1, N, N, N, N], some: [0.2, 0.1, N, N, N, N, N], corroborative: [N, N, N, N, N, N, N], persuasive: [N, N, N, N, N, N, N] },
  low:      { little: [1.0, 0.9, 0.7, 0.3, N, N, N], some: [0.7, 0.6, 0.4, N, N, N, N], corroborative: [0.3, 0.2, N, N, N, N, N], persuasive: [N, N, N, N, N, N, N] },
  low_sr:   { little: [1.4, 1.3, 1.0, 0.7, 0.2, N, N], some: [1.1, 1.0, 0.7, 0.4, N, N, N], corroborative: [0.7, 0.6, 0.3, N, N, N, N], persuasive: [N, N, N, N, N, N, N] },
  moderate: { little: [2.1, 2.0, 1.7, 1.4, 0.9, N, N], some: [1.8, 1.7, 1.4, 1.1, 0.6, N, N], corroborative: [1.4, 1.3, 1.0, 0.7, 0.2, N, N], persuasive: [N, N, N, N, N, N, N] },
  high:     { little: [2.6, 2.5, 2.3, 1.9, 1.4, 0.3, N], some: [2.4, 2.2, 2.0, 1.7, 1.1, N, N], corroborative: [1.9, 1.8, 1.6, 1.3, 0.7, N, N], persuasive: [0.3, 0.2, N, N, N, N, N] },
  high_sr:  { little: [3.0, 2.9, 2.6, 2.3, 1.8, 0.7, N], some: [2.7, 2.6, 2.4, 2.0, 1.5, 0.4, N], corroborative: [2.3, 2.2, 1.9, 1.6, 1.1, N, N], persuasive: [0.7, 0.6, 0.3, N, N, N, N] },
};

interface GlLine {
  ref: string;
  account: string;
  amount: number;
}

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
  const out: GlLine[] = [];
  for (const { data } of rows.rows) {
    const account = String(data[mapping.account] ?? "").trim();
    if (clean && !account.startsWith(clean)) continue;
    const n = amountOr(data[mapping.amount], 0);
    if (!Number.isFinite(n) || n === 0) continue;
    out.push({
      ref: String(data[mapping.jeNumber ?? ""] ?? "").trim() || account,
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

    const populationValue = lines.reduce((s, l) => s + l.amount, 0);
    const threshold = thresholdInput && thresholdInput > 0 ? Math.round(thresholdInput) : te;
    const keyItems = lines.filter((l) => l.amount >= threshold);
    const rest = lines.filter((l) => l.amount < threshold);
    const keyItemValue = keyItems.reduce((s, l) => s + l.amount, 0);
    const remaining = populationValue - keyItemValue;
    const coveragePct = populationValue > 0 ? (keyItemValue / populationValue) * 100 : 0;
    // nearest coverage column at or below the achieved coverage (conservative)
    let col = 0;
    for (let i = 0; i < ART_COLS.length; i += 1) if (coveragePct >= ART_COLS[i]) col = i;
    const factor = ART_MUS[cra][assurance][col];
    const baseSize = te > 0 ? remaining / te : 0;
    const sampleSize = factor === null ? 0 : Math.ceil(baseSize * factor);
    const interval = sampleSize > 0 ? Math.round(remaining / sampleSize) : null;

    // systematic (MUS) selection over the remaining population, random start
    const selected: GlLine[] = [];
    if (interval && sampleSize > 0) {
      const start = Math.floor(Math.random() * interval) + 1;
      let cumulative = 0;
      let nextHook = start;
      for (const l of rest) {
        cumulative += l.amount;
        while (cumulative >= nextHook && selected.length < sampleSize) {
          selected.push(l);
          nextHook += interval;
        }
        if (selected.length >= sampleSize) break;
      }
    }
    return {
      ok: true,
      populationValue: Math.round(populationValue),
      populationCount: lines.length,
      te,
      threshold,
      keyItemCount: keyItems.length,
      keyItemValue: Math.round(keyItemValue),
      coveragePct: Math.round(coveragePct * 10) / 10,
      baseSize: Math.round(baseSize * 10) / 10,
      factor,
      sampleSize,
      interval,
      items: [
        ...keyItems.slice(0, 30).map((l) => ({ ...l, amount: Math.round(l.amount), kind: "key" as const })),
        ...selected.slice(0, 60).map((l) => ({ ...l, amount: Math.round(l.amount), kind: "sample" as const })),
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
    sampleSize?: number;
    sampleNote?: string;
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
         operating_notes = coalesce($6, operating_notes),
         sample_size = coalesce($7, sample_size),
         sample_note = coalesce($8, sample_note)
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
      ],
    );
  });
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
