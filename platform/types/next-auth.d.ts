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
    } & DefaultSession["user"];
  }

  interface User {
    tenantId?: string;
    role?: Role;
    locale?: Locale;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    tenantId?: string;
    role?: Role;
    locale?: Locale;
  }
}
