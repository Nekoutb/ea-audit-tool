import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { respondEngagementAction } from "@/app/actions/team-independence";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { SubmitButton } from "@/components/SubmitButton";
import { Panel } from "@/components/ui/atlas";
import { canSeeEngagement } from "@/lib/engagement-access";
import { getLocale } from "@/lib/locale";
import { localizedTitle } from "@/lib/page-title";
import { myInvitation } from "@/lib/team";

export const generateMetadata = localizedTitle("Engagement invitation", "Invitation à une mission");

const ROLE_LABELS: Record<string, { en: string; fr: string }> = {
  partner: { en: "Engagement partner", fr: "Associé responsable" },
  director: { en: "Director", fr: "Directeur" },
  senior_manager: { en: "Senior manager", fr: "Manager senior" },
  manager: { en: "Manager", fr: "Manager" },
  senior: { en: "Senior", fr: "Senior" },
  staff: { en: "Staff", fr: "Assistant" },
  eqr_reviewer: { en: "Engagement quality reviewer", fr: "Responsable de la revue de qualité" },
};

/**
 * The only screen of an engagement an invited (not yet accepted) member may
 * open (F008): the invitation itself, with accept and decline. Nothing of the
 * file's content is shown; accepting opens the engagement.
 */
export default async function InvitationPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const fr = locale === "fr";

  const invitation = await myInvitation(id);
  if (!invitation) {
    // already a member: straight to the file; otherwise there is nothing here
    if (await canSeeEngagement(id).catch(() => false)) redirect(`/engagements/${id}/dashboard`);
    redirect("/engagements?error=not-on-this-engagement");
  }
  const role = ROLE_LABELS[invitation.teamRole];

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} />
      <div className="mx-auto mt-8 w-full max-w-2xl">
        <ErrorBanner error={error} locale={locale} />
        <Panel className="mt-4" data-testid="engagement-invitation">
          <h1 className="text-xl font-semibold text-ink">
            {fr ? "Invitation à une mission" : "Engagement invitation"}
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            {fr
              ? `Vous avez été invité(e) à rejoindre l'équipe de la mission « ${invitation.engagementName} » (${invitation.clientName}, exercice ${invitation.fiscalYear}) en tant que ${role ? role.fr : invitation.teamRole}.`
              : `You have been invited to join the team of the engagement "${invitation.engagementName}" (${invitation.clientName}, FY${invitation.fiscalYear}) as ${role ? role.en : invitation.teamRole}.`}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            {fr
              ? "Le dossier ne s'ouvre qu'aux membres ayant accepté l'invitation."
              : "The file opens only to members who have accepted the invitation."}
          </p>
          <div className="mt-5 flex flex-wrap items-start gap-3">
            <form action={respondEngagementAction.bind(null, id, true)}>
              <SubmitButton
                className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
                testId="accept-engagement"
              >
                {fr ? "Accepter" : "Accept"}
              </SubmitButton>
            </form>
            <form
              action={respondEngagementAction.bind(null, id, false)}
              className="flex min-w-0 flex-wrap items-center gap-2"
            >
              {/* a decline says why, and the partner hears it (UAT B130) */}
              <input
                name="reason"
                required
                minLength={3}
                pattern=".*\S.*\S.*\S.*"
                title={fr ? "Un motif est requis." : "A reason is required."}
                placeholder={fr ? "Motif du refus (obligatoire)" : "Reason for declining (required)"}
                className="w-full min-w-0 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-emerald-600 sm:w-64"
                data-testid="decline-reason"
              />
              <SubmitButton
                className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-surface-2"
                testId="decline-engagement"
              >
                {fr ? "Refuser" : "Decline"}
              </SubmitButton>
            </form>
          </div>
        </Panel>
      </div>
    </main>
  );
}
