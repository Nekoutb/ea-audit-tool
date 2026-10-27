// Substantive analytical procedures (F038, decision of 2026-10-27): the tool
// at /engagements/[id]/tools/sap, one procedure per lead index and assertion,
// persisted in substantive_analytical_procedure (20261027000007). The pure
// threshold and evaluation rules live in lib/sap-model.ts.
//
// The variance review of the lead schedules (lib/analytical-procedures.ts)
// stays what it is — the ISA 315 risk analytic. This is the ISA 520 ¶5
// substantive procedure: an expectation built before looking at the recorded
// amount, the reliability of its data, a threshold set by the CRA level of
// the account and assertion, the comparison, the investigation of a
// difference above the threshold, and a conclusion on the assertion.

import type { PoolClient } from "pg";
import { recordActivity } from "@/lib/activity";
import { apLeadSchedules } from "@/lib/analytical-procedures";
import { craOf, type CraCr, type CraIr, type CraLevel } from "@/lib/cra-model";
import { pool, withTenant } from "@/lib/db";
import { LEAD_INDEXES, LEAD_INDEX_BY_CODE, INDEX_SECTION, type LeadIndexDef } from "@/lib/lead-classes";
import { assertMutable } from "@/lib/mutability";
import {
  DEFAULT_SAP_THRESHOLDS,
  SAP_ASSERTIONS,
  evaluateSap,
  isSapAssertion,
  isSapPct,
  thresholdPctFor,
  type SapAssertion,
  type SapEvaluation,
  type SapThresholds,
} from "@/lib/sap-model";
import { requireRole, requireTenant, requireWrite } from "@/lib/tenant";

export class SapError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "SapError";
  }
}

/* ------------------------------ firm thresholds ------------------------------ */

export async function sapThresholdsTx(tx: PoolClient, tenantId: string): Promise<SapThresholds> {
  const r = await tx.query<{ low: number; moderate: number; high: number }>(
    "SELECT sap_threshold_low_pct AS low, sap_threshold_moderate_pct AS moderate, sap_threshold_high_pct AS high FROM tenant WHERE id = $1",
    [tenantId],
  );
  const row = r.rows[0];
  return row ? { low: Number(row.low), moderate: Number(row.moderate), high: Number(row.high) } : { ...DEFAULT_SAP_THRESHOLDS };
}

/** The firm's thresholds, for Settings and the tool. */
export async function sapThresholds(): Promise<SapThresholds> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, (tx) => sapThresholdsTx(tx, tenantId));
}

/**
 * Change the firm's percentages (firm administrators). Only procedures saved
 * from here on take the new default: a saved procedure keeps the percentage
 * it was evaluated with.
 */
export async function setSapThresholds(input: SapThresholds): Promise<void> {
  const { tenantId } = await requireRole("firm_admin");
  for (const v of [input.low, input.moderate, input.high]) {
    if (!isSapPct(v)) throw new SapError("sap-threshold-out-of-range");
  }
  // a higher risk never earns a wider tolerance than a lower one
  if (!(input.low >= input.moderate && input.moderate >= input.high)) throw new SapError("sap-threshold-order");
  const before = await withTenant(tenantId, (tx) => sapThresholdsTx(tx, tenantId));
  await pool.query(
    "UPDATE tenant SET sap_threshold_low_pct = $2, sap_threshold_moderate_pct = $3, sap_threshold_high_pct = $4 WHERE id = $1",
    [tenantId, input.low, input.moderate, input.high],
  );
  await recordActivity({
    entityType: "tenant",
    entityId: tenantId,
    action: "sap_thresholds_set",
    summary: `Substantive-analytics thresholds set to ${input.low} / ${input.moderate} / ${input.high} % of performance materiality (low / moderate / high CRA)`,
    before,
    after: input,
  });
}

/* --------------------------------- the view --------------------------------- */

export interface SapProcedure {
  id: string;
  indexCode: string;
  assertion: SapAssertion;
  expectationModel: string;
  inputs: string | null;
  expectedValue: number;
  dataReliability: string | null;
  /** the CRA level the threshold was taken from when the procedure was saved */
  craLevel: CraLevel | null;
  thresholdPct: number;
  thresholdOverridePct: number | null;
  thresholdOverrideReason: string | null;
  performanceMateriality: number | null;
  actualValue: number | null;
  actualSource: "tb" | "manual";
  investigation: string | null;
  corroboration: string | null;
  conclusion: "supported" | "not_supported" | null;
  updatedByName: string | null;
  updatedAt: string | null;
  evaluation: SapEvaluation;
}

