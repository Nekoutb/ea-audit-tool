import Link from "next/link";
import { localizedTitle } from "@/lib/page-title";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  archiveAction,
  disclosureChecklistAction,
  finalAnalyticsAction,
  fsTieoutAction,
  generateConclusionLetterAction,
  issueReportAction,
  partnerConclusionAction,
  pointsForwardAction,
  rollforwardAction,
  subsequentEventsAction,
} from "@/app/actions/conclusion";
import { placeLegalHoldAction, releaseLegalHoldAction } from "@/app/actions/retention";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner, GatesPanel } from "@/components/GatesPanel";
import { Panel } from "@/components/ui/atlas";
import { getClient } from "@/lib/clients";
import {
  archiveGates,
  assemblyDeadline,
  completionGates,
  getCompletionRecord,
  getConclusionState,
} from "@/lib/completion";
import { getEngagement } from "@/lib/engagements";
import { atLeast, canPartnerSignoff, type Role } from "@/lib/rbac";
import { listHolds, retentionDate, retentionPolicy } from "@/lib/retention";
import { REPORT_COMPONENTS } from "@/lib/report-components";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const generateMetadata = localizedTitle("Conclusion", "Conclusion");

export default async function ConclusionPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; failed?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error, failed } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tc = t.planning.conclusion;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [gates, archGates, state, disclosure, subsequent, points, partner, client, holds, retention] = await Promise.all([
    completionGates(id),
    archiveGates(id),
    getConclusionState(id),
    getCompletionRecord(id, "disclosure_checklist"),
    getCompletionRecord(id, "subsequent_events"),
    getCompletionRecord(id, "points_forward"),
    getCompletionRecord(id, "partner_conclusion"),
    getClient(engagement.clientId),
    listHolds(id),
    retentionPolicy(),
  ]);
  const hold = holds.find((h) => h.releasedAt === null) ?? null;
  const releasedHolds = holds.filter((h) => h.releasedAt !== null);
  const role = session.user.role as Role;
  const canPlaceHold = atLeast(role, "manager");
  const canReleaseHold = atLeast(role, "partner");
  // Partner-only actions are offered to a partner only; others see who acts (UAT run 2 B36, run 3 B16).
  const isPartner = canPartnerSignoff(role);
  const awaitingPartner = locale === "fr" ? "En attente de l'associé de la mission" : "Awaiting the engagement partner";
  // Once archived, the date stamped at archiving governs; a later change to the
  // firm's period does not move it (UAT run 2 B86).
  const retentionUntil =
    state.retentionUntil ?? (state.reportDate ? retentionDate(state.reportDate, engagement.periodEnd, retention.years) : null);

  // A4 (Wave 5): the ISA 700 required-components checklist, read-only.
  // No draft report text exists pre-issue (the report is assembled as DOCX at
  // issuance), so states render as "—"; structural validation runs at issue.
  const listed = client?.listed ?? false;
  const rc =
    locale === "fr"
      ? {
          title: "Composantes du rapport (ISA 700 révisée)",
          hint: "Aucun texte de rapport à valider avant l'émission — la validation structurelle s'exécute à l'émission du rapport.",
          conditional: "conditionnel",
        }
      : {
          title: "Report components (ISA 700 Revised)",
          hint: "No report text to validate before issuance — structural validation runs when the report is issued.",
          conditional: "conditional",
        };

  const btn =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2";
  const primary =
    "rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800";
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const subCard = "rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-3";
  const label = "text-xs text-muted";

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />
      <h1 className="mt-8 text-2xl font-semibold text-ink">
        {engagement.clientName} — {engagement.fiscalYear} · {tc.title}
      </h1>
      {/* completion / archive wording, and the tasks each failed gate names (UAT run 2 B84) */}
      <ErrorBanner
        error={error}
        failed={failed}
        locale={locale}
        scope="conclusion"
        details={Object.fromEntries(archGates.filter((g) => !g.ok && g.codes?.length).map((g) => [g.key, (g.codes ?? []).join(", ")]))}
      />

      {state.archivedAt ? (
        <p
          data-testid="archived-banner"
          className="mt-4 rounded-[var(--radius-atlas-sm)] border border-[var(--color-warn)]/40 bg-[var(--color-warn-soft)] px-4 py-3 text-sm text-warn"
        >
          {tc.archived} — {state.archivedAt}
          {state.retentionUntil ? (
            <>
              {" · "}
              {locale === "fr" ? "Conservation jusqu'au" : "Retain until"}{" "}
              <span className="tnum" data-testid="retention-until">{state.retentionUntil}</span>
            </>
          ) : null}
        </p>
      ) : null}

      {/* Retention & legal hold (UAT B65): a hold stops the file from ever
          reaching a destruction path; managers place it, a partner releases it. */}
      <Panel className="mt-6" data-testid="legal-hold-panel">
        <h2 className="text-sm font-semibold text-ink">
          {locale === "fr" ? "Conservation et suspension juridique" : "Retention & legal hold"}
        </h2>
        <p className="mt-1 text-xs text-muted">
          {locale === "fr"
            ? `Durée de conservation du cabinet : ${retention.years} ans à compter du rapport.`
            : `Firm retention period: ${retention.years} years from the report date.`}
          {retentionUntil ? ` · ${locale === "fr" ? "Conservation jusqu'au" : "Retain until"} ${retentionUntil}` : ""}
          {state.archivedAt && state.retentionUntil ? (locale === "fr" ? " (fixée à l'archivage)" : " (fixed at archiving)") : ""}
        </p>
        {hold ? (
          <div className="mt-3 rounded-[var(--radius-atlas-sm)] bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-warn" data-testid="legal-hold-active">
            <p className="font-medium">
              {locale === "fr" ? "Suspension juridique en place" : "Legal hold in place"} — {hold.reason}
            </p>
            <p className="text-xs">
              {hold.placedByName ?? "—"} · {hold.placedAt.slice(0, 16)}
            </p>
            {canReleaseHold ? (
              <form action={releaseLegalHoldAction.bind(null, id)} className="mt-2 flex flex-wrap items-end gap-2">
                <input
                  name="reason"
                  required
                  placeholder={locale === "fr" ? "Motif de la levée" : "Reason for release"}
                  className={`${input} w-72 max-w-full`}
                  data-testid="release-hold-reason"
                />
                <button type="submit" className={btn} data-testid="release-hold">
                  {locale === "fr" ? "Lever la suspension (associé)" : "Release hold (partner)"}
                </button>
              </form>
            ) : (
              <p className="mt-1 text-xs">
                {locale === "fr" ? "Seul un associé peut lever la suspension." : "Only a partner can release the hold."}
              </p>
            )}
          </div>
        ) : canPlaceHold ? (
          <form action={placeLegalHoldAction.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-2">
            <input
              name="reason"
              required
              placeholder={locale === "fr" ? "Motif (litige, enquête, réclamation…)" : "Reason (dispute, investigation, claim…)"}
              className={`${input} w-72 max-w-full`}
              data-testid="place-hold-reason"
            />
            <button type="submit" className={btn} data-testid="place-hold">
              {locale === "fr" ? "Placer une suspension juridique" : "Place a legal hold"}
            </button>
          </form>
        ) : (
          <p className="mt-2 text-xs text-muted">
            {locale === "fr" ? "Aucune suspension juridique. Un manager ou un associé peut en placer une." : "No legal hold. A manager or partner can place one."}
          </p>
        )}
        {/* Released holds stay visible with both reasons (UAT run 2 B158). */}
        {releasedHolds.length > 0 ? (
          <div className="mt-3" data-testid="legal-hold-history">
            <p className="text-xs font-semibold text-ink-soft">
              {locale === "fr" ? "Historique des suspensions levées" : "Released holds"}
            </p>
            <table className="mt-1 w-full text-left text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 pr-3 font-medium">{locale === "fr" ? "Placée" : "Placed"}</th>
                  <th className="py-1 pr-3 font-medium">{locale === "fr" ? "Motif" : "Reason"}</th>
                  <th className="py-1 pr-3 font-medium">{locale === "fr" ? "Levée" : "Released"}</th>
                  <th className="py-1 font-medium">{locale === "fr" ? "Motif de la levée" : "Release reason"}</th>
                </tr>
              </thead>
              <tbody className="text-ink-soft">
                {releasedHolds.map((h) => (
                  <tr key={h.id} className="border-t border-line/60 align-top">
                    <td className="py-1 pr-3 tnum">{h.placedAt.slice(0, 16)} · {h.placedByName ?? "—"}</td>
                    <td className="py-1 pr-3">{h.reason}</td>
                    <td className="py-1 pr-3 tnum">{(h.releasedAt ?? "").slice(0, 16)} · {h.releasedByName ?? "—"}</td>
                    <td className="py-1">{h.releaseReason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      <Panel className="mt-6">
        <h2 className="text-sm font-semibold text-ink">{tc.gates}</h2>
        <GatesPanel gates={gates} locale={locale} />
      </Panel>

      {/* An archived file is read-only: the generate/save actions would only
          fail on submit, so they are not offered (ISA 230 ¶15-16). */}
      {state.archivedAt ? null : (
      <>
      <Panel className="mt-6">
        <div className="flex flex-wrap gap-2">
          <form action={finalAnalyticsAction.bind(null, id)}>
            <button type="submit" className={btn} data-testid="run-final-analytics">
              {tc.runFinalAnalytics}
            </button>
          </form>
          <form action={fsTieoutAction.bind(null, id)}>
            <button type="submit" className={btn} data-testid="run-tieout">
              {tc.runTieout}
            </button>
          </form>
          <form action={generateConclusionLetterAction.bind(null, id, "rep_affirmation")}>
            <button type="submit" className={btn} data-testid="gen-affirmation">
              {tc.affirmation}
            </button>
          </form>
          <form action={generateConclusionLetterAction.bind(null, id, "rep_complementary")}>
            <button type="submit" className={btn} data-testid="gen-complementary">
              {tc.complementary}
            </button>
          </form>
          <form action={generateConclusionLetterAction.bind(null, id, "management_letter")}>
            <button type="submit" className={btn} data-testid="gen-mgmt-letter">
              {tc.managementLetter}
            </button>
          </form>
          <form action={generateConclusionLetterAction.bind(null, id, "tcwg_completion")}>
            <button type="submit" className={btn} data-testid="gen-tcwg-report">
              {tc.tcwgReport}
            </button>
          </form>
        </div>
      </Panel>

      <Panel className="mt-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <form
            action={disclosureChecklistAction.bind(null, id)}
            className={subCard}
          >
            <p className="text-sm font-semibold text-ink">{tc.disclosure}</p>
            <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
              <input
                type="checkbox"
                name="allComplete"
                defaultChecked={disclosure !== null}
                data-testid="disclosure-complete"
              />
              {tc.allComplete}
            </label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={String(disclosure?.notes ?? "")}
              placeholder={tc.notes}
              className={`${input} mt-2 w-full`}
            />
            <button type="submit" className={`${btn} mt-2`} data-testid="save-disclosure">
              {tc.save}
            </button>
          </form>

          <form
            action={subsequentEventsAction.bind(null, id)}
            className={subCard}
          >
            <p className="text-sm font-semibold text-ink">{tc.subsequentEvents}</p>
            <label className={`mt-2 block ${label}`}>
              {tc.reviewedTo}
              <input
                type="date"
                name="reviewedTo"
                required
                defaultValue={String(subsequent?.reviewedTo ?? "")}
                className={`${input} mt-1 block tnum`}
                data-testid="subsequent-date"
              />
            </label>
            <textarea
              name="events"
              rows={2}
              defaultValue={String(subsequent?.events ?? "")}
              placeholder={tc.events}
              className={`${input} mt-2 w-full`}
            />
            <button type="submit" className={`${btn} mt-2`} data-testid="save-subsequent">
              {tc.save}
            </button>
          </form>

          <form
            action={pointsForwardAction.bind(null, id)}
            className={subCard}
          >
            <p className="text-sm font-semibold text-ink">{tc.pointsForward}</p>
            <textarea
              name="points"
              rows={3}
              defaultValue={String(points?.points ?? "")}
              placeholder={tc.points}
              className={`${input} mt-2 w-full`}
              data-testid="points-forward"
            />
            <button type="submit" className={`${btn} mt-2`} data-testid="save-points">
              {tc.save}
            </button>
          </form>

          {!isPartner ? (
            <div className={subCard} data-testid="partner-conclusion-partner-only">
              <p className="text-sm font-semibold text-ink">{tc.partnerConclusion}</p>
              {partner?.conclusion ? <p className="mt-2 text-xs text-ink-soft">{String(partner.conclusion)}</p> : null}
              <p className="mt-2 text-xs text-muted">{partner ? "✓" : awaitingPartner}</p>
            </div>
          ) : (
          <form
            action={partnerConclusionAction.bind(null, id)}
            className={subCard}
          >
            <p className="text-sm font-semibold text-ink">{tc.partnerConclusion}</p>
            <textarea
              name="conclusion"
              rows={2}
              defaultValue={String(partner?.conclusion ?? "")}
              className={`${input} mt-2 w-full`}
              data-testid="partner-conclusion-text"
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
              <input
                type="checkbox"
                name="independenceReconfirmed"
                defaultChecked={partner !== null}
                data-testid="independence-reconfirm"
              />
              {tc.independenceReconfirmed}
            </label>
            <button type="submit" className={`${btn} mt-2`} data-testid="save-partner-conclusion">
              {tc.save}
            </button>
          </form>
          )}
        </div>
      </Panel>
      </>
      )}

      <Panel className="mt-6">
        <h2 className="text-sm font-semibold text-ink">{tc.opinionTitle}</h2>
        {state.reportDate ? (
          <div className="mt-3 text-sm text-ink-soft" data-testid="report-issued">
            <p>
              {tc.issued}: <strong>{state.opinion}</strong> — <span className="tnum">{state.reportDate}</span>
            </p>
            <p className="mt-1">
              {tc.assembly}: <strong data-testid="assembly-deadline" className="tnum">{assemblyDeadline(state.reportDate)}</strong>
            </p>
            {!state.archivedAt ? (
              <>
                {/* ISA 230 archive gates: what must hold before the file locks.
                    A failing gate links straight to where it is actioned. */}
                <ul className="mt-3 flex flex-col gap-1" data-testid="archive-gates">
                  {archGates.map((g) => {
                    const labels: Record<string, { en: string; fr: string; href?: string }> = {
                      report_issued: { en: "Report issued", fr: "Rapport émis" },
                      completion_gates: { en: "All completion gates green (C4.1)", fr: "Toutes les portes d'achèvement au vert (C4.1)", href: `/engagements/${id}/conclusion` },
                      controls_concluded: { en: "Every control selected for testing is designed, tested and concluded", fr: "Chaque contrôle retenu pour test est conçu, testé et conclu", href: `/engagements/${id}/groups/e1` },
                      tasks_addressed: { en: "Every applicable task performed, or marked not applicable with a reason", fr: "Chaque tâche applicable réalisée, ou marquée non applicable avec un motif", href: `/engagements/${id}/tools/forms` },
                      reviews_complete: { en: "Every prepared paper carries its review sign-off", fr: "Chaque papier préparé porte sa signature de revue", href: `/engagements/${id}/dashboard` },
                      papers_signed: { en: "Every working paper signed off as preparer and reviewer", fr: "Chaque papier de travail signé préparateur et réviseur", href: `/engagements/${id}/dashboard` },
                      review_approval: { en: "Review & approval summary concluded (C4.1)", fr: "Récapitulatif de revue & approbation conclu (C4.1)", href: `/engagements/${id}/groups/c4` },
                      review_notes_cleared: { en: "Review notes cleared (papers and tasks)", fr: "Notes de revue levées (papiers et tâches)", href: `/engagements/${id}/tools/review-notes` },
                      c62_checklist: { en: "C6.2 assembly & archive checklist concluded", fr: "Liste C6.2 d'assemblage & archivage conclue", href: `/engagements/${id}/groups/c6` },
                    };
                    const l = labels[g.key] ?? { en: g.key, fr: g.key };
                    return (
                      <li key={g.key} className="flex items-center gap-2 text-xs" data-testid={`archive-gate-${g.key}`}>
                        <span className={g.ok ? "font-bold text-good" : "font-bold text-rose"}>{g.ok ? "✓" : "✗"}</span>
                        <span className={g.ok ? "text-ink-soft" : "text-ink"}>
                          {locale === "fr" ? l.fr : l.en}
                          {!g.ok && g.pending > 0 ? <span className="ml-1 font-semibold text-rose tnum">({g.pending})</span> : null}
                        </span>
                        {!g.ok && l.href ? (
                          <Link href={l.href} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400" data-testid={`archive-fix-${g.key}`}>
                            {locale === "fr" ? "Corriger →" : "Action →"}
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {!isPartner ? (
                  <button
                    type="button"
                    disabled
                    className={`${primary} mt-3 cursor-not-allowed opacity-40`}
                    title={locale === "fr" ? "Réservé à l'associé de la mission" : "Reserved to the engagement partner"}
                    data-testid="archive-file-partner-only"
                  >
                    {tc.archive} · {locale === "fr" ? "Réservé à l'associé" : "Partner only"}
                  </button>
                ) : archGates.every((g) => g.ok) ? (
                  <form action={archiveAction.bind(null, id)} className="mt-3">
                    <button type="submit" className={primary} data-testid="archive-file">
                      {tc.archive}
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    disabled
                    className={`${primary} mt-3 cursor-not-allowed opacity-40`}
                    title={locale === "fr" ? "Toutes les conditions d'archivage doivent être remplies" : "Every archive condition must be met first"}
                    data-testid="archive-file-disabled"
                  >
                    {tc.archive}
                  </button>
                )}
              </>
            ) : (
              <form action={rollforwardAction.bind(null, id)} className="mt-3 flex items-end gap-2">
                <label className={label}>
                  {tc.newYear}
                  <input
                    type="number"
                    name="newYear"
                    required
                    defaultValue={engagement.fiscalYear + 1}
                    className={`${input} mt-1 block tnum`}
                    data-testid="rollforward-year"
                  />
                </label>
                <button type="submit" className={primary} data-testid="rollforward">
                  {tc.create}
                </button>
              </form>
            )}
          </div>
        ) : !isPartner ? (
          <p className="mt-3 text-xs text-muted" data-testid="issue-report-partner-only">
            {awaitingPartner} — {locale === "fr" ? "seul un associé émet le rapport." : "only a partner issues the report."}
          </p>
        ) : engagement.phase !== "execution" && engagement.phase !== "conclusion" ? (
          // Issuing is refused before execution: say so instead of offering a
          // form that is lost on submit (UAT run 2 B154).
          <p className="mt-3 text-xs text-muted" data-testid="issue-report-wrong-phase">
            {t.planning.errors["report-requires-execution"]}
          </p>
        ) : (
          <form action={issueReportAction.bind(null, id)} className="mt-3 flex flex-col gap-2">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs text-ink-soft">
                <input type="checkbox" name="materialMisstatement" data-testid="op-misstatement" />
                {tc.materialMisstatement}
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-soft">
                <input type="checkbox" name="pervasive" data-testid="op-pervasive" />
                {tc.pervasive}
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-soft">
                <input type="checkbox" name="scopeLimitation" data-testid="op-scope" />
                {tc.scopeLimitation}
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-soft">
                <input type="checkbox" name="goingConcernUncertainty" data-testid="op-going-concern" />
                {tc.goingConcernUncertainty}
              </label>
            </div>
            <textarea name="basisText" rows={2} placeholder={tc.basisText} className={`${input} w-full`} data-testid="basis-text" />
            <textarea name="kamText" rows={2} placeholder={tc.kamText} className={`${input} w-full`} data-testid="kam-text" />
            {listed ? (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                  <input type="checkbox" name="kamNone" data-testid="kam-none" />
                  {tc.kamNone}
                </label>
                <input name="kamNoneReason" placeholder={tc.kamNoneReason} className={`${input} min-w-[280px] flex-1`} data-testid="kam-none-reason" />
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <label className={label}>
                {tc.reportDate}
                <input type="date" name="reportDate" required className={`${input} mt-1 block tnum`} data-testid="report-date" />
              </label>
              <button type="submit" className={primary} data-testid="issue-report">
                {tc.issueReport}
              </button>
            </div>
          </form>
        )}
      </Panel>

      <Panel className="mt-6" data-testid="report-components">
        <h2 className="text-sm font-semibold text-ink">{rc.title}</h2>
        <p className="mt-1 text-xs text-muted">{rc.hint}</p>
        <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1 lg:grid-cols-2">
          {REPORT_COMPONENTS.map((component) => {
            const required =
              component.when === "always" || (component.when === "listed" && listed);
            return (
              <li
                key={component.key}
                className="flex items-center justify-between gap-3 border-b border-line/60 py-1 text-xs last:border-b-0 lg:[&:nth-last-child(2)]:border-b-0"
                data-testid={`report-component-${component.key}`}
              >
                <span className={required ? "text-ink-soft" : "text-muted"}>
                  {locale === "fr" ? component.fr : component.en}
                </span>
                <span className="shrink-0 text-muted">{required ? "—" : rc.conditional}</span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </main>
  );
}
