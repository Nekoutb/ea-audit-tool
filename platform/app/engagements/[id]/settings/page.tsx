import Link from "next/link";
import { localizedTitle } from "@/lib/page-title";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { updatePeriodEndAction } from "@/app/actions/audit-file";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { SubmitButton } from "@/components/SubmitButton";
import { Panel, btnPrimary } from "@/components/ui/atlas";
import { getConclusionState } from "@/lib/completion";
import { getEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";
import { canReview, type Role } from "@/lib/rbac";

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
          {fr ? "Date de clôture enregistrée." : "Period end saved."}
        </p>
      ) : null}

      <Panel className="mt-4" data-testid="engsettings-period">
        <h2 className="text-sm font-semibold text-ink">{fr ? "Exercice" : "Period"}</h2>
        <p className="mt-1 text-xs text-muted">
          {fr ? "Exercice" : "Fiscal year"} {engagement.fiscalYear} · {fr ? "Date de clôture" : "Period end"}{" "}
          <span className="tnum" data-testid="engsettings-period-end">{engagement.periodEnd}</span>
          {state.retentionUntil ? (
            <>
              {" · "}
              {fr ? "Conservation jusqu'au" : "Retain until"}{" "}
              <span className="tnum" data-testid="engsettings-retention">{state.retentionUntil}</span>
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
