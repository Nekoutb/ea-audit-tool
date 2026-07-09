"use server";

import { revalidatePath } from "next/cache";
import { createNotification, markNotificationRead } from "@/lib/notifications";
import { requireTenant } from "@/lib/tenant";

/**
 * Dev-only helper to prove the notification pipeline end-to-end: creates a
 * notification addressed to the current user only. Replaced by real triggers
 * (assignments, review notes, deadlines) in later phases.
 */
export async function sendTestNotification(): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  await createNotification({
    tenantId,
    userId,
    kind: "system",
    title: "Test notification",
    body: "This is a test of the in-app notification service.",
  });
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markRead(id: string): Promise<void> {
  await markNotificationRead(id);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
