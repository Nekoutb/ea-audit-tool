"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withTenant } from "@/lib/db";
import { carryForwardFromPriorYear, FORM_DEFINITIONS, saveForm, type FormValues } from "@/lib/forms";
import { advanceToPlanning, closePlanning, GateError, setSectionMaterial } from "@/lib/gates";
import { disposeException, launchCampaign, sendReminder, submitConfirmation, type IndependenceAnswers } from "@/lib/independence";
import { INDEPENDENCE_QUESTIONS } from "@/lib/independence";
import { generateLetter, type LetterKind } from "@/lib/letters";
import { approveMateriality, createMaterialityVersion, type Benchmark } from "@/lib/materiality";
import { addCustomStep, generateProgram } from "@/lib/programs";
import { dismissPotentialRisk, linkRiskToStep, mapRiskToSection, promotePotentialRisk, raisePotentialRisk, rebutRevenueFraudRisk, updateRisk, type Assertion, type RiskRating, type RiskStatus } from "@/lib/risks";
import { addPbcItem, assignTeamMember, removeTeamMember, setBudgetLine, setPbcStatus, type PbcItem, type TeamRole } from "@/lib/team";
import { getLocale } from "@/lib/locale";

/** Wrap a mutation: domain errors become ?error=<code> banners, not 500s. */
async function guarded(path: string, fn: () => Promise<void>): Promise<never> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof GateError) {
      redirect(`${path}?error=gates&failed=${encodeURIComponent(error.failed.join(","))}`);
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
  const path = `/engagements/${engagementId}/forms/${encodeURIComponent(code)}`;
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
  await guarded(path, () => saveForm(engagementId, code, values));
}

export async function carryForwardAction(engagementId: string): Promise<void> {
  const path = `/engagements/${engagementId}/planning`;
  await guarded(path, async () => {
    await carryForwardFromPriorYear(engagementId);
  });
}

export async function addRelatedPartyAction(engagementId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/forms/D5.6`;
  const name = String(formData.get("name") ?? "").trim();
  const relationship = String(formData.get("relationship") ?? "").trim();
  await guarded(path, async () => {
    if (!name || !relationship) throw new Error("fields-required");
    const { requireTenant } = await import("@/lib/tenant");
    const { tenantId } = await requireTenant();
    await withTenant(tenantId, async (tx) => {
      await tx.query(
        "INSERT INTO related_party (tenant_id, engagement_id, name, relationship, notes) VALUES ($1, $2, $3, $4, $5)",
        [tenantId, engagementId, name, relationship, String(formData.get("notes") ?? "") || null],
      );
    });
  });
}

export async function addEstimateAction(engagementId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/forms/D5.7`;
  const nature = String(formData.get("nature") ?? "").trim();
  await guarded(path, async () => {
    if (!nature) throw new Error("fields-required");
    const { requireTenant } = await import("@/lib/tenant");
    const { tenantId } = await requireTenant();
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
  for (const question of INDEPENDENCE_QUESTIONS) {
    answers[question.key] = formData.get(question.key) === "yes";
  }
  const signature = String(formData.get("signature") ?? "");
  try {
    await submitConfirmation(token, answers, signature);
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
  const locale = await getLocale();
  const documentId = await generateLetter(engagementId, kind, locale);
  redirect(`/documents/${documentId}`);
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
    const { requireTenant } = await import("@/lib/tenant");
    const { tenantId } = await requireTenant();
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

export async function setPbcStatusAction(
  engagementId: string,
  id: string,
  status: PbcItem["status"],
): Promise<void> {
  const path = `/engagements/${engagementId}/planning`;
  await guarded(path, () => setPbcStatus(id, status));
}

// ---- Materiality (2.9/2.10) ----

export async function createMaterialityAction(engagementId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/planning`;
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
      justification: String(formData.get("justification") ?? ""),
      performancePct: numberOr("performancePct", 75),
      performanceJustification: String(formData.get("performanceJustification") ?? "") || undefined,
      trivialPct: numberOr("trivialPct", 5),
    });
  });
}

export async function approveMaterialityAction(engagementId: string, versionNo: number): Promise<void> {
  const path = `/engagements/${engagementId}/planning`;
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
