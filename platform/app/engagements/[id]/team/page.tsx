import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { assignTeamFromTeamPageAction, removeTeamFromTeamPageAction } from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { NavLink } from "@/components/NavLink";
import { SubmitButton } from "@/components/SubmitButton";
import { Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { initials } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { canReview } from "@/lib/rbac";
import { TEAM_ROLES, listFirmUsers, listTeam, openAssignedTaskCounts } from "@/lib/team";

export const metadata = { title: "Manage team · AuditISA" };

// Page-local label for the open-assigned-tasks cell (not in messages/*.json).
const OPEN_TASKS = {
  en: (n: number) => (n === 1 ? "1 open task" : `${n} open tasks`),
  fr: (n: number) => (n === 1 ? "1 tâche ouverte" : `${n} tâches ouvertes`),
} as const;

/** Manage Team (Canvas structure): active members table + add/remove. */
export default async function TeamPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tt = t.team;
  // The six-level ladder labels live in planning.team.roles (single source).
  const roleLabels = t.planning.team.roles;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [team, firmUsers, openCounts] = await Promise.all([
    listTeam(id),
    listFirmUsers(),
    openAssignedTaskCounts(id),
  ]);
  const assignable = firmUsers.filter((u) => !team.some((m) => m.userId === u.id));
  const canManage = canReview(session.user.role);

  const th =
    "border-b border-line bg-surface-2 px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

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
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">{tt.title}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          {engagement.name ?? engagement.clientName}
          <span className="px-2 text-line-strong">·</span>
          {t.engagements.fiscalYear} {engagement.fiscalYear}
        </p>
      </div>

      <ErrorBanner error={error} locale={locale} />

      <Panel flush>
        <div className="border-b border-line px-5 py-3.5">
          <PanelHeader title={tt.active} right={<span className="text-xs font-semibold text-muted tnum">{team.length}</span>} />
        </div>
        {team.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">{tt.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]" data-testid="team-table">
              <thead>
                <tr>
                  <th className={th}>{tt.member}</th>
                  <th className={th}>{tt.initials}</th>
                  <th className={th}>{tt.role}</th>
                  <th className={th} />
                  {canManage ? <th className={`${th} text-right`} /> : null}
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-surface-2" data-testid={`team-row-${m.userId}`}>
                    <td className="border-t border-line px-5 py-3.5">
                      <span className="flex items-center gap-2.5">
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-600" aria-hidden />
                        <span className="text-[13.5px] font-semibold text-ink">{m.userName}</span>
                      </span>
                    </td>
                    <td className="border-t border-line px-5 py-3.5 text-[12.5px] font-bold tracking-wide text-ink-soft">
                      {initials(m.userName)}
                    </td>
                    <td className="border-t border-line px-5 py-3.5 text-[13px] text-ink-soft">
                      {roleLabels[m.teamRole]}
                    </td>
                    <td
                      className="border-t border-line px-5 py-3.5 text-[12px] text-muted tnum"
                      data-testid={`open-tasks-${m.userId}`}
                    >
                      {OPEN_TASKS[locale](openCounts.get(m.userId) ?? 0)}
                    </td>
                    {canManage ? (
                      <td className="border-t border-line px-5 py-3.5 text-right">
                        <form action={removeTeamFromTeamPageAction.bind(null, id, m.userId)} className="inline-block">
                          <SubmitButton
                            className="rounded-full border border-line-strong px-3 py-1 text-[11.5px] font-semibold text-ink-soft hover:bg-surface-2"
                            testId={`remove-member-${m.userId}`}
                          >
                            {tt.remove}
                          </SubmitButton>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {canManage ? (
        <Panel className="p-6">
          <PanelHeader title={tt.add} />
          <form action={assignTeamFromTeamPageAction.bind(null, id)} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-ink-soft">
              {tt.member}
              <select name="userId" required className={input} data-testid="team-user">
                {assignable.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-soft">
              {tt.role}
              <select name="teamRole" defaultValue="staff" className={input} data-testid="team-role">
                {TEAM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton className={btnPrimary} testId="team-add">
              {tt.add}
            </SubmitButton>
          </form>
        </Panel>
      ) : null}
    </main>
  );
}
