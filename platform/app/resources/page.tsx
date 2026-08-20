import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Panel } from "@/components/ui/atlas";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { canManageFirm, type Role } from "@/lib/rbac";
import { teamWorkload } from "@/lib/resources";

export const metadata = { title: "Team workload · AuditISA" };

export default async function ResourcesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Every employee's hours and open-task count is firm-management information,
  // not something any authenticated account may browse (assurance finding C2).
  // Reached from Settings, which is gated the same way.
  if (!canManageFirm(session.user.role as Role)) redirect("/dashboard");

  const locale = await getLocale();
  const t = getMessages(locale);
  const tr = t.resources;
  const rows = await teamWorkload();
  const roleName = (r: string) => (t.users.roles as Record<string, string>)[r] ?? r;

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold tracking-[-0.01em] text-ink">{tr.title}</h1>
      <p className="mt-1 text-[13px] text-ink-soft">{tr.subtitle}</p>

      <Panel flush className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="workload-table">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">{tr.member}</th>
                <th className="px-5 py-3 font-semibold">{tr.role}</th>
                <th className="px-5 py-3 text-right font-semibold">{tr.openTasks}</th>
                <th className="px-5 py-3 text-right font-semibold">{tr.hours}</th>
                <th className="px-5 py-3 text-right font-semibold">{tr.engagements}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-muted">{tr.empty}</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-line" data-testid={`workload-${row.id}`}>
                    <td className="px-5 py-3 font-medium text-ink">{row.name}</td>
                    <td className="px-5 py-3 text-ink-soft">{roleName(row.role)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-ink tnum">{row.openTasks}</td>
                    <td className="px-5 py-3 text-right text-ink-soft tnum">{row.hours.toFixed(1)}</td>
                    <td className="px-5 py-3 text-right text-ink-soft tnum">{row.engagements}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </main>
  );
}
