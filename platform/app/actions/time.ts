"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
    throw error;
  }
  revalidatePath(back);
  redirect(back);
}

export async function deleteTimeAction(formData: FormData): Promise<void> {
  const engagementId = String(formData.get("engagementId") ?? "");
  await deleteTimeEntry(String(formData.get("id") ?? ""));
  const back = `/engagements/${engagementId}/time`;
  revalidatePath(back);
  redirect(back);
}
