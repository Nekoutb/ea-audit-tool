"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addManualConfirmation,
  approveConfirmation,
  disposeReply,
  generateConfirmationLetter,
  generateSummaryWorkpaper,
  recordAlternative,
  recordReply,
  remindConfirmation,
  selectFromDataset,
  sendConfirmation,
  type ConfirmationType,
} from "@/lib/confirmations";
import { getLocale } from "@/lib/locale";

async function guarded(path: string, fn: () => Promise<string | void>): Promise<never> {
  let target = path;
  try {
    const result = await fn();
    if (typeof result === "string") target = result;
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath(path);
  redirect(target);
}

const pagePath = (engagementId: string): string => `/engagements/${engagementId}/confirmations`;

export async function selectConfirmationsAction(
  engagementId: string,
  formData: FormData,
): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    await selectFromDataset({
      engagementId,
      fileItemId: String(formData.get("fileItemId") ?? ""),
      datasetId: String(formData.get("datasetId") ?? ""),
      ctype: String(formData.get("ctype") ?? "ar_positive") as ConfirmationType,
      threshold: formData.get("threshold") ? Number(formData.get("threshold")) : undefined,
      topN: formData.get("topN") ? Number(formData.get("topN")) : undefined,
      includeNil: formData.get("includeNil") === "on",
    });
  });
}

export async function addManualAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), () =>
    addManualConfirmation({
      engagementId,
      fileItemId: String(formData.get("fileItemId") ?? ""),
      ctype: String(formData.get("ctype") ?? "bank") as ConfirmationType,
      partyName: String(formData.get("partyName") ?? ""),
      partyEmail: String(formData.get("partyEmail") ?? "") || undefined,
      bookAmount: formData.get("bookAmount") ? Number(formData.get("bookAmount")) : undefined,
    }),
  );
}

export async function generateLetterForAction(engagementId: string, id: string): Promise<void> {
  const locale = await getLocale();
  await guarded(pagePath(engagementId), async () => {
    const documentId = await generateConfirmationLetter(id, locale);
    return `/documents/${documentId}`;
  });
}

export async function approveAction(engagementId: string, id: string): Promise<void> {
  await guarded(pagePath(engagementId), () => approveConfirmation(id));
}

export async function sendAction(engagementId: string, id: string): Promise<void> {
  await guarded(pagePath(engagementId), () => sendConfirmation(id));
}

export async function remindAction(engagementId: string, id: string): Promise<void> {
  await guarded(pagePath(engagementId), () => remindConfirmation(id));
}

export async function replyAction(engagementId: string, id: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    await recordReply(id, Number(formData.get("confirmedAmount") ?? 0));
  });
}

export async function disposeAction(engagementId: string, id: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), () =>
    disposeReply(id, String(formData.get("disposition") ?? "timing") as "timing" | "client_error" | "confirmee_error"),
  );
}

export async function alternativeAction(engagementId: string, id: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), () =>
    recordAlternative(id, String(formData.get("procedure") ?? "")),
  );
}

export async function summaryAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    const documentId = await generateSummaryWorkpaper(engagementId, String(formData.get("fileItemId") ?? ""));
    return `/documents/${documentId}`;
  });
}
