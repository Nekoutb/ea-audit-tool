// Outbound email via MailerSend. Without MAILERSEND_API_KEY every send is a
// logged stub (dev and E2E stay quiet); with it, mail goes out from the sending
// firm's OWN address on the platform's single verified mail domain — the firm
// "ECA" writes to staff and third parties as eca@<MAIL_DOMAIN> — so audit
// correspondence carries the firm's identity rather than one shared platform
// address. The local part comes from the tenant (tenant.mail_local, sanitised);
// the DOMAIN is never tenant-supplied and always comes from MAIL_DOMAIN, so no
// firm can ever send from a domain the platform has not verified. When
// MAIL_REPLY_TO is set, replies flow back into the tool through
// /api/email/inbound (independence confirmations and external balance
// confirmations are matched by the [ref:…] token and logged with a timestamp).

export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
  /** inbound-matching token, e.g. IND-<token> or CONF-<token> — appended to the subject */
  tag?: string;
  /** sending firm's local part on MAIL_DOMAIN, e.g. "eca" (tenant.mail_local) */
  fromLocal?: string;
  /** display name of the sender, e.g. the firm name */
  fromName?: string;
}

const API = "https://api.mailersend.com/v1/email";

/** A mail local part is lowercase, dotted/dashed, at most 64 characters. */
export const MAIL_LOCAL_PATTERN = /^[a-z0-9._-]{1,64}$/;

/** Lowercase + validate a candidate local part; undefined when unusable. */
export function sanitiseMailLocal(value: string | null | undefined): string | undefined {
  const local = (value ?? "").trim().toLowerCase();
  return MAIL_LOCAL_PATTERN.test(local) ? local : undefined;
}

/**
 * The platform's own operational address, used for onboarding and account mail
 * — welcoming a firm, inviting someone to an engagement, anything about the
 * TOOL rather than about an audit.
 *
 * Deliberately distinct from a firm's own address: audit correspondence
 * (independence declarations, balance confirmations) must carry the firm's
 * identity because a third party is being asked to rely on it, whereas an
 * invitation is from the platform and a reply to it should reach support, not a
 * partner's confirmation inbox.
 */
export const PLATFORM_SUPPORT_LOCAL = "support";

/** From-fields for platform operational mail: support@<MAIL_DOMAIN>. */
export function platformSender(): { fromLocal: string; fromName: string } {
  return { fromLocal: PLATFORM_SUPPORT_LOCAL, fromName: process.env.MAIL_FROM_NAME?.trim() || "AuditISA" };
}

/** The single verified sending domain every firm's address sits on. */
export function mailDomain(): string {
  return (process.env.MAIL_DOMAIN ?? "").trim() || "auditisa.com";
}

/**
 * The From header for a send: the firm's own address when it has a valid local
 * part AND the platform has a verified MAIL_DOMAIN, otherwise the platform
 * default. The domain is env-only by design.
 */
export function resolveFrom(email: Pick<OutboundEmail, "fromLocal" | "fromName">): {
  email: string;
  name: string;
} {
  const local = sanitiseMailLocal(email.fromLocal);
  const domain = (process.env.MAIL_DOMAIN ?? "").trim();
  return {
    email: local && domain ? `${local}@${domain}` : (process.env.MAIL_FROM ?? "no-reply@auditisa.com"),
    name: (email.fromName ?? "").trim() || (process.env.MAIL_FROM_NAME ?? "AuditISA"),
  };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function sendEmail(email: OutboundEmail): void {
  const appUrl = (process.env.APP_URL ?? "https://www.auditisa.com").replace(/\/$/, "");
  // absolutize bare in-app paths so links work from a mail client
  const body = email.body.replace(/(^|[\s:])(\/(?:engagements|independence|login|documents)\/[^\s)]+)/g, (m, sp, path) => `${sp}${appUrl}${path}`);
  const subject = email.tag ? `${email.subject} [ref:${email.tag}]` : email.subject;
  const from = resolveFrom(email);

  const key = process.env.MAILERSEND_API_KEY;
  if (!key) {
    console.log(`[email:stub] from=${from.email} to=${email.to} subject="${subject}"`);
    return;
  }

  const replyTo = process.env.MAIL_REPLY_TO;
  const payload: Record<string, unknown> = {
    from: { email: from.email, name: from.name },
    to: [{ email: email.to }],
    subject,
    text: body,
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#1c1c1a;line-height:1.55"><p>${escapeHtml(body).replace(/\n/g, "<br>")}</p><p style="color:#8a8a86;font-size:12px">AuditISA — ${appUrl}</p></div>`,
  };
  if (replyTo) payload.reply_to = { email: replyTo };

  // fire-and-forget: a mail failure must never block the audit workflow
  void fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(async (r) => {
      if (!r.ok) console.error(`[email] MailerSend ${r.status}: ${(await r.text()).slice(0, 300)}`);
    })
    .catch((e) => console.error("[email] send failed:", e));
}
