import { notFound, redirect } from "next/navigation";
import { localizedTitle } from "@/lib/page-title";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { NavLink } from "@/components/NavLink";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { listActivity } from "@/lib/activity";
import { initials } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

/**
 * The trail stores its summaries in English; the materiality lines are
 * rendered in the reader's language (UAT B127: "Materiality v3 approved").
 */
function localizedSummary(summary: string, locale: string): string {
  if (locale !== "fr") return summary;
  const m = /^Materiality v(\d+) (created|revised|approved)$/.exec(summary);
  if (m) {
    const verb = m[2] === "created" ? "créé" : m[2] === "revised" ? "révisé" : "approuvé";
    return `Seuil de signification v${m[1]} ${verb}`;
  }
  // the team, assignment, sign-off and evidence lines (UAT run 3 B14);
  // anything unrecognised is shown as stored
  const role = (r: string) =>
    (({
      partner: "associé",
      manager: "manager",
      senior: "senior",
      staff: "assistant",
      "eqr reviewer": "réviseur qualité (EQR)",
      eqr: "réviseur qualité (EQR)",
      preparer: "préparateur",
      reviewer: "réviseur",
    }) as Record<string, string>)[r] ?? r;
  const rules: [RegExp, (g: string[]) => string][] = [
    [/^(.+) removed from the team \((.+)\)$/, (g) => `${g[1]} retiré(e) de l'équipe (${role(g[2])})`],
    [/^(\S+) unassigned \((.+) left the team\)$/, (g) => `${g[1]} désassignée (${g[2]} a quitté l'équipe)`],
    [/^(\S+) assigned$/, (g) => `${g[1]} assignée`],
    [/^(\S+) unassigned$/, (g) => `${g[1]} désassignée`],
    [/^(\S+ )?signed off as (\w+)$/, (g) => `${g[1] ?? ""}signé comme ${role(g[2])}`],
    [/^(\w+) sign-off on (\S+) voided — the paper was edited after signing$/, (g) => `Signature ${role(g[1])} sur ${g[2]} annulée — le document a été modifié après signature`],
    [/^Attachment (uploaded|deleted|restored): (.+)$/, (g) => `Pièce jointe ${({ uploaded: "déposée", deleted: "supprimée", restored: "restaurée" } as Record<string, string>)[g[1]]} : ${g[2]}`],
    [/^Attachment renamed (.+) → (.+)$/, (g) => `Pièce jointe renommée ${g[1]} → ${g[2]}`],
    [/^Deleted: (.+) \(restorable for (\d+) days\)$/, (g) => `Supprimé : ${g[1]} (restaurable pendant ${g[2]} jours)`],
    [/^Independence confirmation signed by (.+) — (completed|exception)$/, (g) => `Confirmation d'indépendance signée par ${g[1]} — ${g[2] === "exception" ? "exception" : "sans exception"}`],
    [/^S5\.5 (\S+) (\S+) changed$/, (g) => `S5.5 ${g[1]} ${g[2]} modifié`],
    // the remaining common entries (UAT run 2 B24)
    [/^Engagement created$/, () => "Mission créée"],
    [/^Nature of entity concluded: (complex|non complex|very simple)(?: \(reason: (.+)\))?$/, (g) => `Nature de l'entité conclue : ${({ complex: "complexe", "non complex": "non complexe", "very simple": "très simple" } as Record<string, string>)[g[1]] ?? g[1]}${g[2] ? ` (motif : ${g[2]})` : ""}`],
    [/^Period end changed from (\S+) to (\S+)$/, (g) => `Date de clôture modifiée : ${g[1]} → ${g[2]}`],
    [/^Period end changed to (\S+)$/, (g) => `Date de clôture modifiée : ${g[1]}`],
    [/^Trial balance imported \((\w+), v(\d+), (.+)\) — (\w+)$/, (g) => `Balance importée (${g[1] === "pre_audit" ? "avant audit" : g[1] === "post_audit" ? "après audit" : g[1]}, v${g[2]}, ${g[3]}) — ${g[4] === "valid" ? "valide" : g[4] === "invalid" ? "invalide" : g[4]}`],
    [/^Restored: (.+)$/, (g) => `Restauré : ${g[1]}`],
    [/^Review note raised on (\S+)$/, (g) => `Note de revue émise sur ${g[1] === "task" ? "la tâche" : g[1]}`],
    [/^Review note on (\S+) (answered|cleared)$/, (g) => `Note de revue sur ${g[1] === "task" ? "la tâche" : g[1]} ${g[2] === "answered" ? "répondue" : "levée"}`],
    [/^(\S+) working paper generated \((.+)\)$/, (g) => `${g[1]} feuille de travail générée (${g[2]})`],
    [/^(\S+) working paper saved — (.+)$/, (g) => `${g[1]} feuille de travail enregistrée — ${g[2]}`],
    [/^(\S+) tasks instantiated$/, (g) => `Tâches ${g[1]} ajoutées`],
    [/^Due date set to (\S+)$/, (g) => `Échéance fixée au ${g[1]}`],
    [/^Due date cleared$/, () => "Échéance supprimée"],
    [/^Acceptance gates passed — engagement moved to planning$/, () => "Conditions d'acceptation remplies — mission passée en planification"],
    [/^Planning closed — snapshot taken, engagement moved to execution$/, () => "Planification clôturée — instantané pris, mission passée en exécution"],
    [/^Refused: (.+)$/, (g) => `Refusé : ${g[1]}`],
    [/^Audit file archived and locked$/, () => "Dossier archivé et verrouillé"],
    // the client-request (PBC) trail (UAT run 2 B74)
    [/^PBC requested: (.+)$/, (g) => `Demande au client (PBC) émise : ${g[1]}`],
    [/^PBC chased: (.+)$/, (g) => `Demande au client (PBC) relancée : ${g[1]}`],
    [/^PBC uploaded by the client: (.+)$/, (g) => `Document déposé par le client (PBC) : ${g[1]}`],
    [/^PBC (accepted|filed): (.+)$/, (g) => `Demande au client (PBC) ${g[1] === "accepted" ? "acceptée" : "classée"} : ${g[2]}`],
  ];
  for (const [re, fr] of rules) {
    const hit = re.exec(summary);
    if (hit) return fr([...hit]);
  }
  return summary;
}

