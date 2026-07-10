// Risk register (spec §5.3 — the linkage core): D7.1 potential risks are raised
// from any planning form, then dismissed with rationale or promoted to D7.2.
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
  presumedType: "revenue_fraud" | "mgmt_override" | null;
  rebutted: boolean;
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
 * E100; management override (NOT rebuttable) mapped to E350.
 */
export async function seedPresumedRisks(
  tx: PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<void> {
  const sections = await tx.query<{ id: string; code: string }>(
    "SELECT id, code FROM file_item WHERE engagement_id = $1 AND code IN ('E100', 'E350')",
    [engagementId],
  );
  const byCode = new Map(sections.rows.map((row) => [row.code, row.id]));

  const seed = [
    {
      description: "Presumed fraud risk in revenue recognition (ISA 240)",
      presumed: "revenue_fraud",
      section: byCode.get("E100"),
      assertions: ["E", "A"],
    },
    {
      description: "Management override of controls (ISA 240)",
      presumed: "mgmt_override",
      section: byCode.get("E350"),
      assertions: ["C", "E", "A"],
    },
  ] as const;

  for (const entry of seed) {
    const risk = await tx.query<{ id: string }>(
      `INSERT INTO risk (tenant_id, engagement_id, description, level, likelihood, magnitude,
                         significant, presumed_type, source)
       VALUES ($1, $2, $3, 'assertion', 'high', 'high', true, $4, 'Auto-seeded (ISA 240)')
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

/** D7.1 decision: dismiss with documented rationale, or promote into D7.2. */
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
    const source = await tx.query<{ engagement_id: string; description: string; source_code: string }>(
      "SELECT engagement_id, description, source_code FROM potential_risk WHERE id = $1 AND status = 'open'",
      [id],
    );
    const row = source.rows[0];
    if (!row) throw new Error("not-found");
    const risk = await tx.query<{ id: string }>(
      `INSERT INTO risk (tenant_id, engagement_id, description, source, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, row.engagement_id, row.description, `D7.1 (${row.source_code})`, userId],
    );
    await tx.query(
      "UPDATE potential_risk SET status = 'promoted', decided_by = $2, decided_at = now() WHERE id = $1",
      [id, userId],
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
      presumed_type: Risk["presumedType"];
      rebutted: boolean;
      sections: string | null;
      linked_steps: string;
    }>(
      `SELECT r.id, r.description, r.source, r.level, r.likelihood, r.magnitude, r.significant,
              r.substantive_alone_insufficient, r.controls_reliance, r.status, r.presumed_type,
              r.rebutted,
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
      presumedType: row.presumed_type,
      rebutted: row.rebutted,
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
  },
): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const current = await tx.query<{ presumed_type: string | null }>(
      "SELECT presumed_type FROM risk WHERE id = $1",
      [riskId],
    );
    if (!current.rows[0]) throw new Error("not-found");
    // Presumed risks cannot be deleted and management override cannot be
    // downgraded from significant (spec §3).
    if (current.rows[0].presumed_type === "mgmt_override" && patch.significant === false) {
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
         status = coalesce($9, status)
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
      ],
    );
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
