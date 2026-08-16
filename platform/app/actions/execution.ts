"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  approveRiskAddition,
  clearFinding,
  completeStep,
  markStepNa,
  recordControlTest,
  reviewSectionConclusion,
  routeFinding,
  saveSectionConclusion,
  setMisstatementCorrected,
  type FindingRoute,
} from "@/lib/execution";

async function guarded(path: string, fn: () => Promise<void>): Promise<never> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath(path);
  redirect(path);
}

const sectionPath = (engagementId: string, fileItemId: string): string =>
  `/engagements/${engagementId}/sections/${fileItemId}`;

export async function completeStepAction(
  engagementId: string,
  fileItemId: string,
  stepId: string,
  formData: FormData,
): Promise<void> {
  await guarded(sectionPath(engagementId, fileItemId), () =>
    completeStep(stepId, String(formData.get("conclusion") ?? "")),
  );
}

export async function markStepNaAction(
  engagementId: string,
  fileItemId: string,
  stepId: string,
  formData: FormData,
): Promise<void> {
  await guarded(sectionPath(engagementId, fileItemId), () =>
    markStepNa(stepId, String(formData.get("rationale") ?? "")),
  );
}

export async function routeFindingAction(
  engagementId: string,
  fileItemId: string,
  formData: FormData,
): Promise<void> {
  const path = sectionPath(engagementId, fileItemId);
  await guarded(path, async () => {
    await routeFinding({
      engagementId,
      fileItemId,
      programStepId: String(formData.get("stepId") ?? "") || undefined,
      route: String(formData.get("route") ?? "b4") as FindingRoute,
      title: String(formData.get("title") ?? ""),
      detail: String(formData.get("detail") ?? "") || undefined,
      amount: formData.get("amount") ? Number(formData.get("amount")) : undefined,
      accounts: String(formData.get("accounts") ?? "") || undefined,
      mtype: (String(formData.get("mtype") ?? "") || undefined) as
        | "factual" | "judgmental" | "projected" | "classification" | "disclosure" | undefined,
      trivialConfirmed: formData.get("trivialConfirmed") === "on",
      significant: formData.get("significant") === "on",
    });
  });
}

export async function recordControlTestAction(
  engagementId: string,
  fileItemId: string,
  formData: FormData,
): Promise<void> {
  await guarded(sectionPath(engagementId, fileItemId), () =>
    recordControlTest({
      engagementId,
      fileItemId,
      description: String(formData.get("description") ?? ""),
      result: String(formData.get("result") ?? "effective") === "deviation" ? "deviation" : "effective",
      deviationDecision: (String(formData.get("deviationDecision") ?? "") || undefined) as
        | "extend" | "abandon" | "deficiency" | undefined,
      note: String(formData.get("note") ?? "") || undefined,
      scotControlId: String(formData.get("scotControlId") ?? "") || undefined,
    }),
  );
}

export async function saveConclusionAction(
  engagementId: string,
  fileItemId: string,
  formData: FormData,
): Promise<void> {
  await guarded(sectionPath(engagementId, fileItemId), () =>
    saveSectionConclusion(
      fileItemId,
      String(formData.get("conclusion") ?? ""),
      formData.get("objectivesAchieved") === "on",
    ),
  );
}

export async function reviewConclusionAction(
  engagementId: string,
  fileItemId: string,
  asPartner: boolean,
): Promise<void> {
  await guarded(sectionPath(engagementId, fileItemId), () =>
    reviewSectionConclusion(fileItemId, asPartner),
  );
}

export async function clearFindingAction(
  engagementId: string,
  findingId: string,
  formData: FormData,
): Promise<void> {
  await guarded(`/engagements/${engagementId}/findings`, () =>
    clearFinding(findingId, String(formData.get("response") ?? "")),
  );
}

export async function setCorrectedAction(
  engagementId: string,
  misstatementId: string,
  corrected: boolean,
): Promise<void> {
  await guarded(`/engagements/${engagementId}/findings`, () =>
    setMisstatementCorrected(misstatementId, corrected),
  );
}

export async function approveRiskAdditionAction(engagementId: string, riskId: string): Promise<void> {
  await guarded(`/engagements/${engagementId}/risks`, () => approveRiskAddition(riskId));
}
