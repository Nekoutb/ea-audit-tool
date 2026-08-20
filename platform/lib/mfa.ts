import bcrypt from "bcryptjs";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { recordActivity } from "@/lib/activity";
import { formatSecret, generateSecret, otpauthUri, verifyTotp } from "@/lib/totp";

/**
 * Second factor: enrolment, verification, recovery.
 *
 * The secret is encrypted at rest. A TOTP secret is symmetric — whoever holds
 * it can mint valid codes indefinitely — so storing it bare would mean a
 * database copy defeats the factor it exists to add. The key comes from
 * AUTH_SECRET, which lives in the environment and not in the database, so a
 * dump on its own is not enough.
 */

export class MfaError extends Error {}

const ISSUER = "AuditISA";
/** Salt is fixed by design: the key must be derivable, not random per call. */
const KEY_SALT = "auditisa.mfa.v1";

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new MfaError("auth-secret-missing");
  return scryptSync(secret, KEY_SALT, 32);
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

function decrypt(stored: string): string {
  const [iv, tag, body] = stored.split(".");
  if (!iv || !tag || !body) throw new MfaError("bad-ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
}

export interface MfaStatus {
  enrolled: boolean;
  /** Unused recovery codes remaining. */
  recoveryRemaining: number;
}

export async function mfaStatus(): Promise<MfaStatus> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new MfaError("not-signed-in");

  const row = await pool.query<{ enrolled: boolean; remaining: string }>(
    `SELECT (u.totp_enrolled_at IS NOT NULL) AS enrolled,
            (SELECT count(*) FROM mfa_recovery_code r WHERE r.user_id = u.id AND r.used_at IS NULL)::text AS remaining
       FROM app_user u WHERE u.id = $1`,
    [userId],
  );
  return {
    enrolled: row.rows[0]?.enrolled ?? false,
    recoveryRemaining: Number(row.rows[0]?.remaining ?? 0),
  };
}

export interface Enrolment {
  secretFormatted: string;
  uri: string;
}

/**
 * Begin enrolment: mint a secret and store it, but leave totp_enrolled_at NULL
 * so nothing is enforced until a working code proves the authenticator is
 * actually configured. Re-running replaces an unconfirmed secret, which is what
 * someone who abandoned the setup and came back would expect.
 */
export async function beginEnrolment(): Promise<Enrolment> {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;
  if (!userId || !email) throw new MfaError("not-signed-in");

  const status = await mfaStatus();
  if (status.enrolled) throw new MfaError("already-enrolled");

  const secret = generateSecret();
  await pool.query("UPDATE app_user SET totp_secret = $2 WHERE id = $1", [userId, encrypt(secret)]);
  return { secretFormatted: formatSecret(secret), uri: otpauthUri(secret, email, ISSUER) };
}

/**
 * Finish enrolment by proving a code. Returns the recovery codes, which are
 * shown once and never again — they are stored hashed, exactly like passwords,
 * so nobody including an operator can read them back.
 */
export async function confirmEnrolment(code: string): Promise<string[]> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new MfaError("not-signed-in");

  const row = await pool.query<{ totp_secret: string | null; totp_enrolled_at: string | null }>(
    "SELECT totp_secret, totp_enrolled_at::text FROM app_user WHERE id = $1",
    [userId],
  );
  const stored = row.rows[0];
  if (!stored?.totp_secret) throw new MfaError("no-enrolment-started");
  if (stored.totp_enrolled_at) throw new MfaError("already-enrolled");
  if (!verifyTotp(decrypt(stored.totp_secret), code)) throw new MfaError("wrong-code");

  const codes = Array.from({ length: 10 }, () => randomBytes(5).toString("hex").toUpperCase());
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE app_user SET totp_enrolled_at = now() WHERE id = $1", [userId]);
    await client.query("DELETE FROM mfa_recovery_code WHERE user_id = $1", [userId]);
    for (const plain of codes) {
      await client.query("INSERT INTO mfa_recovery_code (user_id, code_hash) VALUES ($1, $2)", [
        userId,
        await bcrypt.hash(plain, 10),
      ]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  await recordActivity({ entityType: "app_user", entityId: userId, action: "mfa.enrolled", summary: "Two-factor enabled" });
  return codes;
}

/** Turn it off. The current password is required — a borrowed session must not. */
export async function disableMfa(currentPassword: string): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new MfaError("not-signed-in");

  const row = await pool.query<{ password_hash: string }>("SELECT password_hash FROM app_user WHERE id = $1", [userId]);
  if (!row.rows[0]) throw new MfaError("not-signed-in");
  if (!(await bcrypt.compare(currentPassword, row.rows[0].password_hash))) throw new MfaError("wrong-password");

  await pool.query("UPDATE app_user SET totp_secret = NULL, totp_enrolled_at = NULL WHERE id = $1", [userId]);
  await pool.query("DELETE FROM mfa_recovery_code WHERE user_id = $1", [userId]);
  await recordActivity({ entityType: "app_user", entityId: userId, action: "mfa.disabled", summary: "Two-factor disabled" });
}

/* ------------------------------------------------------------------ *
 * Sign-in path. Called from authorize(), which has no session yet, so
 * these take the user id directly rather than reading auth().
 * ------------------------------------------------------------------ */

export interface MfaRequirement {
  required: boolean;
  secret: string | null;
}

export async function mfaRequirementFor(userId: string): Promise<MfaRequirement> {
  const row = await pool.query<{ totp_secret: string | null; totp_enrolled_at: string | null }>(
    "SELECT totp_secret, totp_enrolled_at::text FROM app_user WHERE id = $1",
    [userId],
  );
  const stored = row.rows[0];
  // A secret without a confirmation is an abandoned setup, not a factor.
  if (!stored?.totp_secret || !stored.totp_enrolled_at) return { required: false, secret: null };
  return { required: true, secret: decrypt(stored.totp_secret) };
}

/**
 * Check a submitted second factor: an authenticator code, or one recovery code.
 * A recovery code is spent on use — marked rather than deleted, so a reviewer
 * can see one was used.
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
