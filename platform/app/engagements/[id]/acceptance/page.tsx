import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  advanceToPlanningAction,
  disposeExceptionAction,
  generateLetterAction,
  launchCampaignAction,
  sendReminderAction,
  setMandateAction,
} from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner, GatesPanel } from "@/components/GatesPanel";
import { Panel } from "@/components/ui/atlas";
import { getEngagement } from "@/lib/engagements";
import { acceptanceGates } from "@/lib/gates";
import { getMessages } from "@/lib/i18n";
import { listConfirmations } from "@/lib/independence";
import { listLetters, mandateExpiryYear } from "@/lib/letters";
import { getLocale } from "@/lib/locale";
import { listFirmUsers } from "@/lib/team";
import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export const metadata = { title: "Acceptance & continuance · AuditISA" };

async function clientMandate(clientId: string): Promise<{
  mandateType: "statutes" | "ago" | null;
  mandateStartYear: number | null;
}> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ mandate_type: "statutes" | "ago" | null; mandate_start_year: number | null }>(
      "SELECT mandate_type, mandate_start_year FROM client WHERE id = $1",
      [clientId],
    );
    const row = result.rows[0];
    return { mandateType: row?.mandate_type ?? null, mandateStartYear: row?.mandate_start_year ?? null };
  });
}

export default async function AcceptancePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; failed?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error, failed } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tp = t.planning;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [gates, confirmations, letters, users, mandate] = await Promise.all([
    acceptanceGates(id),
    listConfirmations(id),
    listLetters(id),
    listFirmUsers(),
    getEngagement(id).then((e) => clientMandate(e!.clientId)),
  ]);

  const finalYear =
    mandate.mandateType && mandate.mandateStartYear
      ? mandateExpiryYear(mandate.mandateType, mandate.mandateStartYear) === engagement.fiscalYear
      : false;

  const btn =
    "inline-flex items-center rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-surface-2";
  const btnPrimary =
    "inline-flex items-center rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800";
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const sectionClass = "mt-6";
  const heading = "text-lg font-semibold text-ink";

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold text-ink">
        {engagement.clientName} — {engagement.fiscalYear} · {tp.acceptanceTitle}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="acceptance" />
      <ErrorBanner error={error} failed={failed} locale={locale} />

      <Panel className={sectionClass}>
        <h2 className={heading}>P1.1</h2>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href={`/engagements/${id}/forms/P1.1`} className={btn} data-testid="open-d31-form">
            {tp.openForm} (P1.1)
          </Link>
        </div>
      </Panel>

      <Panel className={sectionClass}>
        <h2 className={heading}>
          {tp.independence.title}
        </h2>
        {confirmations.length === 0 ? (
          <form action={launchCampaignAction.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">{tp.independence.selectRecipients}</span>
              <select name="userIds" multiple size={Math.min(4, users.length)} className={input} data-testid="campaign-recipients">
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={btnPrimary} data-testid="launch-campaign">
              {tp.independence.launch}
            </button>
          </form>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" data-testid="confirmations-list">
            {confirmations.map((confirmation) => (
              <li
                key={confirmation.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-atlas)] border border-line bg-surface-2 px-4 py-2.5 text-sm"
              >
                <span className="font-medium text-ink">
                  {confirmation.userName}
                </span>
                <span
                  data-testid={`confirmation-status-${confirmation.userId}`}
                  className={
                    confirmation.status === "completed"
                      ? "rounded-full bg-[var(--color-good-soft)] px-2 py-0.5 text-xs font-semibold text-good"
                      : confirmation.status === "exception"
                        ? "rounded-full bg-[var(--color-rose-soft)] px-2 py-0.5 text-xs font-semibold text-rose"
                        : "rounded-full bg-[var(--color-warn-soft)] px-2 py-0.5 text-xs font-semibold text-warn"
                  }
                >
                  {tp.independence.status[confirmation.status]}
                  {confirmation.disposition ? " ✓" : ""}
                </span>
                <span className="flex items-center gap-2">
                  {confirmation.userId === session.user.id &&
                  (confirmation.status === "sent" || confirmation.status === "opened") ? (
                    <Link
                      href={`/independence/${confirmation.token}`}
                      className={btn}
                      data-testid="my-confirmation-link"
                    >
                      {tp.openForm}
                    </Link>
                  ) : null}
                  {confirmation.status === "sent" || confirmation.status === "opened" ? (
                    <form action={sendReminderAction.bind(null, id, confirmation.id)}>
                      <button type="submit" className={btn}>
                        {tp.independence.remind} ({confirmation.reminderCount})
                      </button>
                    </form>
                  ) : null}
                  {confirmation.status === "exception" && !confirmation.disposition ? (
                    <form
                      action={disposeExceptionAction.bind(null, id, confirmation.id)}
                      className="flex items-center gap-2"
                    >
                      <input
                        name="disposition"
                        required
                        placeholder={tp.independence.dispositionPlaceholder}
                        className={input}
                        data-testid="disposition-input"
                      />
                      <button type="submit" className={btn} data-testid="dispose-exception">
                        {tp.independence.dispose}
                      </button>
                    </form>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className={sectionClass}>
        <h2 className={heading}>{tp.mandate.title}</h2>
        {mandate.mandateType && mandate.mandateStartYear ? (
          <p className="mt-2 text-sm text-ink-soft">
            {tp.mandate.expires
              .replace("{start}", String(mandate.mandateStartYear))
              .replace(
                "{end}",
                String(mandateExpiryYear(mandate.mandateType, mandate.mandateStartYear)),
              )}
            {finalYear ? (
              <span className="ml-2 font-semibold text-warn" data-testid="mandate-final-year">
                {tp.mandate.finalYear}
              </span>
            ) : null}
          </p>
        ) : null}
        <form
          action={setMandateAction.bind(null, id, engagement.clientId)}
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{tp.mandate.type}</span>
            <select name="mandateType" className={input} defaultValue={mandate.mandateType ?? "ago"}>
              <option value="statutes">{tp.mandate.statutes}</option>
              <option value="ago">{tp.mandate.ago}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{tp.mandate.startYear}</span>
            <input
              name="mandateStartYear"
              type="number"
              min="2000"
              max="2100"
              defaultValue={mandate.mandateStartYear ?? engagement.fiscalYear}
              className={`${input} tnum`}
            />
          </label>
          <button type="submit" className={btn} data-testid="save-mandate">
            {tp.mandate.save}
          </button>
        </form>
      </Panel>

      <Panel className={sectionClass}>
        <h2 className={heading}>{tp.letters.title}</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <form action={generateLetterAction.bind(null, id, "engagement")}>
            <button type="submit" className={btn} data-testid="generate-engagement-letter">
              {tp.letters.engagement}
            </button>
          </form>
          <form action={generateLetterAction.bind(null, id, "planning_tcwg")}>
            <button type="submit" className={btn}>
              {tp.letters.planningTcwg}
            </button>
          </form>
        </div>
        {letters.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {letters.map((letter) => (
              <li key={letter.id}>
                <Link
                  href={`/documents/${letter.id}`}
                  className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {letter.title} (v{letter.currentVersion})
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <Panel className={sectionClass}>
        <h2 className={heading}>{tp.gates}</h2>
        <GatesPanel gates={gates} locale={locale} />
        {engagement.phase === "acceptance" ? (
          <form action={advanceToPlanningAction.bind(null, id)} className="mt-4">
            <button type="submit" className={btnPrimary} data-testid="advance-to-planning">
              {tp.advanceToPlanning}
            </button>
          </form>
        ) : null}
      </Panel>
    </main>
  );
}
