// Risk register (spec §5.3 — the linkage core): P5.2 potential risks are raised
// from any planning form, then dismissed with rationale or promoted to S3.1.
// Two presumed risks are auto-seeded per engagement (spec §3).

import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { canPartnerSignoff } from "@/lib/rbac";
import { requireTenant } from "@/lib/tenant";

export type RiskRating = "low" | "medium" | "high";
export type RiskStatus = "identified" | "response_planned" | "response_executed" | "concluded";
export const ASSERTIONS = ["C", "E", "A", "V", "P"] as const;
export type Assertion = (typeof ASSERTIONS)[number];

export interface PotentialRisk {
  id: string;
  description: string;
  sourceCode: string;
  status: "open" | "dismissed" | "promoted";
  dismissalRationale: string | null;
  raisedByName: string;
}

export interface RiskSectionLink {
  fileItemId: string;
  code: string;
  titleEn: string;
  titleFr: string;
  assertions: Assertion[];
}

export interface Risk {
  id: string;
  description: string;
  source: string | null;
  level: "fs" | "assertion";
  likelihood: RiskRating;
  magnitude: RiskRating;
  rating: RiskRating;
  significant: boolean;
  substantiveAloneInsufficient: boolean;
  controlsReliance: boolean;
  status: RiskStatus;
  /** the deck's risk taxonomy: where the risk comes from */
  category: "business" | "fraud" | "error" | null;
  /** ISA 315 ¶31(a): which inherent risk factors drive the risk */
  inherentFactors: string[];
  /** ISA 315 ¶30: the pervasive effect, for FS-level risks */
  fsNote: string | null;
  /** lead-schedule indexes the risk lands on, with the assertions it threatens */
  indexLinks: { indexCode: string; assertions: string[] }[];
  presumedType: "revenue_fraud" | "mgmt_override" | null;
  rebutted: boolean;
  addedAfterPlanning: boolean;
  additionApproved: boolean;
  sections: RiskSectionLink[];
  linkedStepCount: number;
}

/** Inherent risk = likelihood × magnitude on the spectrum of inherent risk. */
export function inherentRating(likelihood: RiskRating, magnitude: RiskRating): RiskRating {
  const score = { low: 1, medium: 2, high: 3 };
  const product = score[likelihood] * score[magnitude];
  if (product >= 6) return "high";
  if (product >= 3) return "medium";
  return "low";
}

/**
 * Seed the two presumed ISA 240 risks. Called inside createEngagement's
 * transaction: revenue-fraud (rebuttable, partner sign-off required) mapped to
 * E4.1; management override (NOT rebuttable) mapped to E2.1.
 */
export async function seedPresumedRisks(
  tx: PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<void> {
  const sections = await tx.query<{ id: string; code: string }>(
    "SELECT id, code FROM file_item WHERE engagement_id = $1 AND code IN ('E4.20', 'E2.1')",
    [engagementId],
  );
  const byCode = new Map(sections.rows.map((row) => [row.code, row.id]));

  const seed = [
    {
      description: "Presumed fraud risk in revenue recognition (ISA 240)",
      presumed: "revenue_fraud",
      section: byCode.get("E4.20"),
      assertions: ["E", "A"],
    },
    {
      description: "Management override of controls (ISA 240)",
      presumed: "mgmt_override",
      section: byCode.get("E2.1"),
      assertions: ["C", "E", "A"],
    },
  ] as const;

  for (const entry of seed) {
    const risk = await tx.query<{ id: string }>(
      `INSERT INTO risk (tenant_id, engagement_id, description, level, likelihood, magnitude,
                         significant, presumed_type, source, category)
       VALUES ($1, $2, $3, 'assertion', 'high', 'high', true, $4, 'Auto-seeded (ISA 240)', 'fraud')
       RETURNING id`,
      [tenantId, engagementId, entry.description, entry.presumed],
    );
    if (entry.section) {
      await tx.query(
        "INSERT INTO risk_section (tenant_id, risk_id, file_item_id, assertions) VALUES ($1, $2, $3, $4)",
        [tenantId, risk.rows[0].id, entry.section, entry.assertions],
      );
    }
  }
}

export async function raisePotentialRisk(
  engagementId: string,
  description: string,
  sourceCode: string,
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!description.trim()) throw new Error("description-required");
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO potential_risk (tenant_id, engagement_id, description, source_code, raised_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, engagementId, description.trim(), sourceCode, userId],
    );
  });
}

export async function listPotentialRisks(engagementId: string): Promise<PotentialRisk[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      description: string;
      source_code: string;
      status: PotentialRisk["status"];
      dismissal_rationale: string | null;
      raised_by_name: string;
    }>(
      `SELECT pr.id, pr.description, pr.source_code, pr.status, pr.dismissal_rationale,
              coalesce(u.name, u.email, '—') AS raised_by_name
         FROM potential_risk pr
         LEFT JOIN app_user u ON u.id = pr.raised_by
        WHERE pr.engagement_id = $1
        ORDER BY pr.raised_at`,
      [engagementId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      description: row.description,
      sourceCode: row.source_code,
      status: row.status,
      dismissalRationale: row.dismissal_rationale,
      raisedByName: row.raised_by_name,
    }));
  });
}

