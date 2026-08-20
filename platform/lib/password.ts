import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { recordActivity } from "@/lib/activity";
import { passwordProblem } from "@/lib/password-policy";

export { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/password-policy";

/**
 * Password self-service. A firm admin onboarded through the console starts with
 * a generated secret that the platform operator never sees and that survives
 * only until first sign-in — `must_change_password` holds the session on the
 * change screen until it is replaced (Phase 0 item 1).
 */

export class PasswordError extends Error {}

/**
 * Replace the signed-in user's password. The current password is always
 * required — an unattended session must not be able to lock the owner out.
 */
export async function changeOwnPassword(current: string, next: string, confirm: string): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new PasswordError("not-signed-in");
  if (next !== confirm) throw new PasswordError("mismatch");

  const row = await pool.query<{ email: string; password_hash: string }>(
    "SELECT email, password_hash FROM app_user WHERE id = $1",
    [userId],
  );
  const user = row.rows[0];
  if (!user) throw new PasswordError("not-signed-in");

  if (!(await bcrypt.compare(current, user.password_hash))) throw new PasswordError("wrong-current");
  if (await bcrypt.compare(next, user.password_hash)) throw new PasswordError("reused");

  const problem = passwordProblem(next, user.email);
  if (problem) throw new PasswordError(problem);

  await pool.query(
    `UPDATE app_user
        SET password_hash = $2, must_change_password = false, password_changed_at = now()
      WHERE id = $1`,
    [userId, await bcrypt.hash(next, 10)],
  );

  // The secret itself is never logged — only that a change happened, and by whom.
  await recordActivity({
    entityType: "app_user",
    entityId: userId,
    action: "password.changed",
    summary: "Password changed",
  });
}
