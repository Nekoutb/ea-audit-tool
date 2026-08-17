// Independence confirmation campaigns (spec §4.2, IESBA Code). Each selected
// staff member gets a unique tokenized link to a structured questionnaire; any
// "yes" answer is an exception creating a threat-and-safeguard record that a
// partner must disposition before the engagement can be accepted.

import { createHash, randomBytes } from "node:crypto";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { withTenant } from "@/lib/db";
import { DOCX_MIME } from "@/lib/documents";
import { sendEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { canPartnerSignoff } from "@/lib/rbac";
import { requireTenant } from "@/lib/tenant";

export interface IndependenceQuestion {
  key: string;
  labelEn: string;
  labelFr: string;
}

// IESBA-derived question set (spec §4.2). "Yes" to any = exception.
export const INDEPENDENCE_QUESTIONS: readonly IndependenceQuestion[] = [
  { key: "financial_interest", labelEn: "Do you (or close family) hold a financial interest in the client?", labelFr: "Détenez-vous (ou un proche) un intérêt financier chez le client ?" },
  { key: "family_relationship", labelEn: "Do you have family or close personal relationships with client management?", labelFr: "Avez-vous des liens familiaux ou personnels étroits avec la direction du client ?" },
  { key: "loans_guarantees", labelEn: "Do you have loans or guarantees to/from the client?", labelFr: "Avez-vous des prêts ou garanties avec le client ?" },
  { key: "business_relationship", labelEn: "Do you have business relationships with the client?", labelFr: "Avez-vous des relations d'affaires avec le client ?" },
  { key: "long_association", labelEn: "Have you served this client long enough to raise a familiarity threat (rotation)?", labelFr: "Votre ancienneté sur ce client crée-t-elle un risque de familiarité (rotation) ?" },
  { key: "gifts_hospitality", labelEn: "Have you accepted gifts or hospitality from the client beyond trivial value?", labelFr: "Avez-vous accepté des cadeaux ou invitations du client au-delà d'une valeur négligeable ?" },
] as const;

export type IndependenceAnswers = Record<string, boolean>;

export function hasException(answers: IndependenceAnswers): boolean {
  return INDEPENDENCE_QUESTIONS.some((q) => answers[q.key] === true);
}

export interface ConfirmationSummary {
  id: string;
  userId: string;
  userName: string;
  token: string;
  status: "sent" | "opened" | "completed" | "exception";
  reminderCount: number;
  signedAt: string | null;
  disposition: string | null;
}

/**
 * Launch (or extend) the engagement's campaign — one confirmation per user.
 * Re-launching reuses the existing campaign and only adds missing recipients,
 * so double-submits cannot create duplicate outstanding confirmations that
 * would block the acceptance gate forever. [Adversarial-review fix]
 */
export async function launchCampaign(
  engagementId: string,
  userIds: string[],
): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  if (userIds.length === 0) throw new Error("no-recipients");
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.query<{ id: string }>(
      "SELECT id FROM independence_campaign WHERE engagement_id = $1 ORDER BY created_at LIMIT 1 FOR UPDATE",
      [engagementId],
    );
    let campaignId = existing.rows[0]?.id;
    if (!campaignId) {
      const campaign = await tx.query<{ id: string }>(
        "INSERT INTO independence_campaign (tenant_id, engagement_id, created_by) VALUES ($1, $2, $3) RETURNING id",
        [tenantId, engagementId, userId],
      );
      campaignId = campaign.rows[0].id;
    }
    for (const recipient of userIds) {
      const token = randomBytes(24).toString("hex");
      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO independence_confirmation (tenant_id, campaign_id, user_id, token)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (campaign_id, user_id) DO NOTHING
         RETURNING id`,
        [tenantId, campaignId, recipient, token],
      );
      if (!inserted.rows[0]) continue; // already invited — no duplicate, no re-email
      const email = await tx.query<{ email: string }>(
        "SELECT email FROM app_user WHERE id = $1",
        [recipient],
      );
      if (email.rows[0]) {
        sendEmail({
          to: email.rows[0].email,
          subject: "Independence confirmation required",
          body: `Complete your confirmation: /independence/${token}\n\nOr simply REPLY to this email with "I CONFIRM my independence" — your reply is logged in the engagement file with its timestamp.`,
          tag: `IND-${token}`,
        });
      }
    }
    return campaignId;
  });
}

export async function listConfirmations(engagementId: string): Promise<ConfirmationSummary[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      user_id: string;
      user_name: string;
      token: string;
      status: ConfirmationSummary["status"];
      reminder_count: number;
      signed_at: string | null;
      disposition: string | null;
    }>(
      `SELECT ic.id, ic.user_id, coalesce(u.name, u.email) AS user_name, ic.token, ic.status,
              ic.reminder_count, to_char(ic.signed_at, 'YYYY-MM-DD HH24:MI') AS signed_at,
              ic.disposition
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
      token: row.token,
      status: row.status,
      reminderCount: row.reminder_count,
      signedAt: row.signed_at,
      disposition: row.disposition,
    }));
  });
}

