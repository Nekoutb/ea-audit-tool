// The Combined Risk Assessment matrix (S3.1): every non-conditional section-E
// item with its live risk links, WCGW assertion tally, program-step progress
// and control tests. Shared by the /cra tool page and the S3.1 working paper.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export interface CraRow {
  id: string;
  code: string;
  title_en: string;
  title_fr: string;
  material: boolean;
  significant: boolean;
  risks_count: number;
  wcgw: number;
  steps_total: number;
  steps_done: number;
  controls: number;
}

export async function craRows(engagementId: string): Promise<CraRow[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<CraRow>(
      `SELECT fi.id, fi.code, fi.title_en, fi.title_fr, fi.material,
              r.significant, r.risks_count, r.wcgw,
              ps.steps_total, ps.steps_done,
              ct.controls
         FROM file_item fi
         LEFT JOIN LATERAL (
           SELECT coalesce(bool_or(rk.significant), false) AS significant,
                  count(DISTINCT rs.risk_id)::int AS risks_count,
                  coalesce(sum(coalesce(array_length(rs.assertions, 1), 0)), 0)::int AS wcgw
             FROM risk_section rs
             JOIN risk rk ON rk.id = rs.risk_id AND rk.rebutted = false
            WHERE rs.file_item_id = fi.id
         ) r ON true
         LEFT JOIN LATERAL (
           SELECT count(*)::int AS steps_total,
                  count(*) FILTER (WHERE p.status = 'complete')::int AS steps_done
             FROM program_step p
            WHERE p.file_item_id = fi.id
         ) ps ON true
         LEFT JOIN LATERAL (
           SELECT count(*)::int AS controls
             FROM control_test c
            WHERE c.file_item_id = fi.id
         ) ct ON true
        WHERE fi.engagement_id = $1 AND fi.section = 'E' AND fi.conditional = false
        ORDER BY fi.sort_order`,
      [engagementId],
    );
    return result.rows;
  });
}
