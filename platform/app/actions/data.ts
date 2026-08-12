"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveApComments } from "@/lib/analytical-procedures";
import { assignSection, generateLeadSchedule } from "@/lib/leadsheets";
import { getLocale } from "@/lib/locale";
import { raisePotentialRisk } from "@/lib/risks";

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

export async function generateLeadScheduleAction(
  engagementId: string,
  fileItemId: string,
): Promise<void> {
  const path = `/engagements/${engagementId}/data`;
  const locale = await getLocale();
  await guarded(path, async () => {
    const result = await generateLeadSchedule(fileItemId, locale);
    return `/documents/${result.documentId}?lost=${result.lostAccounts.length}`;
  });
}

export async function assignSectionAction(
  engagementId: string,
  fileItemId: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/data`;
  await guarded(path, () => assignSection(fileItemId, String(formData.get("userId") ?? "")));
}

export async function raiseAnalyticsRiskAction(
  engagementId: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/analytics`;
  await guarded(path, () =>
    raisePotentialRisk(engagementId, String(formData.get("description") ?? ""), "D4.3"),
  );
}

/** Save one lead schedule&apos;s commentary from the analytical-procedures grid. */
export async function saveApCommentsAction(
  engagementId: string,
  index: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/analytics`;
  const entries: { key: string; value: string }[] = [];
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("c_") && typeof value === "string") {
      entries.push({ key: name.slice(2), value });
    }
  }
  await guarded(path, () => saveApComments(engagementId, index, entries));
}
