"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { placeLegalHold, releaseLegalHold, setRetentionYears } from "@/lib/retention";

/**
 * Retention period, legal hold placement and release (UAT B65). The library
 * already enforced the roles (firm_admin / manager / partner); nothing on the
 * screen called it.
 */
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

export async function setRetentionYearsAction(formData: FormData): Promise<void> {
  await guarded("/settings", () => setRetentionYears(Number(formData.get("years"))));
}

export async function placeLegalHoldAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(`/engagements/${engagementId}/conclusion`, async () => {
    await placeLegalHold(engagementId, String(formData.get("reason") ?? ""));
  });
}

export async function releaseLegalHoldAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(`/engagements/${engagementId}/conclusion`, () =>
    releaseLegalHold(engagementId, String(formData.get("reason") ?? "")),
  );
}
