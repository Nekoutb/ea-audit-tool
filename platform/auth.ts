import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { pool } from "@/lib/db";
import { isLocale, type Locale } from "@/lib/i18n";
import { isRole, type Role } from "@/lib/rbac";
import { clientIp } from "@/lib/client-ip";
import { mfaRequirementFor, verifySecondFactor } from "@/lib/mfa-verify";
import { checkLoginThrottle, recordLoginAttempt } from "@/lib/login-throttle";
import { revalidatePrincipal, revalidationWindowSeconds } from "@/lib/session-guard";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  preferred_language: string;
  is_super: boolean;
  must_change_password: boolean;
  session_version: number;
  disabled_at: string | null;
}

/**
 * A bcrypt hash of a value nobody holds. Compared against when the email is
 * unknown so that branch costs the same ~100 ms as a real one: returning early
 * made response time a free oracle for "does this firm have an account here".
 */
const DECOY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

/** Thrown when the backoff is in force; surfaced as ?error=too-many-attempts. */
export class ThrottledError extends CredentialsSignin {
  code = "too-many-attempts";
}

/** The password was right but the second factor was missing or wrong. */
export class SecondFactorError extends CredentialsSignin {
  code = "mfa-required";
}

interface MembershipRow {
  tenant_id: string;
  role: Role;
  client_id: string | null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Infer the base URL from the request host rather than a hardcoded AUTH_URL,
  // so redirects work regardless of dev port (3000 default vs 3100 launch config)
  // and behind a proxy in production.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, code: {} },
      // `request` carries the inbound headers, which is where the client IP is.
      authorize: async (credentials, request) => {
        const email = String(credentials?.email ?? "")
          .toLowerCase()
          .trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const ip = clientIp(request?.headers ?? new Headers());
        // Fail open — a database problem must not lock every firm out of the
        // product — but say so loudly. Silently swallowing this is exactly how
        // the first version shipped a throttle that never fired.
        const throttle = await checkLoginThrottle(email, ip).catch((e) => {
          console.error("[auth] login throttle unavailable:", e instanceof Error ? e.message : e);
          return { blocked: false, retryAfter: 0 };
        });
        // Refuse without touching the password, and without recording another
        // failure — otherwise the backoff would extend itself every time a
        // blocked caller retried, which is a lockout, not a throttle.
        if (throttle.blocked) throw new ThrottledError();

        const userResult = await pool.query<UserRow>(
          `SELECT id, email, name, password_hash, preferred_language,
                  coalesce(is_super, false) AS is_super,
                  coalesce(must_change_password, false) AS must_change_password,
                  coalesce(session_version, 1) AS session_version,
                  disabled_at::text AS disabled_at
             FROM app_user WHERE lower(email) = $1`,
          [email],
        );
        const user = userResult.rows[0];

        // Do the same work whether or not the account exists, then decide.
        const passwordOk = await bcrypt.compare(password, user?.password_hash ?? DECOY_HASH);
        if (!user || !passwordOk || user.disabled_at) {
          await recordLoginAttempt(email, ip, false);
          return null;
        }

        // Second factor, when the account has confirmed one. Checked after the
        // password so an attacker learns nothing about enrolment from a wrong
        // password, and before the membership lookup so a valid password alone
        // never yields a session.
        const mfa = await mfaRequirementFor(user.id);
        if (mfa.required && mfa.secret) {
          const code = String(credentials?.code ?? "");
          if (!(await verifySecondFactor(user.id, mfa.secret, code))) {
            await recordLoginAttempt(email, ip, false);
            throw new SecondFactorError();
          }
        }

        // Resolve the user's tenant + firm role via their (first) membership.
        const membershipResult = await pool.query<MembershipRow>(
          "SELECT tenant_id, role, client_id FROM membership WHERE user_id = $1 ORDER BY created_at LIMIT 1",
          [user.id],
        );
        const membership = membershipResult.rows[0];
        if (!membership || !isRole(membership.role)) {
          await recordLoginAttempt(email, ip, false);
          return null;
        }
        // Success clears the streak, so an ordinary run of typos resolves the
        // moment the person gets in.
        await recordLoginAttempt(email, ip, true);

        const locale: Locale = isLocale(user.preferred_language)
          ? user.preferred_language
          : "fr";

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          tenantId: membership.tenant_id,
          role: membership.role,
          locale,
          clientId: membership.client_id,
          isSuper: user.is_super,
          mustChangePassword: user.must_change_password,
          sessionVersion: user.session_version,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * The single choke point every one of the ~69 `await auth()` call sites
     * passes through, and therefore the only place a stale token can be caught.
     * Returning null here is supported and clears the session cookie.
     */
    async jwt({ token, user, trigger }) {
      // Sign-in: authorize() has just read the row, so stamp and stop.
      if (user) {
        token.uid = user.id;
        token.tenantId = user.tenantId;
        token.role = user.role;
        token.locale = user.locale;
        token.clientId = user.clientId ?? null;
        token.isSuper = user.isSuper ?? false;
        token.mustChangePassword = user.mustChangePassword ?? false;
        token.sv = user.sessionVersion ?? 1;
        token.cat = Math.floor(Date.now() / 1000);
        return token;
      }

      const uid = typeof token.uid === "string" ? token.uid : "";
      const tenantId = typeof token.tenantId === "string" ? token.tenantId : "";
      // Nothing to re-check against. A token in this shape either predates the
      // identity fields or has been tampered with; refusing beats trusting.
      if (!uid || !tenantId) return null;

      // The staleness window makes the ordinary request free. Without it this
      // callback would query four times per dashboard render, because auth()
      // is not memoised across the proxy, the layout and the page.
      const now = Math.floor(Date.now() / 1000);
      const checkedAt = typeof token.cat === "number" ? token.cat : 0;
      if (trigger !== "update" && now - checkedAt < revalidationWindowSeconds()) return token;

      let principal;
      try {
        principal = await revalidatePrincipal(uid, tenantId);
      } catch {
        // Fail STALE, not closed. The database being briefly unreachable must
        // not log an audit firm out mid-fieldwork; the exposure is bounded by
        // the window, which is a minute.
        return token;
      }

      // Membership gone, tenant changed under them, or the account suspended.
      if (!principal) return null;
      // The credential the token was minted against no longer exists — the
      // password changed, or an operator revoked the sessions.
      if (typeof token.sv === "number" && principal.sessionVersion !== token.sv) return null;

      // Everything else is drift, not revocation: a demotion refreshes the
      // token in place rather than ejecting someone mid-sentence.
      token.role = principal.role;
      token.clientId = principal.clientId;
      token.isSuper = principal.isSuper;
      token.mustChangePassword = principal.mustChangePassword;
      if (isLocale(principal.locale)) token.locale = principal.locale;
      token.sv = principal.sessionVersion;
      token.cat = now;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as Role;
        session.user.locale = token.locale as Locale;
        session.user.clientId = (token.clientId as string | null) ?? null;
        session.user.isSuper = (token.isSuper as boolean | undefined) ?? false;
        session.user.mustChangePassword = (token.mustChangePassword as boolean | undefined) ?? false;
      }
      return session;
    },
  },
});
