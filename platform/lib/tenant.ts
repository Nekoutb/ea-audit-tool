import { auth } from "@/auth";
import { atLeast, canWrite, type Role } from "@/lib/rbac";

export interface TenantContext {
  tenantId: string;
  userId: string;
  role: Role;
}

/**
 * Authorization refusal, as distinct from "not signed in". Route handlers map it
 * to 403; server actions surface the code through their `guarded()` redirect,
 * which is why every message is a lowercase-hyphen token.
 */
export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Resolve the authenticated user's tenant context, or throw if unauthenticated.
 * Every server-side data loader for tenant-scoped data starts here, then passes
 * `tenantId` to `withTenant()` so RLS constrains the queries.
 *
 * Portal accounts are refused here. `client_user` sessions carry the FIRM's
 * tenant id — they have to, since the client belongs to the firm's tenant — so
 * tenant scoping alone does not separate them from the audit file, and RLS
 * cannot tell them apart either. Server Actions post to the URL of the page that
 * rendered them, so a portal user sits on a path the proxy allows and reaches
 * whatever action id they can name. This function is therefore the boundary, not
 * the proxy. The two functions the portal legitimately needs call
 * `requirePortalUser()` instead.
 */
export async function requireTenant(): Promise<TenantContext> {
  const ctx = await resolve();
  if (ctx.role === "client_user") throw new ForbiddenError("portal-account");
  return ctx;
}

/**
 * The portal's own entry point: a `client_user` and nothing else. Firm staff are
 * refused so a single function can never serve both surfaces by accident.
 */
export async function requirePortalUser(): Promise<TenantContext & { clientId: string }> {
  const session = await auth();
  const user = session?.user;
  if (!user?.tenantId || !user.id) throw new Error("UNAUTHENTICATED: no active tenant");
  if (user.role !== "client_user" || !user.clientId) throw new ForbiddenError("not-a-portal-account");
  return { tenantId: user.tenantId, userId: user.id, role: user.role, clientId: user.clientId };
}

/**
 * Context for an operation that changes something. `read_only` exists precisely
 * so a person can be given the file without being able to touch it; before this
 * it constrained nothing, because no mutation path consulted the role at all.
 */
export async function requireWrite(): Promise<TenantContext> {
  const ctx = await requireTenant();
  if (!canWrite(ctx.role)) throw new ForbiddenError("read-only-role");
  return ctx;
}

/** Context for an operation reserved to a rank — review, sign-off, archive, firm admin. */
export async function requireRole(min: Role): Promise<TenantContext> {
  const ctx = await requireWrite();
  if (!atLeast(ctx.role, min)) throw new ForbiddenError(`requires-${min.replace(/_/g, "-")}`);
  return ctx;
}

async function resolve(): Promise<TenantContext> {
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
