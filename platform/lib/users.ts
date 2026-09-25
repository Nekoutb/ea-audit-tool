// Firm user management: list, invite, re-role and remove the internal users of a
// tenant. Built on app_user + membership (both global tables, scoped in app code
// by tenant_id). Firm-admin only. Sign-off history references app_user, so
// "remove" deletes the membership (revokes firm access) and keeps the user row.

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { recordActivity } from "@/lib/activity";
import { withTenant } from "@/lib/db";
import { accountMail, appUrl } from "@/lib/account-mail";
import { createInvite } from "@/lib/invites";
import { sendEmail, platformSender } from "@/lib/email";
import { getLocale } from "@/lib/locale";
import { canManageFirm, isRole, type Role } from "@/lib/rbac";
import { requireTenant } from "@/lib/tenant";

/** Roles an admin can assign to an internal firm user (client_user is portal-only). */
export const ASSIGNABLE_ROLES: Role[] = [
  "firm_admin",
  "partner",
  "manager",
  "senior",
  "staff",
  "eqr_reviewer",
  "read_only",
];

export class UserAdminError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "UserAdminError";
  }
}

/**
 * Where an account stands (UAT B158): `active` once the person has chosen a
 * password; `invited` while a live invitation is waiting for them;
 * `invite-expired` when the only way in has lapsed and a new link is needed.
 */
export type FirmUserStatus = "active" | "invited" | "invite-expired";

export interface FirmUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isSelf: boolean;
  status: FirmUserStatus;
  /** engagement teams the person sits on in this firm — named before a removal */
  engagements: number;
}

async function requireAdmin() {
  const ctx = await requireTenant();
  if (!canManageFirm(ctx.role as Role)) throw new UserAdminError("forbidden");
  return ctx;
}

export async function listFirmUsers(): Promise<FirmUser[]> {
  const { tenantId, userId } = await requireAdmin();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{
      id: string;
      email: string;
      name: string | null;
      role: Role;
      must_change: boolean;
      invite_live: boolean;
      engagements: string;
    }>(
      `SELECT u.id, u.email, u.name, m.role,
              coalesce(u.must_change_password, false) AS must_change,
              EXISTS (SELECT 1 FROM user_invite i
                       WHERE i.user_id = u.id AND i.used_at IS NULL AND i.expires_at > now()) AS invite_live,
              (SELECT count(*) FROM team_member tm WHERE tm.user_id = u.id AND tm.tenant_id = $1)::text AS engagements
         FROM membership m JOIN app_user u ON u.id = m.user_id
        WHERE m.tenant_id = $1 AND m.role <> 'client_user'
        ORDER BY (m.role = 'firm_admin') DESC, u.name NULLS LAST, u.email`,
      [tenantId],
    );
    return r.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      isSelf: row.id === userId,
      status: !row.must_change ? "active" : row.invite_live ? "invited" : "invite-expired",
      engagements: Number(row.engagements),
    }));
  });
}

/**
 * Issue (or re-issue) the one-time set-password link and mail it. The only
 * way a credential ever reaches a colleague: no password travels (UAT B39).
 */
async function sendInvitation(input: {
  tenantId: string;
  inviterId: string;
  userId: string;
  email: string;
  name: string | null;
}): Promise<void> {
  const context = await withTenant(input.tenantId, async (tx) => {
    const firm = await tx.query<{ name: string }>("SELECT name FROM tenant WHERE id = $1", [
      input.tenantId,
    ]);
    const inviter = await tx.query<{ who: string }>(
      "SELECT coalesce(name, email) AS who FROM app_user WHERE id = $1",
      [input.inviterId],
    );
    return { firmName: firm.rows[0]?.name ?? null, inviterName: inviter.rows[0]?.who ?? null };
  });
  const inviteUrl = `${appUrl()}/invite/${await createInvite({ userId: input.userId, createdBy: input.inviterId })}`;
  const mail = accountMail(
    "invitation",
    { email: input.email, name: input.name, inviteUrl, ...context },
    await getLocale(),
  );
  sendEmail({ ...platformSender(), to: input.email, ...mail });
}

