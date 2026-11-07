import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { platformAdminUrl } from "@/lib/admin-redirect";

/**
 * /admin: where an operator lands. Once the admin Odoo exists and PLATFORM_ADMIN_URL is set, this goes
 * there. Until then, and for the firms this tool still serves, the console stays at /admin/console: the
 * admin Odoo manages Odoo firm servers, not this tool's tenants, so the console is not retired by this.
 */
export default async function AdminEntry() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isSuper) redirect("/dashboard");
  redirect(platformAdminUrl() ?? "/admin/console");
}
