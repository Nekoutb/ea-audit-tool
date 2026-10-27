// Inbound email ingestion (MailerSend inbound route → /api/email/inbound).
// Replies carry the [ref:…] token their outbound mail was stamped with:
//   IND-<token>  — RETIRED (F008, 2026-10-27): the in-app independence
//                  campaign was scrapped; a reply carrying an old token is
//                  no longer applied to the confirmation, which stays as it was.
//   CONF-<token> — a third party answering a balance confirmation: the amount
//                  (or agreement) is read from the reply and reconciled to the
//                  recorded balance — zero difference reconciles, else exception.
// The webhook has no session, so the token is resolved by scanning tenants
// (tenant is a global table; per-tenant reads stay under RLS via withTenant).

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
  // IND is the only reference stamped on outbound mail, and it is retired (F008).
  return { handled: null };
}
