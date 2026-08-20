/**
 * Password rules, kept free of any server/auth import so they can be unit
 * tested and reused on the client. The enforcement point is
 * `changeOwnPassword` in lib/password.ts — this module only decides.
 */

/** Deliberately modest: enough to stop the obvious, not so much that people write it down. */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Returns a stable problem code, or null when the password is acceptable.
 * Ordered so the message names the most useful failure first.
 */
export function passwordProblem(next: string, email: string): string | null {
  if (next.length < MIN_PASSWORD_LENGTH) return "too-short";
  if (!/[a-z]/.test(next) || !/[A-Z]/.test(next)) return "needs-mixed-case";
  if (!/[0-9]/.test(next)) return "needs-digit";
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.length > 2 && next.toLowerCase().includes(local)) return "contains-email";
  return null;
}
