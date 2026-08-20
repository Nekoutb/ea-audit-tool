import { redirect } from "next/navigation";
import { canSeeEngagement } from "@/lib/engagement-access";

/**
 * One gate for every page under an engagement.
 *
 * Filtering the register is not enough on its own — the id is in the URL, so
 * anyone who has seen it once, or who guesses it, can navigate straight in.
 * Putting the check in a layout covers all ~30 pages beneath it in one place,
 * rather than relying on thirty loaders each remembering. It re-runs whenever
 * the engagement id changes, which is exactly the granularity the rule needs.
 *
 * The rule itself, including why an unassigned engagement stays open to the
 * firm, is in lib/engagement-access.ts.
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
  // Back to the register rather than a dead end, and say why.
  if (!allowed) redirect("/engagements?error=not-on-this-engagement");
  return <>{children}</>;
}
