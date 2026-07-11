"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateBranding } from "@/lib/branding";

const MAX_LOGO_BYTES = 150 * 1024;

export async function updateBrandingAction(formData: FormData): Promise<void> {
  const path = "/settings";
  try {
    // A selected file always wins: "remove + upload" reads as "replace".
    let logo: string | null | undefined;
    const file = formData.get("logo");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_LOGO_BYTES) throw new Error("logo-too-large");
      if (!["image/png", "image/jpeg"].includes(file.type)) throw new Error("invalid-logo-type");
      const buffer = Buffer.from(await file.arrayBuffer());
      logo = `data:${file.type};base64,${buffer.toString("base64")}`;
    } else if (formData.get("removeLogo") === "on") {
      logo = null;
    }
    await updateBranding({
      displayName: String(formData.get("displayName") ?? ""),
      accent: String(formData.get("resetAccent") === "on" ? "" : (formData.get("accent") ?? "")),
      logo,
      letterhead1: String(formData.get("letterhead1") ?? ""),
      letterhead2: String(formData.get("letterhead2") ?? ""),
      footer: String(formData.get("footer") ?? ""),
      engagementNaming: String(formData.get("engagementNaming") ?? ""),
    });
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath("/", "layout"); // theme + nav appear on every page
  redirect(`${path}?saved=1`);
}
