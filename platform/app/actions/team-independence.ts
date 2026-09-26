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
  // firm staff only: a read-only observer or client contact declares nothing (UAT run 3 B04)
  const team = (await listTeam(engagementId)).filter((m) => m.status !== "declined" && m.declaresIndependence);
  const back = returnTo.startsWith(`/engagements/${engagementId}/`)
    ? returnTo
    : `/engagements/${engagementId}/dashboard`;
  if (team.length === 0) redirect(`${back}?error=no-recipients`);
  try {
    await launchCampaign(
      engagementId,
      team.map((m) => m.userId),
    );
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`${back}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
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
  const name = String(formData.get("memberName") ?? "");
  const back = `/engagements/${engagementId}/team`;
  try {
    await addTeamMemberByEmail(engagementId, email, role, engagementName, name);
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
      redirect(`/engagements/${engagementId}/dashboard?error=${encodeURIComponent(error.message)}`);
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
