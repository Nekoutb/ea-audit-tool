"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { carryForwardFromPriorYear, FORM_DEFINITIONS, saveForm, type FormValues } from "@/lib/forms";
import { advanceToPlanning, closePlanning, GateError, setSectionMaterial } from "@/lib/gates";
import { disposeException, launchCampaign, sendReminder, submitConfirmation, type IndependenceAnswers } from "@/lib/independence";
import { INDEPENDENCE_QUESTIONS } from "@/lib/independence";
import { generateLetter, type LetterKind } from "@/lib/letters";
import { approveMateriality, createMaterialityVersion, type Benchmark } from "@/lib/materiality";
import { addCustomStep, generateProgram } from "@/lib/programs";
import { addRisk, dismissPotentialRisk, linkRiskToIndex, linkRiskToStep, mapRiskToSection, promotePotentialRisk, raisePotentialRisk, rebutRevenueFraudRisk, unlinkRiskFromIndex, updateRisk, type Assertion, type RiskRating, type RiskStatus } from "@/lib/risks";
import { canReview } from "@/lib/rbac";
import { savePaper, StaleEditConflict } from "@/lib/working-papers";
import { encodePaperDraft, paperDraftCookie } from "@/lib/paper-drafts";
import { addPbcItem, assignTask, assignTasks, assignTeamMember, removeTeamMember, setBudgetLine, type TaskAssignmentRole, type TeamRole } from "@/lib/team";
import { getLocale } from "@/lib/locale";

/** Wrap a mutation: domain errors become ?error=<code> banners, not 500s. */
async function guarded(path: string, fn: () => Promise<void>): Promise<never> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof GateError) {
      redirect(`${path}?error=gates&failed=${encodeURIComponent(error.failed.join(","))}`);
    }
    // the archive trigger's own message maps to the one banner the pages know
    if (error instanceof Error && /engagement-archived/.test(error.message)) {
      redirect(`${path}?error=archived`);
    }
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath(path);
  redirect(path);
}

// ---- Forms (2.1/2.11) ----

export async function saveFormAction(
  engagementId: string,
  code: string,
  formData: FormData,
): Promise<void> {
  const definition = FORM_DEFINITIONS[code];
  // A caller (e.g. the merged Planning considerations screen) may ask to land
  // back on itself; only same-engagement paths are honoured.
  const returnTo = String(formData.get("returnTo") ?? "");
  const path = returnTo.startsWith(`/engagements/${engagementId}/`)
    ? returnTo
    : `/engagements/${engagementId}/forms/${encodeURIComponent(code)}`;
  if (!definition) redirect(`/engagements/${engagementId}`);
  const values: FormValues = {};
  for (const field of definition.fields) {
    const raw = formData.get(field.key);
    if (field.type === "boolean") {
      // Booleans are yes/no selects: an unanswered field is NOT saved, so a
      // blank first save cannot mark required checks as answered.
      // [Adversarial-review fix]
      if (raw === "yes") values[field.key] = true;
      else if (raw === "no") values[field.key] = false;
    } else if (field.type === "number") {
      if (raw !== null && String(raw).trim() !== "") values[field.key] = Number(raw);
    } else if (raw !== null) values[field.key] = String(raw);
  }

  // "Save & hand off": save the fields, then generate the working paper (if
  // needed) and sign it off as preparer, landing back on the group task list.
  if (formData.get("handoff") === "1") {
    const { generateDocument, signDocument, DocumentRuleError } = await import("@/lib/documents");
    const { PHASE_SLUG_OF, phaseOfTask } = await import("@/lib/engagement-dashboard");
    const { groupOfTask } = await import("@/lib/task-groups");
    const { recordActivity } = await import("@/lib/activity");
    const { requireTenant } = await import("@/lib/tenant");
    const group = groupOfTask(code);
    const slug = PHASE_SLUG_OF[phaseOfTask("D", code)];
    const listPath = group
      ? `/engagements/${engagementId}/groups/${group.id}`
      : `/engagements/${engagementId}/phases/${slug}`;
    try {
      await saveForm(engagementId, code, values, String(formData.get("__revision") ?? "") || undefined);
      const { tenantId } = await requireTenant();
      const item = await withTenant(tenantId, async (tx) => {
        const r = await tx.query<{ id: string }>(
          "SELECT id FROM file_item WHERE engagement_id = $1 AND code = $2",
          [engagementId, code],
        );
        return r.rows[0] ?? null;
      });
      if (!item) throw new Error("not-found");
      const locale = await getLocale();
      const documentId = await generateDocument(item.id, locale);
      await signDocument(documentId, "preparer");
      await recordActivity({
        engagementId,
        entityType: "file_item",
        entityId: item.id,
        action: "preparer_signoff",
        summary: `${code} saved & handed off`,
      });
    } catch (error) {
      if (error instanceof DocumentRuleError || (error instanceof Error && /^[a-z0-9-]+$/.test(error.message))) {
        redirect(`${path}?error=${encodeURIComponent((error as Error).message)}`);
      }
      throw error;
    }
    revalidatePath(listPath);
    redirect(listPath);
  }

  const revision = String(formData.get("__revision") ?? "");
  await guarded(path, () => saveForm(engagementId, code, values, revision || undefined));
}

