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
import { withTenant } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { decideOpinion, generateAuditReport } from "@/lib/report";
import { requireTenant } from "@/lib/tenant";

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
    // ISA 560: the review runs from the period end to the report date, so a
    // "reviewed to" date on or before the period end reviews nothing (UAT run 2 B79).
    const { tenantId } = await requireTenant();
    const periodEnd = await withTenant(tenantId, async (tx) => {
      const r = await tx.query<{ period_end: string | null }>(
        "SELECT to_char(period_end, 'YYYY-MM-DD') AS period_end FROM engagement WHERE id = $1",
        [engagementId],
      );
      return r.rows[0]?.period_end ?? null;
    });
    if (periodEnd && reviewedTo <= periodEnd) throw new Error("reviewed-before-period-end");
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
    // ISA 705 ¶20: a modified opinion carries the basis for it. ISA 701 ¶16:
    // for a listed entity the report either describes the key audit matters
    // or states that there are none, with the reason recorded (UAT B57).
    const basisText = String(formData.get("basisText") ?? "").trim();
    if (decision.opinion !== "unmodified" && !basisText) throw new Error("basis-required");
    const kamText = String(formData.get("kamText") ?? "").trim();
    const kamNoneReason = String(formData.get("kamNoneReason") ?? "").trim();
    const kamNone = formData.get("kamNone") === "on";
    const { tenantId } = await requireTenant();
    const listed = await withTenant(tenantId, async (tx) => {
      const r = await tx.query<{ listed: boolean }>(
        "SELECT c.listed FROM engagement e JOIN client c ON c.id = e.client_id WHERE e.id = $1",
        [engagementId],
      );
      return Boolean(r.rows[0]?.listed);
    });
    if (listed && !kamText && !(kamNone && kamNoneReason)) throw new Error("kam-required");
    await issueReport(engagementId, decision.opinion, reportDate);
    const documentId = await generateAuditReport({
      engagementId,
      opinion: decision.opinion,
      basisText: basisText || undefined,
      goingConcernParagraph: decision.goingConcernParagraph,
      kamText: kamText || undefined,
      kamNoneReason: listed && kamNone ? kamNoneReason : undefined,
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
