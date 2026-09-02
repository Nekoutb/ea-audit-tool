// Whether this instance challenges for a second factor at sign-in.
//
// The dev/staging instance is exercised by people who do not carry the
// production authenticator, so AUTH_DISABLE_MFA turns the challenge off
// there. The flag is deliberately not enough on its own: it is honoured only
// when the app is connected to a non-production database. The two instances
// run the same build from the same branch, and a variable copied into the
// wrong .env is exactly the accident this guard exists to survive — on
// ea_audit the flag is ignored and a warning is logged instead.

/** Databases that are allowed to run without a second factor. Prod is `ea_audit`. */
const NON_PRODUCTION_DB = /_(dev|staging|test|local)$/;

function databaseName(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname.replace(/^\//, "") || null;
  } catch {
    return null; // an unparseable URL is not a licence to drop the factor
  }
}

function flagSet(): boolean {
  const raw = (process.env.AUTH_DISABLE_MFA ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

let warned = false;

/**
 * True only on a non-production instance that has explicitly asked for the
 * second factor to be skipped at sign-in. Enrolment itself (/security) is
 * untouched — this governs the login challenge, nothing else.
 */
export function mfaDisabled(): boolean {
  if (!flagSet()) return false;
  const db = databaseName(process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL);
  if (db !== null && NON_PRODUCTION_DB.test(db)) return true;
  if (!warned) {
    warned = true;
    console.warn(
      `[mfa] AUTH_DISABLE_MFA is set but the database is ${db ?? "unknown"}; ` +
        "the second factor stays ON. The flag is honoured only on a non-production database.",
    );
  }
  return false;
}