export async function carryForwardAction(engagementId: string): Promise<void> {
  const path = `/engagements/${engagementId}/planning`;
  await guarded(path, async () => {
    await carryForwardFromPriorYear(engagementId);
  });
}

export async function addRelatedPartyAction(engagementId: string, formData: FormData): Promise<void> {
  // The register is embedded on the working-paper screen as well as the legacy
  // form; returnTo brings each screen back to itself.
  const returnTo = String(formData.get("returnTo") ?? "");
  const path = returnTo.startsWith(`/engagements/${engagementId}/`)
    ? returnTo
    : `/engagements/${engagementId}/forms/S4.3`;
  const name = String(formData.get("name") ?? "").trim();
  const relationship = String(formData.get("relationship") ?? "").trim();
  await guarded(path, async () => {
    if (!name || !relationship) throw new Error("fields-required");
    const { requireWrite } = await import("@/lib/tenant");
    const { tenantId, userId, role } = await requireWrite();
    const { assertNotEqrWrite } = await import("@/lib/eqr");
    await assertNotEqrWrite(tenantId, engagementId, userId, role);
    await withTenant(tenantId, async (tx) => {
      await tx.query(
        "INSERT INTO related_party (tenant_id, engagement_id, name, relationship, notes) VALUES ($1, $2, $3, $4, $5)",
        [tenantId, engagementId, name, relationship, String(formData.get("notes") ?? "") || null],
      );
    });
  });
}

