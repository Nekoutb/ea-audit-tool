// An archived engagement is a closed file: readable forever, writable never
// (ISA 230 ¶15-16). Mutation chokepoints call this before touching data; the
// document layer carries its own copy of the check for its byte-level paths.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export class ArchivedError extends Error {
  constructor() {
    super("archived");
    this.name = "ArchivedError";
  }
}

/** Throws ArchivedError when the engagement has been archived. */
export async function assertMutable(engagementId: string): Promise<void> {
  const { tenantId } = await requireTenant();
  const archived = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ archived_at: string | null }>(
      "SELECT archived_at::text FROM engagement WHERE id = $1",
      [engagementId],
    );
    return r.rows[0]?.archived_at != null;
  });
  if (archived) throw new ArchivedError();
}
