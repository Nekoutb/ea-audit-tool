"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordActivity } from "@/lib/activity";
import { launchCampaign } from "@/lib/independence";
import { addTeamMemberByEmail, listTeam, respondToEngagement, type TeamRole } from "@/lib/team";

/** Launch (or extend) the independence campaign to the whole engagement team. */
export async function launchIndependenceToTeamAction(
  engagementId: string,
  returnTo: string,
): Promise<void> {
  const team = await listTeam(engagementId);
  const back = returnTo.startsWith(`/engagements/${engagementId}/`) ? returnTo : `/engagements/${engagementId}/dashboard`;
  if (team.length === 0) redirect(`${back}?error=no-recipients`);
  await launchCampaign(engagementId, team.map((m) => m.userId));
  await recordActivity({
    engagementId,
    entityType: "engagement",
    entityId: engagementId,
    action: "independence_campaign",
    summary: `Independence campaign issued to ${team.length} team member(s)`,
  });
  revalidatePath(back);
  redirect(back);
}

/** Team page: add a member by email; unknown emails provision the account. */
export async function addTeamByEmailAction(
  engagementId: string,
  engagementName: string,
  formData: FormData,
): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const role = String(formData.get("teamRole") ?? "staff") as TeamRole;
  const back = `/engagements/${engagementId}/team`;
  try {
    await addTeamMemberByEmail(engagementId, email, role, engagementName);
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid-email";
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

/** Accept or decline the engagement from its dashboard banner. */
export async function respondEngagementAction(
  engagementId: string,
  accept: boolean,
): Promise<void> {
  await respondToEngagement(engagementId, accept);
  await recordActivity({
    engagementId,
    entityType: "engagement",
    entityId: engagementId,
    action: accept ? "engagement_accepted" : "engagement_declined",
    summary: accept ? "Engagement accepted" : "Engagement declined",
  });
  const back = accept ? `/engagements/${engagementId}/dashboard` : "/dashboard";
  revalidatePath(back);
  redirect(back);
}
