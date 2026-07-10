// Independence confirmation campaigns (spec §4.2, IESBA Code). Each selected
// staff member gets a unique tokenized link to a structured questionnaire; any
// "yes" answer is an exception creating a threat-and-safeguard record that a
// partner must disposition before the engagement can be accepted.

import { randomBytes } from "node:crypto";
import { withTenant } from "@/lib/db";
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

/** Launch a campaign for the engagement, one confirmation per team user id. */
export async function launchCampaign(
  engagementId: string,
  userIds: string[],
): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  if (userIds.length === 0) throw new Error("no-recipients");
  return withTenant(tenantId, async (tx) => {
    const campaign = await tx.query<{ id: string }>(
      "INSERT INTO independence_campaign (tenant_id, engagement_id, created_by) VALUES ($1, $2, $3) RETURNING id",
      [tenantId, engagementId, userId],
    );
    const campaignId = campaign.rows[0].id;
    for (const recipient of userIds) {
      const token = randomBytes(24).toString("hex");
      await tx.query(
        `INSERT INTO independence_confirmation (tenant_id, campaign_id, user_id, token)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (campaign_id, user_id) DO NOTHING`,
        [tenantId, campaignId, recipient, token],
      );
      const email = await tx.query<{ email: string }>(
        "SELECT email FROM app_user WHERE id = $1",
        [recipient],
      );
      if (email.rows[0]) {
        sendEmail({
          to: email.rows[0].email,
          subject: "Independence confirmation required",
          body: `Complete your confirmation: /independence/${token}`,
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

/** Submit + e-sign a confirmation. Any "yes" → exception (partner disposition required). */
export async function submitConfirmation(
  token: string,
  answers: IndependenceAnswers,
  signatureName: string,
): Promise<"completed" | "exception"> {
  const { tenantId, userId } = await requireTenant();
  if (!signatureName.trim()) throw new Error("signature-required");
  const status = hasException(answers) ? "exception" : "completed";
  await withTenant(tenantId, async (tx) => {
    const updated = await tx.query(
      `UPDATE independence_confirmation
          SET answers = $2, signature_name = $3, signed_at = now(), status = $4
        WHERE token = $1 AND user_id = $5 AND status IN ('sent', 'opened')`,
      [token, JSON.stringify(answers), signatureName, status, userId],
    );
    if (updated.rowCount === 0) throw new Error("not-found");
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
      body: `Complete your confirmation: /independence/${target.token}`,
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
