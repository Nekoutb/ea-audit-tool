import { redirect } from "next/navigation";
import { canSeeEngagement, invitationPending } from "@/lib/engagement-access";
import { requireTenant } from "@/lib/tenant";

/**
 * One gate for every page under an engagement.
 *
 * Filtering the register is not enough on its own — the id is in the URL, so
 * anyone who has seen it once, or who guesses it, can navigate straight in.
 * Putting the check in a layout covers all ~30 pages beneath it in one place,
 * rather than relying on thirty loaders each remembering. It re-runs whenever
 * the engagement id changes, which is exactly the granularity the rule needs.
 *
 * The rule itself — only an accepted team member opens the file (F008) — is
 * in lib/engagement-access.ts. An invited member is sent to the invitation.
 */
export default async function EngagementLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const allowed = await canSeeEngagement(id).catch(() => false);
  if (!allowed) {
    const invited = await requireTenant()
      .then(({ tenantId, userId }) => invitationPending(id, tenantId, userId))
      .catch(() => false);
    if (invited) redirect(`/invitations/${id}`);
    // Back to the register rather than a dead end, and say why.
    redirect("/engagements?error=not-on-this-engagement");
  }
  return <>{children}</>;
}
