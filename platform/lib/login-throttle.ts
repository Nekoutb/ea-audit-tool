import { pool } from "@/lib/db";

/**
 * Consecutive-failure backoff on sign-in. Nothing recorded failed logins at
 * all, so an offline-speed guessing attack against a known firm address was
 * unbounded.
 *
 * The brake is normally on the (email, IP) PAIR, because that is the one an
 * attacker cannot point at anybody but themselves: locking on email alone hands
 * them a denial-of-service against any user whose address they know, which for
 * an audit firm is every partner on the website.
 *
 * When no trusted client IP is available the pair collapses to the email, and
 * that DoS is exactly what returns. So with no IP the pair brake is skipped
 * entirely and a much higher email-only ceiling applies — enough to stop
 * sustained guessing, too high to be usable as a weapon. Configure
 * CLIENT_IP_HEADER, behind a proxy that actually sets it, to get the tight one.
 */

/** Failures tolerated on a pair before the backoff starts. */
const PAIR_FREE = 5;
/** Failures tolerated on an email alone, when no IP dimension exists. */
const EMAIL_ONLY_FREE = 50;
/** Backoff after the free attempts, in minutes, then held at the last value. */
const BACKOFF_MINUTES = [1, 2, 4, 8, 16, 30];

export interface ThrottleState {
  blocked: boolean;
  /** Seconds until the next attempt is allowed; 0 when not blocked. */
  retryAfter: number;
}

function penaltyMinutes(failures: number, free: number): number {
  const over = failures - free;
  if (over <= 0) return 0;
  return BACKOFF_MINUTES[Math.min(over - 1, BACKOFF_MINUTES.length - 1)];
}

/**
 * How long the caller must wait, given the failures since this identity last
 * signed in successfully. A successful sign-in resets the count, so an ordinary
 * typo streak clears itself the moment the person gets in.
 */
export async function checkLoginThrottle(email: string, ip: string | null): Promise<ThrottleState> {
  const normalised = email.toLowerCase().trim();
  if (!normalised) return { blocked: false, retryAfter: 0 };

  // Every column is qualified. The first version cross-joined a CTE and left
  // `at` bare, which Postgres rejects as ambiguous — the query threw on every
  // call, authorize() swallowed it, and the throttle was dead without ever
  // saying so.
  const result = await pool.query<{ failures: string; last_at: string | null }>(
    `SELECT count(*)::text AS failures, max(la.at)::text AS last_at
       FROM login_attempt la
      WHERE lower(la.email) = $1
        AND NOT la.successful
        AND ($2::inet IS NULL OR la.ip IS NOT DISTINCT FROM $2::inet)
        AND la.at > coalesce(
              (SELECT max(s.at)
                 FROM login_attempt s
                WHERE lower(s.email) = $1
                  AND s.successful
                  AND ($2::inet IS NULL OR s.ip IS NOT DISTINCT FROM $2::inet)),
              '-infinity'::timestamptz)`,
    [normalised, ip],
  );

  const failures = Number(result.rows[0]?.failures ?? 0);
  const lastAt = result.rows[0]?.last_at ? new Date(result.rows[0].last_at) : null;
  if (!lastAt) return { blocked: false, retryAfter: 0 };

  const minutes = penaltyMinutes(failures, ip ? PAIR_FREE : EMAIL_ONLY_FREE);
  if (minutes === 0) return { blocked: false, retryAfter: 0 };

  const readyAt = lastAt.getTime() + minutes * 60_000;
  const waitMs = readyAt - Date.now();
  return waitMs > 0
    ? { blocked: true, retryAfter: Math.ceil(waitMs / 1000) }
    : { blocked: false, retryAfter: 0 };
}

/** Record the outcome. Best-effort: a logging failure must not block sign-in. */
export async function recordLoginAttempt(email: string, ip: string | null, successful: boolean): Promise<void> {
  try {
    await pool.query(
      "INSERT INTO login_attempt (email, ip, successful) VALUES ($1, $2::inet, $3)",
      [email.toLowerCase().trim(), ip, successful],
    );
  } catch {
    // Never let the audit of a sign-in prevent the sign-in.
  }
}

/**
 * Drop attempts older than the window. Not audit evidence — the trail is
 * activity_log — so it is pruned rather than kept.
 */
export async function pruneLoginAttempts(olderThanDays = 30): Promise<number> {
  const result = await pool.query(
    "DELETE FROM login_attempt WHERE at < now() - ($1 || ' days')::interval",
    [String(olderThanDays)],
  );
  return result.rowCount ?? 0;
}
