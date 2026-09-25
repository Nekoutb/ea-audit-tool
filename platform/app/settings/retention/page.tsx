import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Chip, Panel, PanelHeader } from "@/components/ui/atlas";
import { getLocale } from "@/lib/locale";
import { atLeast, type Role } from "@/lib/rbac";
import { retentionPolicy, retentionReport } from "@/lib/retention";

export const metadata = { title: "Retention · AuditISA" };

/**
 * The firm's retention report (UAT B65): every archived file with its
 * retention expiry and hold status, so the files due for destruction are
 * listed rather than guessed. Manager and above.
 */
export default async function RetentionReportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!atLeast(session.user.role as Role, "manager")) redirect("/settings?error=requires-manager");

  const locale = await getLocale();
  const fr = locale === "fr";
  const [policy, rows] = await Promise.all([retentionPolicy(), retentionReport()]);
  const due = rows.filter((row) => row.dueForDestruction);

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} />
      <div className="mt-8">
        <Link href="/settings" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
          ← {fr ? "Paramètres" : "Settings"}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-ink">
          {fr ? "Rapport de conservation des dossiers" : "File retention report"}
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          {fr
            ? `Durée de conservation : ${policy.years} ans après la date du rapport. ${due.length} dossier(s) arrivé(s) à échéance sans suspension juridique.`
            : `Retention period: ${policy.years} years after the report date. ${due.length} file(s) past expiry with no legal hold.`}
        </p>
      </div>

      <Panel flush className="mt-6 overflow-x-auto">
        <div className="border-b border-line px-5 py-3.5">
          <PanelHeader
            title={fr ? "Dossiers archivés" : "Archived files"}
            right={<span className="text-xs font-semibold text-muted tnum">{rows.length}</span>}
          />
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted" data-testid="retention-empty">
            {fr ? "Aucun dossier archivé." : "No archived file yet."}
          </p>
        ) : (
          <table className="w-full text-sm" data-testid="retention-table">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2">{fr ? "Mission" : "Engagement"}</th>
                <th className="px-4 py-2">{fr ? "Exercice" : "Fiscal year"}</th>
                <th className="px-4 py-2">{fr ? "Archivé le" : "Archived on"}</th>
                <th className="px-4 py-2">{fr ? "Conservation jusqu'au" : "Retain until"}</th>
                <th className="px-4 py-2">{fr ? "Statut" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.engagementId} className="border-t border-line" data-testid={`retention-row-${row.engagementId}`}>
                  <td className="px-4 py-2 text-ink">
                    <Link href={`/engagements/${row.engagementId}/conclusion`} className="hover:underline">
                      {row.name ?? row.clientName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 tnum">{row.fiscalYear}</td>
                  <td className="px-4 py-2 tnum">{row.archivedAt ?? "—"}</td>
                  <td className="px-4 py-2 tnum">{row.retentionUntil ?? "—"}</td>
                  <td className="px-4 py-2">
                    {row.held ? (
                      <Chip tone="warn">{fr ? "Suspension juridique" : "Legal hold"}</Chip>
                    ) : row.dueForDestruction ? (
                      <Chip tone="rose">{fr ? "À détruire" : "Due for destruction"}</Chip>
                    ) : (
                      <Chip tone="good">{fr ? "En conservation" : "Retained"}</Chip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </main>
  );
}
