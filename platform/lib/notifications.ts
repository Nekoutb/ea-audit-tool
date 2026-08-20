import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  /** In-app destination for the notification, e.g. /engagements/<id>/sections/<itemId>. */
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  kind: string;
  title: string;
  body?: string;
  /** Where clicking the notification should land. Omit when there is no screen to open. */
  href?: string;
}

/**
 * Create an in-app notification for a user within a tenant. Runs inside the
 * tenant context so RLS applies. Notifications are in-app only — there is no
 * email channel; the bell and /notifications are the single delivery surface.
 * Callers already hold the tenantId (e.g. from an assignment they are making),
 * so it is passed in rather than re-derived.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await withTenant(input.tenantId, async (client) => {
    await client.query(
      "INSERT INTO notification (tenant_id, user_id, kind, title, body, href) VALUES ($1, $2, $3, $4, $5, $6)",
      [input.tenantId, input.userId, input.kind, input.title, input.body ?? null, input.href ?? null],
    );
  });
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** The signed-in user's notifications, newest first. */
export async function listMyNotifications(limit = 50): Promise<Notification[]> {
  const { tenantId, userId } = await requireTenant();
  const capped = Math.max(1, Math.min(200, Math.trunc(limit)));
  return withTenant(tenantId, async (client) => {
    const result = await client.query<NotificationRow>(
      `SELECT id, kind, title, body, href, read_at, created_at
         FROM notification
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [userId, capped],
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
