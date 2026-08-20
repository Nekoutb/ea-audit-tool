import pg from "pg";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { clientIp, isIpAddress } from "@/lib/client-ip";
import { checkLoginThrottle, pruneLoginAttempts, recordLoginAttempt } from "@/lib/login-throttle";
import { closePool } from "@/lib/db";

const EMAIL = "throttle-fixture@test.local";
const ATTACKER = "203.0.113.9";
const VICTIM = "198.51.100.4";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/** Insert a failure `secondsAgo` in the past, so backoff windows can be tested. */
async function failureAt(secondsAgo: number, ip: string | null): Promise<void> {
  await admin.query(
    "INSERT INTO login_attempt (email, ip, successful, at) VALUES ($1, $2::inet, false, now() - ($3 || ' seconds')::interval)",
    [EMAIL, ip, String(secondsAgo)],
  );
}

afterEach(async () => {
  await admin.query("DELETE FROM login_attempt WHERE email = $1", [EMAIL]);
});

afterAll(async () => {
  await admin.query("DELETE FROM login_attempt WHERE email = $1", [EMAIL]);
  await admin.end();
  await closePool();
});

describe("checkLoginThrottle — the pair brake", () => {
  it("allows the free attempts", async () => {
    for (let i = 0; i < 5; i += 1) await failureAt(1, ATTACKER);
    expect((await checkLoginThrottle(EMAIL, ATTACKER)).blocked).toBe(false);
  });

  it("blocks once the free attempts are used up", async () => {
    for (let i = 0; i < 6; i += 1) await failureAt(1, ATTACKER);
    const state = await checkLoginThrottle(EMAIL, ATTACKER);
    expect(state.blocked).toBe(true);
    expect(state.retryAfter).toBeGreaterThan(0);
  });

  it("backs off further the more failures accumulate", async () => {
    for (let i = 0; i < 6; i += 1) await failureAt(1, ATTACKER);
    const first = await checkLoginThrottle(EMAIL, ATTACKER);
    await failureAt(1, ATTACKER);
    await failureAt(1, ATTACKER);
    const later = await checkLoginThrottle(EMAIL, ATTACKER);
    expect(later.retryAfter).toBeGreaterThan(first.retryAfter);
  });

  it("lets the caller back in once the backoff has elapsed", async () => {
    // Six failures, the most recent well beyond the one-minute first penalty.
    for (let i = 0; i < 6; i += 1) await failureAt(300, ATTACKER);
    expect((await checkLoginThrottle(EMAIL, ATTACKER)).blocked).toBe(false);
  });

  it("does not brake a different IP — the whole point of keying on the pair", async () => {
    // Locking on email alone would hand an attacker a denial of service against
    // any user whose address they know, which for an audit firm is everyone on
    // the website.
    for (let i = 0; i < 20; i += 1) await failureAt(1, ATTACKER);
    expect((await checkLoginThrottle(EMAIL, VICTIM)).blocked).toBe(false);
  });

  it("clears the streak after a successful sign-in from that pair", async () => {
    for (let i = 0; i < 10; i += 1) await failureAt(120, ATTACKER);
    await admin.query(
      "INSERT INTO login_attempt (email, ip, successful, at) VALUES ($1, $2::inet, true, now() - interval '60 seconds')",
      [EMAIL, ATTACKER],
    );
    await failureAt(1, ATTACKER);
    // Only the one failure since the success counts.
    expect((await checkLoginThrottle(EMAIL, ATTACKER)).blocked).toBe(false);
  });
});

describe("checkLoginThrottle — with no trusted IP", () => {
  it("tolerates far more before braking, so it cannot be aimed at a user", async () => {
    // With no IP dimension the pair collapses to the email, and a tight brake
    // becomes a weapon. 20 failures must not lock a real person out.
    for (let i = 0; i < 20; i += 1) await failureAt(1, null);
    expect((await checkLoginThrottle(EMAIL, null)).blocked).toBe(false);
  });

  it("still brakes sustained guessing", async () => {
    for (let i = 0; i < 55; i += 1) await failureAt(1, null);
    expect((await checkLoginThrottle(EMAIL, null)).blocked).toBe(true);
  });
});

describe("checkLoginThrottle — housekeeping", () => {
  it("is not blocked when nothing has ever failed", async () => {
    expect(await checkLoginThrottle(EMAIL, ATTACKER)).toEqual({ blocked: false, retryAfter: 0 });
  });

  it("ignores an empty email rather than counting every blank attempt together", async () => {
    expect((await checkLoginThrottle("", ATTACKER)).blocked).toBe(false);
  });

  it("records and prunes", async () => {
    await recordLoginAttempt(EMAIL, ATTACKER, false);
    await admin.query(
      "INSERT INTO login_attempt (email, ip, successful, at) VALUES ($1, $2::inet, false, now() - interval '90 days')",
      [EMAIL, ATTACKER],
    );
    const removed = await pruneLoginAttempts(30);
    expect(removed).toBeGreaterThanOrEqual(1);
    const left = await admin.query("SELECT count(*)::int AS n FROM login_attempt WHERE email = $1", [EMAIL]);
    expect(left.rows[0].n).toBe(1);
  });
});

describe("clientIp — one source or none", () => {
  const withHeader = (name: string | undefined, headers: Record<string, string>) => {
    const previous = process.env.CLIENT_IP_HEADER;
    if (name === undefined) delete process.env.CLIENT_IP_HEADER;
    else process.env.CLIENT_IP_HEADER = name;
    try {
      return clientIp(new Headers(headers));
    } finally {
      if (previous === undefined) delete process.env.CLIENT_IP_HEADER;
      else process.env.CLIENT_IP_HEADER = previous;
    }
  };

  it("returns null when no header is configured, however many are present", () => {
    // A fallback would defeat the point: configuring the safe header would
    // still leave a forgeable one consulted whenever the safe one is absent —
    // which is exactly the request an attacker sends.
    expect(withHeader(undefined, { "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" })).toBeNull();
  });

  it("reads only the configured header", () => {
    expect(withHeader("x-client-ip", { "x-client-ip": "9.9.9.9", "cf-connecting-ip": "1.2.3.4" })).toBe("9.9.9.9");
    expect(withHeader("x-client-ip", { "cf-connecting-ip": "1.2.3.4" })).toBeNull();
  });

  it("takes the left-most entry of a forwarded-for chain", () => {
    expect(withHeader("x-forwarded-for", { "x-forwarded-for": "9.9.9.9, 10.0.0.1, 172.16.0.1" })).toBe("9.9.9.9");
  });

  it("refuses a malformed value rather than handing it to Postgres", () => {
    expect(withHeader("x-client-ip", { "x-client-ip": "not-an-ip" })).toBeNull();
    expect(withHeader("x-client-ip", { "x-client-ip": "999.1.1.1" })).toBeNull();
  });

  it("accepts IPv6", () => {
    expect(withHeader("x-client-ip", { "x-client-ip": "2001:db8::1" })).toBe("2001:db8::1");
  });
});

describe("isIpAddress", () => {
  it("accepts real addresses", () => {
    expect(isIpAddress("192.168.1.1")).toBe(true);
    expect(isIpAddress("255.255.255.255")).toBe(true);
    expect(isIpAddress("::1")).toBe(true);
  });

  it("rejects the rest", () => {
    expect(isIpAddress("256.1.1.1")).toBe(false);
    expect(isIpAddress("1.2.3")).toBe(false);
    expect(isIpAddress("")).toBe(false);
    expect(isIpAddress("' OR 1=1--")).toBe(false);
  });
});
