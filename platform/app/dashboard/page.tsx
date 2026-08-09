import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sendTestNotification } from "@/app/actions/notifications";
import { AppNav } from "@/components/AppNav";
import { Panel, PanelHeader, btnGhost } from "@/components/ui/atlas";
import { withTenant } from "@/lib/db";
import { phaseDeadline, type DashboardPhase } from "@/lib/engagement-dashboard";
import { listEngagements } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "My engagements · AuditISA" };

/**
 * The screen after sign-in: a welcome, and the engagements the user is
 * assigned to — nothing else. Assignment means membership of the engagement
 * team or ownership of a task in it. The dev-only diagnostics panel remains
 * outside production because the E2E isolation and notification suites
 * depend on it.
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
  const fr = locale === "fr";

  const notes = showDiagnostics
    ? await withTenant(tenantId, async (client) => {
        const result = await client.query<{ note: string }>(
          "SELECT note FROM rls_probe ORDER BY created_at",
        );
        return result.rows.map((row) => row.note);
      })
    : [];

  const register = await listEngagements();
  const myEngagements = register
    .filter((e) => e.isMine && e.phase !== "archived")
    .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8">
      <AppNav locale={locale} />

      <div className="mx-auto w-full max-w-3xl pt-6">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink" data-testid="welcome">
          {fr ? "Bienvenue" : "Welcome back"}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          {fr ? "Vos missions." : "Your engagements."}
        </p>

        <Panel flush className="mt-4 flex flex-col">
          <div className="flex flex-col gap-1 p-1.5" data-testid="my-engagements">
            {myEngagements.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                {fr
                  ? "Aucune mission ne vous est affectée. Rapprochez-vous de l’associé responsable."
                  : "No engagement is assigned to you. Ask the engagement partner to add you to a team."}
              </p>
            ) : (
              myEngagements.map((e) => {
                const pct = e.tasksTotal > 0 ? Math.round((e.tasksDone / e.tasksTotal) * 100) : 0;
                return (
                  <Link
                    key={e.id}
                    href={`/engagements/${e.id}/dashboard`}
                    className="flex items-center gap-4 rounded-[var(--radius-atlas-xs)] px-4 py-3.5 transition hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink">
                        {e.name ?? e.clientName}
                      </span>
                      <span className="block truncate text-[12px] text-muted tnum">
                        {t.engagements.stages[e.phase]} · {t.engagements.fiscalYear} {e.fiscalYear} ·{" "}
                        {phaseDeadline(e.periodEnd, (e.phase === "archived" ? "conclusion" : e.phase) as DashboardPhase)}
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-3">
                      <span className="h-[6px] w-[72px] overflow-hidden rounded-full bg-line">
                        <span className="block h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-9 text-right text-[11px] text-muted tnum">{pct}%</span>
                      <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {td.myEngagements.continueLabel} →
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </Panel>
      </div>

      {showDiagnostics ? (
        <Panel className="mx-auto w-full max-w-3xl p-5" data-testid="dev-diagnostics">
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
