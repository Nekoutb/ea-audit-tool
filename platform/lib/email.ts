// Outbound email via MailerSend. Without MAILERSEND_API_KEY every send is a
// logged stub (dev and E2E stay quiet); with it, mail goes out with the firm
// identity and, when MAIL_REPLY_TO is set, replies flow back into the tool
// through /api/email/inbound (independence confirmations and external balance
// confirmations are matched by the [ref:…] token and logged with a timestamp).

export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
  /** inbound-matching token, e.g. IND-<token> or CONF-<token> — appended to the subject */
  tag?: string;
}

const API = "https://api.mailersend.com/v1/email";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function sendEmail(email: OutboundEmail): void {
  const appUrl = (process.env.APP_URL ?? "https://www.auditisa.com").replace(/\/$/, "");
  // absolutize bare in-app paths so links work from a mail client
  const body = email.body.replace(/(^|[\s:])(\/(?:engagements|independence|login|documents)\/[^\s)]+)/g, (m, sp, path) => `${sp}${appUrl}${path}`);
  const subject = email.tag ? `${email.subject} [ref:${email.tag}]` : email.subject;

  const key = process.env.MAILERSEND_API_KEY;
  if (!key) {
    console.log(`[email:stub] to=${email.to} subject="${subject}"`);
    return;
  }

  const replyTo = process.env.MAIL_REPLY_TO;
  const payload: Record<string, unknown> = {
    from: {
      email: process.env.MAIL_FROM ?? "no-reply@auditisa.com",
      name: process.env.MAIL_FROM_NAME ?? "AuditISA",
    },
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
