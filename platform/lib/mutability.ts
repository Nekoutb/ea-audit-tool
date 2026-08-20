// An archived engagement is a closed file: readable forever, writable never
// (ISA 230 ¶15-16).
//
// THE DATABASE IS THE AUTHORITY. Since
// migrations/20260820000002_archive_immutability.sql every evidence-bearing
// table carries a BEFORE INSERT/UPDATE/DELETE trigger that raises
// 'engagement-archived' when the row's engagement is archived, so a mutation
// path that forgets to call assertMutable is refused by Postgres rather than
// silently rewriting a closed file (assurance finding C3).
//
// assertMutable stays as defence in depth and, more practically, as the layer
// that produces a clean typed error the UI can translate: it runs BEFORE the
// work starts, so the user is told "this file is archived" instead of seeing a
// raw database exception halfway through a multi-statement action. Keep calling
// it at mutation chokepoints; never treat it as the only guard. The document
// layer carries its own copy of the check for its byte-level paths.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

/**
 * Thrown when a caller tries to write to an archived engagement.
 * The message is part of the contract — routes, actions and tests match on
 * "archived" (see tests/lib/conclusion.test.ts). Do not change it.
 */
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
