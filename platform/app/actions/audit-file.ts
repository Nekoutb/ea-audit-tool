"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordActivity } from "@/lib/activity";
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
      partnerId: String(formData.get("partnerId") ?? "") || null,
    });
  } catch (error) {
    // One statutory audit per client per fiscal year (unique constraint).
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "23505") {
      redirect(`/new-engagement?client=${clientId}&error=duplicate-engagement`);
    }
    throw error;
  }
  await recordActivity({
    engagementId: id,
    entityType: "engagement",
    entityId: id,
    action: "created",
    summary: `Engagement created (${level.replace("_", " ")})`,
  });
  revalidatePath("/engagements");
  redirect(`/engagements/${id}/dashboard`);
}

export async function generateDocumentAction(fileItemId: string): Promise<void> {
  const locale = await getLocale();
  const documentId = await generateDocument(fileItemId, locale);
  redirect(docPath(documentId));
}

/**
 * P / R sign-off buttons on the phase task list. The preparer button generates
 * the working paper if needed then signs it as preparer (hand-off); the reviewer
 * button signs it off as partner, which locks the paper. Domain-rule violations
 * (preparer must sign first, open review notes, checked out …) come back as a
 * localized banner on the phase screen rather than a 500.
 */
async function signOffFromList(
  formData: FormData,
  role: "preparer" | "partner",
): Promise<never> {
  const fileItemId = String(formData.get("fileItemId") ?? "");
  const engagementId = String(formData.get("engagementId") ?? "");
  const phaseSlug = String(formData.get("phase") ?? "");
  const back = `/engagements/${engagementId}/phases/${phaseSlug}`;
  const locale = await getLocale();
  try {
    const documentId = await generateDocument(fileItemId, locale); // get-or-create
    await signDocument(documentId, role);
  } catch (error) {
    if (error instanceof DocumentRuleError) {
      redirect(`${back}?error=${encodeURIComponent(error.code)}`);
    }
    throw error;
  }
  await recordActivity({
    engagementId,
    entityType: "file_item",
    entityId: fileItemId,
    action: role === "preparer" ? "preparer_signoff" : "reviewer_signoff",
    summary: role === "preparer" ? "Signed off as preparer" : "Signed off as reviewer",
  });
  revalidatePath(back);
  redirect(back);
}

/** Set / clear a task's due date (per-task deadlines). */
export async function setDueDateAction(formData: FormData): Promise<void> {
  const fileItemId = String(formData.get("fileItemId") ?? "");
  const engagementId = String(formData.get("engagementId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");
  const date = String(formData.get("dueDate") ?? "");
  const back = returnTo.startsWith("/engagements/") ? returnTo : "/engagements";
  if (!fileItemId || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) redirect(back);
  const { requireTenant } = await import("@/lib/tenant");
  const { withTenant } = await import("@/lib/db");
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query("UPDATE file_item SET due_date = $2 WHERE id = $1", [fileItemId, date || null]);
  });
  await recordActivity({
    engagementId,
    entityType: "file_item",
    entityId: fileItemId,
    action: "due_date_set",
    summary: date ? `Due date set to ${date}` : "Due date cleared",
  });
  revalidatePath(back);
  redirect(back);
}

export async function signOffPreparerAction(formData: FormData): Promise<void> {
  await signOffFromList(formData, "preparer");
}

export async function signOffReviewerAction(formData: FormData): Promise<void> {
  await signOffFromList(formData, "partner");
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
