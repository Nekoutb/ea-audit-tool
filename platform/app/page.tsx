import { redirect } from "next/navigation";

export default function Home() {
  // Authenticated users land on the dashboard; the proxy sends the rest to /login.
  redirect("/dashboard");
}
