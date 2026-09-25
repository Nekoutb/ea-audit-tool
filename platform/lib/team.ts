// P2.2 job administration (spec §4.4): team assignment (with the EQR
// independence rule), hours-by-grade budget, and the PBC request list.

import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { accountMail, appUrl } from "@/lib/account-mail";
import { recordActivity } from "@/lib/activity";
import { createInvite } from "@/lib/invites";
import { sendEmail, platformSender } from "@/lib/email";
import { launchCampaign } from "@/lib/independence";
import { getLocale } from "@/lib/locale";
import { createNotification } from "@/lib/notifications";
import { withTenant } from "@/lib/db";
import { requireEngagementAccess } from "@/lib/engagement-access";
import { assertMutable } from "@/lib/mutability";
import { atLeast } from "@/lib/rbac";
import { ForbiddenError, requireTenant, requireWrite } from "@/lib/tenant";

/**
 * Times are stored in UTC and used to be shown that way with no zone, so a
 * sign-off at 06:29 local read 05:29 (UAT B133). The firm's zone is fixed to
 * West Africa Time for now and the label travels with the value.
 */
export const DISPLAY_TIME_ZONE = "Africa/Douala";
export const DISPLAY_TIME_ZONE_LABEL = "WAT";

/** The six-level audit ladder (top down), plus the independent EQR. */
export type TeamRole =
  "partner" | "director" | "senior_manager" | "manager" | "senior" | "staff" | "eqr_reviewer";
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
  /** why the member declined, when they did (UAT B130) */
  declineReason: string | null;
}

export async function listTeam(engagementId: string): Promise<TeamMember[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      user_id: string;
      user_name: string;
      email: string;
      team_role: TeamRole;
      status: "invited" | "accepted" | "declined";
      responded_at: string | null;
      decline_reason: string | null;
    }>(
      `SELECT tm.id, tm.user_id, coalesce(u.name, u.email) AS user_name, u.email, tm.team_role,
              coalesce(tm.status, 'accepted') AS status,
              to_char(tm.responded_at AT TIME ZONE $2, 'DD Mon YYYY HH24:MI') || ' ' || $3 AS responded_at,
              tm.decline_reason
         FROM team_member tm JOIN app_user u ON u.id = tm.user_id
        WHERE tm.engagement_id = $1 ORDER BY tm.created_at`,
      [engagementId, DISPLAY_TIME_ZONE, DISPLAY_TIME_ZONE_LABEL],
    );
    return result.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      email: r.email,
      teamRole: r.team_role,
      status: r.status,
      respondedAt: r.responded_at,
      declineReason: r.decline_reason,
    }));
  });
}

/**
 * Firm users assignable to the engagement (same tenant via membership). Client
 * portal contacts hold a membership too, as role client_user, and used to be
 * offered as team members and independence recipients (UAT B91).
 */
export async function listFirmUsers(): Promise<{ id: string; name: string; email: string }[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string; name: string; email: string }>(
      `SELECT u.id, coalesce(u.name, u.email) AS name, u.email
         FROM app_user u JOIN membership m ON m.user_id = u.id
        WHERE m.tenant_id = $1 AND m.role <> 'client_user' ORDER BY name`,
      [tenantId],
    );
    return result.rows;
  });
}

/**
 * A member joining after the independence campaign was issued is asked at
 * once (UAT B13): the gate now requires a confirmation from everyone on the
 * team, so a late joiner with no confirmation would silently block it — or,
 * before the gate was fixed, silently pass it. No campaign yet: nothing to do,
 * the launch will address the whole team.
 */
async function askIndependenceIfCampaignOpen(engagementId: string, userId: string): Promise<void> {
  const { tenantId } = await requireTenant();
  const open = await withTenant(tenantId, (tx) =>
    tx.query("SELECT 1 FROM independence_campaign WHERE engagement_id = $1 LIMIT 1", [engagementId]),
  );
  if ((open.rowCount ?? 0) === 0) return;
  try {
    await launchCampaign(engagementId, [userId]);
  } catch (error) {
    // The assignment stands; a confirmation that could not be issued shows
    // up as "not asked" on the independence tool and on the gate.
    console.warn("[team] independence confirmation not issued:", error instanceof Error ? error.message : error);
  }
}

/**
 * Who may change an engagement's team (UAT B02). Staffing is a manager's
 * decision (ISQM 1 ¶32, ISA 220 ¶14): any staff member used to be able to add,
 * remove or promote colleagues, including making themselves partner. Now:
 * manager rank or above, never the EQR (who must stay independent of the
 * team), on an engagement the caller can see — and only a partner may hand
 * out or take away the partner seat.
 */
