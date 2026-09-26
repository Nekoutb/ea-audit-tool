import Link from "next/link";
import { localizedTitle } from "@/lib/page-title";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { launchCampaignAction, sendReminderAction } from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { SubmitButton } from "@/components/SubmitButton";
import { Chip, Panel, PanelHeader } from "@/components/ui/atlas";
import { getEngagement } from "@/lib/engagements";
import { INDEPENDENCE_QUESTIONS, listConfirmations } from "@/lib/independence";
import { ErrorBanner } from "@/components/GatesPanel";
import { getLocale } from "@/lib/locale";
import { canReview } from "@/lib/rbac";
import { listTeam } from "@/lib/team";

export const generateMetadata = localizedTitle("Independence Campaign", "Campagne d'indépendance");

/** The Independence Campaign: the inquiry issued to the team, responses managed here. */
export default async function IndependencePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  // the campaign's own buttons land back here, not on Acceptance (UAT B118)
  const returnTo = `/engagements/${id}/tools/independence`;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [confirmations, team] = await Promise.all([listConfirmations(id), listTeam(id)]);
  const canManage = canReview(session.user.role);
  // the question itself in the reader's language, not its storage key (UAT B119)
  const questionLabel = (key: string) => {
    const q = INDEPENDENCE_QUESTIONS.find((question) => question.key === key);
    return `${q ? (fr ? q.labelFr : q.labelEn) : key.replace(/_/g, " ")}${fr ? " :" : ":"}`;
  };
  const done = confirmations.filter((c) => c.status === "completed").length;
  const exceptions = confirmations.filter((c) => c.status === "exception").length;
  const outstanding = confirmations.length - done - exceptions;
  // Team members holding no confirmation at all — the gate blocks on them (UAT B13).
  // Only firm staff declare independence: a read-only observer or client
  // contact is neither asked nor counted (UAT run 3 B04).
  const notAsked = team.filter(
    (m) => m.status !== "declined" && m.declaresIndependence && !confirmations.some((c) => c.userId === m.userId),
  ).length;

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour aux outils" : "Back to tools"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="independence-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Campagne d'indépendance" : "Independence Campaign"}
        </h1>
      </div>
      <ErrorBanner error={error} locale={locale} />

      <Panel className="mt-4" id="independence">
        <PanelHeader
          title={fr ? "Déclarations de l'équipe" : "Team declarations"}
          hint={fr ? "Alimente P2.1 et C4.2" : "Feeds P2.1 and C4.2"}
          right={
            canManage ? (
              <form action={launchCampaignAction.bind(null, id)}>
                <input type="hidden" name="returnTo" value={returnTo} />
                {team
                  .filter((m) => m.status !== "declined" && m.declaresIndependence && !confirmations.some((c) => c.userId === m.userId))
                  .map((m) => (
                    <input key={m.userId} type="hidden" name="userIds" value={m.userId} />
                  ))}
                <SubmitButton
                  testId="indep-launch"
                  className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
                >
                  {confirmations.length === 0
                    ? fr ? "Adresser à l'équipe" : "Issue to the team"
                    : fr ? "Adresser aux nouveaux membres" : "Issue to new members"}
                </SubmitButton>
              </form>
            ) : null
          }
        />

        <div className="mt-3 grid gap-2 sm:grid-cols-5" data-testid="indep-stats">
          {[
            [confirmations.length, fr ? "membres" : "team members"],
            [done, fr ? "répondu" : "responded"],
            [outstanding, fr ? "en attente" : "outstanding"],
            [exceptions, fr ? "exceptions" : "exceptions"],
            [notAsked, fr ? "non sollicités" : "not asked"],
          ].map(([n, label]) => (
            <div key={String(label)} className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2">
              <b className="block text-xl font-semibold text-ink tnum">{n}</b>
              <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
            </div>
          ))}
        </div>

        {confirmations.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            {fr
              ? "Aucune déclaration adressée. Constituez l'équipe, puis adressez l'enquête."
              : "No declaration issued yet. Set the team up, then issue the inquiry."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line">
            <table className="w-full text-sm" data-testid="indep-table">
              <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">{fr ? "Membre" : "Member"}</th>
                  <th className="px-3 py-2 font-semibold">{fr ? "Statut" : "Status"}</th>
                  <th className="px-3 py-2 font-semibold">{fr ? "Signé" : "Signed"}</th>
                  <th className="px-3 py-2 font-semibold">{fr ? "Exception" : "Exception"}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {confirmations.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{c.userName}</td>
                    <td className="px-3 py-2">
                      <Chip tone={c.status === "completed" ? "good" : c.status === "exception" ? "rose" : "warn"}>
                        {c.status === "completed"
                          ? fr ? "Répondu" : "Responded"
                          : c.status === "exception"
                            ? fr ? "Exception" : "Exception"
                            : c.status === "opened"
                              ? fr ? "Ouvert" : "Opened"
                              : fr ? "Adressé" : "Sent"}
                      </Chip>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted tnum">{c.signedAt?.slice(0, 10) ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-ink-soft">
                      {c.status === "exception" && c.explanations && Object.keys(c.explanations).length > 0 ? (
                        <div className="flex flex-col gap-1" data-testid={`indep-explanations-${c.id}`}>
                          {Object.entries(c.explanations).map(([k, note]) => (
                            <div key={k}>
                              <span className="font-semibold text-rose">{questionLabel(k)}</span> {note}
                            </div>
                          ))}
                          {c.disposition ? (
                            <div className="text-muted">
                              {fr ? "Disposition" : "Disposition"}: {c.disposition}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        c.disposition ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {/* a reminder is for someone who has not answered; an
                          exception IS an answer, and is dealt with by its
                          disposition rather than by chasing (UAT B124) */}
                      {canManage && (c.status === "sent" || c.status === "opened") ? (
                        <form action={sendReminderAction.bind(null, id, c.id)}>
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <SubmitButton
                            testId={`indep-remind-${c.id}`}
                            className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2"
                          >
                            {fr ? "Relancer" : "Remind"}
                            {c.reminderCount > 0 ? ` (${c.reminderCount})` : ""}
                          </SubmitButton>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </main>
  );
}
