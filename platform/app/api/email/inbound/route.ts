import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ingestInboundEmail } from "@/lib/email-inbound";

/**
 * MailerSend inbound-route webhook. Configure the inbound route to POST here
 * with the header `x-inbound-secret: <EMAIL_INBOUND_SECRET>`. The secret is NOT
 * accepted from the query string: a URL lands in the Apache access log, in any
 * Referer, and in proxy logs — the same defect that was just removed from the
 * onboarding redirect. Replies to independence and balance
 * confirmations are matched by their [ref:…] token and logged with the
 * reply's timestamp; everything else is acknowledged and ignored.
 */
/** Length-independent comparison, so a wrong secret leaks nothing by timing. */
function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(request: Request) {
  const secret = process.env.EMAIL_INBOUND_SECRET;
  if (!secret) return NextResponse.json({ error: "inbound-disabled" }, { status: 503 });
  const given = request.headers.get("x-inbound-secret") ?? "";
  if (!constantTimeEquals(given, secret)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    // MailerSend wraps the message under `data`; accept a bare shape too.
    const data = (body.data ?? body) as Record<string, unknown>;
    const fromRaw = data.from as Record<string, unknown> | string | undefined;
    const from =
      typeof fromRaw === "string" ? fromRaw : String((fromRaw as Record<string, unknown>)?.email ?? "unknown");
    const subject = String(data.subject ?? "");
    const text = String(data.text ?? (data.raw as string | undefined) ?? "");
    const result = await ingestInboundEmail({ from, subject, text });
    return NextResponse.json(result);
  } catch {
    // a malformed webhook payload must not trigger retries forever
    return NextResponse.json({ handled: null });
  }
}
