import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { NavLink } from "@/components/NavLink";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { listActivity } from "@/lib/activity";
import { initials } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Activity · AuditISA" };

/** Engagement activity timeline — the unified audit trail of user actions. */
export default async function ActivityPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const t = getMessages(locale);
  const ta = t.dashboard.activity;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const rows = await listActivity(id);

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-4">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />

      <div>
        <NavLink
          href={`/engagements/${id}/dashboard`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          testId="back-to-dashboard"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          {t.dashboard.backToDashboard}
        </NavLink>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">{ta.title}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">{ta.subtitle}</p>
      </div>

      <Panel flush className="flex flex-col">
        <div className="border-b border-line px-5 py-3.5">
          <PanelHeader title={ta.title} right={<span className="text-xs font-semibold text-muted tnum">{rows.length}</span>} />
        </div>
        <div className="p-1.5" data-testid="activity-log">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{ta.empty}</p>
          ) : (
            <ol className="flex flex-col">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3.5 border-b border-line px-4 py-3 last:border-b-0">
                  <span
                    className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-emerald-50 text-[11px] font-extrabold tracking-wide text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    aria-hidden
                  >
                    {row.userName ? initials(row.userName) : "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] text-ink">
                      <span className="font-semibold">{row.userName ?? "—"}</span>
                      <span className="text-ink-soft"> · {row.summary ?? row.action}</span>
                    </p>
                    <p className="text-[11.5px] text-muted">
                      {(ta.entityLabels as Record<string, string>)[row.entityType] ?? row.entityType}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-[11.5px] font-medium text-muted tnum">{row.at}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Panel>
    </main>
  );
}
