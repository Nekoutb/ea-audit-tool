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

export const metadata = { title: "Firm dashboard · AuditISA" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { email, role, tenantId } = session.user;
  const locale = await getLocale();
  const t = getMessages(locale);

  // Tenant-scoped read: RLS guarantees these rows belong only to this firm.
  const notes = await withTenant(tenantId, async (client) => {
    const result = await client.query<{ note: string }>(
      "SELECT note FROM rls_probe ORDER BY created_at",
    );
    return result.rows.map((row) => row.note);
  });

  const [firm] = await Promise.all([firmDashboard()]);

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} />

      <section className="mt-6">
        <Panel>
          <p className="text-sm text-muted">{t.dashboard.signedInAs}</p>
          <p className="text-lg font-semibold text-ink">{email}</p>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-4">
              <dt className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted">
                {t.dashboard.role}
              </dt>
              <dd className="mt-1 font-mono text-sm text-ink">{role}</dd>
            </div>
            <div className="rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-4">
              <dt className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted">
                {t.dashboard.tenant}
              </dt>
              <dd className="mt-1 font-mono text-xs text-ink">{tenantId}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <p className="text-sm text-muted">{t.dashboard.firmData}</p>
            <ul className="mt-2 flex flex-col gap-1" data-testid="firm-notes">
              {notes.map((note) => (
                <li
                  key={note}
                  className="rounded-[var(--radius-atlas-sm)] bg-surface-2 px-3 py-2 text-sm text-ink-soft"
                >
                  {note}
                </li>
              ))}
            </ul>
          </div>

          <form
            action={async () => {
              "use server";
              await sendTestNotification();
            }}
            className="mt-6"
          >
            <button type="submit" data-testid="send-test-notification" className={btnGhost}>
              {t.dashboard.sendTestNotification}
            </button>
          </form>
        </Panel>

        {/* 9.4 firm dashboard */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title={t.dashboard.byPhase} />
            <ul className="mt-3 flex flex-wrap gap-2 text-sm" data-testid="firm-by-phase">
              {firm.byPhase.map((entry) => (
                <li
                  key={entry.phase}
                  className="rounded-[var(--radius-atlas-xs)] bg-surface-2 px-2.5 py-1 text-ink-soft"
                >
                  {t.engagements.phases[entry.phase as keyof typeof t.engagements.phases] ?? entry.phase}:{" "}
                  <b className="text-ink tnum">{entry.count}</b>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <PanelHeader title={t.dashboard.workload} />
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-soft" data-testid="firm-workload">
              {firm.workload.map((entry) => (
                <li key={entry.userName}>
                  {entry.userName} — <b className="text-ink tnum">{entry.openSteps}</b>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <PanelHeader title={t.dashboard.mandateExpiries} />
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-soft" data-testid="firm-mandates">
              {firm.mandateExpiries.map((entry) => (
                <li key={entry.clientName}>
                  {entry.clientName} — <b className="text-ink tnum">{entry.expiryYear}</b>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader title={t.dashboard.deadlineHeat} />
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
        </div>

        {/* 9.5 portfolio risk views */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title={t.dashboard.portfolioRisks} />
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
          <Panel>
            <PanelHeader title={t.dashboard.b5Exposure} />
            <ul className="mt-3 flex flex-col gap-1 text-sm" data-testid="portfolio-b5">
              {firm.b5Exposure.map((entry) => (
                <li key={entry.engagementId} className="text-ink-soft">
                  <Link href={`/engagements/${entry.engagementId}/findings`} className="hover:underline">
                    <span className="tnum">
                      {entry.clientName} {entry.fiscalYear} — {formatFCFA(entry.uncorrected)}
                      {entry.materiality === null
                        ? ` (${t.dashboard.noMateriality})`
                        : ` / ${formatFCFA(entry.materiality)}`}
                    </span>
                    {entry.exceeds ? (
                      <span className="ml-1 font-semibold text-rose">{t.dashboard.exceeds}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <p className="mt-6 text-sm text-muted">{t.dashboard.phase1Note}</p>
      </section>
    </main>
  );
}
