"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addManualConfirmation,
  approveConfirmation,
  closeNoResponse,
  disposeReply,
  generateConfirmationLetter,
  generateSummaryWorkpaper,
  NEGATIVE_CONDITION_KEYS,
  recordAlternative,
  recordReply,
  remindConfirmation,
  selectFromDataset,
  sendConfirmation,
  type ConfirmationMethod,
  type ConfirmationSubject,
  type ConfirmationType,
  type NegativeConditionKey,
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
  await guarded(pagePath(engagementId), async () => {
    // A1 positive/negative designation with the ISA 505.15 gate: designating a
    // negative confirmation requires all four conditions to be affirmed.
    const method = (formData.get("method") === "negative" ? "negative" : "positive") as ConfirmationMethod;
    const rationale: Partial<Record<NegativeConditionKey, boolean>> = {};
    for (const key of NEGATIVE_CONDITION_KEYS) rationale[key] = formData.get(key) === "on";
    if (method === "negative" && !NEGATIVE_CONDITION_KEYS.every((key) => rationale[key])) {
      throw new Error("negative-conditions");
    }
    await addManualConfirmation({
      engagementId,
      fileItemId: String(formData.get("fileItemId") ?? ""),
      ctype: String(formData.get("ctype") ?? "bank") as ConfirmationType,
      subject: String(formData.get("subject") ?? "receivable") as ConfirmationSubject,
      method,
      methodRationale: method === "negative" ? rationale : null,
      partyName: String(formData.get("partyName") ?? ""),
      partyEmail: String(formData.get("partyEmail") ?? "") || undefined,
      bookAmount: formData.get("bookAmount") ? Number(formData.get("bookAmount")) : undefined,
    });
  });
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

/** A1 non-response escalation: close without reply or alternative — the page
 * derives the "possible scope limitation — ISA 705" chip from this state. */
export async function noResponseAction(engagementId: string, id: string): Promise<void> {
  await guarded(pagePath(engagementId), () => closeNoResponse(id));
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
