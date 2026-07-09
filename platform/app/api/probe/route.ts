import { NextResponse } from "next/server";
import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

/**
 * Returns the current tenant's rls_probe notes. Deliberately derives the tenant
 * from the authenticated session (requireTenant) and NEVER from a client-supplied
 * parameter — so a crafted request like `/api/probe?tenantId=<other>` still only
 * ever returns the caller's own rows. Used by the cross-tenant isolation E2E test.
 */
export async function GET() {
  try {
    const { tenantId } = await requireTenant();
    const notes = await withTenant(tenantId, async (client) => {
      const result = await client.query<{ note: string }>(
        "SELECT note FROM rls_probe ORDER BY created_at",
      );
      return result.rows.map((row) => row.note);
    });
    return NextResponse.json({ tenantId, notes });
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
