// Inbound email ingestion (MailerSend inbound route → /api/email/inbound).
// Replies carry the [ref:…] token their outbound mail was stamped with:
//   IND-<token>  — an engagement team member confirming independence by reply:
//                  the confirmation is completed with the reply's timestamp.
//   CONF-<token> — a third party answering a balance confirmation: the amount
//                  (or agreement) is read from the reply and reconciled to the
//                  recorded balance — zero difference reconciles, else exception.
// The webhook has no session, so the token is resolved by scanning tenants
// (tenant is a global table; per-tenant reads stay under RLS via withTenant).

import { pool, withTenant } from "@/lib/db";
import { parseAmount } from "@/lib/amount";

const REF = /\[ref:(IND)-([A-Za-z0-9_-]+)\]/;

/** The largest plausible monetary figure in a reply body. */
export function extractAmount(text: string): number | null {
  const matches = text.match(/\d[\d\s  .,]{2,}\d/g) ?? [];
  let best: number | null = null;
  for (const raw of matches) {
    const n = parseAmount(raw);
    if (n !== null && n > 0) best = best === null ? n : Math.max(best, n);
  }
  return best;
}

export async function ingestInboundEmail(input: {
  from: string;
  subject: string;
  text: string;
}): Promise<{ handled: string | null }> {
  const m = REF.exec(input.subject) ?? REF.exec(input.text);
  if (!m) return { handled: null };
  const kind = m[1];
  const token = m[2];

  const tenants = await pool.query<{ id: string }>("SELECT id FROM tenant ORDER BY created_at");
  for (const t of tenants.rows) {
    if (kind === "IND") {
      const done = await withTenant(t.id, async (tx) => {
        const r = await tx.query(
          `UPDATE independence_confirmation
              SET status = 'completed', signed_at = now(), signature_name = $2
            WHERE token = $1 AND status IN ('sent', 'opened')`,
          [token, `${input.from} (confirmed by email reply)`],
        );
        return (r.rowCount ?? 0) > 0;
      });
      if (done) return { handled: `independence:${token}` };
    }
  }
  return { handled: null };
}