export async function requireTeamManager(engagementId: string, teamRole?: string) {
  const ctx = await requireTenant();
  if (ctx.role === "eqr_reviewer" || !atLeast(ctx.role, "manager")) {
    throw new ForbiddenError("team-manager-only");
  }
  if (teamRole === "partner" && !atLeast(ctx.role, "partner")) {
    throw new ForbiddenError("partner-only-team-role");
  }
  await requireEngagementAccess(engagementId);
  return ctx;
}

function assertTeamRole(teamRole: string): asserts teamRole is TeamRole {
  if (!(TEAM_ROLES as readonly string[]).includes(teamRole)) throw new Error("invalid-team-role");
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
  assertTeamRole(teamRole);
  const { tenantId, role } = await requireTeamManager(engagementId, teamRole);
  // an archived file keeps the team it closed with (the trigger refuses the
  // write anyway; the typed error is the one the page can translate)
  await assertMutable(engagementId);
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.query<{ team_role: TeamRole }>(
      "SELECT team_role FROM team_member WHERE engagement_id = $1 AND user_id = $2",
      [engagementId, userId],
    );
    const current = existing.rows[0]?.team_role;
    // Demoting the partner is taking the partner seat away.
    if (current === "partner" && teamRole !== "partner" && !atLeast(role, "partner")) {
      throw new ForbiddenError("partner-only-team-role");
    }
    // The member must belong to this firm — as staff, not as a client contact.
    const member = await tx.query(
      "SELECT 1 FROM membership WHERE tenant_id = $1 AND user_id = $2 AND role <> 'client_user'",
      [tenantId, userId],
    );
    if ((member.rowCount ?? 0) === 0) throw new Error("not-a-firm-member");
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
    // An appointed quality reviewer makes the EQR a completion gate, so the
    // file needs its C4.2 paper whatever the complexity tier (UAT run 2 B13).
    if (teamRole === "eqr_reviewer") {
      const { ensureTaskTx } = await import("@/lib/ensure-task");
      await ensureTaskTx(tx, engagementId, "C4.2");
    }
  });
  await askIndependenceIfCampaignOpen(engagementId, userId);
}

export async function removeTeamMember(engagementId: string, userId: string): Promise<void> {
  const { tenantId, role } = await requireTeamManager(engagementId);
  await assertMutable(engagementId);
  const removed = await withTenant(tenantId, async (tx) => {
    const existing = await tx.query<{ team_role: TeamRole; who: string }>(
      `SELECT tm.team_role, coalesce(u.name, u.email) AS who
         FROM team_member tm JOIN app_user u ON u.id = tm.user_id
        WHERE tm.engagement_id = $1 AND tm.user_id = $2`,
      [engagementId, userId],
    );
    if (existing.rows[0]?.team_role === "partner" && !atLeast(role, "partner")) {
      throw new ForbiddenError("partner-only-team-role");
    }
    await tx.query("DELETE FROM team_member WHERE engagement_id = $1 AND user_id = $2", [
      engagementId,
      userId,
    ]);
    // Leaving the team ends the person's work on the file: their tasks go back
    // to the unassigned pool rather than keeping a hidden grant (UAT run 2 B04):
    // an assignee or preparer (owner) of a task can see the file without a
    // team row (lib/engagement-access.ts), so both seats are vacated.
    const unassigned = await tx.query<{ id: string; code: string }>(
      `UPDATE file_item
          SET assignee_user_id = CASE WHEN assignee_user_id = $2 THEN NULL ELSE assignee_user_id END,
              owner_id = CASE WHEN owner_id = $2 THEN NULL ELSE owner_id END,
              approver_user_id = CASE WHEN approver_user_id = $2 THEN NULL ELSE approver_user_id END
        WHERE engagement_id = $1 AND $2 IN (assignee_user_id, owner_id, approver_user_id)
        RETURNING id, code`,
      [engagementId, userId],
    );
    return existing.rows[0] ? { ...existing.rows[0], unassigned: unassigned.rows } : null;
  });
  // Who left the team, and as what, belongs in the trail (UAT B62).
  if (removed) {
    await recordActivity({
      engagementId,
      entityType: "team_member",
      entityId: userId,
      action: "team_removed",
      summary: `${removed.who} removed from the team (${removed.team_role.replace(/_/g, " ")})`,
      before: { userId, teamRole: removed.team_role },
    });
    for (const task of removed.unassigned) {
      await recordActivity({
        engagementId,
        entityType: "file_item",
        entityId: task.id,
        action: "task_unassigned",
        summary: `${task.code} unassigned (${removed.who} left the team)`,
        before: { assigneeUserId: userId },
      });
    }
  }
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
  const { tenantId, userId: actorId, role: actorRole } = await requireWrite();
  // staffing the team's work is not the independent reviewer's call (UAT run 2 B18)
  if (actorRole === "eqr_reviewer") throw new ForbiddenError("eqr-read-only");
  const task = await withTenant(tenantId, async (tx) => {
    if (userIdOrNull) {
      const member = await tx.query(
        "SELECT 1 FROM team_member WHERE engagement_id = $1 AND user_id = $2",
        [engagementId, userIdOrNull],
      );
      if ((member.rowCount ?? 0) === 0) throw new Error("not-found");
    }
    const updated = await tx.query<{ code: string; title_en: string }>(
      "UPDATE file_item SET assignee_user_id = $3 WHERE id = $2 AND engagement_id = $1 RETURNING code, title_en",
      [engagementId, itemId, userIdOrNull],
    );
    if ((updated.rowCount ?? 0) === 0) throw new Error("not-found");
    return updated.rows[0];
  });
  // The assignee hears about it and the trail records it (UAT B62).
  await recordActivity({
    engagementId,
    entityType: "file_item",
    entityId: itemId,
    action: userIdOrNull ? "task_assigned" : "task_unassigned",
    summary: userIdOrNull ? `${task.code} assigned` : `${task.code} unassigned`,
    after: { assigneeUserId: userIdOrNull },
  });
  if (userIdOrNull && userIdOrNull !== actorId) {
    try {
      await createNotification({
        tenantId,
        userId: userIdOrNull,
        kind: "task_assigned",
        title: `Task assigned: ${task.code} — ${task.title_en}`,
        href: `/engagements/${engagementId}/sections/${itemId}`,
      });
    } catch {
      // a failed notification must never undo the assignment
    }
  }
}