/** P5.2 decision: dismiss with documented rationale, or promote into S3.1. */
export async function dismissPotentialRisk(id: string, rationale: string): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!rationale.trim()) throw new Error("rationale-required");
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `UPDATE potential_risk
          SET status = 'dismissed', dismissal_rationale = $2, decided_by = $3, decided_at = now()
        WHERE id = $1 AND status = 'open'`,
      [id, rationale, userId],
    );
  });
}

export async function promotePotentialRisk(id: string): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    // Guarded single-statement transition: a concurrent promote of the same
    // potential risk finds status already 'promoted' and fails cleanly.
    const source = await tx.query<{ engagement_id: string; description: string; source_code: string }>(
      `UPDATE potential_risk
          SET status = 'promoted', decided_by = $2, decided_at = now()
        WHERE id = $1 AND status = 'open'
        RETURNING engagement_id, description, source_code`,
      [id, userId],
    );
    const row = source.rows[0];
    if (!row) throw new Error("not-found");
    const risk = await tx.query<{ id: string }>(
      `INSERT INTO risk (tenant_id, engagement_id, description, source, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, row.engagement_id, row.description, `P5.2 (${row.source_code})`, userId],
    );
    return risk.rows[0].id;
  });
}

export async function listRisks(engagementId: string): Promise<Risk[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      description: string;
      source: string | null;
      level: "fs" | "assertion";
      likelihood: RiskRating;
      magnitude: RiskRating;
      significant: boolean;
      substantive_alone_insufficient: boolean;
      controls_reliance: boolean;
      status: RiskStatus;
      category: Risk["category"];
      inherent_factors: string[] | null;
      fs_note: string | null;
      index_links: string | null;
      presumed_type: Risk["presumedType"];
      rebutted: boolean;
      added_after_planning: boolean;
      addition_approved_by: string | null;
      sections: string | null;
      linked_steps: string;
    }>(
      `SELECT r.id, r.description, r.source, r.level, r.likelihood, r.magnitude, r.significant,
              r.substantive_alone_insufficient, r.controls_reliance, r.status, r.category, r.presumed_type,
              r.inherent_factors, r.fs_note,
              (SELECT json_agg(json_build_object('indexCode', li.index_code, 'assertions', li.assertions) ORDER BY li.index_code)
                 FROM risk_lead_index li WHERE li.risk_id = r.id)::text AS index_links,
              r.rebutted, r.added_after_planning, r.addition_approved_by,
              (SELECT json_agg(json_build_object(
                 'fileItemId', fi.id, 'code', fi.code, 'titleEn', fi.title_en,
                 'titleFr', fi.title_fr, 'assertions', rs.assertions))
                 FROM risk_section rs JOIN file_item fi ON fi.id = rs.file_item_id
                WHERE rs.risk_id = r.id)::text AS sections,
              (SELECT count(*)::text FROM risk_response rr WHERE rr.risk_id = r.id) AS linked_steps
         FROM risk r
        WHERE r.engagement_id = $1
        ORDER BY r.created_at`,
      [engagementId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      description: row.description,
      source: row.source,
      level: row.level,
      likelihood: row.likelihood,
      magnitude: row.magnitude,
      rating: inherentRating(row.likelihood, row.magnitude),
      significant: row.significant,
      substantiveAloneInsufficient: row.substantive_alone_insufficient,
      controlsReliance: row.controls_reliance,
      status: row.status,
      category: row.category,
      inherentFactors: row.inherent_factors ?? [],
      fsNote: row.fs_note,
      indexLinks: row.index_links ? (JSON.parse(row.index_links) as Risk["indexLinks"]) : [],
      presumedType: row.presumed_type,
      rebutted: row.rebutted,
      addedAfterPlanning: row.added_after_planning,
      additionApproved: row.addition_approved_by !== null,
      sections: row.sections ? (JSON.parse(row.sections) as RiskSectionLink[]) : [],
      linkedStepCount: Number(row.linked_steps),
    }));
  });
}

export async function updateRisk(
  riskId: string,
  patch: {
    description?: string;
    level?: "fs" | "assertion";
    likelihood?: RiskRating;
    magnitude?: RiskRating;
    significant?: boolean;
    substantiveAloneInsufficient?: boolean;
    controlsReliance?: boolean;
    status?: RiskStatus;
    category?: "business" | "fraud" | "error" | null;
    inherentFactors?: string[];
    fsNote?: string;
  },
): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const current = await tx.query<{ presumed_type: string | null }>(
      "SELECT presumed_type FROM risk WHERE id = $1 FOR UPDATE",
      [riskId],
    );
    if (!current.rows[0]) throw new Error("not-found");
    // Presumed ISA 240 risks (spec §3) cannot be de-flagged through a plain
    // update: management override is never rebuttable, and the revenue-fraud
    // presumption is removable ONLY via rebutRevenueFraudRisk (partner +
    // documented justification). [Adversarial-review fix]
    if (current.rows[0].presumed_type !== null && patch.significant === false) {
      throw new Error("not-rebuttable");
    }
    await tx.query(
      `UPDATE risk SET
         description = coalesce($2, description),
         level = coalesce($3, level),
         likelihood = coalesce($4, likelihood),
         magnitude = coalesce($5, magnitude),
         significant = coalesce($6, significant),
         substantive_alone_insufficient = coalesce($7, substantive_alone_insufficient),
         controls_reliance = coalesce($8, controls_reliance),
         status = coalesce($9, status),
         category = CASE WHEN $10::boolean THEN $11 ELSE category END,
         inherent_factors = coalesce($12, inherent_factors),
         fs_note = coalesce($13, fs_note)
       WHERE id = $1`,
      [
        riskId,
        patch.description ?? null,
        patch.level ?? null,
        patch.likelihood ?? null,
        patch.magnitude ?? null,
        patch.significant ?? null,
        patch.substantiveAloneInsufficient ?? null,
        patch.controlsReliance ?? null,
        patch.status ?? null,
        patch.category !== undefined,
        patch.category ?? null,
        patch.inherentFactors ?? null,
        patch.fsNote ?? null,
      ],
    );
  });
}

/** Link a risk to a lead-schedule index with the assertions it threatens. */
export async function linkRiskToIndex(
  riskId: string,
  indexCode: string,
  assertions: string[],
): Promise<void> {
  const { tenantId } = await requireTenant();
  if (!/^[A-Z0-9]{1,4}$/.test(indexCode)) throw new Error("invalid-index");
  const clean = assertions.filter((a) => ["C", "E", "A", "V", "P"].includes(a));
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO risk_lead_index (tenant_id, risk_id, index_code, assertions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (risk_id, index_code) DO UPDATE SET assertions = EXCLUDED.assertions`,
      [tenantId, riskId, indexCode, clean],
    );
  });
}

