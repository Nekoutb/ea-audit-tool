// The two planning sub-registers: related parties (S4.3, ISA 550) and
// accounting estimates (S4.4, ISA 540). Shared by the legacy form page and the
// working-paper screens that embed them.

import type { PoolClient } from "pg";
import { recordActivity } from "@/lib/activity";
import { withTenant } from "@/lib/db";
import { assertMutable } from "@/lib/mutability";
import { requireTenant, requireWrite } from "@/lib/tenant";

export interface RelatedPartyRow {
  id: string;
  name: string;
  relationship: string;
  notes: string | null;
  carried_forward: boolean;
}

export interface EstimateRow {
  id: string;
  nature: string;
  method: string | null;
  uncertainty: string | null;
}

export async function listRelatedParties(engagementId: string): Promise<RelatedPartyRow[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<RelatedPartyRow>(
      "SELECT id, name, relationship, notes, carried_forward FROM related_party WHERE engagement_id = $1 AND removed_at IS NULL ORDER BY name",
      [engagementId],
    );
    return r.rows;
  });
}

export async function listEstimates(engagementId: string): Promise<EstimateRow[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<EstimateRow>(
      "SELECT id, nature, method, uncertainty FROM accounting_estimate WHERE engagement_id = $1 AND removed_at IS NULL ORDER BY created_at",
      [engagementId],
    );
    return r.rows;
  });
}

/**
 * The papers whose sign-offs attest to each register (lib/working-papers.ts
 * structuredContentDigest): a change to the register voids them, as an edit of
 * the paper does (UAT run 2 B26).
 */
const REGISTER_PAPERS = { party: ["S4.3", "E6.2"], estimate: ["S4.4"] } as const;

type RegisterKind = keyof typeof REGISTER_PAPERS;

/**
 * One write to a register, with the checks every writer makes (write access,
 * open file, not the quality reviewer) and the sign-off invalidation after it.
 */
async function writeRegister(
  kind: RegisterKind,
  engagementId: string,
  /** performs the write and returns the trail summary */
  write: (tx: PoolClient, tenantId: string, userId: string) => Promise<string>,
  action: string,
): Promise<void> {
  const { tenantId, userId, role } = await requireWrite();
  await assertMutable(engagementId);
  const { assertNotEqrWrite } = await import("@/lib/eqr");
  await assertNotEqrWrite(tenantId, engagementId, userId, role);
  const { invalidateStaleSignoffs, reportInvalidatedSignoffs } = await import("@/lib/working-papers");
  const invalidated = await withTenant(tenantId, async (tx) => {
    // one writer per register at a time, so the duplicate check holds
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`register:${kind}:${engagementId}`]);
    const summary = await write(tx, tenantId, userId);
    const out: { code: string; rows: Awaited<ReturnType<typeof invalidateStaleSignoffs>> }[] = [];
    for (const code of REGISTER_PAPERS[kind]) out.push({ code, rows: await invalidateStaleSignoffs(tx, engagementId, code) });
    return { summary, out };
  });
  await recordActivity({
    engagementId,
    entityType: kind === "party" ? "related_party" : "accounting_estimate",
    entityId: null,
    action,
    summary: invalidated.summary,
  });
  for (const { code, rows } of invalidated.out) {
    await reportInvalidatedSignoffs(tenantId, engagementId, code, rows, userId);
  }
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export async function addRelatedParty(
  engagementId: string,
  input: { name: string; relationship: string; notes: string | null },
): Promise<void> {
  const name = input.name.trim();
  const relationship = input.relationship.trim();
  if (!name || !relationship) throw new Error("fields-required");
  await writeRegister(
    "party",
    engagementId,
    async (tx, tenantId) => {
      const dup = await tx.query(
        `SELECT 1 FROM related_party
          WHERE engagement_id = $1 AND removed_at IS NULL
            AND lower(regexp_replace(btrim(name), '\\s+', ' ', 'g')) = $2 LIMIT 1`,
        [engagementId, norm(name)],
      );
      if (dup.rows.length > 0) throw new Error("duplicate-party");
      await tx.query(
        "INSERT INTO related_party (tenant_id, engagement_id, name, relationship, notes) VALUES ($1, $2, $3, $4, $5)",
        [tenantId, engagementId, name, relationship, input.notes],
      );
      return `Related party added: ${name} (${relationship})`;
    },
    "related_party_added",
  );
}

/** Remove a wrong line: soft, logged, and it voids the sign-offs over the register. */
export async function removeRelatedParty(engagementId: string, id: string): Promise<void> {
  await writeRegister(
    "party",
    engagementId,
    async (tx, _tenantId, userId) => {
      const r = await tx.query<{ name: string }>(
        `UPDATE related_party SET removed_at = now(), removed_by = $3
          WHERE id = $1 AND engagement_id = $2 AND removed_at IS NULL RETURNING name`,
        [id, engagementId, userId],
      );
      if (!r.rows[0]) throw new Error("not-found");
      return `Related party removed: ${r.rows[0].name}`;
    },
    "related_party_removed",
  );
}

export async function removeEstimate(engagementId: string, id: string): Promise<void> {
  await writeRegister(
    "estimate",
    engagementId,
    async (tx, _tenantId, userId) => {
      const r = await tx.query<{ nature: string }>(
        `UPDATE accounting_estimate SET removed_at = now(), removed_by = $3
          WHERE id = $1 AND engagement_id = $2 AND removed_at IS NULL RETURNING nature`,
        [id, engagementId, userId],
      );
      if (!r.rows[0]) throw new Error("not-found");
      return `Accounting estimate removed: ${r.rows[0].nature}`;
    },
    "estimate_removed",
  );
}

export async function addEstimate(
  engagementId: string,
  input: { nature: string; method: string | null; assumptions: string | null; uncertainty: string | null; retroReview: string | null },
): Promise<void> {
  const nature = input.nature.trim();
  if (!nature) throw new Error("fields-required");
  await writeRegister(
    "estimate",
    engagementId,
    async (tx, tenantId) => {
      const dup = await tx.query(
        `SELECT 1 FROM accounting_estimate
          WHERE engagement_id = $1 AND removed_at IS NULL
            AND lower(regexp_replace(btrim(nature), '\\s+', ' ', 'g')) = $2 LIMIT 1`,
        [engagementId, norm(nature)],
      );
      if (dup.rows.length > 0) throw new Error("duplicate-estimate");
      await tx.query(
        `INSERT INTO accounting_estimate (tenant_id, engagement_id, nature, method, assumptions, uncertainty, retro_review)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenantId, engagementId, nature, input.method, input.assumptions, input.uncertainty, input.retroReview],
      );
      return `Accounting estimate added: ${nature}`;
    },
    "estimate_added",
  );
}
