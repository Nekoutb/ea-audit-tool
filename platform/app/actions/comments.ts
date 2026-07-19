"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CommentError, addComment } from "@/lib/comments";

export async function addCommentAction(formData: FormData): Promise<void> {
  const engagementId = String(formData.get("engagementId") ?? "");
  const back = `/engagements/${engagementId}/discussion`;
  try {
    await addComment({
      engagementId,
      body: String(formData.get("body") ?? ""),
      parentId: String(formData.get("parentId") ?? "") || null,
    });
  } catch (error) {
    if (error instanceof CommentError) redirect(`${back}?error=${encodeURIComponent(error.code)}`);
    throw error;
  }
  revalidatePath(back);
  redirect(back);
}
