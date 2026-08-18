// Audit programs per E-section (spec §5.4): generated from the library,
// tailored by the section's risks (significant risk → extended procedures).

import { withTenant } from "@/lib/db";
import {
  libraryForSection,
  toLegacyAssertions,
  type ProcedureTier,
} from "@/lib/procedure-library";
import { PROGRAM_LIBRARY, SIGNIFICANT_RISK_EXTENSIONS } from "@/lib/program-library";
import type { Assertion } from "@/lib/risks";
import { requireTenant } from "@/lib/tenant";

export interface ProgramStep {
  id: string;
  seq: number;
  description: string;
  assertions: Assertion[];
  source: "library" | "custom" | "risk_extension" | "psp";
  status: "planned" | "complete" | "na";
  linkedRiskIds: string[];
}

export async function listProgramSteps(fileItemId: string): Promise<ProgramStep[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      seq: number;
      description: string;
      assertions: Assertion[];
      source: ProgramStep["source"];
      status: ProgramStep["status"];
      linked_risks: string | null;
    }>(
      `SELECT ps.id, ps.seq, ps.description, ps.assertions, ps.source, ps.status,
              (SELECT json_agg(rr.risk_id) FROM risk_response rr WHERE rr.program_step_id = ps.id)::text AS linked_risks
         FROM program_step ps
        WHERE ps.file_item_id = $1
        ORDER BY ps.seq`,
      [fileItemId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      seq: row.seq,
      description: row.description,
      assertions: row.assertions,
      source: row.source,
      status: row.status,
      linkedRiskIds: row.linked_risks ? (JSON.parse(row.linked_risks) as string[]) : [],
    }));
  });
}

/**
 * Generate the section's program from the library, tailored by risk: when the
 * section carries a non-rebutted significant risk, extended procedures are
 * appended and auto-linked to that risk. Idempotent (no-op if steps exist).
 */
export async function generateProgram(fileItemId: string, locale: "en" | "fr"): Promise<number> {
  const { tenantId, userId } = await requireTenant();
  void userId;
  return withTenant(tenantId, async (tx) => {
    const item = await tx.query<{ engagement_id: string; code: string }>(
      "SELECT engagement_id, code FROM file_item WHERE id = $1",
      [fileItemId],
    );
    const row = item.rows[0];
    if (!row) throw new Error("not-found");

    const existing = await tx.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM program_step WHERE file_item_id = $1",
      [fileItemId],
    );
    if (Number(existing.rows[0].n) > 0) return 0;

    const library = PROGRAM_LIBRARY[row.code] ?? [];
    let seq = 0;
    const seen = new Set<string>();
    for (const step of library) {
      seq += 10;
      const description = locale === "fr" ? step.descFr : step.descEn;
      seen.add(description);
      await tx.query(
        `INSERT INTO program_step (tenant_id, engagement_id, file_item_id, seq, description, assertions, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'library')`,
        [tenantId, row.engagement_id, fileItemId, seq, description, step.assertions],
      );
    }

    // Wave 4 (ISA engine §06/§07): annex procedures at the section's risk
    // tier — a linked non-rebutted significant risk selects the significant
    // tier, any other linked non-rebutted risk the heightened tier, else
    // baseline. Tiers are cumulative, so higher tiers add steps, never swap.
    const linkedRisks = await tx.query<{ significant: boolean }>(
      `SELECT r.significant
         FROM risk_section rs JOIN risk r ON r.id = rs.risk_id
        WHERE rs.file_item_id = $1 AND r.rebutted = false`,
      [fileItemId],
    );
    const tier: ProcedureTier = linkedRisks.rows.some((r) => r.significant)
      ? "significant"
      : linkedRisks.rows.length > 0
        ? "heightened"
        : "baseline";
    for (const entry of libraryForSection(row.code, tier)) {
      const title = locale === "fr" ? entry.titleFr : entry.titleEn;
      const description = `${title} [${entry.code}] (${entry.assertions.join(", ")})`;
      if (seen.has(description)) continue;
      seen.add(description);
      seq += 10;
      await tx.query(
        `INSERT INTO program_step (tenant_id, engagement_id, file_item_id, seq, description, assertions, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'library')`,
        [tenantId, row.engagement_id, fileItemId, seq, description, toLegacyAssertions(entry.assertions)],
      );
    }

    // Risk tailoring: significant, non-rebutted risks mapped to this section.
    const significant = await tx.query<{ id: string }>(
      `SELECT r.id
         FROM risk_section rs JOIN risk r ON r.id = rs.risk_id
        WHERE rs.file_item_id = $1 AND r.significant AND r.rebutted = false`,
      [fileItemId],
    );
    if (significant.rows.length > 0) {
      for (const step of SIGNIFICANT_RISK_EXTENSIONS) {
        seq += 10;
        const inserted = await tx.query<{ id: string }>(
          `INSERT INTO program_step (tenant_id, engagement_id, file_item_id, seq, description, assertions, source)
           VALUES ($1, $2, $3, $4, $5, $6, 'risk_extension')
           RETURNING id`,
          [tenantId, row.engagement_id, fileItemId, seq, locale === "fr" ? step.descFr : step.descEn, step.assertions],
        );
        for (const risk of significant.rows) {
          await tx.query(
            "INSERT INTO risk_response (tenant_id, risk_id, program_step_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            [tenantId, risk.id, inserted.rows[0].id],
          );
        }
      }
      for (const risk of significant.rows) {
        await tx.query(
          "UPDATE risk SET status = 'response_planned' WHERE id = $1 AND status = 'identified'",
          [risk.id],
        );
      }
    }
    return seq / 10;
  });
}

