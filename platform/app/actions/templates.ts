"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TemplateError, resetOverride, saveOverride } from "@/lib/template-overrides";

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

export async function saveTemplateAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "");
  try {
    await saveOverride({
      code,
      purposeEn: String(formData.get("purposeEn") ?? ""),
      purposeFr: String(formData.get("purposeFr") ?? ""),
      itemsEn: lines(formData.get("itemsEn")),
      itemsFr: lines(formData.get("itemsFr")),
    });
  } catch (error) {
    if (error instanceof TemplateError) {
      redirect(`/templates/${encodeURIComponent(code)}?error=${encodeURIComponent(error.code)}`);
    }
    throw error;
  }
  revalidatePath("/templates");
  redirect(`/templates?saved=${encodeURIComponent(code)}`);
}

export async function resetTemplateAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "");
  try {
    await resetOverride(code);
  } catch (error) {
    if (error instanceof TemplateError) {
      redirect(`/templates?error=${encodeURIComponent(error.code)}`);
    }
    throw error;
  }
  revalidatePath("/templates");
  redirect(`/templates?saved=${encodeURIComponent(code)}`);
}
