// A firm's sending identity. Every tenant-scoped email (independence requests,
// reminders, external balance confirmations, engagement invitations) goes out
// from the firm's own address on the platform's verified mail domain, so the
// recipient sees the audit firm and not a shared platform mailbox.
//
// This is a platform-level lookup on the global `tenant` table (like the admin
// console's cross-firm reads), so it uses the bare pool rather than withTenant.
// It lives outside lib/email.ts so the mail module stays free of `pg`.

import { pool } from "@/lib/db";
import { sanitiseMailLocal } from "@/lib/email";

export interface TenantSender {
  fromLocal?: string;
  fromName?: string;
}

/**
 * Resolve the tenant's From identity: `mail_local` (sanitised — a bad value is
 * simply dropped so the send falls back to the platform address) and the firm
 * name as the display name. Never throws: mail identity must not break a send.
 */
export async function tenantSender(tenantId: string): Promise<TenantSender> {
  try {
    const r = await pool.query<{ mail_local: string | null; name: string | null }>(
      "SELECT mail_local, name FROM tenant WHERE id = $1",
      [tenantId],
    );
    const row = r.rows[0];
    if (!row) return {};
    return {
      fromLocal: sanitiseMailLocal(row.mail_local),
      fromName: row.name?.trim() || undefined,
    };
  } catch {
    return {};
  }
}
