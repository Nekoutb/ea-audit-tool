// Firm user management: list, invite, re-role and remove the internal users of a
// tenant. Built on app_user + membership (both global tables, scoped in app code
// by tenant_id). Firm-admin only. Sign-off history references app_user, so
// "remove" deletes the membership (revokes firm access) and keeps the user row.

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { recordActivity } from "@/lib/activity";
import { withTenant } from "@/lib/db";
import { sendEmail, platformSender } from "@/lib/email";
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

export interface FirmUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isSelf: boolean;
}

async function requireAdmin() {
  const ctx = await requireTenant();
  if (!canManageFirm(ctx.role as Role)) throw new UserAdminError("forbidden");
  return ctx;
}

export async function listFirmUsers(): Promise<FirmUser[]> {
  const { tenantId, userId } = await requireAdmin();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ id: string; email: string; name: string | null; role: Role }>(
      `SELECT u.id, u.email, u.name, m.role
         FROM membership m JOIN app_user u ON u.id = m.user_id
        WHERE m.tenant_id = $1 AND m.role <> 'client_user'
        ORDER BY (m.role = 'firm_admin') DESC, u.name NULLS LAST, u.email`,
      [tenantId],
    );
    return r.rows.map((row) => ({ ...row, isSelf: row.id === userId }));
  });
}

export async function inviteFirmUser(input: {
  email: string;
  name: string;
  role: string;
}): Promise<void> {
  const { tenantId } = await requireAdmin();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new UserAdminError("invalid-email");
  if (!name) throw new UserAdminError("name-required");
  if (!isRole(input.role) || !ASSIGNABLE_ROLES.includes(input.role)) throw new UserAdminError("invalid-role");

  // Mirrors firm onboarding (lib/admin.ts): a generated temporary password is
  // emailed to the new user and must be replaced at first sign-in, so an admin
  // never knows, types or transports a colleague's real password.
  const tempPassword = randomBytes(24).toString("base64url");
  const hash = await bcrypt.hash(tempPassword, 10);
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.query<{ id: string }>("SELECT id FROM app_user WHERE lower(email) = $1", [email]);
    if (existing.rows[0]) throw new UserAdminError("email-taken");
    const user = await tx.query<{ id: string }>(
      "INSERT INTO app_user (email, name, password_hash, must_change_password) VALUES ($1, $2, $3, true) RETURNING id",
      [email, name, hash],
    );
    await tx.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [
      user.rows[0].id,
      tenantId,
      input.role,
    ]);
  });
  sendEmail({
    // Account mail is platform mail — a reply belongs with support, not in a
    // firm's audit correspondence.
    ...platformSender(),
    to: email,
    subject: "Your AuditISA account",
    body:
      `An account has been created for you on AuditISA.\n\n` +
      `Sign in: /login\nEmail: ${email}\nTemporary password: ${tempPassword}\n\n` +
      `You will be asked to replace it the first time you sign in.`,
  });
  await recordActivity({
    entityType: "user",
    action: "invited",
    summary: `Invited ${name} (${input.role.replace("_", " ")})`,
  });
}

/**
 * Reset a firm user's password to a fresh temporary one, emailed to them and
 * replaced at first sign-in. The recovery path for an account whose password
 * is unknown — `changeOwnPassword` needs the current one, so without this an
 * admin had no way to readmit a locked-out user. Bumping session_version
 * revokes any session the old password had open.
 */
export async function resetUserPassword(targetUserId: string): Promise<void> {
  const { tenantId, userId } = await requireAdmin();
  // An admin resets their own password signed in (Settings → Password), where
  // knowing the current one is proof of identity worth keeping.
  if (targetUserId === userId) throw new UserAdminError("cannot-reset-self");

  const tempPassword = randomBytes(24).toString("base64url");
  const hash = await bcrypt.hash(tempPassword, 10);
  const target = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ email: string; name: string | null }>(
      `SELECT u.email, u.name FROM membership m JOIN app_user u ON u.id = m.user_id
        WHERE m.user_id = $1 AND m.tenant_id = $2 AND m.role <> 'client_user'`,
      [targetUserId, tenantId],
    );
    if (!r.rows[0]) throw new UserAdminError("not-found");
    await tx.query(
      `UPDATE app_user
          SET password_hash = $2, must_change_password = true,
              session_version = coalesce(session_version, 1) + 1
        WHERE id = $1`,
      [targetUserId, hash],
    );
    return r.rows[0];
  });
  sendEmail({
    ...platformSender(),
    to: target.email,
    subject: "Your AuditISA password has been reset",
    body:
      `A firm administrator has reset your AuditISA password.\n\n` +
      `Sign in: /login\nEmail: ${target.email}\nTemporary password: ${tempPassword}\n\n` +
      `You will be asked to replace it the first time you sign in. ` +
      `If you did not expect this, contact your firm administrator.`,
  });
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
  await recordActivity({ entityType: "user", entityId: targetUserId, action: "role_changed", summary: `Role changed to ${role.replace("_", " ")}` });
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
  });
  await recordActivity({ entityType: "user", entityId: targetUserId, action: "removed", summary: "Removed from firm" });
}
