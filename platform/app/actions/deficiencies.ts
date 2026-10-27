"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveDeficiencyEvaluation } from "@/lib/deficiencies";

/**
 * The ISA 265 evaluation grid on C5.11 (F037): one form per deficiency, saved
 * from the working-paper screen and landing back on it. Domain refusals come
 * back as ?error=<code> banners, never a 500.
 */
export async function saveDeficiencyEvaluationAction(
  engagementId: string,
  fileItemId: string,
  findingId: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/sections/${fileItemId}`;
  const text = (key: string): string | null => String(formData.get(key) ?? "").trim() || null;
  const aware = String(formData.get("managementAware") ?? "");
  try {
    await saveDeficiencyEvaluation({
      engagementId,
      findingId,
      likelihood: text("likelihood"),
      magnitude: text("magnitude"),
      accountsAssertions: text("accountsAssertions"),
      managementAware: aware === "yes" ? true : aware === "no" ? false : null,
      indicators: text("indicators"),
      relatedFindingIds: formData.getAll("related").map((v) => String(v)).filter(Boolean),
      aggregationNote: text("aggregationNote"),
      grade: String(formData.get("grade") ?? ""),
      communicatedOn: text("communicatedOn"),
      recipient: text("recipient"),
    });
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`${path}?error=${encodeURIComponent(error.message)}#deficiency-${findingId}`);
    }
    throw error;
  }
  revalidatePath(path);
  redirect(`${path}#deficiency-${findingId}`);
}
