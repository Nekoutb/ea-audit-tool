import { notFound, redirect } from "next/navigation";
import { localizedTitle } from "@/lib/page-title";
import { auth } from "@/auth";
import {
  removeTeamFromTeamPageAction,
  setPartnerDelegateAction,
  transferEngagementPartnerAction,
} from "@/app/actions/planning";
import { addTeamByEmailAction } from "@/app/actions/team-independence";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { NavLink } from "@/components/NavLink";
import { SubmitButton } from "@/components/SubmitButton";
import { Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { initials } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { atLeast, canReview, isRole } from "@/lib/rbac";
import {
  DISPLAY_TIME_ZONE,
  DISPLAY_TIME_ZONE_LABEL,
  TEAM_ROLES,
  engagementPartnerInfo,
  listFirmUsers,
  listTeam,
  openAssignedTaskCounts,
} from "@/lib/team";

export const generateMetadata = localizedTitle("Manage team", "Gestion de l'équipe");

// Page-local label for the open-assigned-tasks cell (not in messages/*.json).
const OPEN_TASKS = {
  en: (n: number) => (n === 1 ? "1 open task" : `${n} open tasks`),
  fr: (n: number) => (n === 1 ? "1 tâche ouverte" : `${n} tâches ouvertes`),
} as const;

/** Manage Team (Canvas structure): active members table + add/remove. */
export default async function TeamPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tt = t.team;
  // The six-level ladder labels live in planning.team.roles (single source).
  const roleLabels = t.planning.team.roles;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [team, firmUsers, openCounts, seat] = await Promise.all([
    listTeam(id),
    listFirmUsers(),
    openAssignedTaskCounts(id),
    engagementPartnerInfo(id),
  ]);
  const fr = locale === "fr";
  // F003: the engagement partner seat. Firm partners and administrators may
  // hold it; the partner or a firm administrator hands it over or delegates.
  const firmPartners = firmUsers.filter((u) => isRole(u.role) && atLeast(u.role, "partner"));
  const maySteerSeat =
    session.user.role === "firm_admin" || (seat.partnerId !== null && seat.partnerId === session.user.id);
  const delegateCandidates = firmPartners.filter(
    (u) =>
      u.id !== seat.partnerId &&
      team.some((m) => m.userId === u.id && m.status !== "declined" && m.teamRole !== "eqr_reviewer"),
  );
  const ladderBelowPartner = TEAM_ROLES.filter((r) => r !== "partner" && r !== "eqr_reviewer");
  const assignable = firmUsers.filter((u) => !team.some((m) => m.userId === u.id));
  const canManage = canReview(session.user.role);
  // "25 sept. 2026 19:20 WAT" in French, "25 Sep 2026 19:20 WAT" in English (UAT B123)
  const respondedFormat = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const respondedLabel = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : `${respondedFormat.format(d).replace(",", "").replace(" à ", " ")} ${DISPLAY_TIME_ZONE_LABEL}`;
  };

  const th =
    "border-b border-line bg-surface-2 px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />

      <div>
        <NavLink
          href={`/engagements/${id}/dashboard`}
          className="inline-flex min-h-[24px] items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          testId="back-to-dashboard"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          {t.dashboard.backToDashboard}
        </NavLink>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">{tt.title}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          {engagement.name ?? engagement.clientName}
          <span className="px-2 text-line-strong">·</span>
          {t.engagements.fiscalYear} {engagement.fiscalYear}
        </p>
      </div>

      <ErrorBanner error={error} locale={locale} />

      <Panel flush>
        <div className="border-b border-line px-5 py-3.5">
          <PanelHeader
            title={tt.active}
            right={<span className="text-xs font-semibold text-muted tnum">{team.length}</span>}
          />
        </div>
        {team.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">{tt.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]" data-testid="team-table">
              <thead>
                <tr>
                  <th className={th}>{tt.member}</th>
                  <th className={th}>{tt.initials}</th>
                  <th className={th}>{tt.role}</th>
                  <th className={th}>{locale === "fr" ? "Statut" : "Status"}</th>
                  <th className={th} />
                  {canManage ? <th className={`${th} text-right`} /> : null}
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr
                    key={m.id}
                    className="transition-colors hover:bg-surface-2"
                    data-testid={`team-row-${m.userId}`}
                  >
                    <td className="border-t border-line px-5 py-3.5">
                      <span className="flex items-center gap-2.5">
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-600"
                          aria-hidden
                        />
                        <span className="text-[13.5px] font-semibold text-ink">{m.userName}</span>
                      </span>
                    </td>
                    <td className="border-t border-line px-5 py-3.5 text-[12.5px] font-bold tracking-wide text-ink-soft">
                      {initials(m.userName)}
                    </td>
                    <td className="border-t border-line px-5 py-3.5 text-[13px] text-ink-soft">
                      {roleLabels[m.teamRole]}
                    </td>
                    <td
                      className="border-t border-line px-5 py-3.5 text-[12px]"
                      data-testid={`team-status-${m.userId}`}
                    >
                      {m.status === "accepted" ? (
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {locale === "fr" ? "Acceptée" : "Accepted"}
                          {m.respondedAt ? ` · ${respondedLabel(m.respondedAt)}` : ""}
                        </span>
                      ) : m.status === "declined" ? (
                        <span className="font-semibold text-rose">
                          {locale === "fr" ? "Refusée" : "Declined"}
                          {m.respondedAt ? ` · ${respondedLabel(m.respondedAt)}` : ""}
                          {m.declineReason ? (
                            <span className="block font-normal text-ink-soft" data-testid={`decline-reason-${m.userId}`}>
                              {locale === "fr" ? "Motif : " : "Reason: "}
                              {m.declineReason}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted">
                          {locale === "fr" ? "Invitée — en attente" : "Invited — awaiting response"}
                        </span>
                      )}
                    </td>
                    <td
                      className="border-t border-line px-5 py-3.5 text-[12px] text-muted tnum"
                      data-testid={`open-tasks-${m.userId}`}
                    >
                      {OPEN_TASKS[locale](openCounts.get(m.userId) ?? 0)}
                    </td>
                    {canManage ? (
                      <td className="border-t border-line px-5 py-3.5 text-right">
                        <form
                          action={removeTeamFromTeamPageAction.bind(null, id, m.userId)}
                          className="inline-block"
                        >
                          <SubmitButton
                            className="rounded-full border border-line-strong px-3 py-1 text-[11.5px] font-semibold text-ink-soft hover:bg-surface-2"
                            testId={`remove-member-${m.userId}`}
                          >
                            {tt.remove}
                          </SubmitButton>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="p-6" data-testid="engagement-partner-panel">
        <PanelHeader
          title={fr ? "Associé responsable de la mission" : "Engagement partner"}
          hint={
            fr
              ? "Un seul associé par mission. Les signatures d'associé sont les siennes, ou celles de l'associé qu'il délègue."
              : "One partner per engagement. Partner sign-offs are theirs, or those of the partner they delegate to."
          }
        />
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{fr ? "Associé" : "Partner"}</dt>
            <dd className="text-ink" data-testid="engagement-partner">
              {seat.partnerName ?? (fr ? "Non désigné" : "Not designated")}
              {seat.partnerStatus === "invited" ? (
                <span className="ml-2 text-xs text-muted">{fr ? "(invitation en attente)" : "(invitation pending)"}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{fr ? "Délégué" : "Delegate"}</dt>
            <dd className="text-ink" data-testid="engagement-partner-delegate">
              {seat.delegateName ?? (fr ? "Aucun" : "None")}
            </dd>
          </div>
        </dl>
        {maySteerSeat && seat.partnerId ? (
          <div className="mt-5 flex flex-col gap-5">
            <form
              action={transferEngagementPartnerAction.bind(null, id)}
              className="flex flex-wrap items-end gap-3"
              data-testid="transfer-partner-form"
            >
              <label className="flex flex-col gap-1 text-sm text-ink-soft">
                {fr ? "Transférer le rôle à" : "Transfer the role to"}
                <select name="newPartner" required defaultValue="" className={input} data-testid="transfer-partner-to">
                  <option value="" disabled>
                    —
                  </option>
                  {firmPartners
                    .filter((u) => u.id !== seat.partnerId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink-soft">
                {fr ? "Nouveau rôle de l'associé sortant" : "Outgoing partner's new role"}
                <select name="outgoingRole" defaultValue="director" className={input} data-testid="transfer-outgoing-role">
                  {ladderBelowPartner.map((r) => (
                    <option key={r} value={r}>
                      {roleLabels[r]}
                    </option>
                  ))}
                </select>
              </label>
              <SubmitButton className={btnPrimary} testId="transfer-partner">
                {fr ? "Transférer" : "Transfer"}
              </SubmitButton>
            </form>
            <form
              action={setPartnerDelegateAction.bind(null, id)}
              className="flex flex-wrap items-end gap-3"
              data-testid="partner-delegate-form"
            >
              <label className="flex flex-col gap-1 text-sm text-ink-soft">
                {fr ? "Associé délégué (signatures d'associé)" : "Delegate partner (partner sign-offs)"}
                <select name="delegate" defaultValue={seat.delegateId ?? ""} className={input} data-testid="partner-delegate">
                  <option value="">{fr ? "Aucun" : "None"}</option>
                  {delegateCandidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <SubmitButton className={btnPrimary} testId="partner-delegate-save">
                {fr ? "Enregistrer" : "Save"}
              </SubmitButton>
              <span className="w-full text-xs text-muted">
                {fr
                  ? "Le délégué doit être un associé du cabinet déjà membre de l'équipe."
                  : "The delegate must be a partner of the firm who is already on the team."}
              </span>
            </form>
          </div>
        ) : null}
      </Panel>

      {canManage ? (
        <Panel className="p-6">
          <PanelHeader title={tt.add} />
          <form
            action={addTeamByEmailAction.bind(null, id, engagement.name ?? engagement.clientName)}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <label className="flex flex-col gap-1 text-sm text-ink-soft">
              {locale === "fr" ? "Adresse e-mail" : "Email address"}
              <input
                type="email"
                name="email"
                required
                list="firm-user-emails"
                placeholder={locale === "fr" ? "prenom.nom@cabinet.com" : "first.last@firm.com"}
                className={input}
                data-testid="team-email"
              />
              <datalist id="firm-user-emails">
                {assignable.map((u) => (
                  <option key={u.id} value={u.email ?? ""}>
                    {u.name}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-soft">
              {locale === "fr" ? "Nom complet" : "Full name"}
              <input
                type="text"
                name="memberName"
                placeholder={locale === "fr" ? "J. P. Mbarga" : "J. P. Mbarga"}
                className={input}
                data-testid="team-name"
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-soft">
              {tt.role}
              <select
                name="teamRole"
                defaultValue="staff"
                className={input}
                data-testid="team-role"
              >
                {TEAM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton className={btnPrimary} testId="team-add">
              {tt.add}
            </SubmitButton>
            {/* Full-width helper on its own wrap line, so the three controls
                above share one baseline instead of bottom-aligning to it. */}
            <span className="w-full text-xs text-muted">
              {locale === "fr"
                ? "Une adresse inconnue crée le compte, au nom saisi ci-dessus — laissé vide, il est déduit de l'adresse. Un collègue déjà enregistré conserve son nom. Le membre est invité par e-mail à accepter la mission."
                : "An unknown address provisions the account under the name typed above — left blank, it is guessed from the address. A colleague who already has an account keeps their name. The member is emailed to accept or decline the engagement."}
            </span>
          </form>
        </Panel>
      ) : null}
    </main>
  );
}
