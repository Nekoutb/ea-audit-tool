import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import type { Role } from "@/lib/rbac";
import { ForbiddenError } from "@/lib/tenant";

/**
 * Who is the engagement quality reviewer, for the rules that keep the EQR
 * independent of the team (ISQM 2 ¶18) and the review theirs (ISQM 2 ¶24-27).
 *
 * The first round of guards looked only at the FIRM role, so a colleague
 * appointed on /team as "Réviseur qualité (EQR)" — a senior or manager by firm
 * role — kept the editable papers and the P/R chips of the team they review
 * (UAT run 3 B03). The engagement's quality reviewer is whoever holds that team
 * role on it, as well as any firm-role EQR.
 */

/** The one paper the engagement quality reviewer writes: their own review record. */
export const EQR_PAPER = "C4.2";

/**
 * C4.2 holds two records (lib/papers/conclusion.ts): the quality review
 * itself, and the team's communications to those charged with governance.
 * These are the reviewer's part — the evaluation, the completion, "review
 * complete", "matters resolved" and the first conclusion. Where an EQR is
 * required only the appointed reviewer writes them, and the reviewer writes
 * nothing else on the paper (UAT run 3 B02).
 */
export const EQR_C42_KEYS: readonly string[] = [
  "p_review",
  "p_completion",
  "q_complete",
  "q_complete_x",
  "q_resolved",
  "q_resolved_x",
  "c_0",
  "c_0_x",
];

/** True when the user holds the team role eqr_reviewer on this engagement. */
export async function isEngagementEqrTx(tx: PoolClient, engagementId: string, userId: string): Promise<boolean> {
  const r = await tx.query(
    `SELECT 1 FROM team_member
      WHERE engagement_id = $1 AND user_id = $2 AND team_role = 'eqr_reviewer'
        AND coalesce(status, 'accepted') <> 'declined'`,
    [engagementId, userId],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * The appointed quality reviewer who may write and sign C4.2: on the team as
 * its EQR, or a firm-role EQR sitting on the team (UAT run 3 B02).
 */
export async function isAppointedEqrTx(tx: PoolClient, engagementId: string, userId: string): Promise<boolean> {
  const r = await tx.query(
    `SELECT 1 FROM team_member tm
      WHERE tm.engagement_id = $1 AND tm.user_id = $2
        AND coalesce(tm.status, 'accepted') <> 'declined'
        AND (tm.team_role = 'eqr_reviewer'
             OR EXISTS (SELECT 1 FROM membership m
                         WHERE m.user_id = tm.user_id AND m.tenant_id = tm.tenant_id
                           AND m.role = 'eqr_reviewer'))`,
    [engagementId, userId],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Firm-role EQR, or the engagement's team-role EQR: read-only on the team's work. */
export async function actsAsEqrTx(
  tx: PoolClient,
  engagementId: string,
  userId: string,
  role: Role,
): Promise<boolean> {
  return role === "eqr_reviewer" || isEngagementEqrTx(tx, engagementId, userId);
}

export async function actsAsEqr(
  tenantId: string,
  engagementId: string,
  userId: string,
  role: Role,
): Promise<boolean> {
  if (role === "eqr_reviewer") return true;
  return withTenant(tenantId, (tx) => isEngagementEqrTx(tx, engagementId, userId));
}

/**
 * Refuse a write to the team's work by the quality reviewer. `code` is the
 * task written to; C4.2 — the reviewer's own record — is let through.
 */
export async function assertNotEqrWrite(
  tenantId: string,
  engagementId: string,
  userId: string,
  role: Role,
  code?: string | null,
): Promise<void> {
  if (code === EQR_PAPER) return;
  if (await actsAsEqr(tenantId, engagementId, userId, role)) throw new ForbiddenError("eqr-read-only");
}

/** The same refusal keyed on a task id (evidence uploads, N/A, assignment). */
export async function assertNotEqrWriteOnItem(
  tenantId: string,
  fileItemId: string,
  userId: string,
  role: Role,
): Promise<void> {
  const item = await withTenant(tenantId, (tx) =>
    tx
      .query<{ engagement_id: string; code: string }>("SELECT engagement_id, code FROM file_item WHERE id = $1", [fileItemId])
      .then((r) => r.rows[0] ?? null),
  );
  if (!item) return; // the caller's own not-found handling applies
  await assertNotEqrWrite(tenantId, item.engagement_id, userId, role, item.code);
}

export interface EqrStanding {
  /** firm-role EQR, or team-role EQR on this engagement: read-only on the team's work */
  actsAsEqr: boolean;
  /** the appointed reviewer, who writes and signs C4.2 */
  appointed: boolean;
  /** the engagement requires an EQR (P1.5 or a reviewer on the team) */
  required: boolean;
  /** the reviewer's active sign-off on C4.2, if any */
  signoff: { name: string; at: string } | null;
}

/** The signed-in user's standing towards the quality review, for the task page. */
export async function eqrStanding(engagementId: string): Promise<EqrStanding> {
  const { requireTenant } = await import("@/lib/tenant");
  const { tenantId, userId, role } = await requireTenant();
  const { eqrRequiredTx } = await import("@/lib/completion");
  return withTenant(tenantId, async (tx) => {
    const signed = await tx.query<{ name: string; at: string }>(
      `SELECT coalesce(u.name, u.email) AS name, to_char(s.signed_at, 'DD Mon YYYY HH24:MI') AS at
         FROM signoff s
         JOIN document d ON d.id = s.document_id
         JOIN file_item fi ON fi.id = d.file_item_id
         JOIN app_user u ON u.id = s.user_id
        WHERE fi.engagement_id = $1 AND fi.code = $2 AND s.role = 'eqr'
          AND s.voided_at IS NULL AND s.invalidated_at IS NULL
        ORDER BY s.signed_at DESC LIMIT 1`,
      [engagementId, EQR_PAPER],
    );
    return {
      actsAsEqr: await actsAsEqrTx(tx, engagementId, userId, role),
      appointed: await isAppointedEqrTx(tx, engagementId, userId),
      required: await eqrRequiredTx(tx, engagementId),
      signoff: signed.rows[0] ?? null,
    };
  });
}
