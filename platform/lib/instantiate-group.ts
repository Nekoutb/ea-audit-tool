// Instantiate a group's not-yet-created tasks on an engagement. Idempotent
// (UNIQUE(engagement_id, code)) — the group page calls this on load, so a
// phase never greets its reader with "0/0, click to add the tasks".

import { withTenant } from "@/lib/db";
import { DEFAULT_FILE_INDEX } from "@/lib/file-index";
import { GROUP_BY_ID } from "@/lib/task-groups";
import { requireTenant } from "@/lib/tenant";

export async function instantiateGroupTasks(engagementId: string, groupId: string): Promise<number> {
  const group = GROUP_BY_ID[groupId];
  if (!group) return 0;
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const max = await tx.query<{ m: string | null }>(
      "SELECT max(sort_order)::text AS m FROM file_item WHERE engagement_id = $1",
      [engagementId],
    );
    let sort = Number(max.rows[0]?.m ?? 0);
    let added = 0;
    for (const code of group.members) {
      const entry = DEFAULT_FILE_INDEX.find((e) => e.code === code);
      if (!entry) continue;
      sort += 10;
      const r = await tx.query(
        `INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (engagement_id, code) DO NOTHING`,
        [tenantId, engagementId, entry.code, entry.section, entry.titleEn, entry.titleFr, sort, entry.conditional ?? false],
      );
      added += r.rowCount ?? 0;
    }
    return added;
  });
}
