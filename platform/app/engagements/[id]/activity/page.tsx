import { localizedSummary } from "@/lib/activity-summary";
import { notFound, redirect } from "next/navigation";
import { localizedTitle } from "@/lib/page-title";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { NavLink } from "@/components/NavLink";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { listActivity } from "@/lib/activity";
import { answerHistory } from "@/lib/audit-log";
import { initials } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";


export const generateMetadata = localizedTitle("Activity", "Activité");

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
  const [rows, history] = await Promise.all([listActivity(id), answerHistory(id)]);
  const th = t.auditLog;
  const shown = (v: string | null) => (v === null || v === "" ? th.empty_value : v.length > 400 ? `${v.slice(0, 400)}…` : v);

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />

      <div>
        <NavLink
          href={`/engagements/${id}/dashboard`}
          className="inline-flex min-h-[24px] items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
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
          <PanelHeader
            title={ta.title}
            right={
              <span className="flex items-center gap-3">
                <span className="text-xs font-semibold text-muted tnum">{rows.length}</span>
                {/* the trail as a readable file, and the complete audit-file bundle (UAT B157) */}
                <a
                  href={`/api/engagements/${id}/activity/export`}
                  className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  data-testid="activity-export"
                >
                  {locale === "fr" ? "Exporter (CSV)" : "Export (CSV)"}
                </a>
                <a
                  href={`/api/engagements/${id}/export/bundle`}
                  className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  data-testid="activity-bundle"
                >
                  {locale === "fr" ? "Dossier complet (ZIP)" : "Audit-file bundle (ZIP)"}
                </a>
              </span>
            }
          />
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
                      <span className="text-ink-soft"> · {localizedSummary(row.summary ?? row.action, locale)}</span>
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

      {/* F027: every working-paper answer change, field by field, with its old and new value */}
      <Panel flush className="flex flex-col" data-testid="answer-history">
        <div className="border-b border-line px-5 py-3.5">
          <PanelHeader
            title={th.historyTitle}
            hint={th.historyHint}
            right={<span className="text-xs font-semibold text-muted tnum">{history.length}</span>}
          />
        </div>
        <div className="p-1.5">
          {history.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">{th.historyEmpty}</p>
          ) : (
            <ul className="flex flex-col">
              {history.map((field) => (
                <li key={`${field.code}|${field.field}`} className="border-b border-line px-4 py-2.5 last:border-b-0">
                  <details>
                    <summary className="cursor-pointer text-[13px] text-ink">
                      <span className="font-mono text-[12px] font-semibold">{field.code.replace(/^wp:/, "")}</span>
                      <span className="text-ink-soft"> · {field.field}</span>
                      <span className="ml-2 text-[11.5px] text-muted">
                        {th.changes.replace("{n}", String(field.changes.length))} · {field.changes[0]?.at}
                      </span>
                    </summary>
                    <ol className="mt-2 flex flex-col gap-2">
                      {field.changes.map((c, i) => (
                        <li key={i} className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-[12px]">
                          <p className="text-muted">
                            <span className="font-semibold text-ink-soft">{c.userName ?? th.unknownUser}</span> · <span className="tnum">{c.at}</span>
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-ink-soft">
                            <span className="font-semibold text-muted">{th.beforeLabel} </span>
                            {shown(c.before)}
                          </p>
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-ink">
                            <span className="font-semibold text-muted">{th.afterLabel} </span>
                            {shown(c.after)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </main>
  );
}