export async function inviteFirmUser(input: {
  email: string;
  name: string;
  role: string;
}): Promise<void> {
  const { tenantId } = await requireAdmin();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new UserAdminError("invalid-email");
  if (!name) throw new UserAdminError("name-required");
  if (!isRole(input.role) || !ASSIGNABLE_ROLES.includes(input.role))
    throw new UserAdminError("invalid-role");

  // The row needs a hash, and the account is opened by setting a password
  // through the invitation. Random means nothing guessable sits there in the
  // meantime; nobody — not the admin — is ever told this value.
  const tempPassword = randomBytes(24).toString("base64url");
  const hash = await bcrypt.hash(tempPassword, 10);
  const { userId: inviterId } = await requireTenant();
  const target = await withTenant(tenantId, async (tx) => {
    const existing = await tx.query<{ id: string; name: string | null; must_change: boolean }>(
      "SELECT id, name, coalesce(must_change_password, false) AS must_change FROM app_user WHERE lower(email) = $1",
      [email],
    );
    const found = existing.rows[0];
    if (found) {
      // An address already on the platform (UAT B87/B88). Three cases, none of
      // them a blanket refusal: a colleague of this firm still waiting on their
      // link gets a fresh one; a person removed from every firm is readmitted
      // with new credentials; an account that belongs to another firm is
      // refused — one login never straddles two firms.
      const memberships = await tx.query<{ tenant_id: string; role: string }>(
        "SELECT tenant_id, role FROM membership WHERE user_id = $1",
        [found.id],
      );
      const here = memberships.rows.find((m) => m.tenant_id === tenantId);
      if (here) {
        if (here.role === "client_user" || !found.must_change) throw new UserAdminError("email-taken");
        return { userId: found.id, name: found.name ?? name, readmitted: false };
      }
      if (memberships.rows.length > 0) throw new UserAdminError("email-other-firm");
      await tx.query(
        `UPDATE app_user
            SET name = $2, password_hash = $3, must_change_password = true,
                session_version = coalesce(session_version, 1) + 1
          WHERE id = $1`,
        [found.id, name, hash],
      );
      await tx.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [
        found.id,
        tenantId,
        input.role,
      ]);
      return { userId: found.id, name, readmitted: true };
    }
    const user = await tx.query<{ id: string }>(
      "INSERT INTO app_user (email, name, password_hash, must_change_password) VALUES ($1, $2, $3, true) RETURNING id",
      [email, name, hash],
    );
    await tx.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [
      user.rows[0].id,
      tenantId,
      input.role,
    ]);
    return { userId: user.rows[0].id, name, readmitted: false };
  });
  // Account mail is platform mail — a reply belongs with support, not in a
  // firm's audit correspondence. The link lets them choose their own password;
  // no credential travels in the message at all, so the administrator who
  // created the account is never in a position to know it.
  await sendInvitation({ tenantId, inviterId, userId: target.userId, email, name: target.name });
  await recordActivity({
    entityType: "user",
    entityId: target.userId,
    action: "invited",
    summary: `Invited ${target.name} (${input.role.replace("_", " ")})`,
  });
}

/**
 * Send a colleague who has not yet chosen a password a fresh invitation link
 * (UAT B87). The previous link stops working the moment this one is issued.
 */
export async function resendInvite(targetUserId: string): Promise<{ email: string }> {
  const { tenantId, userId } = await requireAdmin();
  const target = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ email: string; name: string | null; must_change: boolean }>(
      `SELECT u.email, u.name, coalesce(u.must_change_password, false) AS must_change
         FROM membership m JOIN app_user u ON u.id = m.user_id
        WHERE m.user_id = $1 AND m.tenant_id = $2 AND m.role <> 'client_user'`,
      [targetUserId, tenantId],
    );
    if (!r.rows[0]) throw new UserAdminError("not-found");
    // Someone who has already set a password is not waiting on a link; the
    // reset path is the one that re-opens their account.
    if (!r.rows[0].must_change) throw new UserAdminError("already-active");
    return r.rows[0];
  });
  await sendInvitation({ tenantId, inviterId: userId, userId: targetUserId, ...target });
  await recordActivity({
    entityType: "user",
    entityId: targetUserId,
    action: "invited",
    summary: `Invitation re-sent to ${target.name ?? target.email}`,
  });
  return { email: target.email };
}

/**
 * Reset a firm user's password: the old one stops working at once, every
 * session it had open is closed, and the person receives a one-time link where
 * they choose the next one — no password is ever emailed (UAT B39). The
 * recovery path for an account whose password is unknown: `changeOwnPassword`
 * needs the current one, so without this an admin had no way to readmit a
 * locked-out user.
 */