/**
 * Assign every listed task (file item) of the engagement to one team member in
 * a single statement — the phase-level counterpart of assignTask, used by the
 * Forms tool to hand a whole phase to one person. Same rules: the target must
 * be a team_member of the engagement; null unassigns. Returns how many tasks
 * were repointed.
 */
export type TaskAssignmentRole = "preparer" | "approver" | "assignee";
const ASSIGNMENT_COLUMN: Record<TaskAssignmentRole, string> = {
  preparer: "owner_id",
  approver: "approver_user_id",
  assignee: "assignee_user_id",
};

export async function assignTasks(
  engagementId: string,
  itemIds: string[],
  userIdOrNull: string | null,
  role: TaskAssignmentRole = "assignee",
): Promise<number> {
  if (itemIds.length === 0) return 0;
  const { tenantId, userId: actorId, role: actorRole } = await requireWrite();
  if (actorRole === "eqr_reviewer") throw new ForbiddenError("eqr-read-only");
  const result = await withTenant(tenantId, async (tx) => {
    if (userIdOrNull) {
      const member = await tx.query(
        "SELECT 1 FROM team_member WHERE engagement_id = $1 AND user_id = $2",
        [engagementId, userIdOrNull],
      );
      if ((member.rowCount ?? 0) === 0) throw new Error("not-found");
    }
    const updated = await tx.query<{ code: string }>(
      `UPDATE file_item SET ${ASSIGNMENT_COLUMN[role]} = $3 WHERE engagement_id = $1 AND id = ANY($2::uuid[]) RETURNING code`,
      [engagementId, itemIds, userIdOrNull],
    );
    return { n: updated.rowCount ?? 0, codes: updated.rows.map((r) => r.code) };
  });
  if (result.n > 0) {
    await recordActivity({
      engagementId,
      entityType: "engagement",
      entityId: engagementId,
      action: userIdOrNull ? "tasks_assigned" : "tasks_unassigned",
      summary: `${result.n} task(s) ${userIdOrNull ? "assigned" : "unassigned"} as ${role}: ${result.codes.slice(0, 12).join(", ")}${result.codes.length > 12 ? "…" : ""}`,
      after: { role, userId: userIdOrNull, codes: result.codes },
    });
    if (userIdOrNull && userIdOrNull !== actorId) {
      try {
        await createNotification({
          tenantId,
          userId: userIdOrNull,
          kind: "task_assigned",
          title: `${result.n} task(s) assigned to you as ${role}`,
          body: result.codes.slice(0, 20).join(", "),
          href: `/engagements/${engagementId}/tasks`,
        });
      } catch {
        // a failed notification must never undo the assignment
      }
    }
  }
  return result.n;
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

export async function setBudgetLine(
  engagementId: string,
  grade: string,
  hours: number,
): Promise<void> {
  const { tenantId } = await requireWrite();
  if (!grade.trim() || !(hours >= 0)) throw new Error("invalid-budget");
  // Actual hours are attributed to the logger's team role, so a budget line
  // must carry one of those keys or the two never meet on the same row.
  if (!(TEAM_ROLES as readonly string[]).includes(grade.trim())) throw new Error("invalid-grade");
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
  // A read-only or portal account raises no request (UAT B09).
  const { tenantId } = await requireWrite();
  await requireEngagementAccess(engagementId);
  if (!title.trim()) throw new Error("title-required");
  await withTenant(tenantId, async (tx) => {
    await tx.query("INSERT INTO pbc_item (tenant_id, engagement_id, title) VALUES ($1, $2, $3)", [
      tenantId,
      engagementId,
      title.trim(),
    ]);
  });
}

// setPbcStatus is gone (UAT B09): it was a bare UPDATE with no role, content or
// transition check, so any staff member could mark a request "uploaded" then
// "accepted" with no file. The only ways a request changes status now are the
// client's upload (lib/pbc.ts uploadPbc) and the reviewer's acceptance of that
// upload (lib/pbc.ts acceptPbc).

/**
 * Add a team member by email address. An existing firm user is matched; an
 * unknown email provisions the account with a TEMPORARY password that goes out
 * in the invitation email and must be replaced at first sign-in — the same
 * pattern as firm onboarding (lib/admin.ts). Without it the provisioned
 * account was unreachable: nobody knew its random password and no admin reset
 * existed. The member starts as "invited" and is prompted by email to accept
 * or decline the engagement from the console.
 */
export async function addTeamMemberByEmail(
  engagementId: string,
  emailRaw: string,
  teamRole: TeamRole,
  engagementName: string,
  /**
   * The person's name as typed by whoever is adding them. Used only when the
   * account has to be provisioned; an existing colleague keeps the name on
   * their account, which this screen has no business rewriting.
   *
   * When it is blank the name is still derived from the address, but that
   * guess drops initials and punctuation — "j.p.mbarga@" became "J P Mbarga"
   * — so the typed value wins whenever there is one.
   */
  displayNameRaw?: string,
): Promise<void> {
  assertTeamRole(teamRole);
  const { tenantId, userId: inviterId } = await requireTeamManager(engagementId, teamRole);
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("invalid-email");

  // Not a credential anybody receives: the row needs a hash, and the account is
  // opened by setting a password through the invitation. Random means there is
  // nothing guessable sitting there in the meantime.
  const tempPassword = randomBytes(24).toString("base64url");
  const { userId, provisioned, name, firmName, inviterName } = await withTenant(
    tenantId,
    async (tx) => {
      const firm = await tx.query<{ name: string }>("SELECT name FROM tenant WHERE id = $1", [
        tenantId,
      ]);
      const inviter = await tx.query<{ who: string }>(
        "SELECT coalesce(name, email) AS who FROM app_user WHERE id = $1",
        [inviterId],
      );
      const meta = {
        firmName: firm.rows[0]?.name ?? null,
        inviterName: inviter.rows[0]?.who ?? null,
      };
      const existing = await tx.query<{ id: string; name: string | null }>(
        `SELECT u.id, u.name FROM app_user u JOIN membership m ON m.user_id = u.id
        WHERE lower(u.email) = $1 AND m.tenant_id = $2`,
        [email, tenantId],
      );
      if (existing.rows[0])
        return {
          userId: existing.rows[0].id,
          provisioned: false,
          name: existing.rows[0].name,
          ...meta,
        };
      // Same email in another tenant is a different firm's user — never attach.
      const elsewhere = await tx.query<{ id: string }>(
        "SELECT id FROM app_user WHERE lower(email) = $1",
        [email],
      );
      if (elsewhere.rows[0]) throw new Error("email-taken");
      const bcrypt = (await import("bcryptjs")).default;
      const hash = await bcrypt.hash(tempPassword, 10);
      const typed = displayNameRaw?.trim();
      const name =
        typed && typed.length > 0
          ? typed
          : email
              .split("@")[0]
              .replace(/[._-]+/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());
      const user = await tx.query<{ id: string }>(
        "INSERT INTO app_user (email, name, password_hash, must_change_password) VALUES ($1, $2, $3, true) RETURNING id",
        [email, name, hash],
      );
      await tx.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'staff')", [
        user.rows[0].id,
        tenantId,
      ]);
      return { userId: user.rows[0].id, provisioned: true, name, ...meta };
    },
  );

  await withTenant(tenantId, async (tx) => {
    // "Add" never re-roles someone already on the team: that silently turned
    // the EQR into a preparer and back and re-sent the invitation (UAT run 2
    // B17). Roles change through assignTeamMember, which applies the EQR and
    // partner-seat rules. Someone who declined may be invited again, under
    // those same rules.
    const current = await tx.query<{ team_role: TeamRole; status: string }>(
      "SELECT team_role, status FROM team_member WHERE engagement_id = $1 AND user_id = $2",
      [engagementId, userId],
    );
    const row = current.rows[0];
    if (row) {
      if (row.status !== "declined") throw new Error("already-on-team");
      if ((teamRole === "eqr_reviewer") !== (row.team_role === "eqr_reviewer")) throw new Error("eqr-on-team");
    }
    await tx.query(
      `INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status, invited_at)
       VALUES ($1, $2, $3, $4, 'invited', now())
       ON CONFLICT (engagement_id, user_id)
       DO UPDATE SET team_role = EXCLUDED.team_role, status = 'invited', invited_at = now()`,
      [tenantId, engagementId, userId, teamRole],
    );
  });

  // Onboarding a colleague onto the tool: platform mail, so replies reach
  // support. Audit correspondence still goes out as the firm — see
  // lib/independence.ts. A provisioned account gets the sign-in link with
  // the email filled in and its temporary password; an existing colleague
  // gets the engagement's door and no password.
  const locale = await getLocale();
  const facts = {
    email,
    name,
    firmName,
    inviterName,
    engagementName,
    engagementId,
    roleLabel: teamRole.replace("_", " "),
  };
  // A brand-new colleague is invited to choose their own password, so nothing
  // usable travels by email. Someone who already has an account signs in with
  // the password they already chose — there is nothing to issue them.
  const mail = provisioned
    ? accountMail(
        "invitation",
        {
          ...facts,
          inviteUrl: `${appUrl()}/invite/${await createInvite({
            userId,
            createdBy: inviterId,
            nextPath: `/engagements/${engagementId}/dashboard`,
          })}`,
        },
        locale,
      )
    : accountMail("added-to-engagement", facts, locale);
  sendEmail({ ...platformSender(), to: email, ...mail });
  await createNotification({
    tenantId,
    userId,
    kind: "engagement-invite",
    title: `Added to ${engagementName}`,
    body: "Accept or decline the engagement from its dashboard.",
  });
  await askIndependenceIfCampaignOpen(engagementId, userId);
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

