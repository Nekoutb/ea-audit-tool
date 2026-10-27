import Link from "next/link";
import { localizedTitle } from "@/lib/page-title";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  advanceToPlanningAction,
  generateLetterAction,
  setMandateAction,
} from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner, GatesPanel } from "@/components/GatesPanel";
import { Panel } from "@/components/ui/atlas";
import { priorYearEngagement } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { acceptanceGates } from "@/lib/gates";
import { getMessages } from "@/lib/i18n";
import { listConfirmations } from "@/lib/independence";
import { listLetters, mandateExpiryYear } from "@/lib/letters";
import { getLocale } from "@/lib/locale";
import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export const generateMetadata = localizedTitle("Acceptance & continuance", "Acceptation & maintien");

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

  const [gates, confirmations, letters, mandate, prior] = await Promise.all([
    acceptanceGates(id),
    // read-only history of the retired in-app campaign (F008)
    listConfirmations(id),
    listLetters(id),
    getEngagement(id).then((e) => clientMandate(e!.clientId)),
    priorYearEngagement(id),
  ]);
  // The letters are filed on tasks; there are none until the entity is classified.
  const classified = Boolean(engagement.complexity);
  // A gate that fails after the phase has moved on means a gating paper was
  // reopened (UAT B99): say so, since the phase itself does not move back.
  const gateReopened = engagement.phase !== "acceptance" && gates.some((g) => !g.ok);

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
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />
      <h1 className="mt-8 text-2xl font-semibold text-ink">
        {engagement.clientName} — {engagement.fiscalYear} · {tp.acceptanceTitle}
      </h1>
      <ErrorBanner error={error} failed={failed} locale={locale} />
      {prior ? (
        <p
          data-testid="continuance-banner"
          className="mt-4 rounded-[var(--radius-atlas-sm)] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {locale === "fr"
            ? `Mission récurrente : le dossier de l'exercice ${prior.fiscalYear} est lié et ses éléments reconductibles ont été repris. `
            : `Continuing engagement: the FY${prior.fiscalYear} file is linked and its rolling-forward items were carried over. `}
          <Link href={`/engagements/${prior.id}/dashboard`} className="font-semibold underline" data-testid="prior-file-link">
            {prior.name ?? `FY${prior.fiscalYear}`}
          </Link>
        </p>
      ) : null}
      {gateReopened ? (
        <div
          role="alert"
          data-testid="gate-reopened"
          className="mt-4 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-[var(--color-warn-soft)] px-4 py-3 text-sm text-warn"
        >
          {tp.gateReopened}
        </div>
      ) : null}

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
        {/* F008: declarations are obtained outside the system and filed on P2.1 */}
        <p className="mt-2 text-sm text-ink-soft" data-testid="independence-outside">
          {tp.independence.outside}
        </p>
        {confirmations.length > 0 ? (
          <>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted">
              {tp.independence.history}
            </p>
            <ul className="mt-1 flex flex-col gap-1" data-testid="confirmations-history">
              {confirmations.map((confirmation) => (
                <li key={confirmation.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-ink">{confirmation.userName}</span>
                  <span className="text-xs text-muted">
                    {tp.independence.status[confirmation.status]}
                    {confirmation.signedAt ? ` · ${confirmation.signedAt}` : ""}
                    {confirmation.disposition ? ` · ${confirmation.disposition}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
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
            <button
              type="submit"
              className={`${btn} disabled:cursor-not-allowed disabled:opacity-50`}
              disabled={!classified}
              title={classified ? undefined : tp.errors["classify-first"]}
              data-testid="generate-engagement-letter"
            >
              {tp.letters.engagement}
            </button>
          </form>
          <form action={generateLetterAction.bind(null, id, "planning_tcwg")}>
            <button
              type="submit"
              className={`${btn} disabled:cursor-not-allowed disabled:opacity-50`}
              disabled={!classified}
              title={classified ? undefined : tp.errors["classify-first"]}
            >
              {tp.letters.planningTcwg}
            </button>
          </form>
          {!classified ? (
            <Link href={`/engagements/${id}/nature`} className="self-center text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400" data-testid="classify-first-link">
              {tp.errors["classify-first"]}
            </Link>
          ) : null}
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