export async function resetUserPassword(targetUserId: string): Promise<void> {
  const { tenantId, userId } = await requireAdmin();
  // An admin resets their own password signed in (Settings → Password), where
  // knowing the current one is proof of identity worth keeping.
  if (targetUserId === userId) throw new UserAdminError("cannot-reset-self");

  // An unusable placeholder: the account can only be re-entered through the link.
  const hash = await bcrypt.hash(randomBytes(24).toString("base64url"), 10);
  const target = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ email: string; name: string | null }>(
      `SELECT u.email, u.name FROM membership m JOIN app_user u ON u.id = m.user_id
        WHERE m.user_id = $1 AND m.tenant_id = $2 AND m.role <> 'client_user'`,
      [targetUserId, tenantId],
    );
    if (!r.rows[0]) throw new UserAdminError("not-found");
    const admin = await tx.query<{ who: string }>(
      "SELECT coalesce(name, email) AS who FROM app_user WHERE id = $1",
      [userId],
    );
    const firm = await tx.query<{ name: string }>("SELECT name FROM tenant WHERE id = $1", [
      tenantId,
    ]);
    await tx.query(
      `UPDATE app_user
          SET password_hash = $2, must_change_password = true,
              session_version = coalesce(session_version, 1) + 1
        WHERE id = $1`,
      [targetUserId, hash],
    );
    return {
      ...r.rows[0],
      inviterName: admin.rows[0]?.who ?? null,
      firmName: firm.rows[0]?.name ?? null,
    };
  });
  const inviteUrl = `${appUrl()}/invite/${await createInvite({ userId: targetUserId, createdBy: userId })}`;
  const mail = accountMail(
    "password-reset",
    {
      email: target.email,
      name: target.name,
      inviteUrl,
      inviterName: target.inviterName,
      firmName: target.firmName,
    },
    await getLocale(),
  );
  sendEmail({ ...platformSender(), to: target.email, ...mail });
  await recordActivity({
    entityType: "user",
    entityId: targetUserId,
    action: "password_reset",
    summary: `Password reset for ${target.name ?? target.email}`,
  });
}

export async function changeUserRole(targetUserId: string, role: string): Promise<void> {
  const { tenantId, userId } = await requireAdmin();
  if (targetUserId === userId) throw new UserAdminError("cannot-change-self");
  if (!isRole(role) || !ASSIGNABLE_ROLES.includes(role)) throw new UserAdminError("invalid-role");
  await withTenant(tenantId, async (tx) => {
    const r = await tx.query(
      "UPDATE membership SET role = $3, updated_at = now() WHERE user_id = $1 AND tenant_id = $2 AND role <> 'client_user'",
      [targetUserId, tenantId, role],
    );
    if (r.rowCount === 0) throw new UserAdminError("not-found");
  });
  await recordActivity({
    entityType: "user",
    entityId: targetUserId,
    action: "role_changed",
    summary: `Role changed to ${role.replace("_", " ")}`,
  });
}

export async function removeFirmUser(targetUserId: string): Promise<void> {
  const { tenantId, userId } = await requireAdmin();
  if (targetUserId === userId) throw new UserAdminError("cannot-remove-self");
  await withTenant(tenantId, async (tx) => {
    const r = await tx.query(
      "DELETE FROM membership WHERE user_id = $1 AND tenant_id = $2 AND role <> 'client_user'",
      [targetUserId, tenantId],
    );
    if (r.rowCount === 0) throw new UserAdminError("not-found");
    // A person who has left the firm cannot stay on its engagement teams or
    // hold its open tasks (UAT B89): the team rows go, the task assignments
    // are cleared for reassignment. Sign-off history references app_user and
    // is untouched — it records who did the work, not who is on the team.
    // Archived files are immutable (their rows carry an archive guard) and are
    // left as the record of who was on the team when the file closed.
    const live = "SELECT id FROM engagement WHERE tenant_id = $2 AND archived_at IS NULL";
    await tx.query(
      `DELETE FROM team_member WHERE user_id = $1 AND tenant_id = $2 AND engagement_id IN (${live})`,
      [targetUserId, tenantId],
    );
    await tx.query(
      `UPDATE file_item
          SET owner_id = CASE WHEN owner_id = $1 THEN NULL ELSE owner_id END,
              approver_user_id = CASE WHEN approver_user_id = $1 THEN NULL ELSE approver_user_id END,
              assignee_user_id = CASE WHEN assignee_user_id = $1 THEN NULL ELSE assignee_user_id END
        WHERE tenant_id = $2 AND engagement_id IN (${live})
          AND (owner_id = $1 OR approver_user_id = $1 OR assignee_user_id = $1)`,
      [targetUserId, tenantId],
    );
    // Invalidate any live sessions on the same request
    await tx.query(
      "UPDATE app_user SET session_version = coalesce(session_version, 1) + 1 WHERE id = $1",
      [targetUserId],
    );
  });
  await recordActivity({
    entityType: "user",
    entityId: targetUserId,
    action: "removed",
    summary: "Removed from firm",
  });
}