export const generateMetadata = localizedTitle("Activity", "Activité");

/** Engagement activity timeline — the unified audit trail of user actions. */
export default async function ActivityPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const t = getMessages(locale);
  const ta = t.dashboard.activity;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const rows = await listActivity(id);

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />

      <div>
        <NavLink
          href={`/engagements/${id}/dashboard`}
          className="inline-flex min-h-[24px] items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          testId="back-to-dashboard"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          {t.dashboard.backToDashboard}
        </NavLink>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">{ta.title}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">{ta.subtitle}</p>
      </div>

      <Panel flush className="flex flex-col">
        <div className="border-b border-line px-5 py-3.5">
          <PanelHeader
            title={ta.title}
            right={
              <span className="flex items-center gap-3">
                <span className="text-xs font-semibold text-muted tnum">{rows.length}</span>
                {/* the trail as a readable file, and the complete audit-file bundle (UAT B157) */}
                <a
                  href={`/api/engagements/${id}/activity/export`}
                  className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  data-testid="activity-export"
                >
                  {locale === "fr" ? "Exporter (CSV)" : "Export (CSV)"}
                </a>
                <a
                  href={`/api/engagements/${id}/export/bundle`}
                  className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  data-testid="activity-bundle"
                >
                  {locale === "fr" ? "Dossier complet (ZIP)" : "Audit-file bundle (ZIP)"}
                </a>
              </span>
            }
          />
        </div>
        <div className="p-1.5" data-testid="activity-log">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{ta.empty}</p>
          ) : (
            <ol className="flex flex-col">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3.5 border-b border-line px-4 py-3 last:border-b-0">
                  <span
                    className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-emerald-50 text-[11px] font-extrabold tracking-wide text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    aria-hidden
                  >
                    {row.userName ? initials(row.userName) : "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] text-ink">
                      <span className="font-semibold">{row.userName ?? "—"}</span>
                      <span className="text-ink-soft"> · {localizedSummary(row.summary ?? row.action, locale)}</span>
                    </p>
                    <p className="text-[11.5px] text-muted">
                      {(ta.entityLabels as Record<string, string>)[row.entityType] ?? row.entityType}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-[11.5px] font-medium text-muted tnum">{row.at}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Panel>
    </main>
  );
}
