// P2.2 job administration (spec §4.4): team assignment (with the EQR
// independence rule), hours-by-grade budget, and the PBC request list.

import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { sendEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

/** The six-level audit ladder (top down), plus the independent EQR. */
export type TeamRole =
  | "partner"
  | "director"
  | "senior_manager"
  | "manager"
  | "senior"
  | "staff"
  | "eqr_reviewer";
export const TEAM_ROLES: readonly TeamRole[] = [
  "partner",
  "director",
  "senior_manager",
  "manager",
  "senior",
  "staff",
  "eqr_reviewer",
];

export interface TeamMember {
  id: string;
  userId: string;
  userName: string;
  email: string;
  teamRole: TeamRole;
  status: "invited" | "accepted" | "declined";
  respondedAt: string | null;
}

export async function listTeam(engagementId: string): Promise<TeamMember[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string; user_id: string; user_name: string; email: string; team_role: TeamRole; status: "invited" | "accepted" | "declined"; responded_at: string | null }>(
      `SELECT tm.id, tm.user_id, coalesce(u.name, u.email) AS user_name, u.email, tm.team_role,
              coalesce(tm.status, 'accepted') AS status,
              to_char(tm.responded_at, 'DD Mon YYYY HH24:MI') AS responded_at
         FROM team_member tm JOIN app_user u ON u.id = tm.user_id
        WHERE tm.engagement_id = $1 ORDER BY tm.created_at`,
      [engagementId],
    );
    return result.rows.map((r) => ({ id: r.id, userId: r.user_id, userName: r.user_name, email: r.email, teamRole: r.team_role, status: r.status, respondedAt: r.responded_at }));
  });
}

/** Firm users assignable to the engagement (same tenant via membership). */
export async function listFirmUsers(): Promise<{ id: string; name: string; email: string }[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string; name: string; email: string }>(
      `SELECT u.id, coalesce(u.name, u.email) AS name, u.email
         FROM app_user u JOIN membership m ON m.user_id = u.id
        WHERE m.tenant_id = $1 ORDER BY name`,
      [tenantId],
    );
    return result.rows;
  });
}

/**
 * Assign a user to the team. EQR rule (spec §2): the EQR must be independent of
 * the engagement team — the system blocks assigning an EQR who already holds a
 * team role, and blocks giving a team role to the current EQR.
 */
export async function assignTeamMember(
  engagementId: string,
  userId: string,
  teamRole: TeamRole,
): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.query<{ team_role: TeamRole }>(
      "SELECT team_role FROM team_member WHERE engagement_id = $1 AND user_id = $2",
      [engagementId, userId],
    );
    const current = existing.rows[0]?.team_role;
    if (teamRole === "eqr_reviewer" && current && current !== "eqr_reviewer") {
      throw new Error("eqr-on-team");
    }
    if (teamRole !== "eqr_reviewer" && current === "eqr_reviewer") {
      throw new Error("eqr-on-team");
    }
    await tx.query(
      `INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (engagement_id, user_id) DO UPDATE SET team_role = EXCLUDED.team_role`,
      [tenantId, engagementId, userId, teamRole],
    );
  });
}

export async function removeTeamMember(engagementId: string, userId: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query("DELETE FROM team_member WHERE engagement_id = $1 AND user_id = $2", [
      engagementId,
      userId,
    ]);
  });
}

/**
 * Schema-tolerant read of file_item.assignee_user_id (expand/contract deploy):
 * until the 20260808 migration runs, tasks simply report no assignee. Checked
 * once per process (same pattern as due_date in lib/engagement-dashboard).
 */
let assigneeColumnKnown: boolean | null = null;
export async function fileItemHasAssignee(tx: PoolClient): Promise<boolean> {
  if (assigneeColumnKnown === null) {
    const r = await tx.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'file_item' AND column_name = 'assignee_user_id'",
    );
    assigneeColumnKnown = (r.rowCount ?? 0) > 0;
  }
  return assigneeColumnKnown;
}

/** Current direct assignee of a task (file item), or null. */
export async function getTaskAssignee(
  itemId: string,
): Promise<{ userId: string; name: string } | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    if (!(await fileItemHasAssignee(tx))) return null;
    const r = await tx.query<{ user_id: string; name: string }>(
      `SELECT u.id AS user_id, coalesce(u.name, u.email) AS name
         FROM file_item fi JOIN app_user u ON u.id = fi.assignee_user_id
        WHERE fi.id = $1`,
      [itemId],
    );
    const row = r.rows[0];
    return row ? { userId: row.user_id, name: row.name } : null;
  });
}

/**
 * Directly assign a task (file item) to an engagement team member, or unassign
 * with null. Only current team_member rows of the engagement are assignable.
 */
export async function assignTask(
  engagementId: string,
  itemId: string,
  userIdOrNull: string | null,
): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    if (userIdOrNull) {
      const member = await tx.query(
        "SELECT 1 FROM team_member WHERE engagement_id = $1 AND user_id = $2",
        [engagementId, userIdOrNull],
      );
      if ((member.rowCount ?? 0) === 0) throw new Error("not-found");
    }
    const updated = await tx.query(
      "UPDATE file_item SET assignee_user_id = $3 WHERE id = $2 AND engagement_id = $1",
      [engagementId, itemId, userIdOrNull],
    );
    if ((updated.rowCount ?? 0) === 0) throw new Error("not-found");
  });
}

/**
 * Open (not yet reviewed) directly-assigned tasks per team member of the
 * engagement, in one query: user_id → count.
 */
