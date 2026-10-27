import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { ForbiddenError, requireTenant } from "@/lib/tenant";

/**
 * Who may open which engagement — the firm's rule of 2026-10-27 (F008):
 *
 *   ONLY an ACCEPTED member of the engagement team (team_member.status =
 *   'accepted') may open an engagement and do anything in it, read or sign.
 *
 * There is no exception. A firm administrator or a partner who is not on the
 * team does not see the engagement in the register, the dashboards or the
 * search, cannot open its pages, documents, attachments or API routes, and
 * cannot export it. The earlier allowances are gone:
 *  - portfolio oversight for partners and firm administrators;
 *  - an engagement with no team being open to the whole firm;
 *  - the preparer or assignee of a task seeing the file without a team row;
 *  - an invited (not yet accepted) member seeing the file.
 *
 * An invited member sees only the invitation (app/invitations/[id]), where
 * they accept or decline; invitationPending() is what routes them there.
 * Firm-level pages (Settings, Users, the firm audit log) are not engagement
 * pages and stay with the firm administrator.
 *
 * Consequence for staffing: the partner seat on a file the administrator is
 * not staffed on is handed over by the current engagement partner
 * (lib/team.ts transferEngagementPartner), from the team page.
 */

/**
 * A SQL predicate over an `engagement` alias: the user bound at $userParam is
 * an accepted member of its team. Callers splice it into an existing WHERE.
 */
export function visibilitySql(alias: string, userParam: number): string {
  return `EXISTS (SELECT 1 FROM team_member tm
                   WHERE tm.engagement_id = ${alias}.id
                     AND tm.user_id = $${userParam}
                     AND tm.status = 'accepted')`;
}

/** The clause to AND into a listing: always applied, whatever the firm role. */
export function visibilityClause(alias: string, userParam: number): string {
  return ` AND ${visibilitySql(alias, userParam)}`;
}

/** Is this engagement visible to the signed-in user? */
export async function canSeeEngagement(engagementId: string): Promise<boolean> {
  const { tenantId, userId } = await requireTenant();
  return visibleToUser(engagementId, tenantId, userId);
}

/** Throws unless the engagement is visible. Use at a page or action entry. */
export async function requireEngagementAccess(engagementId: string): Promise<void> {
  if (!(await canSeeEngagement(engagementId))) throw new ForbiddenError("not-on-this-engagement");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The tenant's RLS scopes the engagement row, so an id belonging to another
 * firm is invisible whatever team rows exist (UAT B01).
 */
async function visibleTx(tx: PoolClient, engagementId: string, userId: string): Promise<boolean> {
  if (!UUID.test(engagementId)) return false;
  const result = await tx.query<{ visible: boolean }>(
    `SELECT ${visibilitySql("e", 2)} AS visible FROM engagement e WHERE e.id = $1`,
    [engagementId, userId],
  );
  // No row means the tenant's RLS already hid it; treat as invisible.
  return result.rows[0]?.visible ?? false;
}

/**
 * The same decision for a caller the proxy has already authenticated, without
 * going through auth() again. The firm role plays no part in it.
 */
export async function visibleToUser(engagementId: string, tenantId: string, userId: string): Promise<boolean> {
  return withTenant(tenantId, (tx) => visibleTx(tx, engagementId, userId));
}

/**
 * The user holds an open (invited, not yet answered) invitation to the
 * engagement: they may see the invitation and answer it, nothing else.
 */
export async function invitationPending(engagementId: string, tenantId: string, userId: string): Promise<boolean> {
  if (!UUID.test(engagementId)) return false;
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query(
      `SELECT 1 FROM team_member tm JOIN engagement e ON e.id = tm.engagement_id
        WHERE tm.engagement_id = $1 AND tm.user_id = $2 AND tm.status = 'invited'`,
      [engagementId, userId],
    );
    return (r.rowCount ?? 0) > 0;
  });
}