/**
 * Accept or decline the engagement invitation; the response is timestamped.
 * A decline carries its reason and reaches the engagement partners (UAT B130):
 * a member walking away from a file is an independence or capacity signal
 * the partner has to hear, not a silent status change.
 */
export async function respondToEngagement(engagementId: string, accept: boolean, reason = ""): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  const why = reason.trim();
  if (!accept && !why) throw new Error("reason-required");
  const outcome = await withTenant(tenantId, async (tx) => {
    const updated = await tx.query<{ who: string; team_role: string }>(
      `UPDATE team_member tm SET status = $3, responded_at = now(), decline_reason = $4
         FROM app_user u
        WHERE tm.engagement_id = $1 AND tm.user_id = $2 AND tm.status = 'invited' AND u.id = tm.user_id
        RETURNING coalesce(u.name, u.email) AS who, tm.team_role`,
      [engagementId, userId, accept ? "accepted" : "declined", accept ? null : why],
    );
    if (!updated.rows[0]) return null;
    const partners = await tx.query<{ user_id: string }>(
      "SELECT user_id FROM team_member WHERE engagement_id = $1 AND team_role = 'partner' AND user_id <> $2",
      [engagementId, userId],
    );
    return { ...updated.rows[0], partners: partners.rows.map((p) => p.user_id) };
  });
  if (outcome && !accept) {
    for (const partnerId of outcome.partners) {
      try {
        await createNotification({
          tenantId,
          userId: partnerId,
          kind: "engagement-declined",
          title: `${outcome.who} declined the engagement`,
          body: why.slice(0, 400),
          href: `/engagements/${engagementId}/team`,
        });
      } catch {
        // a failed notification must never undo the response
      }
    }
  }
}
