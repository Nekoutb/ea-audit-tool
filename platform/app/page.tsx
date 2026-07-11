import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { mostRecentEngagement } from "@/lib/engagement-dashboard";

export default async function Home() {
  // Authenticated users land on the dashboard of the engagement they last worked
  // on; the proxy sends unauthenticated requests to /login. Firms with no
  // engagement yet fall back to the firm overview.
  const session = await auth();
  if (!session?.user) redirect("/login");

  let target = "/dashboard";
  try {
    const engagement = await mostRecentEngagement();
    if (engagement) target = `/engagements/${engagement.id}/dashboard`;
  } catch {
    // Fall back to the firm dashboard if the lookup fails.
  }
  redirect(target);
}
