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

/** Read a positive integer from the environment, falling back to `fallback`. */
function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/*
 * Pool sizing and timeouts. Every number here is a deliberate choice, not a
 * default — the pg defaults (max 10, no acquisition timeout, no server-side
 * timeouts) cannot serve a firm-sized concurrent user base and let a single
 * stuck query pin a connection for ever.
 *
 * POOL_MAX (PG_POOL_MAX, default 20)
 *   PostgreSQL on a single VM ships with max_connections = 100. Each Node
 *   process holding 20 leaves room for a second app instance, the migration
 *   role, a psql session and the handful of superuser slots Postgres reserves.
 *   Sizing much higher is counter-productive anyway: beyond roughly
 *   (2 x cores + effective_spindles) concurrently active backends, Postgres
 *   throughput drops rather than rises, and 20 short transactions per process
 *   sustain far more than 20 users because a request holds a connection only
 *   for the milliseconds it is actually querying. Raise PG_POOL_MAX only
 *   together with the server's max_connections, or put PgBouncer in front.
 *
 * CONNECT_TIMEOUT (PG_CONNECT_TIMEOUT_MS, default 5000)
 *   Without it, pool.connect() waits for ever when the pool is exhausted or the
 *   database is down: requests pile up invisibly and the process wedges. Five
 *   seconds turns that into a fast, visible 500 while leaving room for a TLS
 *   handshake and a brief pool queue under a burst.
 *
 * IDLE_TIMEOUT (PG_IDLE_TIMEOUT_MS, default 30000)
 *   Return idle connections to the server after 30s so an overnight-idle app
 *   does not hold 20 backends, while a normal working day never pays the
 *   reconnect cost between requests.
 *
 * STATEMENT_TIMEOUT (PG_STATEMENT_TIMEOUT_MS, default 30000)
 *   Server-side ceiling on any single statement. Generous enough for the
 *   heaviest report/export queries, short enough that a pathological query
 *   frees its connection instead of holding it until the process restarts.
 *
 * IDLE_TX_TIMEOUT (PG_IDLE_TX_TIMEOUT_MS, default 60000)
 *   Kills a session that is *inside* a transaction but issuing nothing — the
 *   shape a leaked withTenant() takes, which would otherwise hold locks and a
 *   connection indefinitely. Set above STATEMENT_TIMEOUT because some
 *   withTenant() bodies legitimately do non-database work (building an xlsx
 *   workbook, for instance) between two queries of the same transaction.
 *
 * statement_timeout and idle_in_transaction_session_timeout are passed as pg
 * client options, which sends them in the connection startup packet — they are
 * therefore in force for the very first query on a connection, unlike a `SET`
 * issued from a pool 'connect' handler.
 */
// 10, not 20: the cluster this app shares runs max_connections well below
// what one greedy pool can claim, and exhausting it takes the whole site down
// with "too many clients already" — as it did on 26 Aug. Raise deliberately
// (PG_POOL_MAX) once the server has the headroom to back it.
const POOL_MAX = intFromEnv("PG_POOL_MAX", 10);
const CONNECT_TIMEOUT = intFromEnv("PG_CONNECT_TIMEOUT_MS", 5_000);
const IDLE_TIMEOUT = intFromEnv("PG_IDLE_TIMEOUT_MS", 30_000);
const STATEMENT_TIMEOUT = intFromEnv("PG_STATEMENT_TIMEOUT_MS", 30_000);
const IDLE_TX_TIMEOUT = intFromEnv("PG_IDLE_TX_TIMEOUT_MS", 60_000);

// Reuse a single pool across hot reloads in development.
const globalForPool = globalThis as unknown as { __eaPool?: Pool };

function createPool(): Pool {
  const created = new Pool({
    connectionString,
    max: POOL_MAX,
    connectionTimeoutMillis: CONNECT_TIMEOUT,
    idleTimeoutMillis: IDLE_TIMEOUT,
    statement_timeout: STATEMENT_TIMEOUT,
    idle_in_transaction_session_timeout: IDLE_TX_TIMEOUT,
    application_name: process.env.PG_APPLICATION_NAME || "ea-audit",
  });
  // An idle pooled client that errors (server restart, network drop) emits
  // 'error' on the pool. Without a listener Node treats it as an unhandled
  // 'error' event and kills the process; pg removes the broken client itself,
  // so logging is the correct response.
  created.on("error", (error) => {
    console.error("[db] idle client error", error);
  });
  return created;
}

export const pool: Pool = globalForPool.__eaPool ?? createPool();

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
