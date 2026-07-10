// Phase-transition gates (spec §19.2: "Gates, not guidance" — where the
// methodology says must, the tool BLOCKS with a clear explanation).
//
// acceptance → planning:  D3.1 form complete & concluded "accept", partner
//                         sign-off on the D3.1 working paper, an independence
//                         campaign launched with every confirmation completed
//                         and exceptions disposed.
// planning → execution:   materiality approved; partner sign-offs on D6.1,
//                         D7.1, D7.2; every significant risk linked to ≥1
//                         program step (or validly rebutted with partner
//                         approval); every material E-section has planned
//                         coverage (stand-back). Closing takes a snapshot.
//
// Transitions run gate-check + mutation in ONE transaction with the engagement
// row locked, so double-submits and check-then-act races cannot slip through.
// [Adversarial-review fix]

import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { FORM_DEFINITIONS, isFormComplete, type FormValues } from "@/lib/forms";
import { requireTenant } from "@/lib/tenant";

export interface GateResult {
  key: string;
  ok: boolean;
}

async function formValues(
  tx: PoolClient,
  engagementId: string,
  code: string,
): Promise<FormValues> {
  const result = await tx.query<{ field_key: string; value: unknown }>(
    "SELECT field_key, value FROM form_response WHERE engagement_id = $1 AND code = $2",
    [engagementId, code],
  );
  const values: FormValues = {};
  for (const row of result.rows) values[row.field_key] = row.value;
  return values;
}

/**
 * Active (non-voided) partner sign-off on the WORKING PAPER of a file-index
 * code. kind='workpaper' matters: letters filed under the same index (e.g. the
 * engagement letter under D3.1) must not satisfy the gate.
 */