export async function unlinkRiskFromIndex(riskId: string, indexCode: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query("DELETE FROM risk_lead_index WHERE risk_id = $1 AND index_code = $2", [riskId, indexCode]);
  });
}

/** Every index a live risk lands on, with the union of threatened assertions. */
export async function riskDerivedAssertions(
  engagementId: string,
): Promise<Map<string, Set<string>>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ index_code: string; assertions: string[] }>(
      `SELECT li.index_code, li.assertions
         FROM risk_lead_index li JOIN risk rk ON rk.id = li.risk_id
        WHERE rk.engagement_id = $1 AND rk.rebutted = false`,
      [engagementId],
    );
    const out = new Map<string, Set<string>>();
    for (const row of r.rows) {
      const set = out.get(row.index_code) ?? new Set<string>();
      for (const a of row.assertions) set.add(a);
      out.set(row.index_code, set);
    }
    return out;
  });
}
/** Rebut the presumed revenue-fraud risk — requires justification + partner. */
export async function rebutRevenueFraudRisk(riskId: string, justification: string): Promise<void> {
  const { tenantId, userId, role } = await requireTenant();
  if (!canPartnerSignoff(role)) throw new Error("forbidden");
  if (!justification.trim()) throw new Error("justification-required");
  await withTenant(tenantId, async (tx) => {
    const updated = await tx.query(
      `UPDATE risk SET rebutted = true, rebuttal_justification = $2, rebuttal_approved_by = $3,
              significant = false, status = 'concluded'
        WHERE id = $1 AND presumed_type = 'revenue_fraud'`,
      [riskId, justification, userId],
    );
    if (updated.rowCount === 0) throw new Error("not-rebuttable");
  });
}

export async function mapRiskToSection(
  riskId: string,
  fileItemId: string,
  assertions: Assertion[],
): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO risk_section (tenant_id, risk_id, file_item_id, assertions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (risk_id, file_item_id) DO UPDATE SET assertions = EXCLUDED.assertions`,
      [tenantId, riskId, fileItemId, assertions],
    );
  });
}

/** Link a planned response: risk ↔ program step (both directions queryable). */
export async function linkRiskToStep(riskId: string, programStepId: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO risk_response (tenant_id, risk_id, program_step_id)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [tenantId, riskId, programStepId],
    );
    await tx.query(
      "UPDATE risk SET status = 'response_planned' WHERE id = $1 AND status = 'identified'",
      [riskId],
    );
  });
}

/** Risks pinned to an E-section header (spec §8.1). */
export async function risksForSection(fileItemId: string): Promise<
  { id: string; description: string; rating: RiskRating; significant: boolean; assertions: Assertion[] }[]
> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      description: string;
      likelihood: RiskRating;
      magnitude: RiskRating;
      significant: boolean;
      rebutted: boolean;
      assertions: Assertion[];
    }>(
      `SELECT r.id, r.description, r.likelihood, r.magnitude, r.significant, r.rebutted, rs.assertions
         FROM risk_section rs JOIN risk r ON r.id = rs.risk_id
        WHERE rs.file_item_id = $1 AND r.rebutted = false
        ORDER BY r.significant DESC, r.created_at`,
      [fileItemId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      description: row.description,
      rating: inherentRating(row.likelihood, row.magnitude),
      significant: row.significant,
      assertions: row.assertions,
    }));
  });
}
