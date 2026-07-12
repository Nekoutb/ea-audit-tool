"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, isLegalForm } from "@/lib/clients";
import { answersFromForm, classifyComplexity } from "@/lib/complexity";
import {
  addReviewNote,
  cancelCheckout,
  checkoutDocument,
  clearReviewNote,
  DocumentRuleError,
  generateDocument,
  reopenDocument,
  restoreVersion,
  signDocument,
  type SignoffRole,
} from "@/lib/documents";
import { createEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";

function docPath(documentId: string): string {
  return `/documents/${documentId}`;
}

/** Map a domain-rule violation to a localized banner instead of a 500 page. */
async function run(documentId: string, fn: () => Promise<void>): Promise<never> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof DocumentRuleError) {
      redirect(`${docPath(documentId)}?error=${encodeURIComponent(error.code)}`);
    }
    throw error;
  }
  revalidatePath(docPath(documentId));
  redirect(docPath(documentId));
}

export async function createClientAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const legalFormRaw = String(formData.get("legalForm") ?? "SARL");
  if (!name) redirect("/clients?error=name-required");
  const id = await createClient({
    name,
    legalForm: isLegalForm(legalFormRaw) ? legalFormRaw : "OTHER",
    listed: formData.get("listed") === "on",
    coCac: formData.get("coCac") === "on",
  });
  revalidatePath("/clients");
  redirect(`/clients/${id}`);
}

export async function createEngagementAction(formData: FormData): Promise<void> {
  const clientId = String(formData.get("clientId") ?? "");
  const fiscalYear = Number(formData.get("fiscalYear"));
  const periodEnd = String(formData.get("periodEnd") ?? "");
  if (!clientId || !Number.isInteger(fiscalYear) || !periodEnd) {
    redirect(`/new-engagement?error=invalid-engagement`);
  }
  // Complexity assessment (lib/complexity.ts): the server recomputes the
  // classification from the raw answers — never trusts a client-side result.
  const answers = answersFromForm((name) => formData.get(name));
  const { level } = classifyComplexity(answers);
  let id: string;
  try {
    id = await createEngagement({
      clientId,
      fiscalYear,
      periodEnd,
      name: String(formData.get("name") ?? ""),
      complexity: level,
      complexityAnswers: answers,
    });
  } catch (error) {
    // One statutory audit per client per fiscal year (unique constraint).
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "23505") {
      redirect(`/new-engagement?client=${clientId}&error=duplicate-engagement`);
    }
    throw error;
  }
  revalidatePath("/engagements");
  redirect(`/engagements/${id}/dashboard`);
}

export async function generateDocumentAction(fileItemId: string): Promise<void> {
  const locale = await getLocale();
  const documentId = await generateDocument(fileItemId, locale);
  redirect(docPath(documentId));
}

export async function checkoutAction(documentId: string): Promise<void> {
  await run(documentId, () => checkoutDocument(documentId));
}

export async function cancelCheckoutAction(documentId: string): Promise<void> {
  await run(documentId, () => cancelCheckout(documentId));
}

export async function restoreVersionAction(documentId: string, versionNo: number): Promise<void> {
  await run(documentId, async () => {
    await restoreVersion(documentId, versionNo);
  });
}

export async function signAction(documentId: string, role: SignoffRole): Promise<void> {
  await run(documentId, () => signDocument(documentId, role));
}

export async function reopenAction(documentId: string, formData: FormData): Promise<void> {
  const reason = String(formData.get("reason") ?? "");
  await run(documentId, () => reopenDocument(documentId, reason));
}

export async function addNoteAction(documentId: string, formData: FormData): Promise<void> {
  const body = String(formData.get("body") ?? "");
  await run(documentId, () => addReviewNote(documentId, body));
}

export async function clearNoteAction(
  documentId: string,
  noteId: string,
  formData: FormData,
): Promise<void> {
  const response = String(formData.get("response") ?? "");
  await run(documentId, () => clearReviewNote(noteId, response));
}
