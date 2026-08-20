import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { atLeast, type Role } from "@/lib/rbac";
import { ForbiddenError, requireTenant } from "@/lib/tenant";

/**
 * Who may open which engagement.
 *
 * Firm membership opened every client's file: tenant isolation separates firms
 * from each other, and nothing separated one engagement from another inside a
 * firm. This adds that, at the application layer.
 *
 * It is deliberately PROGRESSIVE rather than absolute, and that is the whole
 * design. On the day this ships, 528 of 531 engagements on the development
 * database have no team_member rows at all — gating strictly on assignment
 * would make almost every engagement in the product invisible to everyone
 * except partners and firm admins. So an engagement with no team is treated as
 * unassigned and stays open to the firm; the restriction takes effect for an
 * engagement the moment somebody is actually assigned to it. Nobody can be
 * locked out of work they can reach today, and new engagements are protected
 * from the first assignment onward.
 *
 * Set ENGAGEMENT_ACCESS_STRICT=1 to drop that allowance once teams are
 * populated.
 */

/** True when an engagement with no team should stay open to the firm. */
function unassignedIsOpen(): boolean {
  return process.env.ENGAGEMENT_ACCESS_STRICT !== "1";
}

/** Ranks that see the whole portfolio — ISQM 1 puts oversight on them. */
export function hasPortfolioOversight(role: Role): boolean {
  return atLeast(role, "partner");
}

/**
 * A SQL predicate over an `engagement` alias, plus the parameters it needs.
 * Callers splice it into an existing WHERE; the parameter numbers are supplied
 * so it can sit alongside whatever the caller already binds.
 *
 * The EXISTS clauses are uncorrelated with the outer row apart from the
 * engagement id, so the planner hoists them rather than re-running per row.
 */
export function visibilitySql(alias: string, userParam: number): string {
  return `(
    EXISTS (SELECT 1 FROM team_member tm
             WHERE tm.engagement_id = ${alias}.id
               AND tm.user_id = $${userParam}
               AND tm.status IN ('invited', 'accepted'))
    OR EXISTS (SELECT 1 FROM file_item fi
                WHERE fi.engagement_id = ${alias}.id
                  AND (fi.owner_id = $${userParam} OR fi.assignee_user_id = $${userParam}))
    ${unassignedIsOpen()
      ? `OR NOT EXISTS (SELECT 1 FROM team_member tm2 WHERE tm2.engagement_id = ${alias}.id)`
      : ""}
  )`;
}

/**
 * The clause to AND into a listing. Empty string for a partner or firm admin,
 * who see everything — returning "" rather than "true" keeps the generated SQL
 * readable in a log.
 */
export function visibilityClause(role: Role, alias: string, userParam: number): string {
  return hasPortfolioOversight(role) ? "" : ` AND ${visibilitySql(alias, userParam)}`;
}

/** Is this engagement visible to the signed-in user? */
export async function canSeeEngagement(engagementId: string): Promise<boolean> {
  const { tenantId, userId, role } = await requireTenant();
  if (hasPortfolioOversight(role)) return true;
  return withTenant(tenantId, (tx) => visibleTx(tx, engagementId, userId));
}

/** Throws unless the engagement is visible. Use at a page or action entry. */
export async function requireEngagementAccess(engagementId: string): Promise<void> {
  if (!(await canSeeEngagement(engagementId))) throw new ForbiddenError("not-on-this-engagement");
}

async function visibleTx(tx: PoolClient, engagementId: string, userId: string): Promise<boolean> {
  const result = await tx.query<{ visible: boolean }>(
    `SELECT ${visibilitySql("e", 2)} AS visible FROM engagement e WHERE e.id = $1`,
    [engagementId, userId],
  );
  // No row means the tenant's RLS already hid it; treat as invisible.
  return result.rows[0]?.visible ?? false;
}

/**
 * The same decision for a caller the proxy has already authenticated, without
 * going through auth() again. The proxy holds the session on req.auth, so
 * re-resolving it there would be a second decode per request.
 */
export async function visibleToUser(
  engagementId: string,
  tenantId: string,
  userId: string,
  role: Role,
): Promise<boolean> {
  if (hasPortfolioOversight(role)) return true;
  return withTenant(tenantId, (tx) => visibleTx(tx, engagementId, userId));
}
