import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { pool } from "@/lib/db";
import { isRole, type Role } from "@/lib/rbac";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
}

interface MembershipRow {
  tenant_id: string;
  role: Role;
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
          "SELECT id, email, name, password_hash FROM app_user WHERE lower(email) = $1",
          [email],
        );
        const user = userResult.rows[0];
        if (!user) return null;

        const passwordOk = await bcrypt.compare(password, user.password_hash);
        if (!passwordOk) return null;

        // Resolve the user's tenant + firm role via their (first) membership.
        const membershipResult = await pool.query<MembershipRow>(
          "SELECT tenant_id, role FROM membership WHERE user_id = $1 ORDER BY created_at LIMIT 1",
          [user.id],
        );
        const membership = membershipResult.rows[0];
        if (!membership || !isRole(membership.role)) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          tenantId: membership.tenant_id,
          role: membership.role,
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
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});
