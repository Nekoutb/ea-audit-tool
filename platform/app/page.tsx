import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Home() {
  // Signing in lands on the firm dashboard: a welcome and the list of
  // engagements. The engagement console opens from that list.
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect("/dashboard");
}
