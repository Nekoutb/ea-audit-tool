// The two planning sub-registers: related parties (S3.4, ISA 550) and
// accounting estimates (S3.5, ISA 540). Shared by the legacy form page and the
// working-paper screens that embed them.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

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
      "SELECT id, name, relationship, notes, carried_forward FROM related_party WHERE engagement_id = $1 ORDER BY name",
      [engagementId],
    );
    return r.rows;
  });
}

export async function listEstimates(engagementId: string): Promise<EstimateRow[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<EstimateRow>(
      "SELECT id, nature, method, uncertainty FROM accounting_estimate WHERE engagement_id = $1 ORDER BY created_at",
      [engagementId],
    );
    return r.rows;
  });
}
