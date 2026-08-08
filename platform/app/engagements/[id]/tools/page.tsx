import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { launchCampaignAction, sendReminderAction } from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { PhaseNav } from "@/components/PhaseNav";
import { SubmitButton } from "@/components/SubmitButton";
import { Chip, Panel, PanelHeader } from "@/components/ui/atlas";
import { engagementTasks } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { listConfirmations } from "@/lib/independence";
import { getLocale } from "@/lib/locale";
import { canReview } from "@/lib/rbac";
import { listTeam } from "@/lib/team";
import { sectionLabel, type SectionKey } from "@/lib/task-groups";

export const metadata = { title: "Tools · AuditISA" };

/**
 * Every audit tool in one place. Each row states the working papers its output
 * lands in, so the link between a tool and the file is visible from here as well
 * as from the task. Tools no longer live inside the audit programme.
 */
interface ToolDef {
  id: string;
  nameEn: string;
  nameFr: string;
  descEn: string;
  descFr: string;
  /** internal task codes this tool feeds */
  feeds: string[];
  phase: SectionKey;
  href: (id: string) => string;
}

const TOOLS: ToolDef[] = [
  {
    id: "independence",
    nameEn: "Independence inquiry",
    nameFr: "Enquête d’indépendance",
    descEn: "Issue the declaration to the whole team and manage the responses",
    descFr: "Adresser la déclaration à toute l’équipe et suivre les réponses",
    feeds: ["D3.1", "B2"],
    phase: "acceptance",
    href: () => "#independence",
  },
  {
    id: "materiality",
    nameEn: "Materiality",
    nameFr: "Seuil de signification",
    descEn: "Overall, performance and clearly trivial, with approval",
    descFr: "Seuil global, seuil de travail et seuil négligeable",
    feeds: ["D5.1"],
    phase: "strategy",
    href: (id) => `/engagements/${id}/planning`,
  },
  {
    id: "trial-balance",
    nameEn: "Trial balance",
    nameFr: "Balance générale",
    descEn: "Import, map to lead schedules, and version",
    descFr: "Importer, rattacher aux feuilles maîtresses et versionner",
    feeds: ["D5.2"],
    phase: "strategy",
    href: (id) => `/engagements/${id}/data`,
  },
  {
    id: "analytics",
    nameEn: "Analytical procedures",
    nameFr: "Procédures analytiques",
    descEn: "Current against prior period, by lead schedule, with ratios",
    descFr: "Exercice courant contre antérieur, par feuille maîtresse",
    feeds: ["D5.2"],
    phase: "strategy",
    href: (id) => `/engagements/${id}/analytics`,
  },
  {
    id: "risk",
    nameEn: "Risk register",
    nameFr: "Registre des risques",
    descEn: "What can go wrong by assertion, and the strategy against each",
    descFr: "Ce qui peut mal tourner par assertion et la stratégie retenue",
    feeds: ["D7.2"],
    phase: "strategy",
    href: (id) => `/engagements/${id}/risks`,
  },
  {
    id: "cra",
    nameEn: "Combined risk assessment",
    nameFr: "Évaluation combinée des risques",
    descEn: "Accounts against assertions, inherent and control risk",
    descFr: "Comptes par assertions, risque inhérent et de contrôle",
    feeds: ["D7.2"],
    phase: "strategy",
    href: (id) => `/engagements/${id}/cra`,
  },
  {
    id: "confirmations",
    nameEn: "External confirmations",
    nameFr: "Confirmations externes",
    descEn: "Positive and negative requests, dispatch, replies and exceptions",
    descFr: "Demandes positives et négatives, envois, réponses et exceptions",
    feeds: ["E100", "E170"],
    phase: "execution",
    href: (id) => `/engagements/${id}/confirmations`,
  },
  {
    id: "findings",
    nameEn: "Misstatement schedule",
    nameFr: "Récapitulatif des anomalies",
    descEn: "Accumulation, projection and evaluation against materiality",
    descFr: "Accumulation, extrapolation et évaluation au regard du seuil",
    feeds: ["B5"],
    phase: "conclusion",
    href: (id) => `/engagements/${id}/findings`,
  },
];

export default async function ToolsPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [confirmations, tasks, team] = await Promise.all([
    listConfirmations(id),
    engagementTasks(id),
    listTeam(id),
  ]);
  const byCode = new Map(tasks.map((x) => [x.code, x]));
  const canManage = canReview(session.user.role);

  const done = confirmations.filter((c) => c.status === "completed").length;
  const exceptions = confirmations.filter((c) => c.status === "exception").length;
  const outstanding = confirmations.length - done - exceptions;

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} current={{ id, label: engagement.clientName }} />
      <PhaseNav engagementId={id} locale={locale} active="tools" />

      <header className="mt-8">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Outils" : "Tools"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {fr
            ? "Les résultats alimentent les feuilles de travail indiquées."
            : "Results flow into the working papers listed."}
        </p>
      </header>

      <Panel className="mt-6">
        <ul className="divide-y divide-line" data-testid="tool-list">
          {TOOLS.map((tool) => (
            <li key={tool.id}>
              <Link
                href={tool.href(id)}
                data-testid={`tool-${tool.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 transition hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{fr ? tool.nameFr : tool.nameEn}</span>
                  <span className="block text-xs text-muted">{fr ? tool.descFr : tool.descEn}</span>
                </span>
                <span className="flex flex-shrink-0 flex-wrap items-center gap-1">
                  <Chip tone="muted">{sectionLabel(tool.phase, locale)}</Chip>
                  {tool.feeds.map((code) => {
                    const task = byCode.get(code);
                    return (
                      <span
                        key={code}
                        className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        title={task ? (fr ? task.titleFr : task.titleEn) : code}
                      >
                        {code}
                      </span>
                    );
                  })}
                </span>
                <span className="flex-shrink-0 text-muted" aria-hidden>›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Independence inquiry — issued to the whole team, responses managed here */}
      <Panel className="mt-6" id="independence">
        <PanelHeader
          title={fr ? "Enquête d’indépendance" : "Independence inquiry"}
          hint={fr ? "Alimente D3.1 et B2" : "Feeds D3.1 and B2"}
          right={
            canManage ? (
              <form action={launchCampaignAction.bind(null, id)}>
                {team
                  .filter((m) => !confirmations.some((c) => c.userId === m.userId))
                  .map((m) => (
                    <input key={m.userId} type="hidden" name="userIds" value={m.userId} />
                  ))}
                <SubmitButton
                  testId="indep-launch"
                  className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
                >
                  {confirmations.length === 0
                    ? fr ? "Adresser à l’équipe" : "Issue to the team"
                    : fr ? "Adresser aux nouveaux membres" : "Issue to new members"}
                </SubmitButton>
              </form>
            ) : null
          }
        />

        <div className="mt-3 grid gap-2 sm:grid-cols-4" data-testid="indep-stats">
          {[
            [confirmations.length, fr ? "membres" : "team members"],
            [done, fr ? "répondu" : "responded"],
            [outstanding, fr ? "en attente" : "outstanding"],
            [exceptions, fr ? "exceptions" : "exceptions"],
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
              ? "Aucune déclaration adressée. Constituez l’équipe, puis adressez l’enquête."
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
                      <Chip
                        tone={c.status === "completed" ? "good" : c.status === "exception" ? "rose" : "warn"}
                      >
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
                    <td className="px-3 py-2 text-xs text-ink-soft">{c.disposition ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {canManage && c.status !== "completed" ? (
                        <form action={sendReminderAction.bind(null, id, c.id)}>
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
