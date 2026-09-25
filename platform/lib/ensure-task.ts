// Put one file-index task on an engagement when a trigger makes it apply,
// whatever the complexity tier left out at creation (UAT run 2 B13, B19, B20).
//
// The complexity classification scales the documentation a file starts with,
// but some tasks follow from a fact rather than from the tier: an initial
// audit needs the predecessor communication (P1.2), an appointed quality
// reviewer needs the EQR paper (C4.2), and an account designed in S5.5 needs
// its E4 paper. Without the row, the gate that requires the task can never
// pass and the work has nowhere to live.

import { DEFAULT_FILE_INDEX } from "@/lib/file-index";

type Tx = { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> };

/**
 * Insert `code` as an active task on the engagement (or re-activate it when it
 * sits there as an untriggered conditional). Idempotent; an archived file is
 * left alone. The task is slotted just after the nearest preceding entry of
 * the default index that the file holds. Returns true when a row was inserted
 * or activated.
 */
export async function ensureTaskTx(tx: Tx, engagementId: string, code: string): Promise<boolean> {
  const at = DEFAULT_FILE_INDEX.findIndex((entry) => entry.code === code);
  if (at < 0) return false;
  const entry = DEFAULT_FILE_INDEX[at];
  const before = DEFAULT_FILE_INDEX.slice(0, at).map((e) => e.code).reverse();
  const r = await tx.query<{ id: string }>(
    `INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
     SELECT e.tenant_id, e.id, $2, $3, $4, $5,
            coalesce(
              (SELECT fi.sort_order FROM file_item fi
                WHERE fi.engagement_id = e.id AND fi.code = ANY($6::text[])
                ORDER BY array_position($6::text[], fi.code) LIMIT 1),
              (SELECT max(fi.sort_order) FROM file_item fi WHERE fi.engagement_id = e.id),
              0) + 1,
            false
       FROM engagement e
      WHERE e.id = $1 AND e.archived_at IS NULL
     ON CONFLICT (engagement_id, code) DO UPDATE SET conditional = false
      WHERE file_item.conditional
     RETURNING id`,
    [engagementId, entry.code, entry.section, entry.titleEn, entry.titleFr, before],
  );
  return r.rows.length > 0;
}
