import type { DefaultSession } from "next-auth";
import type { Locale } from "@/lib/i18n";
import type { Role } from "@/lib/rbac";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: Role;
      locale: Locale;
      /** Set only for role 'client_user' — the client the portal user belongs to. */
      clientId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    tenantId?: string;
    role?: Role;
    locale?: Locale;
    clientId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    tenantId?: string;
    role?: Role;
    locale?: Locale;
    clientId?: string | null;
  }
}