export async function addCustomStep(
  fileItemId: string,
  description: string,
  assertions: Assertion[],
): Promise<void> {
  const { tenantId } = await requireTenant();
  if (!description.trim()) throw new Error("description-required");
  await withTenant(tenantId, async (tx) => {
    const item = await tx.query<{ engagement_id: string }>(
      "SELECT engagement_id FROM file_item WHERE id = $1",
      [fileItemId],
    );
    if (!item.rows[0]) throw new Error("not-found");
    const next = await tx.query<{ v: number }>(
      "SELECT coalesce(max(seq), 0) + 10 AS v FROM program_step WHERE file_item_id = $1",
      [fileItemId],
    );
    await tx.query(
      `INSERT INTO program_step (tenant_id, engagement_id, file_item_id, seq, description, assertions, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'custom')`,
      [tenantId, item.rows[0].engagement_id, fileItemId, next.rows[0].v, description.trim(), assertions],
    );
  });
}

/** Coverage view: which assertions of each mapped risk are addressed by steps. */
export interface CoverageRow {
  riskId: string;
  riskDescription: string;
  significant: boolean;
  assertions: Assertion[];
  coveredAssertions: Assertion[];
  linkedSteps: number;
}

export async function sectionCoverage(fileItemId: string): Promise<CoverageRow[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      risk_id: string;
      description: string;
      significant: boolean;
      assertions: Assertion[];
      covered: Assertion[] | null;
      linked_steps: string;
    }>(
      `SELECT r.id AS risk_id, r.description, r.significant, rs.assertions,
              (SELECT array_agg(DISTINCT a)
                 FROM risk_response rr
                 JOIN program_step ps ON ps.id = rr.program_step_id AND ps.file_item_id = $1,
                 unnest(ps.assertions) AS a
                WHERE rr.risk_id = r.id) AS covered,
              (SELECT count(*)::text FROM risk_response rr
                 JOIN program_step ps ON ps.id = rr.program_step_id AND ps.file_item_id = $1
                WHERE rr.risk_id = r.id) AS linked_steps
         FROM risk_section rs JOIN risk r ON r.id = rs.risk_id
        WHERE rs.file_item_id = $1 AND r.rebutted = false
        ORDER BY r.significant DESC`,
      [fileItemId],
    );
    return result.rows.map((row) => ({
      riskId: row.risk_id,
      riskDescription: row.description,
      significant: row.significant,
      assertions: row.assertions,
      coveredAssertions: (row.covered ?? []).filter((a): a is Assertion =>
        ["C", "E", "A", "V", "P"].includes(a),
      ),
      linkedSteps: Number(row.linked_steps),
    }));
  });
}
