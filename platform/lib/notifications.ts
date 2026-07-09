import { withTenant } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { requireTenant } from "@/lib/tenant";

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  kind: string;
  title: string;
  body?: string;
  email?: string;
}

/**
 * Create an in-app notification for a user within a tenant. Runs inside the
 * tenant context so RLS applies. Also fires the (stubbed) email channel.
 * Callers already hold the tenantId (e.g. from an assignment they are making),
 * so it is passed in rather than re-derived.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await withTenant(input.tenantId, async (client) => {
    await client.query(
      "INSERT INTO notification (tenant_id, user_id, kind, title, body) VALUES ($1, $2, $3, $4, $5)",
      [input.tenantId, input.userId, input.kind, input.title, input.body ?? null],
    );
  });

  if (input.email) {
    sendEmail({ to: input.email, subject: input.title, body: input.body ?? "" });
  }
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** The signed-in user's notifications, newest first. */
export async function listMyNotifications(): Promise<Notification[]> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (client) => {
    const result = await client.query<NotificationRow>(
      `SELECT id, kind, title, body, read_at, created_at
         FROM notification
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [userId],
    );
    return result.rows.map(toNotification);
  });
}

/** Count of the signed-in user's unread notifications. */
export async function unreadCount(): Promise<number> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (client) => {
    const result = await client.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM notification WHERE user_id = $1 AND read_at IS NULL",
      [userId],
    );
    return Number(result.rows[0].n);
  });
}

/** Mark one of the signed-in user's notifications as read. */
export async function markNotificationRead(id: string): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (client) => {
    await client.query(
      "UPDATE notification SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL",
      [id, userId],
    );
  });
}