export async function addEstimateAction(engagementId: string, formData: FormData): Promise<void> {
  const returnTo = String(formData.get("returnTo") ?? "");
  const path = returnTo.startsWith(`/engagements/${engagementId}/`)
    ? returnTo
    : `/engagements/${engagementId}/forms/S4.4`;
  const nature = String(formData.get("nature") ?? "").trim();
  await guarded(path, async () => {
    if (!nature) throw new Error("fields-required");
    const { requireWrite } = await import("@/lib/tenant");
    const { tenantId, userId, role } = await requireWrite();
    const { assertNotEqrWrite } = await import("@/lib/eqr");
    await assertNotEqrWrite(tenantId, engagementId, userId, role);
    await withTenant(tenantId, async (tx) => {
      await tx.query(
        `INSERT INTO accounting_estimate (tenant_id, engagement_id, nature, method, assumptions, uncertainty, retro_review)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId,
          engagementId,
          nature,
          String(formData.get("method") ?? "") || null,
          String(formData.get("assumptions") ?? "") || null,
          String(formData.get("uncertainty") ?? "") || null,
          String(formData.get("retro_review") ?? "") || null,
        ],
      );
    });
  });
}

// ---- Independence (2.3/2.4) ----

export async function launchCampaignAction(engagementId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/acceptance`;
  const userIds = formData.getAll("userIds").map(String).filter(Boolean);
  await guarded(path, async () => {
    await launchCampaign(engagementId, userIds);
  });
}

export async function submitConfirmationAction(token: string, formData: FormData): Promise<void> {
  const answers: IndependenceAnswers = {};
  const explanations: Record<string, string> = {};
  for (const question of INDEPENDENCE_QUESTIONS) {
    answers[question.key] = formData.get(question.key) === "yes";
    const note = String(formData.get(`note_${question.key}`) ?? "").trim();
    if (note) explanations[question.key] = note;
  }
  const signature = String(formData.get("signature") ?? "");
  try {
    await submitConfirmation(token, answers, signature, explanations);
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`/independence/${token}?error=${error.message}`);
    }
    throw error;
  }
  redirect(`/independence/${token}?done=1`);
}

export async function disposeExceptionAction(
  engagementId: string,
  confirmationId: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/acceptance`;
  await guarded(path, () =>
    disposeException(confirmationId, String(formData.get("disposition") ?? "")),
  );
}

export async function sendReminderAction(engagementId: string, confirmationId: string): Promise<void> {
  const path = `/engagements/${engagementId}/acceptance`;
  await guarded(path, () => sendReminder(confirmationId));
}

// ---- Letters & mandate (2.5/2.6) ----

export async function generateLetterAction(engagementId: string, kind: LetterKind): Promise<void> {
  const path = `/engagements/${engagementId}/acceptance`;
  const locale = await getLocale();
  let documentId: string;
  try {
    // The letter is filed on a task of the audit file, and the file has no
    // tasks until the entity is classified (deferred scoping): say so instead
    // of failing on the missing item.
    const { getEngagement } = await import("@/lib/engagements");
    const engagement = await getEngagement(engagementId);
    if (!engagement) throw new Error("not-found");
    if (!engagement.complexity) throw new Error("classify-first");
    documentId = await generateLetter(engagementId, kind, locale);
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  redirect(`/documents/${documentId}`);
}

/**
 * Mark a task not applicable to this engagement, with the reason — or clear
 * that mark (clear=1). Reviewer rank and above; the archive gate
 * tasks_addressed accepts either performed work or this record.
 */
export async function markNotApplicableAction(
  engagementId: string,
  itemId: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/sections/${itemId}`;
  const reason = String(formData.get("naReason") ?? "").trim().slice(0, 500);
  const clear = formData.get("clear") === "1";
  await guarded(path, async () => {
    const { requireTenant } = await import("@/lib/tenant");
    const { assertMutable } = await import("@/lib/mutability");
    const { recordActivity } = await import("@/lib/activity");
    const { tenantId, userId, role } = await requireTenant();
    if (!canReview(role)) throw new Error("forbidden");
    // scoping the team's work in or out is not the independent reviewer's call (UAT run 2 B18)
    // ... firm-role or team-role EQR alike (UAT run 3 B03)
    const { actsAsEqr } = await import("@/lib/eqr");
    if (await actsAsEqr(tenantId, engagementId, userId, role)) throw new Error("eqr-read-only");
    if (!clear && !reason) throw new Error("rationale-required");
    await assertMutable(engagementId);
    const updated = await withTenant(tenantId, async (tx) => {
      const r = await tx.query<{ code: string }>(
        `UPDATE file_item
            SET na_reason = $3, na_by = $4, na_at = CASE WHEN $3::text IS NULL THEN NULL ELSE now() END
          WHERE id = $2 AND engagement_id = $1 RETURNING code`,
        [engagementId, itemId, clear ? null : reason, clear ? null : userId],
      );
      return r.rows[0] ?? null;
    });
    if (!updated) throw new Error("not-found");
    await recordActivity({
      engagementId,
      entityType: "file_item",
      entityId: itemId,
      action: clear ? "na_cleared" : "marked_not_applicable",
      summary: clear ? `${updated.code} no longer marked not applicable` : `${updated.code} marked not applicable: ${reason}`,
    });
  });
}

export async function setMandateAction(
  engagementId: string,
  clientId: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/acceptance`;
  const type = String(formData.get("mandateType") ?? "");
  const startYear = Number(formData.get("mandateStartYear"));
  await guarded(path, async () => {
    if (!["statutes", "ago"].includes(type) || !Number.isInteger(startYear)) {
      throw new Error("fields-required");
    }
    const { requireWrite } = await import("@/lib/tenant");
    const { tenantId } = await requireWrite();
    await withTenant(tenantId, async (tx) => {
      await tx.query("UPDATE client SET mandate_type = $2, mandate_start_year = $3 WHERE id = $1", [
        clientId,
        type,
        startYear,
      ]);
    });
  });
}

// ---- Team / budget / PBC (2.7) ----

export async function assignTeamAction(engagementId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/planning`;
  await guarded(path, () =>
    assignTeamMember(
      engagementId,
      String(formData.get("userId") ?? ""),
      String(formData.get("teamRole") ?? "staff") as TeamRole,
    ),
  );
}

export async function removeTeamAction(engagementId: string, userId: string): Promise<void> {
  const path = `/engagements/${engagementId}/planning`;
  await guarded(path, () => removeTeamMember(engagementId, userId));
}

/** Team-page variants of the two actions above (land back on /team). */
export async function assignTeamFromTeamPageAction(engagementId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/team`;
  await guarded(path, () =>
    assignTeamMember(
      engagementId,
      String(formData.get("userId") ?? ""),
      String(formData.get("teamRole") ?? "staff") as TeamRole,
    ),
  );
}

export async function removeTeamFromTeamPageAction(engagementId: string, userId: string): Promise<void> {
  const path = `/engagements/${engagementId}/team`;
  await guarded(path, () => removeTeamMember(engagementId, userId));
}

/**
 * Directly assign a task (file item) to a team member — or unassign with an
 * empty value. Same permission gate as team management (canReview); the target
 * must be a team_member row of the engagement (enforced in lib/team).
 */
export async function assignTaskAction(
  engagementId: string,
  itemId: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/sections/${itemId}`;
  const userIdOrNull = String(formData.get("assignee") ?? "").trim() || null;
  const session = await auth();
  try {
    if (!session?.user || !canReview(session.user.role)) throw new Error("forbidden");
    await assignTask(engagementId, itemId, userIdOrNull);
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath(`/engagements/${engagementId}/tasks`);
  revalidatePath(path);
  redirect(path);
}

/**
 * Assign a set of tasks — one form's task, or a whole phase — from the Forms
 * tool. Same permission gate as direct task assignment (canReview); lands back
 * on the Forms page rather than the section.
 */
export async function assignFormsTasksAction(
  engagementId: string,
  itemIds: string[],
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/tools/forms`;
  const userIdOrNull = String(formData.get("assignee") ?? "").trim() || null;
  const rawRole = String(formData.get("role") ?? "assignee");
  const role: TaskAssignmentRole =
    rawRole === "preparer" || rawRole === "approver" ? rawRole : "assignee";
  const session = await auth();
  let assigned = 0;
  try {
    if (!session?.user || !canReview(session.user.role)) throw new Error("forbidden");
    assigned = await assignTasks(engagementId, itemIds, userIdOrNull, role);
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath(path);
  revalidatePath(`/engagements/${engagementId}/tasks`);
  redirect(`${path}?assigned=${assigned}`);
}

export async function setBudgetAction(engagementId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/planning`;
  await guarded(path, () =>
    setBudgetLine(engagementId, String(formData.get("grade") ?? ""), Number(formData.get("hours"))),
  );
}

export async function addPbcAction(engagementId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/planning`;
  await guarded(path, () => addPbcItem(engagementId, String(formData.get("title") ?? "")));
}

// setPbcStatusAction is gone (UAT B09): a request's status moves only through
// the client's upload and the reviewer's acceptance on /pbc.

// ---- Materiality (2.9/2.10) ----

export async function createMaterialityAction(engagementId: string, formData: FormData): Promise<void> {
  const returnTo = String(formData.get("returnTo") ?? "");
  const path = returnTo.startsWith(`/engagements/${engagementId}/`) ? returnTo : `/engagements/${engagementId}/planning`;
  // Cleared optional inputs fall back to their defaults instead of becoming 0
  // (which would trip DB CHECK constraints). [Adversarial-review fix]
  const numberOr = (key: string, fallback: number): number => {
    const raw = String(formData.get(key) ?? "").trim();
    return raw === "" ? fallback : Number(raw);
  };
  await guarded(path, async () => {
    await createMaterialityVersion(engagementId, {
      benchmark: String(formData.get("benchmark") ?? "revenue") as Benchmark,
      benchmarkAmount: numberOr("benchmarkAmount", NaN),
      percentage: numberOr("percentage", NaN),
      justification: String(formData.get("justification") || "Documented in P6.1") || "Documented in P6.1",
      performancePct: numberOr("performancePct", 75),
      performanceJustification: String(formData.get("performanceJustification") ?? "") || undefined,
      trivialPct: numberOr("trivialPct", 5),
      overrideJustification: String(formData.get("overrideJustification") ?? "") || undefined,
    });
  });
}

export async function approveMaterialityAction(engagementId: string, versionNo: number, formData?: FormData): Promise<void> {
  const returnTo = String(formData?.get("returnTo") ?? "");
  const path = returnTo.startsWith(`/engagements/${engagementId}/`) ? returnTo : `/engagements/${engagementId}/planning`;
  await guarded(path, () => approveMateriality(engagementId, versionNo));
}

// ---- Risks (2.12) ----

export async function raiseRiskAction(
  engagementId: string,
  sourceCode: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/forms/${encodeURIComponent(sourceCode)}`;
  await guarded(path, () =>
    raisePotentialRisk(engagementId, String(formData.get("description") ?? ""), sourceCode),
  );
}

export async function dismissPotentialAction(
  engagementId: string,
  id: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/risks`;
  await guarded(path, () => dismissPotentialRisk(id, String(formData.get("rationale") ?? "")));
}

export async function promotePotentialAction(engagementId: string, id: string): Promise<void> {
  const path = `/engagements/${engagementId}/risks`;
  await guarded(path, async () => {
    await promotePotentialRisk(id);
  });
}

export async function updateRiskAction(engagementId: string, riskId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/risks`;
  // Checkbox fields only update when their marker field was submitted with the
  // form — an absent checkbox never silently overwrites to false.
  // [Adversarial-review fix]
  const checkbox = (key: string): boolean | undefined =>
    formData.has(`${key}_present`) ? formData.get(key) === "on" : undefined;
  await guarded(path, () =>
    updateRisk(riskId, {
      likelihood: String(formData.get("likelihood") ?? "medium") as RiskRating,
      magnitude: String(formData.get("magnitude") ?? "medium") as RiskRating,
      significant: checkbox("significant"),
      controlsReliance: checkbox("controlsReliance"),
      status: (formData.get("status") ? String(formData.get("status")) : undefined) as RiskStatus | undefined,
      category: (() => {
        const raw = formData.get("category");
        if (raw === null) return undefined;
        const value = String(raw);
        return value === "business" || value === "fraud" || value === "error" ? value : null;
      })(),
      // factor checkboxes only update when their marker field travelled with the form
      inherentFactors: formData.has("factors_present")
        ? formData.getAll("factors").map(String).filter((f) => ["complexity", "subjectivity", "change", "uncertainty", "bias"].includes(f))
        : undefined,
      fsNote: formData.has("fsNote") ? String(formData.get("fsNote") ?? "") : undefined,
    }),
  );
}

export async function mapRiskAction(engagementId: string, riskId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/risks`;
  const fileItemId = String(formData.get("fileItemId") ?? "");
  const assertions = formData.getAll("assertions").map(String) as Assertion[];
  await guarded(path, () => mapRiskToSection(riskId, fileItemId, assertions));
}

export async function rebutRiskAction(engagementId: string, riskId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/risks`;
  await guarded(path, () => rebutRevenueFraudRisk(riskId, String(formData.get("justification") ?? "")));
}

export async function linkRiskStepAction(
  engagementId: string,
  fileItemId: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/sections/${fileItemId}`;
  await guarded(path, () =>
    linkRiskToStep(String(formData.get("riskId") ?? ""), String(formData.get("stepId") ?? "")),
  );
}

// ---- Programs (2.14) ----

export async function generateProgramAction(engagementId: string, fileItemId: string): Promise<void> {
  const path = `/engagements/${engagementId}/sections/${fileItemId}`;
  const locale = await getLocale();
  await guarded(path, async () => {
    await generateProgram(fileItemId, locale);
  });
}

export async function addStepAction(
  engagementId: string,
  fileItemId: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/sections/${fileItemId}`;
  const assertions = formData.getAll("assertions").map(String) as Assertion[];
  await guarded(path, () =>
    addCustomStep(fileItemId, String(formData.get("description") ?? ""), assertions),
  );
}

// ---- Gates & phase transitions (2.2/2.13) ----

export async function advanceToPlanningAction(engagementId: string): Promise<void> {
  await guarded(`/engagements/${engagementId}/acceptance`, () => advanceToPlanning(engagementId));
}

export async function closePlanningAction(engagementId: string): Promise<void> {
  await guarded(`/engagements/${engagementId}/planning`, () => closePlanning(engagementId));
}

export async function setMaterialAction(
  engagementId: string,
  fileItemId: string,
  material: boolean,
): Promise<void> {
  await guarded(`/engagements/${engagementId}/planning`, () =>
    setSectionMaterial(fileItemId, material),
  );
}

// ---- Working papers (one per task, console design) ----

export async function savePaperAction(
  engagementId: string,
  itemId: string,
  code: string,
  formData: FormData,
): Promise<void> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  // The version the form was rendered from (UAT run 2 B05): a colleague's save
  // in between refuses this one ("stale-edit") instead of blanking their fields.
  const baseVersion = values.__baseVersion;
  delete values.__baseVersion;
  // The digests of the values the form was built on (UAT run 3
  // firm.perf-concurrent): a colleague's save in between then refuses only a
  // field both people changed, and the user's text for it is kept for them.
  let baseDigests: Record<string, string> | undefined;
  try {
    const parsed: unknown = values.__baseDigests ? JSON.parse(values.__baseDigests) : undefined;
    if (parsed && typeof parsed === "object") baseDigests = parsed as Record<string, string>;
  } catch {
    baseDigests = undefined;
  }
  delete values.__baseDigests;
  const path = `/engagements/${engagementId}/sections/${itemId}`;
  await guarded(path, async () => {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const cookieName = paperDraftCookie(itemId);
    try {
      await savePaper(engagementId, code, values, baseVersion, baseDigests);
    } catch (error) {
      if (error instanceof StaleEditConflict) {
        jar.set(cookieName, encodePaperDraft(error.drafts).value, {
          path,
          maxAge: 60 * 30,
          httpOnly: true,
          sameSite: "lax",
        });
      }
      throw error;
    }
    if (jar.get(cookieName)) jar.delete({ name: cookieName, path });
  });
}

/** Risk Console: decide a computed lead — promote into the register or dismiss. */
/** Risk Console: a risk the auditor identifies and documents by hand. */
export async function addRiskAction(engagementId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/risks`;
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const category = text("category");
  const level = text("level");
  await guarded(path, async () => {
    await addRisk(engagementId, {
      description: text("description"),
      source: text("source") || undefined,
      category: category === "fraud" || category === "error" ? category : "business",
      level: level === "fs" ? "fs" : "assertion",
      likelihood: text("likelihood") as RiskRating,
      magnitude: text("magnitude") as RiskRating,
      significant: formData.get("significant") === "on",
      factors: formData.getAll("factors").map(String),
      index: text("indexCode") || undefined,
      assertions: formData.getAll("linkAssertions").map(String),
      managementMissed: text("managementMissed") || undefined,
      fsNote: text("fsNote") || undefined,
    });
  });
}

/** Risk Console: link a risk to a lead-schedule index with threatened assertions. */
export async function linkRiskIndexAction(engagementId: string, riskId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/risks`;
  const indexCode = String(formData.get("indexCode") ?? "");
  const assertions = formData.getAll("linkAssertions").map(String);
  await guarded(path, () => linkRiskToIndex(riskId, indexCode, assertions));
}

export async function unlinkRiskIndexAction(engagementId: string, riskId: string, indexCode: string): Promise<void> {
  const path = `/engagements/${engagementId}/risks`;
  await guarded(path, () => unlinkRiskFromIndex(riskId, indexCode));
}
