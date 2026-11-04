"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ForbiddenError } from "@/lib/tenant";
import { TimeError, deleteTimeEntry, logTime } from "@/lib/time";

export async function logTimeAction(formData: FormData): Promise<void> {
  const engagementId = String(formData.get("engagementId") ?? "");
  const back = `/engagements/${engagementId}/time`;
  try {
    await logTime({
      engagementId,
      fileItemId: String(formData.get("fileItemId") ?? "") || null,
      date: String(formData.get("date") ?? ""),
      hours: Number(formData.get("hours")),
      note: String(formData.get("note") ?? ""),
    });
  } catch (error) {
    if (error instanceof TimeError) redirect(`${back}?error=${encodeURIComponent(error.code)}`);
    if (error instanceof ForbiddenError) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
    throw error;
  }
  revalidatePath(back);
  redirect(back);
}

export async function deleteTimeAction(formData: FormData): Promise<void> {
  const engagementId = String(formData.get("engagementId") ?? "");
  const back = `/engagements/${engagementId}/time`;
  try {
    await deleteTimeEntry(String(formData.get("id") ?? ""));
  } catch (error) {
    if (error instanceof ForbiddenError) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
    throw error;
  }
  revalidatePath(back);
  redirect(back);
}
