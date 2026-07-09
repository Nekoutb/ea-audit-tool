import { auth } from "@/auth";
import type { Role } from "@/lib/rbac";

export interface TenantContext {
  tenantId: string;
  userId: string;
  role: Role;
}

/**
 * Resolve the authenticated user's tenant context, or throw if unauthenticated.
 * Every server-side data loader for tenant-scoped data starts here, then passes
 * `tenantId` to `withTenant()` so RLS constrains the queries.
 */
export async function requireTenant(): Promise<TenantContext> {
  const session = await auth();
  if (!session?.user?.tenantId || !session.user.id) {
    throw new Error("UNAUTHENTICATED: no active tenant");
  }
  return {
    tenantId: session.user.tenantId,
    userId: session.user.id,
    role: session.user.role,
  };
}