export interface SapIndexView {
  def: LeadIndexDef;
  /** the E4 task of the index, when it is on the file */
  taskCode: string;
  fileItemId: string | null;
  /** closing balance of the index in the current TB, null without a TB */
  tbClosing: number | null;
  /** the current CRA level per assertion (S3.1), null where not assessed */
  cra: Partial<Record<SapAssertion, CraLevel>>;
  procedures: SapProcedure[];
}

export interface SapView {
  thresholds: SapThresholds;
  performanceMateriality: number | null;
  hasTb: boolean;
  indexes: SapIndexView[];
}

async function craLevelsTx(tx: PoolClient, engagementId: string): Promise<Map<string, CraLevel>> {
  const r = await tx.query<{ index_code: string; assertion: string; ir: CraIr | null; cr: CraCr | null }>(
    "SELECT index_code, assertion, ir, cr FROM cra_assessment WHERE engagement_id = $1 AND relevant",
    [engagementId],
  );
  const out = new Map<string, CraLevel>();
  for (const row of r.rows) {
    if (row.ir && row.cr) out.set(`${row.index_code}|${row.assertion}`, craOf(row.ir, row.cr));
  }
  return out;
}

async function performanceMaterialityTx(tx: PoolClient, engagementId: string): Promise<number | null> {
  const r = await tx.query<{ performance: string }>(
    "SELECT performance::text FROM materiality WHERE engagement_id = $1 AND status = 'approved' ORDER BY version_no DESC LIMIT 1",
    [engagementId],
  );
  return r.rows[0] ? Number(r.rows[0].performance) : null;
}

function toProcedure(row: {
  id: string;
  index_code: string;
  assertion: SapAssertion;
  expectation_model: string;
  inputs: string | null;
  expected_value: string;
  data_reliability: string | null;
  cra_level: CraLevel | null;
  threshold_pct: number;
  threshold_override_pct: number | null;
  threshold_override_reason: string | null;
  performance_materiality: string | null;
  actual_value: string | null;
  actual_source: "tb" | "manual";
  investigation: string | null;
  corroboration: string | null;
  conclusion: "supported" | "not_supported" | null;
  updated_by_name: string | null;
  updated_at: string | null;
}): SapProcedure {
  const expected = Number(row.expected_value);
  const actual = row.actual_value === null ? null : Number(row.actual_value);
  const pm = row.performance_materiality === null ? null : Number(row.performance_materiality);
  const pct = row.threshold_override_pct ?? row.threshold_pct;
  return {
    id: row.id,
    indexCode: row.index_code,
    assertion: row.assertion,
    expectationModel: row.expectation_model,
    inputs: row.inputs,
    expectedValue: expected,
    dataReliability: row.data_reliability,
    craLevel: row.cra_level,
    thresholdPct: row.threshold_pct,
    thresholdOverridePct: row.threshold_override_pct,
    thresholdOverrideReason: row.threshold_override_reason,
    performanceMateriality: pm,
    actualValue: actual,
    actualSource: row.actual_source,
    investigation: row.investigation,
    corroboration: row.corroboration,
    conclusion: row.conclusion,
    updatedByName: row.updated_by_name,
    updatedAt: row.updated_at,
    evaluation: evaluateSap({ expected, actual, performanceMateriality: pm, pct }),
  };
}

const SELECT_PROCEDURE = `
  SELECT p.id, p.index_code, p.assertion, p.expectation_model, p.inputs, p.expected_value::text,
         p.data_reliability, p.cra_level, p.threshold_pct, p.threshold_override_pct, p.threshold_override_reason,
         p.performance_materiality::text, p.actual_value::text, p.actual_source,
         p.investigation, p.corroboration, p.conclusion,
         (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = p.updated_by) AS updated_by_name,
         to_char(p.updated_at, 'YYYY-MM-DD HH24:MI') AS updated_at
    FROM substantive_analytical_procedure p`;

