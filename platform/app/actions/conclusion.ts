"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { analyticalReview } from "@/lib/analytics";
import {
  archiveEngagement,
  CompletionGateError,
  issueReport,
  recordCompletion,
  rollforward,
} from "@/lib/completion";
import { runFsTieout } from "@/lib/fs-tieout";
import { generateLetter, type LetterKind } from "@/lib/letters";
import { getLocale } from "@/lib/locale";
import { decideOpinion, generateAuditReport } from "@/lib/report";

async function guarded(path: string, fn: () => Promise<string | void>): Promise<never> {
  let target = path;
  try {
    const result = await fn();
    if (typeof result === "string") target = result;
  } catch (error) {
    if (error instanceof CompletionGateError) {
      redirect(`${path}?error=gates&failed=${encodeURIComponent(error.failed.join(","))}`);
    }
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath(path);
  redirect(target);
}

const pagePath = (engagementId: string): string => `/engagements/${engagementId}/conclusion`;

/** 7.3 Final analytical review on final figures, snapshotted into C4.1. */
export async function finalAnalyticsAction(engagementId: string): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    const review = await analyticalReview(engagementId);
    if (!review.hasTb) throw new Error("no-tb");
    await recordCompletion(engagementId, "final_analytical_review", {
      lines: review.lines.slice(0, 30),
      performanceMateriality: review.performanceMateriality,
    });
  });
}

/** 7.4/7.5 FS tie-out (optional client FS CSV via the upload route). */
export async function fsTieoutAction(engagementId: string): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    const result = await runFsTieout(engagementId);
    if (!result.pass) throw new Error("tieout-failed");
    await recordCompletion(engagementId, "fs_tieout", {
      checks: result.checks,
      crResult: result.cr.find((line) => line.ref === "XI")?.amount ?? null,
    });
  });
}

export async function disclosureChecklistAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    if (formData.get("allComplete") !== "on") throw new Error("checklist-incomplete");
    await recordCompletion(engagementId, "disclosure_checklist", {
      notes: String(formData.get("notes") ?? ""),
      notesRange: "1-36",
    });
  });
}

export async function subsequentEventsAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    const reviewedTo = String(formData.get("reviewedTo") ?? "");
    if (!reviewedTo) throw new Error("fields-required");
    await recordCompletion(engagementId, "subsequent_events", {
      reviewedTo,
      events: String(formData.get("events") ?? ""),
    });
  });
}

export async function pointsForwardAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    await recordCompletion(engagementId, "points_forward", {
      points: String(formData.get("points") ?? ""),
    });
  });
}

export async function partnerConclusionAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    if (formData.get("independenceReconfirmed") !== "on") throw new Error("independence-reconfirm-required");
    await recordCompletion(engagementId, "partner_conclusion", {
      conclusion: String(formData.get("conclusion") ?? ""),
      independenceReconfirmed: true,
    });
  });
}

export async function generateConclusionLetterAction(
  engagementId: string,
  kind: LetterKind,
): Promise<void> {
  const locale = await getLocale();
  await guarded(pagePath(engagementId), async () => {
    const documentId = await generateLetter(engagementId, kind, locale);
    return `/documents/${documentId}`;
  });
}

/** 7.9/7.10/7.11 opinion → report → issuance (gated, one transaction inside). */
export async function issueReportAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    const decision = decideOpinion({
      materialMisstatement: formData.get("materialMisstatement") === "on",
      pervasive: formData.get("pervasive") === "on",
      scopeLimitation: formData.get("scopeLimitation") === "on",
      goingConcernUncertainty: formData.get("goingConcernUncertainty") === "on",
    });
    const reportDate = String(formData.get("reportDate") ?? "");
    if (!reportDate) throw new Error("fields-required");
    await issueReport(engagementId, decision.opinion, reportDate);
    const documentId = await generateAuditReport({
      engagementId,
      opinion: decision.opinion,
      basisText: String(formData.get("basisText") ?? "") || undefined,
      goingConcernParagraph: decision.goingConcernParagraph,
      kamText: String(formData.get("kamText") ?? "") || undefined,
      reportDate,
    });
    return `/documents/${documentId}`;
  });
}

export async function archiveAction(engagementId: string): Promise<void> {
  await guarded(pagePath(engagementId), () => archiveEngagement(engagementId));
}

export async function rollforwardAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    const newId = await rollforward(engagementId, Number(formData.get("newYear")));
    return `/engagements/${newId}`;
  });
}

/**
 * Register variant: same roll-forward, but the engagement id travels in the
 * form (client rows can't bind server-action arguments) and lands on the new
 * engagement's dashboard.
 */
export async function rollforwardFromRegisterAction(formData: FormData): Promise<void> {
  const engagementId = String(formData.get("engagementId") ?? "");
  await guarded("/engagements", async () => {
    const newId = await rollforward(engagementId, Number(formData.get("newYear")));
    return `/engagements/${newId}/dashboard`;
  });
}
