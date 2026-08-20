import { pool } from "@/lib/db";
import { isRole, type Role } from "@/lib/rbac";

/**
 * Re-reads the account behind a session token.
 *
 * role, tenantId, isSuper and mustChangePassword live only in the JWT, so
 * before this a demoted or removed user kept their authority until the token
 * expired, and setting must_change_password on a live session did nothing.
 *
 * The cost has to be answered, not just the correctness: `auth()` is not
 * memoised, so one dashboard render calls the jwt callback four times (proxy,
 * layout's getLocale, the page, the page's getLocale). A naive query there is
 * four round trips per page. Two things prevent that — a staleness window on
 * the token, and deduplication of concurrent reads of the same user below.
 */

export interface Principal {
  tenantId: string;
  role: Role;
  clientId: string | null;
  isSuper: boolean;
  mustChangePassword: boolean;
  locale: string;
  sessionVersion: number;
}

/** How long a token is trusted without re-reading the row. */
export function revalidationWindowSeconds(): number {
  const raw = Number(process.env.SESSION_REVALIDATE_SECONDS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 60;
}

/**
 * In-flight reads, keyed by user. The four calls a single render makes arrive
 * within microseconds of each other, so they share one query. Entries are
 * removed as soon as the query settles — this is request coalescing, not a
 * cache, because a cache would reintroduce exactly the staleness being fixed.
 */
const inFlight = new Map<string, Promise<Principal | null>>();

export async function revalidatePrincipal(userId: string, tenantId: string): Promise<Principal | null> {
  const key = `${userId}:${tenantId}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const run = read(userId, tenantId).finally(() => inFlight.delete(key));
  inFlight.set(key, run);
  return run;
}

async function read(userId: string, tenantId: string): Promise<Principal | null> {
  const result = await pool.query<{
    role: string;
    client_id: string | null;
    is_super: boolean;
    must_change_password: boolean;
    preferred_language: string;
    session_version: number;
    disabled_at: string | null;
  }>(
    `SELECT m.role, m.client_id,
            coalesce(u.is_super, false)            AS is_super,
            coalesce(u.must_change_password, false) AS must_change_password,
            u.preferred_language,
            coalesce(u.session_version, 1)          AS session_version,
            u.disabled_at::text                     AS disabled_at
       FROM app_user u
       JOIN membership m ON m.user_id = u.id AND m.tenant_id = $2
      WHERE u.id = $1
      ORDER BY m.created_at
      LIMIT 1`,
    [userId, tenantId],
  );

  const row = result.rows[0];
  // No membership in that tenant, or the account is suspended. Either way the
  // session no longer describes anyone.
  if (!row || row.disabled_at) return null;
  if (!isRole(row.role)) return null;

  return {
    tenantId,
    role: row.role,
    clientId: row.client_id,
    isSuper: row.is_super,
    mustChangePassword: row.must_change_password,
    locale: row.preferred_language,
    sessionVersion: row.session_version,
  };
}

/**
 * Raised when the re-read itself fails — the database is unreachable, not the
 * user unauthorised. The caller keeps the existing token rather than logging
 * everybody out during a blip: failing STALE is the correct trade here, because
 * failing closed turns a momentary database problem into a mass logout of an
 * audit firm mid-fieldwork, and the window is 60 seconds wide.
 */
export class RevalidationUnavailable extends Error {}
