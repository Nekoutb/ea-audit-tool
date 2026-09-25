"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  evaluateSampling,
  recordTodResult,
  runJeTesting,
  runReconciliation,
  runSampling,
  runSubstantiveAnalytic,
  runSupplierRecon,
  type SamplingMethod,
} from "@/lib/engines";
import type { ConfidenceLevel } from "@/lib/sampling-params";

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

const sectionPath = (engagementId: string, fileItemId: string): string =>
  `/engagements/${engagementId}/sections/${fileItemId}`;

export async function runSamplingAction(
  engagementId: string,
  fileItemId: string,
  formData: FormData,
): Promise<void> {
  const path = sectionPath(engagementId, fileItemId);
  await guarded(path, async () => {
    await runSampling({
      fileItemId,
      datasetId: String(formData.get("datasetId") ?? ""),
      method: String(formData.get("method") ?? "random") as SamplingMethod,
      sampleSize: Number(formData.get("sampleSize") ?? 0),
      seed: String(formData.get("seed") ?? ""),
      threshold: formData.get("threshold") ? Number(formData.get("threshold")) : undefined,
      confidence: formData.get("confidence")
        ? (Number(formData.get("confidence")) as ConfidenceLevel)
        : undefined,
      expectedMisstatement: formData.get("expectedMisstatement")
        ? Number(formData.get("expectedMisstatement"))
        : undefined,
      overrideSize: formData.get("overrideSize") ? Number(formData.get("overrideSize")) : undefined,
      overrideRationale: String(formData.get("overrideRationale") ?? "").trim() || undefined,
    });
  });
}

export async function evaluateSamplingAction(
  engagementId: string,
  fileItemId: string,
  runId: string,
  formData: FormData,
): Promise<void> {
  const path = sectionPath(engagementId, fileItemId);
  await guarded(path, async () => {
    await evaluateSampling(runId, Number(formData.get("misstatement") ?? 0));
  });
}

/**
 * The Sampling tool's results step (UAT B78): what the tests-of-details
 * workbook found, projected to the population and carried to C1.1.
 */
export async function recordTodResultAction(engagementId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/tools/sampling`;
  const amount = (name: string): number => Number(String(formData.get(name) ?? "").replace(/[\s  ]/g, "").replace(",", "."));
  await guarded(path, async () => {
    await recordTodResult({
      engagementId,
      indexCode: String(formData.get("indexCode") ?? ""),
      sampleValue: amount("sampleValue"),
      sampleMisstatement: amount("sampleMisstatement") || 0,
      keyMisstatement: amount("keyMisstatement") || 0,
      remainingValue: amount("remainingValue"),
    });
    return `${path}?recorded=1`;
  });
}

/**
 * Agree a sub-ledger to its control account from the analyzer page (UAT B80),
 * returning there rather than to the E4 paper the run is filed under.
 */
export async function runReconFromAnalyzerAction(
  engagementId: string,
  kind: string,
  fileItemId: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/analyzers/${kind}`;
  await guarded(path, async () => {
    await runReconciliation({
      fileItemId,
      datasetId: String(formData.get("datasetId") ?? ""),
      staleDays: formData.get("staleDays") ? Number(formData.get("staleDays")) : undefined,
      periodEnd: String(formData.get("periodEnd") ?? "") || undefined,
    });
    return `${path}?reconciled=1`;
  });
}

export async function runReconAction(
  engagementId: string,
  fileItemId: string,
  formData: FormData,
): Promise<void> {
  const path = sectionPath(engagementId, fileItemId);
  await guarded(path, async () => {
    await runReconciliation({
      fileItemId,
      datasetId: String(formData.get("datasetId") ?? ""),
      staleDays: formData.get("staleDays") ? Number(formData.get("staleDays")) : undefined,
      periodEnd: String(formData.get("periodEnd") ?? "") || undefined,
    });
  });
}

export async function runSupplierReconAction(
  engagementId: string,
  fileItemId: string,
  formData: FormData,
): Promise<void> {
  const path = sectionPath(engagementId, fileItemId);
  await guarded(path, async () => {
    await runSupplierRecon({
      fileItemId,
      statementsDatasetId: String(formData.get("statementsDatasetId") ?? ""),
      ledgerDatasetId: String(formData.get("ledgerDatasetId") ?? ""),
    });
  });
}

export async function runJeTestingAction(
  engagementId: string,
  fileItemId: string,
  formData: FormData,
): Promise<void> {
  const path = sectionPath(engagementId, fileItemId);
  await guarded(path, async () => {
    await runJeTesting({
      fileItemId,
      datasetId: String(formData.get("datasetId") ?? ""),
      periodEnd: String(formData.get("periodEnd") ?? ""),
      largeThreshold: formData.get("largeThreshold") ? Number(formData.get("largeThreshold")) : undefined,
    });
  });
}

export async function runAnalyticAction(
  engagementId: string,
  fileItemId: string,
  formData: FormData,
): Promise<void> {
  const path = sectionPath(engagementId, fileItemId);
  await guarded(path, async () => {
    await runSubstantiveAnalytic({
      fileItemId,
      expectation: Number(formData.get("expectation") ?? 0),
      tolerance: Number(formData.get("tolerance") ?? 0),
      basis: String(formData.get("basis") ?? ""),
    });
  });
}