/** Every lead index of the file with its procedures — the tool's screen. */
export async function sapView(engagementId: string): Promise<SapView> {
  const { tenantId } = await requireTenant();
  // the TB closing per index, as the lead schedules present it
  const schedules = await apLeadSchedules(engagementId);
  const closing = new Map(schedules.map((s) => [s.def.code, s.closing]));
  return withTenant(tenantId, async (tx) => {
    // one client, one query at a time
    const thresholds = await sapThresholdsTx(tx, tenantId);
    const pm = await performanceMaterialityTx(tx, engagementId);
    const cra = await craLevelsTx(tx, engagementId);
    const items = await tx.query<{ id: string; code: string }>(
      "SELECT id, code FROM file_item WHERE engagement_id = $1 AND code LIKE 'E4.%'",
      [engagementId],
    );
    const itemByCode = new Map(items.rows.map((r) => [r.code, r.id]));
    const rows = await tx.query<Parameters<typeof toProcedure>[0]>(
      `${SELECT_PROCEDURE} WHERE p.engagement_id = $1 ORDER BY p.index_code, p.assertion`,
      [engagementId],
    );
    const byIndex = new Map<string, SapProcedure[]>();
    for (const row of rows.rows) {
      const list = byIndex.get(row.index_code) ?? [];
      list.push(toProcedure(row));
      byIndex.set(row.index_code, list);
    }
    const indexes: SapIndexView[] = [];
    for (const def of LEAD_INDEXES) {
      const taskCode = INDEX_SECTION[def.code];
      if (!taskCode) continue;
      const craOfIndex: Partial<Record<SapAssertion, CraLevel>> = {};
      for (const a of SAP_ASSERTIONS) {
        const level = cra.get(`${def.code}|${a}`);
        if (level) craOfIndex[a] = level;
      }
      indexes.push({
        def,
        taskCode,
        fileItemId: itemByCode.get(taskCode) ?? null,
        tbClosing: closing.get(def.code) ?? null,
        cra: craOfIndex,
        procedures: byIndex.get(def.code) ?? [],
      });
    }
    return { thresholds, performanceMateriality: pm, hasTb: schedules.length > 0, indexes };
  });
}

/** Procedures per index — the count the E4 paper shows: how many, how many concluded. */
export async function sapCountsByIndex(engagementId: string): Promise<Record<string, { total: number; concluded: number; exceeding: number }>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.query<Parameters<typeof toProcedure>[0]>(`${SELECT_PROCEDURE} WHERE p.engagement_id = $1`, [engagementId]);
    const out: Record<string, { total: number; concluded: number; exceeding: number }> = {};
    for (const row of rows.rows) {
      const p = toProcedure(row);
      const c = (out[p.indexCode] ??= { total: 0, concluded: 0, exceeding: 0 });
      c.total += 1;
      if (p.conclusion) c.concluded += 1;
      if (p.evaluation.exceeds) c.exceeding += 1;
    }
    return out;
  });
}

/* --------------------------------- saving --------------------------------- */

export interface SapInput {
  engagementId: string;
  indexCode: string;
  assertion: string;
  expectationModel: string;
  inputs: string | null;
  expectedValue: number;
  dataReliability: string | null;
  /** a per-procedure percentage in place of the firm default, with its reason */
  thresholdOverridePct: number | null;
  thresholdOverrideReason: string | null;
  /** the recorded amount when no TB supplies it */
  actualValue: number | null;
  investigation: string | null;
  corroboration: string | null;
  conclusion: string | null;
}

/**
 * Save (create or replace) the procedure of one index and assertion. The
 * expectation is mandatory — a procedure with no expectation is a variance
 * review, not a substantive procedure. An override of the threshold needs a
 * reason. The CRA level, the firm percentage and the performance materiality
 * are snapshotted here; the actual comes from the current TB where there is
 * one, else from the amount typed.
 */
