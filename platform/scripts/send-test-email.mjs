// Send a real invitation-style email and REPORT WHAT MAILERSEND ACTUALLY SAID.
//
// The application's sendEmail() is fire-and-forget by design — a mail failure
// must never block an audit workflow — which means it cannot tell you whether a
// send succeeded. This script awaits the API response instead, so "sent" is a
// fact rather than an assumption.
//
//   node scripts/send-test-email.mjs someone@example.com [another@example.com]
//
// Reads MAILERSEND_API_KEY, MAIL_DOMAIN, MAIL_FROM_NAME and APP_URL from the
// environment (/opt/ea-audit/.env in production).

import { config } from "dotenv";

config();

const recipients = process.argv.slice(2).filter(Boolean);
if (recipients.length === 0) {
  console.error("usage: node scripts/send-test-email.mjs <to> [to...]");
  process.exit(1);
}

const key = process.env.MAILERSEND_API_KEY;
const domain = (process.env.MAIL_DOMAIN ?? "").trim();
const appUrl = (process.env.APP_URL ?? "https://www.auditisa.com").replace(/\/$/, "");
const fromName = process.env.MAIL_FROM_NAME?.trim() || "AuditISA";

console.log("configuration:");
console.log("  MAILERSEND_API_KEY :", key ? `set (${key.length} chars)` : "NOT SET — nothing can be sent");
console.log("  MAIL_DOMAIN        :", domain || "NOT SET — the From falls back to MAIL_FROM");
console.log("  APP_URL            :", appUrl);

if (!key) {
  console.error("\nRefusing to report a send that cannot happen: MAILERSEND_API_KEY is absent.");
  process.exit(2);
}
if (!domain) {
  console.error("\nRefusing to send: without MAIL_DOMAIN the From cannot be support@<domain>.");
  process.exit(2);
}

const from = { email: `support@${domain}`, name: fromName };
console.log("  From               :", `${from.name} <${from.email}>`);

const subject = "AuditISA — test invitation";
const body =
  "This is a test of the AuditISA onboarding email.\n\n" +
  "A real invitation looks like this:\n\n" +
  'You have been added to the engagement "ELIMELEC_DECEMBER 31 2025_STATUTORY AUDIT" as senior. ' +
  `Sign in and accept or decline it from the engagement dashboard: ${appUrl}/engagements/<id>/dashboard\n\n` +
  "Replies to this address reach support, not a partner's confirmation inbox.";

let failures = 0;
for (const to of recipients) {
  const payload = {
    from,
    to: [{ email: to }],
    subject,
    text: body,
    html:
      '<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#1c1c1a;line-height:1.55">' +
      `<p>${body.replace(/\n/g, "<br>")}</p>` +
      `<p style="color:#8a8a86;font-size:12px">AuditISA — ${appUrl}</p></div>`,
  };
  if (process.env.MAIL_REPLY_TO) payload.reply_to = { email: process.env.MAIL_REPLY_TO };

  process.stdout.write(`\nsending to ${to} ... `);
  try {
    const response = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    if (response.ok) {
      // MailerSend returns 202 with an x-message-id header and an empty body.
      console.log(`HTTP ${response.status} ACCEPTED  message-id=${response.headers.get("x-message-id") ?? "(none)"}`);
    } else {
      failures += 1;
      console.log(`HTTP ${response.status} REFUSED`);
      console.log("  response:", text.slice(0, 500) || "(empty)");
    }
  } catch (error) {
    failures += 1;
    console.log("FAILED");
    console.log("  ", error instanceof Error ? error.message : String(error));
  }
}

console.log(
  failures === 0
    ? `\nAll ${recipients.length} accepted by MailerSend. Acceptance is not delivery — check the inbox and the MailerSend activity log.`
    : `\n${failures} of ${recipients.length} were refused. Nothing above claims to have been delivered.`,
);
process.exit(failures === 0 ? 0 : 1);
