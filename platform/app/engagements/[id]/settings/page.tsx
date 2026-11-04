import Link from "next/link";
import { localizedTitle } from "@/lib/page-title";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { updateEngagementSetupAction, updatePeriodEndAction, updateStandardsEditionAction } from "@/app/actions/audit-file";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { SubmitButton } from "@/components/SubmitButton";
import { Panel, btnPrimary } from "@/components/ui/atlas";
import { FRAMEWORKS, DEFAULT_FRAMEWORK, frameworkLabel } from "@/lib/clients";
import { assemblyDeadline, getConclusionState } from "@/lib/completion";
import { engagementSetupOf, getEngagement, standardsEditionOf } from "@/lib/engagements";
import { agoDeadline, fmtDate } from "@/lib/format-date";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { atLeast, canReview, type Role } from "@/lib/rbac";
import { STANDARDS_EDITIONS, editionLabel } from "@/lib/standards-edition";

export const generateMetadata = localizedTitle("Engagement settings", "Paramètres de la mission");

/**
 * Engagement settings: what belongs to THIS engagement — the team, and the
 * period end while the file is still being opened. Firm-wide matters
 * (branding, integrations) live in firm administration, not here.
 */
export default async function EngagementSettingsPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error, saved } = await props.searchParams;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const state = await getConclusionState(id);
  const periodEditable =
    (engagement.phase === "acceptance" || engagement.phase === "planning") && canReview(session.user.role as Role);
  // the standards edition (F045): derived from the period, overridable by a manager or above with a reason
  const se = getMessages(locale).standardsEdition;
  const setup = await engagementSetupOf(id);
  const setupEditable = engagement.phase !== "archived" && atLeast(session.user.role as Role, "manager");
  const currentFramework = setup?.framework ?? DEFAULT_FRAMEWORK;
  const legacyFramework = (FRAMEWORKS as readonly string[]).includes(currentFramework) ? null : currentFramework;
  const editionInfo = await standardsEditionOf(id);
  const editionEditable = engagement.phase !== "archived" && atLeast(session.user.role as Role, "manager");
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/dashboard`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour au tableau de bord" : "Back to dashboard"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="engsettings-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Paramètres de la mission" : "Engagement settings"}
        </h1>
      </div>

      <ErrorBanner error={error} locale={locale} />
      {saved ? (
        <p className="mt-4 text-sm font-semibold text-emerald-700 dark:text-emerald-400" data-testid="engsettings-saved">
          {saved === "edition"
            ? se.saved
            : saved === "setup"
              ? fr ? "Référentiel et date prévue enregistrés." : "Framework and planned date saved."
              : fr ? "Date de clôture enregistrée." : "Period end saved."}
        </p>
      ) : null}

      <Panel className="mt-4" data-testid="engsettings-period">
        <h2 className="text-sm font-semibold text-ink">{fr ? "Exercice" : "Period"}</h2>
        <p className="mt-1 text-xs text-muted">
          {fr ? "Exercice" : "Fiscal year"} {engagement.fiscalYear} · {fr ? "Date de clôture" : "Period end"}{" "}
          <span className="tnum" data-testid="engsettings-period-end">{fmtDate(engagement.periodEnd)}</span>
          {state.retentionUntil ? (
            <>
              {" · "}
              {fr ? "Conservation jusqu'au" : "Retain until"}{" "}
              <span className="tnum" data-testid="engsettings-retention">{fmtDate(state.retentionUntil)}</span>
            </>
          ) : null}
        </p>
        {periodEditable ? (
          <form action={updatePeriodEndAction.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">{fr ? "Corriger la date de clôture" : "Correct the period end"}</span>
              <input name="periodEnd" type="date" defaultValue={engagement.periodEnd} required className={input} data-testid="engsettings-period-input" />
            </label>
            <SubmitButton className={btnPrimary} testId="engsettings-period-save">
              {fr ? "Enregistrer" : "Save"}
            </SubmitButton>
            <span className="text-xs text-muted">
              {fr
                ? "Modifiable pendant l'acceptation et la planification ; le nom de la mission est regénéré."
                : "Editable during acceptance and planning; the engagement name is regenerated."}
            </span>
          </form>
        ) : null}
      </Panel>

      <Panel className="mt-4" data-testid="engsettings-status">
        <h2 className="text-sm font-semibold text-ink">{fr ? "Rapport et verrouillage" : "Report and lock"}</h2>
        <dl className="mt-2 grid gap-x-8 gap-y-2 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted">{fr ? "Date du rapport" : "Report date"}</dt>
            <dd className="tnum text-ink" data-testid="engsettings-report-date">
              {fmtDate(state.reportDate)}{" "}
              <Link href={`/engagements/${id}/conclusion`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                {fr ? "Conclusion" : "Conclusion"}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-muted">{fr ? "Date limite d'assemblage (rapport + 60 jours)" : "Assembly deadline (report + 60 days)"}</dt>
            <dd className="tnum text-ink" data-testid="engsettings-assembly">
              {state.reportDate ? fmtDate(assemblyDeadline(state.reportDate)) : fr ? "— (date du rapport non fixée)" : "— (no report date yet)"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{fr ? "Verrouillage du dossier" : "File lock"}</dt>
            <dd className="text-ink" data-testid="engsettings-lock">
              {state.archivedAt
                ? `${fr ? "Archivé et verrouillé le" : "Archived and locked on"} ${fmtDate(state.archivedAt)}`
                : fr ? "Ouvert (verrouillé à l'archivage, C6.2)" : "Open (locked on archiving, C6.2)"}
            </dd>
          </div>
        </dl>
      </Panel>

      <Panel className="mt-4" data-testid="engsettings-setup">
        <h2 className="text-sm font-semibold text-ink">{fr ? "Référentiel et assemblée" : "Framework and general meeting"}</h2>
        <p className="mt-1 text-xs text-muted">
          {fr ? "Rapport attendu avant le" : "Report due before"}{" "}
          <span className="tnum font-semibold text-ink" data-testid="engsettings-ago">{fmtDate(setup?.plannedAgmDate ?? agoDeadline(engagement.periodEnd))}</span>{" "}
          {setup?.plannedAgmDate
            ? fr ? "(date prévue saisie)" : "(planned date entered)"
            : fr ? "(clôture + 6 mois)" : "(period end + 6 months)"}
        </p>
        {setupEditable ? (
          <form action={updateEngagementSetupAction.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">{fr ? "Référentiel comptable" : "Reporting framework"}</span>
              <select name="framework" defaultValue={currentFramework} required className={input} data-testid="engsettings-framework">
                {FRAMEWORKS.map((f) => (
                  <option key={f} value={f}>{frameworkLabel(f, locale)}</option>
                ))}
                {legacyFramework ? <option value={legacyFramework}>{frameworkLabel(legacyFramework, locale)}</option> : null}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">{fr ? "Date prévue du rapport / de l'AGO" : "Planned report / AGM date"}</span>
              <input name="plannedAgmDate" type="date" defaultValue={setup?.plannedAgmDate ?? ""} className={input} data-testid="engsettings-planned-agm" />
            </label>
            <SubmitButton className={btnPrimary} testId="engsettings-setup-save">
              {fr ? "Enregistrer" : "Save"}
            </SubmitButton>
          </form>
        ) : (
          <p className="mt-1 text-xs text-muted">{frameworkLabel(currentFramework, locale)}</p>
        )}
      </Panel>

      {editionInfo ? (
        <Panel className="mt-4" data-testid="engsettings-edition">
          <h2 className="text-sm font-semibold text-ink">{se.label}</h2>
          <p className="mt-1 text-xs text-muted">
            <span className="font-semibold text-ink" data-testid="engsettings-edition-value">{editionLabel(editionInfo.edition, locale)}</span>
            {" · "}
            {editionInfo.overridden ? se.overridden : se.derived}
            {" · "}
            {fr ? "début d'exercice" : "period start"} <span className="tnum">{fmtDate(editionInfo.periodStart)}</span>
            {editionInfo.overridden ? (
              <>
                {" · "}
                {se.derived}: {editionLabel(editionInfo.derived, locale)}
              </>
            ) : null}
          </p>
          <p className="mt-1 max-w-3xl text-xs text-muted">{se.hint}</p>
          {editionEditable ? (
            <form action={updateStandardsEditionAction.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-soft">{se.change}</span>
                <select name="standardsEdition" defaultValue={editionInfo.edition} required className={input} data-testid="engsettings-edition-select">
                  {STANDARDS_EDITIONS.map((e) => (
                    <option key={e} value={e}>
                      {editionLabel(e, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[18rem] flex-1 flex-col gap-1 text-sm">
                <span className="text-ink-soft">{se.reason}</span>
                <input name="reason" type="text" required maxLength={500} className={input} data-testid="engsettings-edition-reason" />
              </label>
              <SubmitButton className={btnPrimary} testId="engsettings-edition-save">
                {se.save}
              </SubmitButton>
            </form>
          ) : (
            <p className="mt-2 text-xs text-muted">{se.managerOnly}</p>
          )}
        </Panel>
      ) : null}

      <Panel className="mt-4">
        <ul className="divide-y divide-line" data-testid="engsettings-list">
          <li>
            <Link
              href={`/engagements/${id}/team`}
              data-testid="engsettings-team"
              className="flex items-center gap-3 py-3 transition hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{fr ? "Équipe" : "Team"}</span>
                <span className="block text-xs text-muted">
                  {fr
                    ? "Inviter des membres par e-mail, attribuer les rôles et suivre les acceptations"
                    : "Invite team members by email, set their roles and track acceptances"}
                </span>
              </span>
              <span className="flex-shrink-0 text-muted" aria-hidden>›</span>
            </Link>
          </li>
        </ul>
      </Panel>
    </main>
  );
}
