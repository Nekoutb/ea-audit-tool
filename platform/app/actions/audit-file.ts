"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordActivity } from "@/lib/activity";
import { createClient, isLegalForm, listClients } from "@/lib/clients";
import { answersFromForm, classifyComplexity, generateEngagementName } from "@/lib/complexity";
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
import { applyComplexity, createEngagement } from "@/lib/engagements";
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
  // Three identity questions: the client name (typed — an existing client is
  // matched by name, a new name creates the entity), the fiscal year, and the
  // nature of the engagement (free text when "other").
  const clientName = String(formData.get("clientName") ?? "").trim();
  const fiscalYear = Number(formData.get("fiscalYear"));
  const natureChoice = String(formData.get("nature") ?? "statutory_audit");
  const natureText = String(formData.get("natureText") ?? "").trim();
  const nature = natureChoice === "other" && natureText ? natureText : natureChoice;
  if (!clientName || !Number.isInteger(fiscalYear)) {
    redirect(`/new-engagement?error=invalid-engagement`);
  }
  const existing = (await listClients()).find(
    (c) => c.name.trim().toLowerCase() === clientName.toLowerCase(),
  );
  const clientId =
    existing?.id ??
    (await createClient({ name: clientName, legalForm: "SA", listed: false, coCac: false }));
  // The period end defaults to December 31 of the fiscal year; the engagement
  // profile refines it later where it differs. Scoping is deferred to the
  // nature-of-entity screen (complexity: null → no file items yet).
  const periodEnd = `${fiscalYear}-12-31`;
  let id: string;
  try {
    id = await createEngagement({
      clientId,
      fiscalYear,
      periodEnd,
      name: generateEngagementName(clientName, "12-31", fiscalYear, nature),
      complexity: null,
      complexityAnswers: null,
      nature,
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
    summary: "Engagement created",
  });
  revalidatePath("/engagements");
  redirect(`/engagements/${id}/nature`);
}


/**
 * Nature-of-entity screen: recompute the classification from the raw answers
 * (never trusting the client-side preview), record it, and propagate the audit
 * file at the concluded level.
 */
export async function classifyEntityAction(engagementId: string, formData: FormData): Promise<void> {
  const answers = answersFromForm((name) => formData.get(name));
  const { level } = classifyComplexity(answers);
  await applyComplexity(engagementId, level, answers);
  await recordActivity({
    engagementId,
    entityType: "engagement",
    entityId: engagementId,
    action: "classified",
    summary: `Nature of entity concluded: ${level.replace("_", " ")}`,
  });
  revalidatePath(`/engagements/${engagementId}`);
  redirect(`/engagements/${engagementId}/team`);
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
  const returnTo = String(formData.get("returnTo") ?? "");
  const back = returnTo.startsWith(`/engagements/${engagementId}/`)
    ? returnTo
    : `/engagements/${engagementId}/phases/${phaseSlug}`;
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
  try {
    await withTenant(tenantId, async (tx) => {
      await tx.query("UPDATE file_item SET due_date = $2 WHERE id = $1", [fileItemId, date || null]);
    });
  } catch (error) {
    // 42703 = column doesn't exist yet (migration pending) — no-op until it runs.
    if ((error as { code?: string }).code === "42703") redirect(back);
    throw error;
  }
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

/**
 * Add a group's not-yet-instantiated tasks to an existing engagement — e.g.
 * the E2 (IT) tasks shipped after the engagement was created. Idempotent
 * (UNIQUE(engagement_id, code)); senior+ only.
 */
export async function instantiateGroupTasksAction(formData: FormData): Promise<void> {
  const engagementId = String(formData.get("engagementId") ?? "");
  const groupId = String(formData.get("group") ?? "");
  const back = `/engagements/${engagementId}/groups/${groupId}`;
  const { GROUP_BY_ID } = await import("@/lib/task-groups");
  const { DEFAULT_FILE_INDEX } = await import("@/lib/file-index");
  const { requireTenant } = await import("@/lib/tenant");
  const { withTenant } = await import("@/lib/db");
  const { canReview } = await import("@/lib/rbac");
  const group = GROUP_BY_ID[groupId];
  if (!engagementId || !group) redirect("/engagements");
  const { tenantId, role } = await requireTenant();
  if (!canReview(role)) redirect(back);
  await withTenant(tenantId, async (tx) => {
    const max = await tx.query<{ m: string | null }>(
      "SELECT max(sort_order)::text AS m FROM file_item WHERE engagement_id = $1",
      [engagementId],
    );
    let sort = Number(max.rows[0]?.m ?? 0);
    for (const code of group.members) {
      const entry = DEFAULT_FILE_INDEX.find((e) => e.code === code);
      if (!entry) continue;
      sort += 10;
      await tx.query(
        `INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (engagement_id, code) DO NOTHING`,
        [tenantId, engagementId, entry.code, entry.section, entry.titleEn, entry.titleFr, sort, entry.conditional ?? false],
      );
    }
  });
  await recordActivity({
    engagementId,
    entityType: "engagement",
    entityId: engagementId,
    action: "tasks_added",
    summary: `${group.code} tasks instantiated`,
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
