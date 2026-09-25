// One-time invitations: the recipient chooses their own password, and no
// usable credential ever travels by email.
//
// The token is generated here, sent once, and stored only as a SHA-256 digest.
// Reading the table therefore tells an attacker nothing they could present,
// and the digest is what a lookup matches — the same shape the product already
// uses for MFA recovery codes.

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { safeNext } from "@/lib/account-mail";
import { pool } from "@/lib/db";
import { passwordProblem } from "@/lib/password-policy";

export class InviteError extends Error {}

/** How long an invitation is good for. Long enough for a holiday, not a quarter. */
export const INVITE_TTL_DAYS = 14;

const digest = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Only a path on this site, so an invitation cannot bounce someone elsewhere. */
function safePath(next: string | null | undefined): string | null {
  const p = typeof next === "string" ? next.trim() : "";
  if (!p) return null;
  // One rule for every stored destination (UAT B07): the sign-in form's
  // safeNext rejects "//host", "/\host" and anything that resolves off-site.
  const safe = safeNext(p);
  return safe === "/" && p !== "/" ? null : safe;
}

/**
 * Issue an invitation for a user, superseding any unused one they already have.
 *
 * Returns the raw token, which exists in memory here and in exactly one email.
 * It is never written down, never logged, and cannot be recovered from the row.
 */
export async function createInvite(input: {
  userId: string;
  createdBy?: string | null;
  nextPath?: string | null;
}): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    // Supersede rather than accumulate: the partial unique index allows one
    // live invitation per person, and a stale link must stop working the
    // moment a fresh one is sent.
    `UPDATE user_invite SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
    [input.userId],
  );
  await pool.query(
    `INSERT INTO user_invite (user_id, token_hash, next_path, created_by, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval)`,
    [
      input.userId,
      digest(token),
      safePath(input.nextPath),
      input.createdBy ?? null,
      String(INVITE_TTL_DAYS),
    ],
  );
  return token;
}

export interface InviteTarget {
  userId: string;
  email: string;
  name: string | null;
  nextPath: string | null;
}

/**
 * Who an unused, unexpired token belongs to — or null.
 *
 * Deliberately says nothing about *why* a token failed. "Expired" and "already
 * used" and "never existed" all look the same from outside, so the page cannot
 * be used to probe which tokens are real.
 */
export async function inviteTarget(token: string): Promise<InviteTarget | null> {
  if (!token || token.length < 20) return null;
  const { rows } = await pool.query<{
    user_id: string;
    email: string;
    name: string | null;
    next_path: string | null;
  }>(
    `SELECT i.user_id, u.email, u.name, i.next_path
       FROM user_invite i JOIN app_user u ON u.id = i.user_id
      WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.expires_at > now()`,
    [digest(token)],
  );
  const row = rows[0];
  return row
    ? { userId: row.user_id, email: row.email, name: row.name, nextPath: row.next_path }
    : null;
}

/**
 * Spend the token and set the password the recipient chose.
 *
 * The UPDATE that marks the invitation used carries the `used_at IS NULL`
 * condition, so two submissions racing each other cannot both win: the second
 * changes no row and is refused. The password is only written once that claim
 * has succeeded.
 */
export async function acceptInvite(
  token: string,
  password: string,
  confirm: string,
): Promise<InviteTarget> {
  const target = await inviteTarget(token);
  if (!target) throw new InviteError("invalid-or-expired");
  if (password !== confirm) throw new InviteError("mismatch");
  const problem = passwordProblem(password, target.email);
  if (problem) throw new InviteError(problem);

  const hash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const claimed = await client.query(
      `UPDATE user_invite SET used_at = now()
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [digest(token)],
    );
    if (claimed.rowCount !== 1) throw new InviteError("invalid-or-expired");
    await client.query(
      `UPDATE app_user
          SET password_hash = $2, must_change_password = false, password_changed_at = now(),
              session_version = coalesce(session_version, 1) + 1
        WHERE id = $1`,
      [target.userId, hash],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return target;
}
