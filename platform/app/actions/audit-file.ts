"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordActivity } from "@/lib/activity";
import { getBranding } from "@/lib/branding";
import { auth } from "@/auth";
import { createClient, isLegalForm, isSector, listClients } from "@/lib/clients";
import { canWrite } from "@/lib/rbac";
import { answersFromForm, applyNamingConvention, classifyComplexity } from "@/lib/complexity";
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
import { ForbiddenError } from "@/lib/tenant";

function docPath(documentId: string): string {
  return `/documents/${documentId}`;
}

/** The archive trigger's own message, when a write slips past the layer checks (UAT B42). */
const isArchivedError = (error: unknown): boolean =>
  error instanceof Error && (error.message === "archived" || /engagement-archived/.test(error.message));

/** Map a domain-rule violation to a localized banner instead of a 500 page. */
async function run(documentId: string, fn: () => Promise<void>): Promise<never> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof DocumentRuleError) {
      redirect(`${docPath(documentId)}?error=${encodeURIComponent(error.code)}`);
    }
    // Rank refusals (requires-manager, cannot-void-more-senior-signoff …) are
    // domain rules too, not faults: a banner, never the global error page.
    if (error instanceof ForbiddenError) {
      redirect(`${docPath(documentId)}?error=${encodeURIComponent(error.message)}`);
    }
    if (isArchivedError(error)) redirect(`${docPath(documentId)}?error=archived`);
    throw error;
  }
  revalidatePath(docPath(documentId));
  redirect(docPath(documentId));
}

