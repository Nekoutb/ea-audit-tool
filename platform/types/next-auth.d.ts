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
      /** Platform operator (cross-firm admin console). */
      isSuper: boolean;
      /** Holding a system-generated temporary password; confined to /change-password. */
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    tenantId?: string;
    role?: Role;
    locale?: Locale;
    clientId?: string | null;
    isSuper?: boolean;
    mustChangePassword?: boolean;
    /** app_user.session_version at sign-in; a mismatch later kills the token. */
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    tenantId?: string;
    role?: Role;
    locale?: Locale;
    clientId?: string | null;
    isSuper?: boolean;
    mustChangePassword?: boolean;
    /** session_version the token was minted against */
    sv?: number;
    /** checked-at, epoch seconds — drives the staleness window */
    cat?: number;
  }
}
