// The platform admin console's data layer. Cross-firm reads NEVER bypass the
// tenant walls: global tables (tenant, app_user, membership) are read directly,
// per-tenant figures go through withTenant so RLS stays the only data plane —
// the super-admin flag gates the console and firm onboarding, nothing else.
// Firms are independent by construction (FORCE ROW LEVEL SECURITY on every
// tenant table), and engagements are independent within a firm (every query is
// engagement-scoped; cross-engagement reads exist only as explicit rollups).

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { pool, withTenant } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export class AdminError extends Error {}

export async function requireSuper(): Promise<{ userId: string }> {
  const session = await auth();
  if (!session?.user?.isSuper) throw new AdminError("forbidden");
  return { userId: session.user.id };
}

export interface FirmSummary {
  id: string;
  name: string;
  slug: string;
  /** the firm's local part on the platform mail domain, e.g. "eca" */
  mailLocal: string | null;
  createdAt: string;
  users: number;
  clients: number;
  engagements: number;
}

export async function listFirms(): Promise<FirmSummary[]> {
  await requireSuper();
  const tenants = await pool.query<{ id: string; name: string; slug: string; mail_local: string | null; created_at: string }>(
    "SELECT id, name, slug, mail_local, to_char(created_at, 'YYYY-MM-DD') AS created_at FROM tenant ORDER BY created_at",
  );
  const members = await pool.query<{ tenant_id: string; n: string }>(
    "SELECT tenant_id, count(*)::text AS n FROM membership GROUP BY tenant_id",
  );
  const memberOf = new Map(members.rows.map((r) => [r.tenant_id, Number(r.n)]));
  const out: FirmSummary[] = [];
  for (const t of tenants.rows) {
    // per-tenant figures under that tenant's own RLS context
    const counts = await withTenant(t.id, async (tx) => {
      const r = await tx.query<{ clients: string; engagements: string }>(
        "SELECT (SELECT count(*) FROM client)::text AS clients, (SELECT count(*) FROM engagement)::text AS engagements",
      );
      return r.rows[0];
    }).catch(() => ({ clients: "0", engagements: "0" }));
    out.push({
      id: t.id,
      name: t.name,
      slug: t.slug,
      mailLocal: t.mail_local,
      createdAt: t.created_at,
      users: memberOf.get(t.id) ?? 0,
      clients: Number(counts.clients),
      engagements: Number(counts.engagements),
    });
  }
  return out;
}

/**
 * Onboard an audit firm: tenant + firm-admin account + onboarding email with
 * a one-time password the admin changes after first sign-in.
 */
export async function createFirm(input: {
  name: string;
  slug: string;
  adminEmail: string;
  adminName: string;
  language?: "en" | "fr";
  /** local part of the firm's sending address; defaults to the slug */
  mailLocal?: string;
}): Promise<{ tenantId: string; tempPassword: string }> {
  await requireSuper();
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const adminEmail = input.adminEmail.trim().toLowerCase();
  if (!name || !slug || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) throw new AdminError("fields-required");
  const language = input.language === "en" ? "en" : "fr";

  const existing = await pool.query("SELECT 1 FROM tenant WHERE slug = $1", [slug]);
  if (existing.rows[0]) throw new AdminError("slug-taken");

  // the firm's sending identity: local part only — the domain is the platform's
  // verified one, so a firm can never set a From that would fail to deliver
  const mailLocal = (input.mailLocal ?? "").trim().toLowerCase() || slug;
  if (!/^[a-z0-9._-]{1,64}$/.test(mailLocal)) throw new AdminError("bad-mail-local");
  const mailTaken = await pool.query("SELECT 1 FROM tenant WHERE lower(mail_local) = $1", [mailLocal]);
  if (mailTaken.rows[0]) throw new AdminError("mail-local-taken");

  const tempPassword = randomBytes(6).toString("base64url");
  const hash = await bcrypt.hash(tempPassword, 10);
  const existingUser = await pool.query<{ id: string }>(
    "SELECT id FROM app_user WHERE lower(email) = $1",
    [adminEmail],
  );
  const isNewUser = !existingUser.rows[0];

  const client = await pool.connect();
  let tenantId = "";
  try {
    await client.query("BEGIN");
    const t = await client.query<{ id: string }>(
      "INSERT INTO tenant (name, slug, default_language, mail_local) VALUES ($1, $2, $3, $4) RETURNING id",
      [name, slug, language, mailLocal],
    );
    tenantId = t.rows[0].id;
    let userId = existingUser.rows[0]?.id;
    if (!userId) {
      const u = await client.query<{ id: string }>(
        `INSERT INTO app_user (email, name, password_hash, preferred_language)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [adminEmail, input.adminName.trim() || name, hash, language],
      );
      userId = u.rows[0].id;
    }
    await client.query(
      "INSERT INTO membership (tenant_id, user_id, role) VALUES ($1, $2, 'firm_admin')",
      [tenantId, userId],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  sendEmail({
    to: adminEmail,
    subject: `Welcome to AuditISA — ${name} is onboarded`,
    body:
      `Your audit firm "${name}" has been set up on AuditISA.\n\n` +
      `Sign in: /login\nEmail: ${adminEmail}\n` +
      (isNewUser ? `Temporary password: ${tempPassword}\n\nChange the password after your first sign-in, ` : `Use your existing password. `) +
      `then create your clients and audit engagements and invite your team. ` +
      `Each firm's data is fully segregated, and every engagement is independent within the firm.`,
  });

  return { tenantId, tempPassword: isNewUser ? tempPassword : "" };
}
