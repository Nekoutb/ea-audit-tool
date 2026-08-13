import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Panel } from "@/components/ui/atlas";
import { getEngagement } from "@/lib/engagements";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Engagement settings · AuditISA" };

/**
 * Engagement settings: what belongs to THIS engagement — the team. Firm-wide
 * matters (branding, integrations) live in firm administration, not here.
 */
export default async function EngagementSettingsPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const fr = locale === "fr";
  const engagement = await getEngagement(id);
  if (!engagement) notFound();

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
