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
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner, GatesPanel } from "@/components/GatesPanel";
import { Panel } from "@/components/ui/atlas";
import {
  assemblyDeadline,
  completionGates,
  getCompletionRecord,
  getConclusionState,
} from "@/lib/completion";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

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
  const [gates, state, disclosure, subsequent, points, partner] = await Promise.all([
    completionGates(id),
    getConclusionState(id),
    getCompletionRecord(id, "disclosure_checklist"),
    getCompletionRecord(id, "subsequent_events"),
    getCompletionRecord(id, "points_forward"),
    getCompletionRecord(id, "partner_conclusion"),
  ]);

  const btn =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2";
  const primary =
    "rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800";
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const subCard = "rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-3";
  const label = "text-xs text-muted";

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold text-ink">
        {engagement.clientName} — {engagement.fiscalYear} · {tc.title}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="conclusion" />
      <ErrorBanner error={error} failed={failed} locale={locale} />

      {state.archivedAt ? (
        <p
          data-testid="archived-banner"
          className="mt-4 rounded-[var(--radius-atlas-sm)] border border-[var(--color-warn)]/40 bg-[var(--color-warn-soft)] px-4 py-3 text-sm text-warn"
        >
          {tc.archived} — {state.archivedAt}
        </p>
      ) : null}

      <Panel className="mt-6">
        <h2 className="text-sm font-semibold text-ink">{tc.gates}</h2>
        <GatesPanel gates={gates} locale={locale} />
      </Panel>

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
        </div>
      </Panel>

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
              <form action={archiveAction.bind(null, id)} className="mt-3">
                <button type="submit" className={primary} data-testid="archive-file">
                  {tc.archive}
                </button>
              </form>
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
            <textarea name="basisText" rows={2} placeholder={tc.basisText} className={`${input} w-full`} />
            <textarea name="kamText" rows={2} placeholder={tc.kamText} className={`${input} w-full`} />
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
    </main>
  );
}
