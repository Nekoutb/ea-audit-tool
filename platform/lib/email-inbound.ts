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

const REF = /\[ref:(IND|CONF)-([A-Za-z0-9_-]+)\]/;

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
    } else {
      const result = await withTenant(t.id, async (tx) => {
        const row = await tx.query<{ id: string; book_amount: string | null }>(
          "SELECT id, book_amount::text FROM confirmation WHERE reply_token = $1 AND status = 'sent' FOR UPDATE",
          [token],
        );
        if (!row.rows[0]) return null;
        const { id } = row.rows[0];
        const book = row.rows[0].book_amount === null ? 0 : Number(row.rows[0].book_amount);
        // closed-form agreement ("we agree / conforme") confirms the stated
        // balance; otherwise the reply's amount is taken (open / blank form)
        const disagrees = /\b(disagree|do not agree|not agree|pas d'accord|non conforme|incorrect)\b/i.test(input.text);
        const agrees = !disagrees && /\b(agree|agreed|confirm|confirmed|conforme|d'accord|exact)\b/i.test(input.text);
        const amount = agrees && book !== 0 ? book : extractAmount(input.text);
        if (amount === null) {
          await tx.query(
            "UPDATE confirmation SET status = 'exception', replied_at = now() WHERE id = $1",
            [id],
          );
          return "exception:unparsed";
        }
        const difference = Math.round(amount - book);
        const status = difference === 0 ? "reconciled" : "exception";
        await tx.query(
          `UPDATE confirmation
              SET status = $2, replied_at = now(), confirmed_amount = $3, difference = $4
            WHERE id = $1`,
          [id, status, Math.round(amount), difference],
        );
        return status;
      });
      if (result) return { handled: `confirmation:${token}:${result}` };
    }
  }
  return { handled: null };
}
