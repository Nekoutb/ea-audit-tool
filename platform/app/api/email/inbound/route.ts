import { NextResponse } from "next/server";
import { ingestInboundEmail } from "@/lib/email-inbound";

/**
 * MailerSend inbound-route webhook. Configure the inbound route to POST here
 * with ?secret=<EMAIL_INBOUND_SECRET>. Replies to independence and balance
 * confirmations are matched by their [ref:…] token and logged with the
 * reply's timestamp; everything else is acknowledged and ignored.
 */
export async function POST(request: Request) {
  const secret = process.env.EMAIL_INBOUND_SECRET;
  if (!secret) return NextResponse.json({ error: "inbound-disabled" }, { status: 503 });
  const url = new URL(request.url);
  const given = url.searchParams.get("secret") ?? request.headers.get("x-inbound-secret");
  if (given !== secret) return NextResponse.json({ error: "forbidden" }, { status: 403 });

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
