// Email sending is stubbed for Build Phase 0 — outbound mail (per-firm identity,
// SPF/DKIM, delivery tracking) is wired in a later phase (master spec §13). For
// now every send is logged so the notification flow is observable end-to-end.

export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
}

export function sendEmail(email: OutboundEmail): void {
  console.log(`[email:stub] to=${email.to} subject="${email.subject}"`);
}