/** Resolve a confirmation by token for the signed-in user (link is personal). */
export async function getMyConfirmation(token: string): Promise<{
  id: string;
  status: string;
  answers: IndependenceAnswers | null;
} | null> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string; status: string; answers: IndependenceAnswers | null; user_id: string }>(
      "SELECT id, status, answers, user_id FROM independence_confirmation WHERE token = $1",
      [token],
    );
    const row = result.rows[0];
    if (!row || row.user_id !== userId) return null;
    if (row.status === "sent") {
      await tx.query(
        "UPDATE independence_confirmation SET status = 'opened' WHERE id = $1 AND status = 'sent'",
        [row.id],
      );
    }
    return { id: row.id, status: row.status, answers: row.answers };
  });
}

async function confirmationArtifact(
  answers: IndependenceAnswers,
  signatureName: string,
  status: string,
): Promise<Buffer> {
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun("Independence confirmation / Confirmation d'indépendance")],
    }),
    ...INDEPENDENCE_QUESTIONS.map(
      (question) =>
        new Paragraph({
          children: [
            new TextRun({ text: `${question.labelEn} — ` }),
            new TextRun({ text: answers[question.key] ? "YES" : "NO", bold: true }),
          ],
        }),
    ),
    new Paragraph({ children: [new TextRun({ text: `Status: ${status}`, bold: true })] }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Electronically signed by ${signatureName} on ${new Date().toISOString().slice(0, 10)}`,
          italics: true,
        }),
      ],
    }),
  ];
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

/**
 * Submit + e-sign a confirmation. Any "yes" → exception (partner disposition
 * required). The signed confirmation is archived into P1.1 as a Word artifact
 * (spec §4.2). [Adversarial-review fix]
 */
export async function submitConfirmation(
  token: string,
  answers: IndependenceAnswers,
  signatureName: string,
): Promise<"completed" | "exception"> {
  const { tenantId, userId } = await requireTenant();
  if (!signatureName.trim()) throw new Error("signature-required");
  const status = hasException(answers) ? "exception" : "completed";
  await withTenant(tenantId, async (tx) => {
    const updated = await tx.query<{ engagement_id: string }>(
      `UPDATE independence_confirmation ic
          SET answers = $2, signature_name = $3, signed_at = now(), status = $4
         FROM independence_campaign c
        WHERE ic.token = $1 AND ic.user_id = $5 AND ic.status IN ('sent', 'opened')
          AND c.id = ic.campaign_id
        RETURNING c.engagement_id`,
      [token, JSON.stringify(answers), signatureName, status, userId],
    );
    if (updated.rowCount === 0) throw new Error("not-found");

    // Archive into P1.1 (kind='letter' so it never collides with the working paper).
    const engagementId = updated.rows[0].engagement_id;
    const item = await tx.query<{ id: string }>(
      "SELECT id FROM file_item WHERE engagement_id = $1 AND code = 'P1.1'",
      [engagementId],
    );
    if (item.rows[0]) {
      const content = await confirmationArtifact(answers, signatureName, status);
      const created = await tx.query<{ id: string }>(
        `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, kind, created_by, current_version)
         VALUES ($1, $2, $3, $4, 'en', 'letter', $5, 1) RETURNING id`,
        [tenantId, engagementId, item.rows[0].id, `Independence confirmation — ${signatureName}`, userId],
      );
      await tx.query(
        `INSERT INTO document_version
           (tenant_id, document_id, version_no, mime, byte_size, sha256, content, note, created_by)
         VALUES ($1, $2, 1, $3, $4, $5, $6, 'independence:archived', $7)`,
        [
          tenantId,
          created.rows[0].id,
          DOCX_MIME,
          content.length,
          createHash("sha256").update(content).digest("hex"),
          content,
          userId,
        ],
      );
    }
  });
  return status;
}

/** Partner disposition of an exception (threat-and-safeguard record). */
export async function disposeException(confirmationId: string, disposition: string): Promise<void> {
  const { tenantId, userId, role } = await requireTenant();
  if (!canPartnerSignoff(role)) throw new Error("forbidden");
  if (!disposition.trim()) throw new Error("disposition-required");
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `UPDATE independence_confirmation
          SET disposition = $2, disposition_by = $3, disposition_at = now()
        WHERE id = $1 AND status = 'exception'`,
      [confirmationId, disposition, userId],
    );
  });
}

/** Manual reminder (auto-cadence deferred until a scheduler exists — DECISIONS.md). */
export async function sendReminder(confirmationId: string): Promise<void> {
  const { tenantId } = await requireTenant();
  const target: { userId: string; email: string; token: string } | null = await withTenant(
    tenantId,
    async (tx) => {
      const result = await tx.query<{ user_id: string; email: string; token: string }>(
        `UPDATE independence_confirmation ic
            SET reminder_count = reminder_count + 1, last_reminder_at = now()
           FROM app_user u
          WHERE ic.id = $1 AND u.id = ic.user_id AND ic.status IN ('sent', 'opened')
          RETURNING ic.user_id, u.email, ic.token`,
        [confirmationId],
      );
      const row = result.rows[0];
      return row ? { userId: row.user_id, email: row.email, token: row.token } : null;
    },
  );
  if (target) {
    sendEmail({
      to: target.email,
      subject: "Reminder: independence confirmation outstanding",
      body: `Complete your confirmation: /independence/${target.token}\n\nOr simply REPLY to this email with "I CONFIRM my independence" — your reply is logged with its timestamp.`,
      tag: `IND-${target.token}`,
    });
    await createNotification({
      tenantId,
      userId: target.userId,
      kind: "independence-reminder",
      title: "Independence confirmation outstanding",
      body: "Please complete your independence confirmation.",
    });
  }
}

/**
 * The automatic 24-hour cadence: every confirmation still outstanding a day
 * after it was sent — and not reminded within the last day — gets an email and
 * an in-app notification. Idempotent per 24 hours; called when the campaign
 * status renders, so working the file keeps the reminders flowing without a
 * separate scheduler.
 */
export async function sendDueReminders(engagementId: string): Promise<number> {
  const { tenantId } = await requireTenant();
  const due = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ user_id: string; email: string; token: string }>(
      `UPDATE independence_confirmation ic
          SET reminder_count = ic.reminder_count + 1, last_reminder_at = now()
         FROM independence_campaign c, app_user u
        WHERE c.id = ic.campaign_id AND c.engagement_id = $1 AND u.id = ic.user_id
          AND ic.status IN ('sent', 'opened')
          AND ic.created_at < now() - interval '24 hours'
          AND (ic.last_reminder_at IS NULL OR ic.last_reminder_at < now() - interval '24 hours')
        RETURNING ic.user_id, u.email, ic.token`,
      [engagementId],
    );
    return r.rows;
  });
  for (const row of due) {
    sendEmail({
      to: row.email,
      subject: "Reminder: independence confirmation outstanding",
      body: `Your independence confirmation is still outstanding. Complete it: /independence/${row.token}\n\nOr simply REPLY to this email with "I CONFIRM my independence" — your reply is logged with its timestamp.`,
      tag: `IND-${row.token}`,
    });
    await createNotification({
      tenantId,
      userId: row.user_id,
      kind: "independence-reminder",
      title: "Independence confirmation outstanding",
      body: `Your confirmation is more than a day old. Complete it: /independence/${row.token}`,
    });
  }
  return due.length;
}
