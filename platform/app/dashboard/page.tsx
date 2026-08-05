import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sendTestNotification } from "@/app/actions/notifications";
import { AppNav } from "@/components/AppNav";
import { Panel, PanelHeader, btnGhost } from "@/components/ui/atlas";
import { firmDashboard } from "@/lib/dashboards";
import { withTenant } from "@/lib/db";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

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

  const firm = await firmDashboard();

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-4">
      <AppNav locale={locale} />

      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{td.portfolioTitle}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">{td.portfolioHint}</p>
      </div>

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
