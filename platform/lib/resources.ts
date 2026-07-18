// Resource management: firm-wide team workload. Per internal user, the number
// of open owned working papers, hours logged, and engagements they are on.
// file_item/document/time_entry are RLS-scoped inside withTenant; membership and
// team_member are scoped explicitly by tenant_id.

import { withTenant } from "@/lib/db";
import type { Role } from "@/lib/rbac";
import { requireTenant } from "@/lib/tenant";

export interface WorkloadRow {
  id: string;
  name: string;
  role: Role;
  openTasks: number;
  hours: number;
  engagements: number;
}

export async function teamWorkload(): Promise<WorkloadRow[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{
      id: string;
      name: string;
      role: Role;
      open_tasks: string;
      hours: string;
      engagements: string;
    }>(
      `SELECT u.id, coalesce(u.name, u.email) AS name, m.role,
              (SELECT count(*) FROM file_item fi
                 WHERE fi.owner_id = u.id
                   AND NOT EXISTS (SELECT 1 FROM document d
                                    WHERE d.file_item_id = fi.id AND d.status = 'signed'))::text AS open_tasks,
              (SELECT coalesce(sum(hours), 0) FROM time_entry te WHERE te.user_id = u.id)::text AS hours,
              (SELECT count(DISTINCT tm.engagement_id) FROM team_member tm
                 WHERE tm.user_id = u.id AND tm.tenant_id = $1)::text AS engagements
         FROM membership m JOIN app_user u ON u.id = m.user_id
        WHERE m.tenant_id = $1 AND m.role <> 'client_user'
        ORDER BY (SELECT count(*) FROM file_item fi
                    WHERE fi.owner_id = u.id
                      AND NOT EXISTS (SELECT 1 FROM document d
                                       WHERE d.file_item_id = fi.id AND d.status = 'signed')) DESC,
                 name`,
      [tenantId],
    );
    return r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      openTasks: Number(row.open_tasks),
      hours: Number(row.hours),
      engagements: Number(row.engagements),
    }));
  });
}
