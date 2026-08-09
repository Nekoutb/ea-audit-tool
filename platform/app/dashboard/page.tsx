import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sendTestNotification } from "@/app/actions/notifications";
import { AppNav } from "@/components/AppNav";
import { Panel, PanelHeader, btnGhost } from "@/components/ui/atlas";
import { firmDashboard, portfolioActions } from "@/lib/dashboards";
import { withTenant } from "@/lib/db";
import { phaseDeadline, type DashboardPhase } from "@/lib/engagement-dashboard";
import { listEngagements } from "@/lib/engagements";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { canReview } from "@/lib/rbac";

export const metadata = { title: "My Audit Portfolio · AuditISA" };

/**
 * My Audit Portfolio (IA audit, Part 5A): firm-wide exceptions that need
 * action — deadlines, significant risks, misstatement exposure, mandate
 * rotation — with every number linking somewhere. The Phase-1 diagnostics
 * (RLS probe, test notification) only render outside production; the E2E
 * isolation and notification suites depend on them.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const showDiagnostics = process.env.NODE_ENV !== "production";
  const { email, role, tenantId } = session.user;
  const firstName = (session.user.name ?? email ?? "").split(/[ @]/)[0] ?? "";
  const locale = await getLocale();
  const t = getMessages(locale);
  const td = t.dashboard;

  const notes = showDiagnostics
    ? await withTenant(tenantId, async (client) => {
        const result = await client.query<{ note: string }>(
          "SELECT note FROM rls_probe ORDER BY created_at",
        );
        return result.rows.map((row) => row.note);
      })
    : [];

  const [firm, actions, register] = await Promise.all([
    firmDashboard(),
    portfolioActions(),
    listEngagements(),
  ]);

  // Reviewer-facing rows only for roles that can actually review/sign.
  const reviewer = canReview(role);
  const myActions = actions.filter(
    (a) => reviewer || (a.kind !== "review" && a.kind !== "acceptance"),
  );
  const KIND_TONE: Record<string, string> = {
    review: "bg-[var(--color-warn-soft)] text-warn",
    notes: "bg-[var(--color-rose-soft)] text-rose",
    independence: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    acceptance: "bg-[var(--color-warn-soft)] text-warn",
  };

  const active = register.filter((e) => e.phase !== "archived");
  const mine = active.filter((e) => e.isMine);
  const myEngagements = (mine.length > 0 ? mine : active)
    .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""))


  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8">
      <AppNav locale={locale} />

      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink" data-testid="welcome">
          {locale === "fr" ? "Bienvenue" : "Welcome back"}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          {locale === "fr" ? "Vos missions, et ce qui requiert votre attention." : "Your engagements, and what needs your attention."}
        </p>
      </div>

      <section className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[1.35fr_1fr]">
        <Panel flush className="flex flex-col">
          <div className="border-b border-line px-5 py-3.5">
            <PanelHeader title={td.myEngagements.title} />
          </div>
          <div className="flex flex-col gap-1 p-1.5" data-testid="my-engagements">
            {myEngagements.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">{td.myEngagements.empty}</p>
            ) : (
              myEngagements.map((e) => {
                const pct = e.tasksTotal > 0 ? Math.round((e.tasksDone / e.tasksTotal) * 100) : 0;
                return (
                  <Link
                    key={e.id}
                    href={`/engagements/${e.id}/dashboard`}
                    className="flex items-center gap-3 rounded-[var(--radius-atlas-xs)] px-3.5 py-2.5 transition hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {e.name ?? e.clientName}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted tnum">
                        {t.engagements.stages[e.phase]} · {phaseDeadline(e.periodEnd, (e.phase === "archived" ? "conclusion" : e.phase) as DashboardPhase)}
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-2">
                      <span className="h-[5px] w-[56px] overflow-hidden rounded-full bg-line">
                        <span className="block h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {td.myEngagements.continueLabel} →
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </Panel>
        <Panel flush className="flex flex-col">
          <div className="border-b border-line px-5 py-3.5">
            <PanelHeader
              title={td.priority.title}
              right={<span className="text-xs font-semibold text-muted tnum">{myActions.length}</span>}
            />
          </div>
          <div className="p-1.5" data-testid="priority-actions">
            {myActions.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">
                {td.priority.empty}{" "}
                <Link href="/engagements" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                  →
                </Link>
              </p>
            ) : (
              myActions.slice(0, 8).map((a, i) => (
                <Link
                  key={`${a.kind}-${a.engagementId}-${i}`}
                  href={a.href}
                  className="flex items-center gap-3 rounded-[var(--radius-atlas-xs)] px-3.5 py-2.5 transition hover:bg-surface-2"
                >
                  <span
                    className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-[10px] font-extrabold ${KIND_TONE[a.kind]}`}
                  >
                    {a.count}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {td.priority[a.kind].replace("{n}", String(a.count))}
                    </span>
                    <span className="block truncate text-[11.5px] text-muted">{a.label}</span>
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="flex-shrink-0 text-muted">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              ))
            )}
          </div>
        </Panel>

      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel className="p-5">
          <PanelHeader title={td.byStage} />
          <ul className="mt-3 flex flex-wrap gap-2 text-sm" data-testid="firm-by-phase">
            {firm.byPhase.map((entry) => (
              <li key={entry.phase}>
                <Link
                  href={`/engagements?stage=${entry.phase}`}
                  className="inline-flex min-h-[28px] items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-ink-soft transition hover:bg-line"
                >
                  {t.engagements.stages[entry.phase as keyof typeof t.engagements.stages] ?? entry.phase}
                  <b className="text-ink tnum">{entry.count}</b>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <PanelHeader title={td.mandateExpiries} />
          </div>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-soft" data-testid="firm-mandates">
            {firm.mandateExpiries.map((entry) => (
              <li key={entry.clientId}>
                <Link href={`/clients/${entry.clientId}`} className="hover:underline">
                  {entry.clientName} — <b className="text-ink tnum">{entry.expiryYear}</b>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="p-5">
          <PanelHeader title={td.deadlineHeat} />
          <ul className="mt-3 flex flex-col gap-1 text-sm" data-testid="firm-deadlines">
            {firm.deadlineHeat.map((entry) => (
              <li key={`${entry.engagementId}-${entry.key}`}>
                <Link href={`/engagements/${entry.engagementId}/legal`} className="hover:underline">
                  <span className={entry.daysLeft < 0 ? "font-semibold text-rose tnum" : "text-ink-soft tnum"}>
                    {entry.dueDate} — {entry.clientName} {entry.fiscalYear} · {entry.key}
                    {entry.daysLeft < 0 ? " (overdue)" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel className="p-5">
          <PanelHeader title={td.portfolioRisks} />
          <ul className="mt-3 flex flex-col gap-1 text-sm text-ink-soft" data-testid="portfolio-risks">
            {firm.significantRisks.map((risk, index) => (
              <li key={`${risk.engagementId}-${index}`}>
                <Link href={`/engagements/${risk.engagementId}/risks`} className="hover:underline">
                  {risk.clientName} {risk.fiscalYear} — {risk.description} ({risk.status})
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="p-5">
          <PanelHeader title={td.b5Exposure} />
          <ul className="mt-3 flex flex-col gap-1 text-sm" data-testid="portfolio-b5">
            {firm.b5Exposure.map((entry) => (
              <li key={entry.engagementId} className="text-ink-soft">
                <Link href={`/engagements/${entry.engagementId}/findings`} className="hover:underline">
                  <span className="tnum">
                    {entry.clientName} {entry.fiscalYear} — {formatFCFA(entry.uncorrected)}
                    {entry.materiality === null
                      ? ` (${td.noMateriality})`
                      : ` / ${formatFCFA(entry.materiality)}`}
                  </span>
                  {entry.exceeds ? (
                    <span className="ml-1 font-semibold text-rose">{td.exceeds}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      {showDiagnostics ? (
        <Panel className="p-5" data-testid="dev-diagnostics">
          <PanelHeader title="Diagnostics (dev only)" />
          <p className="mt-2 text-sm text-muted">{td.signedInAs}</p>
          <p className="text-sm font-semibold text-ink">
            {email} · {role} · <span className="font-mono text-xs">{tenantId}</span>
          </p>
          <ul className="mt-3 flex flex-col gap-1" data-testid="firm-notes">
            {notes.map((note) => (
              <li key={note} className="rounded-[var(--radius-atlas-sm)] bg-surface-2 px-3 py-2 text-sm text-ink-soft">
                {note}
              </li>
            ))}
          </ul>
          <form
            action={async () => {
              "use server";
              await sendTestNotification();
            }}
            className="mt-4"
          >
            <button type="submit" data-testid="send-test-notification" className={btnGhost}>
              {td.sendTestNotification}
            </button>
          </form>
        </Panel>
      ) : null}
    </main>
  );
}
