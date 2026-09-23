/**
 * Which instance this process is: production, or the dev/staging twin.
 *
 * The two run the SAME build from the same branch, so nothing in the code can
 * tell them apart — and an environment variable alone cannot either, because a
 * variable copied into the wrong .env is exactly the accident that matters.
 * The database name is the one thing that is necessarily different: production
 * is `ea_audit`, the twin is `ea_audit_dev`.
 *
 * Used to gate things that must never appear on production: the sign-in
 * second-factor skip (lib/mfa-policy.ts) and the UAT workbook at /uat.
 */

/** Databases that are not production. Production is `ea_audit`. */
const NON_PRODUCTION_DB = /_(dev|staging|test|local)$/;

export function databaseName(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname.replace(/^\//, "") || null;
  } catch {
    return null; // an unparseable URL is never treated as non-production
  }
}

/**
 * True only when this process is demonstrably talking to a non-production
 * database. Fails closed: an unknown or unparseable connection string counts
 * as production, because the cost of being wrong runs one way.
 */
export function isNonProductionInstance(): boolean {
  const db = databaseName(process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL);
  return db !== null && NON_PRODUCTION_DB.test(db);
}