export async function saveSap(input: SapInput): Promise<void> {
  const { tenantId, userId } = await requireWrite();
  if (!LEAD_INDEX_BY_CODE[input.indexCode]) throw new SapError("invalid-index");
  if (!isSapAssertion(input.assertion)) throw new SapError("invalid-assertion");
  const expectationModel = input.expectationModel.trim();
  if (!expectationModel) throw new SapError("sap-expectation-required");
  if (!Number.isFinite(input.expectedValue)) throw new SapError("sap-expected-value-required");
  const overridePct = input.thresholdOverridePct;
  const overrideReason = (input.thresholdOverrideReason ?? "").trim() || null;
  if (overridePct !== null) {
    if (!isSapPct(overridePct)) throw new SapError("sap-threshold-out-of-range");
    if (!overrideReason) throw new SapError("sap-override-reason-required");
  }
  const conclusion = input.conclusion === "supported" || input.conclusion === "not_supported" ? input.conclusion : null;
  if (input.conclusion && !conclusion) throw new SapError("invalid-conclusion");
  await assertMutable(input.engagementId);

  const schedules = await apLeadSchedules(input.engagementId);
  const tbClosing = schedules.find((s) => s.def.code === input.indexCode)?.closing ?? null;
  const actualSource: "tb" | "manual" = tbClosing !== null ? "tb" : "manual";
  const actualValue = tbClosing !== null ? tbClosing : input.actualValue !== null && Number.isFinite(input.actualValue) ? input.actualValue : null;

  const outcome = await withTenant(tenantId, async (tx) => {
    const thresholds = await sapThresholdsTx(tx, tenantId);
    const pm = await performanceMaterialityTx(tx, input.engagementId);
    const cra = await craLevelsTx(tx, input.engagementId);
    const level = cra.get(`${input.indexCode}|${input.assertion}`) ?? null;
    const pct = thresholdPctFor(level, thresholds);
    await tx.query(
      `INSERT INTO substantive_analytical_procedure
         (tenant_id, engagement_id, index_code, assertion, expectation_model, inputs, expected_value, data_reliability,
          cra_level, threshold_pct, threshold_override_pct, threshold_override_reason, performance_materiality,
          actual_value, actual_source, investigation, corroboration, conclusion, created_by, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19, now())
       ON CONFLICT (engagement_id, index_code, assertion) DO UPDATE
         SET expectation_model = EXCLUDED.expectation_model, inputs = EXCLUDED.inputs,
             expected_value = EXCLUDED.expected_value, data_reliability = EXCLUDED.data_reliability,
             cra_level = EXCLUDED.cra_level, threshold_pct = EXCLUDED.threshold_pct,
             threshold_override_pct = EXCLUDED.threshold_override_pct,
             threshold_override_reason = EXCLUDED.threshold_override_reason,
             performance_materiality = EXCLUDED.performance_materiality,
             actual_value = EXCLUDED.actual_value, actual_source = EXCLUDED.actual_source,
             investigation = EXCLUDED.investigation, corroboration = EXCLUDED.corroboration,
             conclusion = EXCLUDED.conclusion, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [
        tenantId, input.engagementId, input.indexCode, input.assertion, expectationModel,
        (input.inputs ?? "").trim() || null, input.expectedValue, (input.dataReliability ?? "").trim() || null,
        level, pct, overridePct, overridePct === null ? null : overrideReason, pm,
        actualValue, actualSource, (input.investigation ?? "").trim() || null,
        (input.corroboration ?? "").trim() || null, conclusion, userId,
      ],
    );
    return { level, pct, ...evaluateSap({ expected: input.expectedValue, actual: actualValue, performanceMateriality: pm, pct: overridePct ?? pct }) };
  });

  await recordActivity({
    engagementId: input.engagementId,
    entityType: "substantive_analytical_procedure",
    entityId: null,
    action: "sap_saved",
    summary: `Substantive analytical procedure saved on ${input.indexCode} / ${input.assertion}: expected ${Math.round(input.expectedValue)}, actual ${actualValue === null ? "—" : Math.round(actualValue)}, threshold ${overridePct ?? outcome.pct} % of PM${outcome.exceeds === null ? "" : outcome.exceeds ? " — difference above threshold" : " — within threshold"}${conclusion ? `, assertion ${conclusion.replace("_", " ")}` : ""}`,
    meta: { indexCode: input.indexCode, assertion: input.assertion, craLevel: outcome.level, thresholdPct: outcome.pct, overridePct, conclusion },
  });
}
