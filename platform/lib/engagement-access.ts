import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { ForbiddenError, requireTenant, requireWrite, type TenantContext } from "@/lib/tenant";

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
 * Throws unless the signed-in user is an accepted member of the team of the
 * engagement that owns this program step. Routes keyed by a step id sit outside
 * the proxy's /engagements/<id> check. An unknown step is refused the same way,
 * so the answer never says whether the id exists.
 */
export async function requireStepAccess(stepId: string): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  const visible =
    UUID.test(stepId) &&
    (await withTenant(tenantId, async (tx) => {
      const r = await tx.query<{ visible: boolean }>(
        `SELECT ${visibilitySql("e", 2)} AS visible
           FROM program_step ps JOIN engagement e ON e.id = ps.engagement_id
          WHERE ps.id = $1`,
        [stepId, userId],
      );
      return r.rows[0]?.visible ?? false;
    }));
  if (!visible) throw new ForbiddenError("not-on-this-engagement");
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

/* ------------------------- one check for every id an action can carry ------------------------- */

/**
 * The proxy reads the engagement id from the URL. A Server Action is posted to
 * the URL of whichever page rendered it and carries its real target in its bound
 * arguments or form fields, so a member of engagement A could post to A's URL
 * and write to engagement B (DEV re-test of 8725e6a, D1). The rule is therefore
 * enforced here, on the id the function is about to act on:
 *
 *   requireEngagementRead / requireEngagementWrite   an engagement id
 *   requireChildRead / requireChildWrite             the id of something that
 *                                                    belongs to an engagement
 *
 * The Write forms also refuse a read-only account. Every library function that
 * takes such an id calls one of them first; tests/lib/engagement-write-guard
 * walks the library and the action list so a new function cannot skip it.
 *
 * Deliberately outside this rule: respondToEngagement and myInvitation (an
 * invited member answering), firm-level settings and client records, and the
 * portal, whose accounts requireTenant() refuses and which has its own
 * requirePortalUser() path scoped to their client.
 */

/** Tables whose rows belong to one engagement, and how to reach that engagement. */
const ENGAGEMENT_OF = {
  adjusting_journal: "SELECT engagement_id FROM adjusting_journal WHERE id = $1",
  alerte: "SELECT engagement_id FROM alerte WHERE id = $1",
  automation_run: "SELECT engagement_id FROM automation_run WHERE id = $1",
  document: "SELECT engagement_id FROM document WHERE id = $1",
  file_item: "SELECT engagement_id FROM file_item WHERE id = $1",
  finding: "SELECT engagement_id FROM finding WHERE id = $1",
  firm_holiday: "SELECT engagement_id FROM firm_holiday WHERE id = $1",
  misstatement: "SELECT engagement_id FROM misstatement WHERE id = $1",
  pbc_item: "SELECT engagement_id FROM pbc_item WHERE id = $1",
  potential_risk: "SELECT engagement_id FROM potential_risk WHERE id = $1",
  program_step: "SELECT engagement_id FROM program_step WHERE id = $1",
  review_note: "SELECT engagement_id FROM review_note WHERE id = $1",
  risk: "SELECT engagement_id FROM risk WHERE id = $1",
  scot: "SELECT engagement_id FROM scot WHERE id = $1",
  scot_control: "SELECT s.engagement_id FROM scot_control c JOIN scot s ON s.id = c.scot_id WHERE c.id = $1",
  sub_ledger_dataset: "SELECT engagement_id FROM sub_ledger_dataset WHERE id = $1",
  task_attachment: "SELECT engagement_id FROM task_attachment WHERE id = $1",
  time_entry: "SELECT engagement_id FROM time_entry WHERE id = $1",
  wcgw: "SELECT s.engagement_id FROM wcgw w JOIN scot s ON s.id = w.scot_id WHERE w.id = $1",
} as const;

export type EngagementChild = keyof typeof ENGAGEMENT_OF;

/**
 * The engagement that owns this row, or null when there is no such row in this
 * firm (the tenant's RLS hides another firm's rows) or the row belongs to no
 * engagement (a firm-wide holiday).
 */
export async function engagementOfChild(
  kind: EngagementChild,
  id: string,
  tenantId: string,
): Promise<string | null> {
  if (!UUID.test(id)) return null;
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ engagement_id: string | null }>(ENGAGEMENT_OF[kind], [id]);
    return r.rows[0]?.engagement_id ?? null;
  });
}

async function assertMember(engagementId: string, ctx: TenantContext): Promise<TenantContext> {
  if (!(await visibleToUser(engagementId, ctx.tenantId, ctx.userId))) {
    throw new ForbiddenError("not-on-this-engagement");
  }
  return ctx;
}

/** The signed-in user is an accepted member of this engagement; returns their context. */
export async function requireEngagementRead(engagementId: string): Promise<TenantContext> {
  return assertMember(engagementId, await requireTenant());
}

/** As requireEngagementRead, and the account may write (not read-only). */
export async function requireEngagementWrite(engagementId: string): Promise<TenantContext> {
  return assertMember(engagementId, await requireWrite());
}

/**
 * The signed-in user is an accepted member of the engagement owning this row.
 * An unknown id falls through, so the caller's own not-found handling answers
 * it: there is nothing to protect, and nothing to write to.
 */
export async function requireChildRead(kind: EngagementChild, id: string): Promise<TenantContext> {
  const ctx = await requireTenant();
  const engagementId = await engagementOfChild(kind, id, ctx.tenantId);
  return engagementId ? assertMember(engagementId, ctx) : ctx;
}

/** As requireChildRead, and the account may write (not read-only). */
export async function requireChildWrite(kind: EngagementChild, id: string): Promise<TenantContext> {
  const ctx = await requireWrite();
  const engagementId = await engagementOfChild(kind, id, ctx.tenantId);
  return engagementId ? assertMember(engagementId, ctx) : ctx;
}
