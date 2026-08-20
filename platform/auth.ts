import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { pool } from "@/lib/db";
import { isLocale, type Locale } from "@/lib/i18n";
import { isRole, type Role } from "@/lib/rbac";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  preferred_language: string;
  is_super: boolean;
  must_change_password: boolean;
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
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
          .toLowerCase()
          .trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const userResult = await pool.query<UserRow>(
          `SELECT id, email, name, password_hash, preferred_language,
                  coalesce(is_super, false) AS is_super,
                  coalesce(must_change_password, false) AS must_change_password
             FROM app_user WHERE lower(email) = $1`,
          [email],
        );
        const user = userResult.rows[0];
        if (!user) return null;

        const passwordOk = await bcrypt.compare(password, user.password_hash);
        if (!passwordOk) return null;

        // Resolve the user's tenant + firm role via their (first) membership.
        const membershipResult = await pool.query<MembershipRow>(
          "SELECT tenant_id, role, client_id FROM membership WHERE user_id = $1 ORDER BY created_at LIMIT 1",
          [user.id],
        );
        const membership = membershipResult.rows[0];
        if (!membership || !isRole(membership.role)) return null;

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
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.tenantId = user.tenantId;
        token.role = user.role;
        token.locale = user.locale;
        token.clientId = user.clientId ?? null;
        token.isSuper = user.isSuper ?? false;
        token.mustChangePassword = user.mustChangePassword ?? false;
      }
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