/** Case- and whitespace-insensitive client name match. */
function sameClientName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function createClientAction(formData: FormData): Promise<void> {
  // A read-only account used to submit this form and land back on the
  // register with no client and no message (UAT B127).
  const session = await auth();
  if (!session?.user || !canWrite(session.user.role)) redirect("/clients?error=read-only-role");
  const name = String(formData.get("name") ?? "").trim();
  const legalFormRaw = String(formData.get("legalForm") ?? "SARL");
  const sectorRaw = String(formData.get("sector") ?? "");
  if (!name) redirect("/clients?error=name-required");
  // A second row with the same name is almost always a slip; the register
  // asks once, and creates only when the form says "create anyway".
  if (formData.get("force") !== "1") {
    const duplicate = (await listClients()).find((c) => sameClientName(c.name, name));
    if (duplicate) {
      redirect(`/clients?error=duplicate-client&name=${encodeURIComponent(name)}&legalForm=${encodeURIComponent(legalFormRaw)}`);
    }
  }
  const id = await createClient({
    name,
    legalForm: isLegalForm(legalFormRaw) ? legalFormRaw : "OTHER",
    listed: formData.get("listed") === "on",
    coCac: formData.get("coCac") === "on",
    sector: isSector(sectorRaw) ? sectorRaw : null,
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
  // The period end is entered on the wizard (defaulting to the client's
  // year-end, else 31 December); it was hard-coded to 31 December before.
  const periodEnd = String(formData.get("periodEnd") ?? "").trim() || `${fiscalYear}-12-31`;
  if (!clientName || !Number.isInteger(fiscalYear) || !isIsoDate(periodEnd)) {
    redirect(`/new-engagement?error=invalid-engagement`);
  }
  const matches = (await listClients()).filter((c) => sameClientName(c.name, clientName));
  // Two rows carry this name: the register must be cleaned up before the
  // wizard can know which entity the engagement belongs to.
  if (matches.length > 1) redirect(`/new-engagement?error=ambiguous-client`);
  const existing = matches[0];
  const legalFormRaw = String(formData.get("legalForm") ?? "SA");
  const clientId =
    existing?.id ??
    (await createClient({
      name: clientName,
      legalForm: isLegalForm(legalFormRaw) ? legalFormRaw : "SA",
      listed: false,
      coCac: false,
    }));
  // Scoping is deferred to the nature-of-entity screen (complexity: null → no
  // file items yet). The name follows the firm's convention (Settings).
  const naming = (await getBranding()).engagementNaming;
  let id: string;
  try {
    id = await createEngagement({
      clientId,
      fiscalYear,
      periodEnd,
      name: applyNamingConvention(naming, clientName, fiscalYear, { periodEnd, nature }),
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
  // A second (or later) year for the same client is a continuance, not a
  // first-year acceptance: P1.1 opens as "continuing", the file is not a first
  // audit, and the rolling-forward papers are carried from the prior year.
  const { priorYearEngagement } = await import("@/lib/engagement-dashboard");
  const prior = await priorYearEngagement(id);
  if (prior) {
    const { requireTenant } = await import("@/lib/tenant");
    const { withTenant } = await import("@/lib/db");
    const { carryForwardFromPriorYear } = await import("@/lib/forms");
    const { tenantId, userId } = await requireTenant();
    await withTenant(tenantId, async (tx) => {
      await tx.query("UPDATE engagement SET first_year = false WHERE id = $1", [id]);
      await tx.query(
        `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by)
         VALUES ($1, $2, 'P1.1', 'engagement_type', to_jsonb('continuing'::text), $3)
         ON CONFLICT (engagement_id, code, field_key) DO NOTHING`,
        [tenantId, id, userId],
      );
    });
    const carried = await carryForwardFromPriorYear(id).catch(() => 0);
    await recordActivity({
      engagementId: id,
      entityType: "engagement",
      entityId: id,
      action: "continuance",
      summary: `Continuing engagement: prior file FY${prior.fiscalYear} linked, ${carried} field(s) carried forward`,
      meta: { priorEngagementId: prior.id, carried },
    });
  }
  revalidatePath("/engagements");
  redirect(`/engagements/${id}/nature`);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Correct the period end while the file is still in acceptance or planning
 * (a wrong date discovered later is a new engagement, not an edit). The name
 * is regenerated from the firm's convention so it never states a stale date.
 */
export async function updatePeriodEndAction(engagementId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/settings`;
  const periodEnd = String(formData.get("periodEnd") ?? "").trim();
  if (!isIsoDate(periodEnd)) redirect(`${path}?error=invalid-engagement`);
  const { requireTenant } = await import("@/lib/tenant");
  const { withTenant } = await import("@/lib/db");
  const { canReview } = await import("@/lib/rbac");
  const { tenantId, role } = await requireTenant();
  if (!canReview(role)) redirect(`${path}?error=forbidden`);
  const naming = (await getBranding()).engagementNaming;
  const outcome = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ phase: string; client_name: string; fiscal_year: number; nature: string | null; period_end: string }>(
      `SELECT e.phase, c.name AS client_name, e.fiscal_year, e.nature, to_char(e.period_end, 'YYYY-MM-DD') AS period_end
         FROM engagement e JOIN client c ON c.id = e.client_id WHERE e.id = $1 FOR UPDATE OF e`,
      [engagementId],
    );
    const row = r.rows[0];
    if (!row) return "not-found";
    if (row.phase !== "acceptance" && row.phase !== "planning") return "wrong-phase";
    const name = applyNamingConvention(naming, row.client_name, row.fiscal_year, {
      periodEnd,
      nature: row.nature ?? "statutory_audit",
    });
    await tx.query("UPDATE engagement SET period_end = $2, name = $3 WHERE id = $1", [engagementId, periodEnd, name]);
    return row.period_end;
  });
  if (outcome === "not-found" || outcome === "wrong-phase") redirect(`${path}?error=${outcome}`);
  await recordActivity({
    engagementId,
    entityType: "engagement",
    entityId: engagementId,
    action: "period_end_changed",
    summary: `Period end changed to ${periodEnd}`,
    before: outcome,
    after: periodEnd,
  });
  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(path);
  redirect(`${path}?saved=1`);
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
 * the working paper if needed then signs it as preparer (hand-off); the R button
 * signs it as REVIEWER — the role the control is labelled with and the role the
 * activity entry records (they disagreed before: the button signed as partner
 * while the trail said reviewer). Partner sign-off, which the phase gates look
 * for, stays on the partner control of the document itself. Domain-rule
 * violations (preparer must sign first, self-review, open review notes, checked
 * out …) come back as a localized banner on the phase screen rather than a 500.
 */
async function signOffFromList(
  formData: FormData,
  role: "preparer" | "reviewer",
): Promise<never> {
  const fileItemId = String(formData.get("fileItemId") ?? "");
  const engagementId = String(formData.get("engagementId") ?? "");
  const phaseSlug = String(formData.get("phase") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");
  const back = returnTo.startsWith(`/engagements/${engagementId}/`)
    ? returnTo
    : `/engagements/${engagementId}/phases/${phaseSlug}`;
  const locale = await getLocale();
  // the tier signDocument actually recorded (a partner's R on a gated paper is "partner")
  let recorded: SignoffRole = role;
  let code = "";
  try {
    const documentId = await generateDocument(fileItemId, locale); // get-or-create
    recorded = await signDocument(documentId, role);
    const { requireTenant } = await import("@/lib/tenant");
    const { withTenant } = await import("@/lib/db");
    const { tenantId } = await requireTenant();
    code = await withTenant(tenantId, async (tx) => {
      const r = await tx.query<{ code: string }>("SELECT code FROM file_item WHERE id = $1", [fileItemId]);
      return r.rows[0]?.code ?? "";
    });
  } catch (error) {
    if (error instanceof DocumentRuleError) {
      redirect(`${back}?error=${encodeURIComponent(error.code)}`);
    }
    if (isArchivedError(error)) redirect(`${back}?error=archived`);
    throw error;
  }
  await recordActivity({
    engagementId,
    entityType: "file_item",
    entityId: fileItemId,
    // derived from the role actually recorded, so the trail cannot drift from it
    action: `${recorded}_signoff`,
    // the task code travels with the entry (UAT B62: list sign-offs named no task)
    summary: `${code ? `${code} ` : ""}signed off as ${recorded}`,
    after: { code, role: recorded },
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
  const { itemsForComplexity } = await import("@/lib/file-index");
  const { requireTenant } = await import("@/lib/tenant");
  const { withTenant } = await import("@/lib/db");
  const { canReview } = await import("@/lib/rbac");
  const group = GROUP_BY_ID[groupId];
  if (!engagementId || !group) redirect("/engagements");
  const { tenantId, role } = await requireTenant();
  if (!canReview(role)) redirect(back);
  await withTenant(tenantId, async (tx) => {
    // Only the items the entity's classification scopes in: adding a group
    // must never grow a very-simple file into a complex one's programme.
    const eng = await tx.query<{ complexity: "complex" | "non_complex" | "very_simple" | null }>(
      "SELECT complexity FROM engagement WHERE id = $1",
      [engagementId],
    );
    const inScope = itemsForComplexity(eng.rows[0]?.complexity ?? "complex");
    const max = await tx.query<{ m: string | null }>(
      "SELECT max(sort_order)::text AS m FROM file_item WHERE engagement_id = $1",
      [engagementId],
    );
    let sort = Number(max.rows[0]?.m ?? 0);
    for (const code of group.members) {
      const entry = inScope.find((e) => e.code === code);
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
  await signOffFromList(formData, "reviewer");
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
  await run(documentId, async () => {
    await signDocument(documentId, role);
  });
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
