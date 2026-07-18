// Firm user management: list, invite, re-role and remove the internal users of a
// tenant. Built on app_user + membership (both global tables, scoped in app code
// by tenant_id). Firm-admin only. Sign-off history references app_user, so
// "remove" deletes the membership (revokes firm access) and keeps the user row.

import bcrypt from "bcryptjs";
import { recordActivity } from "@/lib/activity";
import { withTenant } from "@/lib/db";
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
  password: string;
}): Promise<void> {
  const { tenantId } = await requireAdmin();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new UserAdminError("invalid-email");
  if (!name) throw new UserAdminError("name-required");
  if (!isRole(input.role) || !ASSIGNABLE_ROLES.includes(input.role)) throw new UserAdminError("invalid-role");
  if (input.password.length < 8) throw new UserAdminError("password-too-short");

  const hash = await bcrypt.hash(input.password, 10);
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.query<{ id: string }>("SELECT id FROM app_user WHERE lower(email) = $1", [email]);
    if (existing.rows[0]) throw new UserAdminError("email-taken");
    const user = await tx.query<{ id: string }>(
      "INSERT INTO app_user (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id",
      [email, name, hash],
    );
    await tx.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [
      user.rows[0].id,
      tenantId,
      input.role,
    ]);
  });
  await recordActivity({
    entityType: "user",
    action: "invited",
    summary: `Invited ${name} (${input.role.replace("_", " ")})`,
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