export async function openAssignedTaskCounts(engagementId: string): Promise<Map<string, number>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    if (!(await fileItemHasAssignee(tx))) return new Map();
    const r = await tx.query<{ user_id: string; n: string }>(
      `SELECT fi.assignee_user_id AS user_id, count(*)::text AS n
         FROM file_item fi
        WHERE fi.engagement_id = $1 AND fi.conditional = false
          AND fi.assignee_user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM document d JOIN signoff s ON s.document_id = d.id
             WHERE d.file_item_id = fi.id AND s.role IN ('reviewer', 'partner')
               AND s.voided_at IS NULL
          )
        GROUP BY fi.assignee_user_id`,
      [engagementId],
    );
    return new Map(r.rows.map((row) => [row.user_id, Number(row.n)]));
  });
}

export interface BudgetLine {
  grade: string;
  hours: number;
}

export async function listBudget(engagementId: string): Promise<BudgetLine[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ grade: string; hours: string }>(
      "SELECT grade, hours::text FROM budget_line WHERE engagement_id = $1 ORDER BY grade",
      [engagementId],
    );
    return result.rows.map((r) => ({ grade: r.grade, hours: Number(r.hours) }));
  });
}

export async function setBudgetLine(engagementId: string, grade: string, hours: number): Promise<void> {
  const { tenantId } = await requireTenant();
  if (!grade.trim() || !(hours >= 0)) throw new Error("invalid-budget");
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO budget_line (tenant_id, engagement_id, grade, hours)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (engagement_id, grade) DO UPDATE SET hours = EXCLUDED.hours`,
      [tenantId, engagementId, grade.trim(), hours],
    );
  });
}

export interface PbcItem {
  id: string;
  title: string;
  status: "requested" | "uploaded" | "accepted";
}

export async function listPbc(engagementId: string): Promise<PbcItem[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<PbcItem>(
      "SELECT id, title, status FROM pbc_item WHERE engagement_id = $1 ORDER BY created_at",
      [engagementId],
    );
    return result.rows;
  });
}

export async function addPbcItem(engagementId: string, title: string): Promise<void> {
  const { tenantId } = await requireTenant();
  if (!title.trim()) throw new Error("title-required");
  await withTenant(tenantId, async (tx) => {
    await tx.query("INSERT INTO pbc_item (tenant_id, engagement_id, title) VALUES ($1, $2, $3)", [
      tenantId,
      engagementId,
      title.trim(),
    ]);
  });
}

export async function setPbcStatus(id: string, status: PbcItem["status"]): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query("UPDATE pbc_item SET status = $2 WHERE id = $1", [id, status]);
  });
}

/**
 * Add a team member by email address. An existing firm user is matched; an
 * unknown email provisions the account (random password — the firm admin sets
 * the real one under Settings → Users). The member starts as "invited" and is
 * prompted by email to accept or decline the engagement from the console.
 */
export async function addTeamMemberByEmail(
  engagementId: string,
  emailRaw: string,
  teamRole: TeamRole,
  engagementName: string,
): Promise<void> {
  const { tenantId } = await requireTenant();
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("invalid-email");

  const userId = await withTenant(tenantId, async (tx) => {
    const existing = await tx.query<{ id: string }>(
      `SELECT u.id FROM app_user u JOIN membership m ON m.user_id = u.id
        WHERE lower(u.email) = $1 AND m.tenant_id = $2`,
      [email, tenantId],
    );
    if (existing.rows[0]) return existing.rows[0].id;
    // Same email in another tenant is a different firm's user — never attach.
    const elsewhere = await tx.query<{ id: string }>(
      "SELECT id FROM app_user WHERE lower(email) = $1",
      [email],
    );
    if (elsewhere.rows[0]) throw new Error("email-taken");
    const bcrypt = (await import("bcryptjs")).default;
    const hash = await bcrypt.hash(randomBytes(18).toString("hex"), 10);
    const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const user = await tx.query<{ id: string }>(
      "INSERT INTO app_user (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id",
      [email, name, hash],
    );
    await tx.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'staff')", [
      user.rows[0].id,
      tenantId,
    ]);
    return user.rows[0].id;
  });

  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status, invited_at)
       VALUES ($1, $2, $3, $4, 'invited', now())
       ON CONFLICT (engagement_id, user_id)
       DO UPDATE SET team_role = EXCLUDED.team_role`,
      [tenantId, engagementId, userId, teamRole],
    );
  });

  sendEmail({
    to: email,
    subject: `You have been added to ${engagementName}`,
    body: `You have been added to the engagement "${engagementName}" as ${teamRole.replace("_", " ")}. Sign in and accept or decline it from the engagement dashboard: /engagements/${engagementId}/dashboard`,
  });
  await createNotification({
    tenantId,
    userId,
    kind: "engagement-invite",
    title: `Added to ${engagementName}`,
    body: "Accept or decline the engagement from its dashboard.",
  });
}

/** The signed-in user's own membership status on the engagement, if any. */
export async function myTeamStatus(
  engagementId: string,
): Promise<"invited" | "accepted" | "declined" | null> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ status: "invited" | "accepted" | "declined" }>(
      "SELECT coalesce(status, 'accepted') AS status FROM team_member WHERE engagement_id = $1 AND user_id = $2",
      [engagementId, userId],
    );
    return r.rows[0]?.status ?? null;
  });
}

/** Accept or decline the engagement invitation; the response is timestamped. */
export async function respondToEngagement(engagementId: string, accept: boolean): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `UPDATE team_member SET status = $3, responded_at = now()
        WHERE engagement_id = $1 AND user_id = $2 AND status = 'invited'`,
      [engagementId, userId, accept ? "accepted" : "declined"],
    );
  });
}
