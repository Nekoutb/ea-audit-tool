import bcrypt from "bcryptjs";
import { createDecipheriv, scryptSync } from "node:crypto";
import { pool } from "@/lib/db";
import { mfaDisabled } from "@/lib/mfa-policy";
import { verifyTotp } from "@/lib/totp";

/**
 * The second-factor checks used DURING sign-in.
 *
 * Split from lib/mfa.ts because that module needs `auth()` for the enrolment
 * flow, and auth.ts needs these — a cycle that built by luck until a new route
 * pulled the chain in a different order and V8 ran out of compiler zone during
 * page collection. Nothing here has a session yet, so nothing here may import
 * one.
 */

export class MfaVerifyError extends Error {}

const KEY_SALT = "auditisa.mfa.v1";

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new MfaVerifyError("auth-secret-missing");
  return scryptSync(secret, KEY_SALT, 32);
}

/** Reverses lib/mfa.ts#encrypt. The two must stay in step. */
export function decryptSecret(stored: string): string {
  const [iv, tag, body] = stored.split(".");
  if (!iv || !tag || !body) throw new MfaVerifyError("bad-ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
}

export interface MfaRequirement {
  required: boolean;
  secret: string | null;
}

export async function mfaRequirementFor(userId: string): Promise<MfaRequirement> {
  // Dev/staging may run without the challenge; see lib/mfa-policy.ts for why
  // the flag alone cannot do this on production.
  if (mfaDisabled()) return { required: false, secret: null };
  const row = await pool.query<{ totp_secret: string | null; totp_enrolled_at: string | null }>(
    "SELECT totp_secret, totp_enrolled_at::text FROM app_user WHERE id = $1",
    [userId],
  );
  const stored = row.rows[0];
  // A secret without a confirmation is an abandoned setup, not a factor.
  if (!stored?.totp_secret || !stored.totp_enrolled_at) return { required: false, secret: null };
  return { required: true, secret: decryptSecret(stored.totp_secret) };
}

/**
 * An authenticator code, or one recovery code. A recovery code is spent on use
 * — marked rather than deleted, so a reviewer can see one was used.
 */
export async function verifySecondFactor(userId: string, secret: string, submitted: string): Promise<boolean> {
  const cleaned = submitted.replace(/[\s-]/g, "").trim();
  if (!cleaned) return false;
  if (verifyTotp(secret, cleaned)) return true;

  const candidates = await pool.query<{ id: string; code_hash: string }>(
    "SELECT id, code_hash FROM mfa_recovery_code WHERE user_id = $1 AND used_at IS NULL",
    [userId],
  );
  for (const candidate of candidates.rows) {
    if (await bcrypt.compare(cleaned.toUpperCase(), candidate.code_hash)) {
      await pool.query("UPDATE mfa_recovery_code SET used_at = now() WHERE id = $1", [candidate.id]);
      return true;
    }
  }
  return false;
}