async function partnerSigned(
  tx: PoolClient,
  engagementId: string,
  code: string,
): Promise<boolean> {
  const result = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM signoff s
       JOIN document d ON d.id = s.document_id
       JOIN file_item fi ON fi.id = d.file_item_id
      WHERE fi.engagement_id = $1 AND fi.code = $2
        AND d.kind = 'workpaper'
        AND s.role = 'partner' AND s.voided_at IS NULL`,
    [engagementId, code],
  );
  return Number(result.rows[0].n) > 0;
}

async function acceptanceGatesTx(tx: PoolClient, engagementId: string): Promise<GateResult[]> {
  const d31 = await formValues(tx, engagementId, "D3.1");
  const formComplete = isFormComplete(FORM_DEFINITIONS["D3.1"], d31);
  const concludedAccept = d31.conclusion === "accept";
  const signed = await partnerSigned(tx, engagementId, "D3.1");

  const independence = await tx.query<{ total: string; open: string; undisposed: string }>(
    `SELECT
       count(*)::text AS total,
       count(*) FILTER (WHERE ic.status IN ('sent', 'opened'))::text AS open,
       count(*) FILTER (WHERE ic.status = 'exception' AND ic.disposition IS NULL)::text AS undisposed
       FROM independence_confirmation ic
       JOIN independence_campaign c ON c.id = ic.campaign_id
      WHERE c.engagement_id = $1`,
    [engagementId],
  );
  const indep = independence.rows[0];

  return [
    { key: "d31_form_complete", ok: formComplete && concludedAccept },
    { key: "d31_partner_signed", ok: signed },
    // Not vacuous: a campaign must exist AND be fully completed.
    { key: "independence_complete", ok: Number(indep.total) > 0 && Number(indep.open) === 0 },
    { key: "independence_exceptions_disposed", ok: Number(indep.undisposed) === 0 },
  ];
}

async function planningCloseGatesTx(tx: PoolClient, engagementId: string): Promise<GateResult[]> {
  const materiality = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM materiality
      WHERE engagement_id = $1 AND status = 'approved'
        AND version_no = (SELECT max(version_no) FROM materiality WHERE engagement_id = $1)`,
    [engagementId],
  );

  const gateDocs: GateResult[] = [];
  for (const code of ["D6.1", "D7.1", "D7.2"]) {
    gateDocs.push({
      key: `${code.toLowerCase().replace(".", "")}_partner_signed`,
      ok: await partnerSigned(tx, engagementId, code),
    });
  }

  // Every significant, non-rebutted risk must have ≥1 linked program step
  // (spec §8.1: an unlinked significant risk is a blocking error).
  const unlinked = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM risk r
      WHERE r.engagement_id = $1 AND r.significant AND r.rebutted = false
        AND NOT EXISTS (SELECT 1 FROM risk_response rr WHERE rr.risk_id = r.id)`,
    [engagementId],
  );

  // A rebutted presumed revenue-fraud risk requires the partner-approved rebuttal.
  const badRebuttal = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM risk
      WHERE engagement_id = $1 AND rebutted AND rebuttal_approved_by IS NULL`,
    [engagementId],
  );

  // Stand-back (spec §5.3): every material class must receive substantive
  // procedures regardless of risk rating. Material flag is manual in Phase 2;
  // TB-driven from Phase 3.
  const uncovered = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM file_item fi
      WHERE fi.engagement_id = $1 AND fi.section = 'E' AND fi.material
        AND NOT EXISTS (
          SELECT 1 FROM program_step ps
           WHERE ps.file_item_id = fi.id AND ps.status <> 'na'
        )`,
    [engagementId],
  );

  return [
    { key: "materiality_approved", ok: Number(materiality.rows[0].n) > 0 },
    ...gateDocs,
    { key: "significant_risks_linked", ok: Number(unlinked.rows[0].n) === 0 },
    { key: "rebuttals_approved", ok: Number(badRebuttal.rows[0].n) === 0 },
    { key: "material_sections_covered", ok: Number(uncovered.rows[0].n) === 0 },
  ];
}

export async function acceptanceGates(engagementId: string): Promise<GateResult[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, (tx) => acceptanceGatesTx(tx, engagementId));
}

export async function planningCloseGates(engagementId: string): Promise<GateResult[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, (tx) => planningCloseGatesTx(tx, engagementId));
}

export class GateError extends Error {
  constructor(public readonly failed: string[]) {
    super(`gates-failed:${failed.join(",")}`);
    this.name = "GateError";
  }
}

async function lockEngagementPhase(
  tx: PoolClient,
  engagementId: string,
  expected: string,
): Promise<void> {
  const result = await tx.query<{ phase: string }>(
    "SELECT phase FROM engagement WHERE id = $1 FOR UPDATE",
    [engagementId],
  );
  if (!result.rows[0]) throw new Error("not-found");
  if (result.rows[0].phase !== expected) throw new Error("wrong-phase");
}

/** acceptance → planning: gate-check + transition atomically. */
export async function advanceToPlanning(engagementId: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await lockEngagementPhase(tx, engagementId, "acceptance");
    const gates = await acceptanceGatesTx(tx, engagementId);
    const failed = gates.filter((g) => !g.ok).map((g) => g.key);
    if (failed.length > 0) throw new GateError(failed);
    await tx.query("UPDATE engagement SET phase = 'planning' WHERE id = $1", [engagementId]);
  });
}

/** planning → execution: gates + snapshot + transition in one transaction (spec §5.4). */
export async function closePlanning(engagementId: string): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await lockEngagementPhase(tx, engagementId, "planning");
    const gates = await planningCloseGatesTx(tx, engagementId);
    const failed = gates.filter((g) => !g.ok).map((g) => g.key);
    if (failed.length > 0) throw new GateError(failed);

    const snapshot = await tx.query<{ data: unknown }>(
      `SELECT json_build_object(
         'materiality', (SELECT to_jsonb(m) - 'tenant_id' FROM materiality m
                          WHERE m.engagement_id = $1 ORDER BY m.version_no DESC LIMIT 1),
         'risks', (SELECT coalesce(json_agg(to_jsonb(r) - 'tenant_id'), '[]'::json)
                     FROM risk r WHERE r.engagement_id = $1),
         'programSteps', (SELECT coalesce(json_agg(to_jsonb(p) - 'tenant_id'), '[]'::json)
                            FROM program_step p WHERE p.engagement_id = $1)
       ) AS data`,
      [engagementId],
    );
    await tx.query(
      "INSERT INTO planning_snapshot (tenant_id, engagement_id, data, taken_by) VALUES ($1, $2, $3, $4)",
      [tenantId, engagementId, JSON.stringify(snapshot.rows[0].data), userId],
    );
    await tx.query("UPDATE engagement SET phase = 'execution' WHERE id = $1", [engagementId]);
  });
}

/** Toggle the (Phase 2 manual) material flag on an E-section. */
export async function setSectionMaterial(fileItemId: string, material: boolean): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query("UPDATE file_item SET material = $2 WHERE id = $1 AND section = 'E'", [
      fileItemId,
      material,
    ]);
  });
}
