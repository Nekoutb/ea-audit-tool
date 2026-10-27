"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setAllowedDomains } from "@/lib/email-domains";

/** Settings: the firm's allowed email domains for engagement-team invitations (F070). */
export async function setAllowedDomainsAction(formData: FormData): Promise<void> {
  try {
    await setAllowedDomains(String(formData.get("domains") ?? ""));
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`/settings?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath("/settings");
  redirect("/settings?saved=domains");
}
