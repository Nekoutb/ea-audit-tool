// ISA 265 deficiency evaluation (F037, decision of 2026-10-27): the grid on
// the C5.11 communications paper, fed from the findings register. Every
// finding routed 'c1' is a deficiency in internal control; this is where its
// severity is reasoned out — likelihood of misstatement, potential magnitude,
// the accounts and assertions exposed, management's awareness, the ISA 265
// A6–A7 indicators and the related deficiencies taken together — and where
// the written communication to those charged with governance is dated.
//
// The final grade is written back to finding.severity: the management letter,
// the completion report to governance, the register and the gates all read
// that one value. The archive gate 'deficiencies_communicated'
// (lib/completion.ts) holds the file open while a significant deficiency has
// no written-communication date (ISA 265 ¶9).

import type { PoolClient } from "pg";
import { recordActivity } from "@/lib/activity";
import { withTenant } from "@/lib/db";
import { FINDING_SEVERITIES, type FindingSeverity } from "@/lib/execution";
import { assertMutable } from "@/lib/mutability";
import { requireTenant, requireWrite } from "@/lib/tenant";

export const LIKELIHOODS = ["remote", "reasonably_possible", "probable"] as const;
export type Likelihood = (typeof LIKELIHOODS)[number];

export const MAGNITUDES = ["inconsequential", "significant", "material"] as const;
export type Magnitude = (typeof MAGNITUDES)[number];

export class DeficiencyError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "DeficiencyError";
  }
}

/**
 * The grade the two severity factors point to (ISA 265 A5): a misstatement
 * that is reasonably possible or probable AND material is a significant
 * deficiency; one that is remote AND inconsequential is an observation; the
 * rest are deficiencies. A suggestion the preparer confirms or overrides —
 * the A6–A7 indicators and the related deficiencies can raise the grade.
 */
export function suggestedGrade(likelihood: Likelihood | null, magnitude: Magnitude | null): FindingSeverity | null {
  if (!likelihood || !magnitude) return null;
  if (magnitude === "material" && likelihood !== "remote") return "significant_deficiency";
  if (magnitude === "inconsequential" && likelihood === "remote") return "observation";
  return "deficiency";
}

export interface DeficiencyRow {
  findingId: string;
  title: string;
  detail: string | null;
  /** the finding's origin task, when raised from a paper */
  sectionCode: string | null;
  status: "open" | "cleared";
  recommendation: string | null;
  managementResponse: string | null;
  /** finding.severity — the grade as the register carries it */
  severity: FindingSeverity | null;
  evaluation: DeficiencyEvaluation | null;
}

export interface DeficiencyEvaluation {
  likelihood: Likelihood | null;
  magnitude: Magnitude | null;
  accountsAssertions: string | null;
  managementAware: boolean | null;
  indicators: string | null;
  relatedFindingIds: string[];
  aggregationNote: string | null;
  grade: FindingSeverity;
  communicatedOn: string | null;
  recipient: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

/** The deficiencies of the file with their evaluations, significant first, then by date raised. */
export async function listDeficiencies(engagementId: string): Promise<DeficiencyRow[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{
      id: string;
      title: string;
      detail: string | null;
      section_code: string | null;
      status: "open" | "cleared";
      recommendation: string | null;
      management_response: string | null;
      severity: FindingSeverity | null;
      likelihood: Likelihood | null;
      magnitude: Magnitude | null;
      accounts_assertions: string | null;
      management_aware: boolean | null;
      indicators: string | null;
      related_finding_ids: string[] | null;
      aggregation_note: string | null;
      grade: FindingSeverity | null;
      communicated_on: string | null;
      recipient: string | null;
      updated_by_name: string | null;
      updated_at: string | null;
    }>(
      `SELECT f.id, f.title, f.detail, fi.code AS section_code, f.status, f.recommendation, f.management_response, f.severity,
              d.likelihood, d.magnitude, d.accounts_assertions, d.management_aware, d.indicators,
              d.related_finding_ids, d.aggregation_note, d.grade,
              to_char(d.communicated_on, 'YYYY-MM-DD') AS communicated_on, d.recipient,
              (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = d.updated_by) AS updated_by_name,
              to_char(d.updated_at, 'YYYY-MM-DD HH24:MI') AS updated_at
         FROM finding f
         LEFT JOIN file_item fi ON fi.id = f.file_item_id
         LEFT JOIN deficiency_evaluation d ON d.finding_id = f.id
        WHERE f.engagement_id = $1 AND f.route = 'c1'
        ORDER BY CASE f.severity WHEN 'significant_deficiency' THEN 0 WHEN 'deficiency' THEN 1 WHEN 'observation' THEN 2 ELSE 3 END,
                 f.created_at`,
      [engagementId],
    );
    return r.rows.map((row) => ({
      findingId: row.id,
      title: row.title,
      detail: row.detail,
      sectionCode: row.section_code,
      status: row.status,
      recommendation: row.recommendation,
      managementResponse: row.management_response,
      severity: row.severity,
      evaluation: row.grade
        ? {
            likelihood: row.likelihood,
            magnitude: row.magnitude,
            accountsAssertions: row.accounts_assertions,
            managementAware: row.management_aware,
            indicators: row.indicators,
            relatedFindingIds: row.related_finding_ids ?? [],
            aggregationNote: row.aggregation_note,
            grade: row.grade,
            communicatedOn: row.communicated_on,
            recipient: row.recipient,
            updatedByName: row.updated_by_name,
            updatedAt: row.updated_at,
          }
        : null,
    }));
  });
}

