// The Combined Risk Assessment matrix (S3.1): every non-conditional section-E
// item with its live risk links, WCGW assertion tally, program-step progress
// and control tests. Shared by the /cra tool page and the S3.1 working paper.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { INDEX_SECTION } from "@/lib/lead-classes";

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
  /** SCOT Studio: SCOTs whose lead indexes feed this account (distinct names — `wcgw`/`controls` above are the legacy tallies) */
  scots: number;
  /** controls selected for testing across those SCOTs */
  scot_controls: number;
}

export async function craRows(engagementId: string): Promise<CraRow[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<Omit<CraRow, "scots" | "scot_controls">>(
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

    // SCOT Studio write-back: each SCOT reaches the matrix through its lead
    // indexes (INDEX_SECTION maps index code → task code). A SCOT linked to two
    // indexes of the same account still counts once.
    const scotLinks = await tx.query<{ index_code: string; scot_id: string; sel: number }>(
      `SELECT si.index_code, s.id AS scot_id,
              (SELECT count(*) FROM scot_control c
                WHERE c.scot_id = s.id AND c.selected_for_testing)::int AS sel
         FROM scot s
         JOIN scot_index si ON si.scot_id = s.id
        WHERE s.engagement_id = $1`,
      [engagementId],
    );
    const byTask = new Map<string, Map<string, number>>();
    for (const link of scotLinks.rows) {
      const taskCode = INDEX_SECTION[link.index_code];
      if (!taskCode) continue;
      const bucket = byTask.get(taskCode) ?? new Map<string, number>();
      bucket.set(link.scot_id, link.sel);
      byTask.set(taskCode, bucket);
    }
    return result.rows.map((row) => {
      const bucket = byTask.get(row.code);
      return {
        ...row,
        scots: bucket?.size ?? 0,
        scot_controls: bucket ? [...bucket.values()].reduce((a, b) => a + b, 0) : 0,
      };
    });
  });
}
