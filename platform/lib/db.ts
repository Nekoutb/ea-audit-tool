import { Pool, type PoolClient } from "pg";

/**
 * The application database connection.
 *
 * Prefers APP_DATABASE_URL — the non-superuser, non-owner role (`ea_app`) that
 * Row-Level Security policies actually constrain (superusers/owners bypass RLS).
 * Falls back to DATABASE_URL until that role exists (created in the RLS-bootstrap
 * step). Every tenant-scoped query must run inside `withTenant()` so the
 * `app.tenant_id` GUC is set and RLS restricts rows to that tenant.
 */
const connectionString = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("APP_DATABASE_URL or DATABASE_URL must be set");
}

// Reuse a single pool across hot reloads in development.
const globalForPool = globalThis as unknown as { __eaPool?: Pool };

export const pool: Pool = globalForPool.__eaPool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  globalForPool.__eaPool = pool;
}

/**
 * Run tenant-scoped database work. Opens a transaction, sets the
 * `app.tenant_id` GUC (transaction-local), runs `fn`, then commits — so the
 * RLS policies restrict every query inside `fn` to this tenant. Rolls back and
 * rethrows on any error. Always use this for tenant data; use the bare `pool`
 * only for global tables (tenant, app_user, membership) during authentication.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Transaction-local (is_local = true): reset automatically when the tx ends,
    // so a pooled connection never leaks one tenant's id into another's query.
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Close the pool. Used by tests and graceful shutdown. */
export async function closePool(): Promise<void> {
  await pool.end();
  if (globalForPool.__eaPool === pool) {
    globalForPool.__eaPool = undefined;
  }
}
