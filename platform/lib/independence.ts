// Independence confirmations — READ-ONLY since F008 (2026-10-27).
//
// The firm scrapped the in-app independence campaign: declarations are now
// obtained outside the system, and the signed declarations are filed on the
// P2.1 working paper as attachments, which the partner signs. Nothing here
// issues, reminds, answers or dispositions a confirmation any more, and no
// gate waits on one.
//
// The independence_campaign / independence_confirmation tables and the rows
// already recorded in them are kept (no destructive migration): this module
// only reads them, so a file that ran a campaign before the change still
// shows what was received, as history.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export interface ConfirmationSummary {
  id: string;
  userId: string;
  userName: string;
  status: "sent" | "opened" | "completed" | "exception";
  signedAt: string | null;
  disposition: string | null;
}

/** Confirmations recorded by the retired campaign, for display as history. */
export async function listConfirmations(engagementId: string): Promise<ConfirmationSummary[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      user_id: string;
      user_name: string;
      status: ConfirmationSummary["status"];
      signed_at: string | null;
      disposition: string | null;
    }>(
      `SELECT ic.id, ic.user_id, coalesce(u.name, u.email) AS user_name, ic.status,
              to_char(ic.signed_at, 'YYYY-MM-DD HH24:MI') AS signed_at, ic.disposition
         FROM independence_confirmation ic
         JOIN independence_campaign c ON c.id = ic.campaign_id
         JOIN app_user u ON u.id = ic.user_id
        WHERE c.engagement_id = $1
        ORDER BY u.email`,
      [engagementId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      status: row.status,
      signedAt: row.signed_at,
      disposition: row.disposition,
    }));
  });
}
