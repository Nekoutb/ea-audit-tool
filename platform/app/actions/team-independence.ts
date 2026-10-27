"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordActivity } from "@/lib/activity";
import { addTeamMemberByEmail, respondToEngagement, type TeamRole } from "@/lib/team";

/** Team page: add a member by email; unknown emails provision the account. */
export async function addTeamByEmailAction(
  engagementId: string,
  engagementName: string,
  formData: FormData,
): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const role = String(formData.get("teamRole") ?? "staff") as TeamRole;
  const name = String(formData.get("memberName") ?? "");
  const back = `/engagements/${engagementId}/team`;
  try {
    await addTeamMemberByEmail(engagementId, email, role, engagementName, name, {
      // the objectivity declaration ticked when appointing the EQR (F005)
      eqrDeclaration: formData.get("eqrDeclaration") === "on",
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "invalid-email";
    // the archive trigger's message maps to the banner the page knows (UAT B156)
    const code = /engagement-archived|^archived$/.test(raw) ? "archived" : raw;
    redirect(`${back}?error=${encodeURIComponent(code)}`);
  }
  await recordActivity({
    engagementId,
    entityType: "engagement",
    entityId: engagementId,
    action: "team_invited",
    summary: `${email.trim().toLowerCase()} invited to the engagement`,
  });
  revalidatePath(back);
  redirect(back);
}

/** Accept or decline the engagement from its dashboard banner (a decline needs its reason — UAT B130). */
export async function respondEngagementAction(
  engagementId: string,
  accept: boolean,
  formData?: FormData,
): Promise<void> {
  const reason = String(formData?.get("reason") ?? "").trim();
  try {
    await respondToEngagement(engagementId, accept, reason);
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`/invitations/${engagementId}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  await recordActivity({
    engagementId,
    entityType: "engagement",
    entityId: engagementId,
    action: accept ? "engagement_accepted" : "engagement_declined",
    summary: accept ? "Engagement accepted" : `Engagement declined: ${reason}`,
    meta: accept ? null : { reason },
  });
  const back = accept ? `/engagements/${engagementId}/dashboard` : "/dashboard";
  revalidatePath(back);
  redirect(back);
}