export interface DeficiencyEvaluationInput {
  engagementId: string;
  findingId: string;
  likelihood: string | null;
  magnitude: string | null;
  accountsAssertions: string | null;
  managementAware: boolean | null;
  indicators: string | null;
  relatedFindingIds: string[];
  aggregationNote: string | null;
  grade: string;
  /** YYYY-MM-DD, the date the written communication went to governance */
  communicatedOn: string | null;
  recipient: string | null;
}

const isLikelihood = (v: unknown): v is Likelihood => (LIKELIHOODS as readonly unknown[]).includes(v);
const isMagnitude = (v: unknown): v is Magnitude => (MAGNITUDES as readonly unknown[]).includes(v);
const isSeverity = (v: unknown): v is FindingSeverity => (FINDING_SEVERITIES as readonly unknown[]).includes(v);

/**
 * Save the evaluation of one deficiency and write its grade back to the
 * register. A communication date needs a recipient: a letter nobody received
 * is not a communication (ISA 265 ¶9). Related deficiencies must be other
 * 'c1' findings of the same file.
 */
export async function saveDeficiencyEvaluation(input: DeficiencyEvaluationInput): Promise<void> {
  const { tenantId, userId } = await requireWrite();
  if (!isSeverity(input.grade)) throw new DeficiencyError("invalid-severity");
  const likelihood = input.likelihood ? (isLikelihood(input.likelihood) ? input.likelihood : null) : null;
  const magnitude = input.magnitude ? (isMagnitude(input.magnitude) ? input.magnitude : null) : null;
  if ((input.likelihood && !likelihood) || (input.magnitude && !magnitude)) throw new DeficiencyError("invalid-severity-factor");
  const communicatedOn = (input.communicatedOn ?? "").trim() || null;
  if (communicatedOn && !/^\d{4}-\d{2}-\d{2}$/.test(communicatedOn)) throw new DeficiencyError("invalid-date");
  const recipient = (input.recipient ?? "").trim() || null;
  if (communicatedOn && !recipient) throw new DeficiencyError("recipient-required");
  await assertMutable(input.engagementId);
  const related = [...new Set(input.relatedFindingIds.filter((id) => id && id !== input.findingId))];

  const before = await withTenant(tenantId, async (tx) => {
    const finding = await tx.query<{ severity: FindingSeverity | null }>(
      "SELECT severity FROM finding WHERE id = $1 AND engagement_id = $2 AND route = 'c1'",
      [input.findingId, input.engagementId],
    );
    if (!finding.rows[0]) throw new DeficiencyError("not-found");
    if (related.length > 0) {
      const known = await tx.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM finding WHERE engagement_id = $1 AND route = 'c1' AND id = ANY($2::uuid[])",
        [input.engagementId, related],
      );
      if (Number(known.rows[0].n) !== related.length) throw new DeficiencyError("related-finding-unknown");
    }
    const prior = await tx.query<{ grade: FindingSeverity; communicated_on: string | null }>(
      "SELECT grade, to_char(communicated_on, 'YYYY-MM-DD') AS communicated_on FROM deficiency_evaluation WHERE finding_id = $1",
      [input.findingId],
    );
    await tx.query(
      `INSERT INTO deficiency_evaluation
         (tenant_id, engagement_id, finding_id, likelihood, magnitude, accounts_assertions, management_aware,
          indicators, related_finding_ids, aggregation_note, grade, communicated_on, recipient, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid[], $10, $11, $12::date, $13, $14, now())
       ON CONFLICT (finding_id) DO UPDATE
         SET likelihood = EXCLUDED.likelihood, magnitude = EXCLUDED.magnitude,
             accounts_assertions = EXCLUDED.accounts_assertions, management_aware = EXCLUDED.management_aware,
             indicators = EXCLUDED.indicators, related_finding_ids = EXCLUDED.related_finding_ids,
             aggregation_note = EXCLUDED.aggregation_note, grade = EXCLUDED.grade,
             communicated_on = EXCLUDED.communicated_on, recipient = EXCLUDED.recipient,
             updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [
        tenantId, input.engagementId, input.findingId, likelihood, magnitude,
        (input.accountsAssertions ?? "").trim() || null, input.managementAware,
        (input.indicators ?? "").trim() || null, related, (input.aggregationNote ?? "").trim() || null,
        input.grade, communicatedOn, recipient, userId,
      ],
    );
    // the grade reached here IS the register's severity
    await tx.query("UPDATE finding SET severity = $2 WHERE id = $1", [input.findingId, input.grade]);
    return { severity: finding.rows[0].severity, grade: prior.rows[0]?.grade ?? null, communicatedOn: prior.rows[0]?.communicated_on ?? null };
  });

  await recordActivity({
    engagementId: input.engagementId,
    entityType: "finding",
    entityId: input.findingId,
    action: "deficiency_evaluated",
    summary: `ISA 265 deficiency evaluated on C5.11: graded ${input.grade}${communicatedOn ? `, communicated in writing on ${communicatedOn} to ${recipient}` : ""}`,
    before: { severity: before.severity, grade: before.grade, communicatedOn: before.communicatedOn },
    after: { severity: input.grade, grade: input.grade, communicatedOn },
  });
}

/**
 * Significant deficiencies with no written communication recorded (ISA 265
 * ¶9): the count the archive gate reads. A finding graded significant on the
 * register but never evaluated on the grid counts too.
 */
export async function uncommunicatedSignificantDeficienciesTx(tx: PoolClient, engagementId: string): Promise<number> {
  const r = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM finding f
       LEFT JOIN deficiency_evaluation d ON d.finding_id = f.id
      WHERE f.engagement_id = $1 AND f.route = 'c1' AND f.severity = 'significant_deficiency'
        AND d.communicated_on IS NULL`,
    [engagementId],
  );
  return Number(r.rows[0].n);
}
