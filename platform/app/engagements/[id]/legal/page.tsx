import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  addConventionAction,
  advanceAlerteAction,
  article715Action,
  cocacAction,
  equityCheckAction,
  generateDeadlinesAction,
  irregularitiesAction,
  markDeadlineDoneAction,
  rapportSpecialAction,
  resumeAlerteAction,
  revealFaitAction,
  setShareCapitalAction,
  startAlerteAction,
  titresAttestationAction,
} from "@/app/actions/legal";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner } from "@/components/GatesPanel";
import { getAlerte } from "@/lib/alerte";
import { getCompletionRecord } from "@/lib/completion";
import { getEngagement } from "@/lib/engagements";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { canPartnerSignoff, type Role } from "@/lib/rbac";
import { CONVENTION_CAPACITIES, listConventions, listDeadlines, listFaits } from "@/lib/legal";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "OHADA legal · AuditISA" };

export default async function LegalPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isPartner = canPartnerSignoff(session.user.role as Role);

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tl = t.planning.legal;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [deadlines, register, alerte, faits, worksplit, crossreview, disagreement] = await Promise.all([
    listDeadlines(id),
    listConventions(id),
    getAlerte(id),
    isPartner ? listFaits(id) : Promise.resolve([]),
    getCompletionRecord(id, "f8_worksplit"),
    getCompletionRecord(id, "f8_crossreview"),
    getCompletionRecord(id, "f8_disagreement"),
  ]);

  const btn =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2";
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const card =
    "mt-6 rounded-[var(--radius-atlas)] border border-line bg-surface p-5 shadow-[var(--shadow-atlas)]";
  const heading = "text-sm font-semibold text-ink";
  const label = "flex flex-col text-xs text-muted";

  const deadlineName = (key: string): string =>
    tl.deadlineNames[key as keyof typeof tl.deadlineNames] ?? key;
  const stageName = (stage: string): string => tl.stages[stage as keyof typeof tl.stages] ?? stage;

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold text-ink">
        {engagement.clientName} — {engagement.fiscalYear} · {tl.title}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="legal" />
      <ErrorBanner error={error} locale={locale} />

      {/* C5.2 deadlines */}
      <section className={card}>
        <div className="flex items-center justify-between">
          <h2 className={heading}>{tl.deadlines}</h2>
          <form action={generateDeadlinesAction.bind(null, id)}>
            <button type="submit" className={btn} data-testid="generate-deadlines">
              {tl.generateDeadlines}
            </button>
          </form>
        </div>
        {deadlines.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-[var(--radius-atlas)] border border-line">
            <table className="w-full text-sm" data-testid="deadlines-table">
              <tbody>
                {deadlines.map((deadline) => (
                  <tr key={deadline.key} className="border-t border-line first:border-t-0 hover:bg-surface-2">
                    <td className="px-3 py-2 text-ink">{deadlineName(deadline.key)}</td>
                    <td className="w-28 px-3 py-2 font-mono text-xs tnum">{deadline.dueDate}</td>
                    <td className="w-28 px-3 py-2 text-xs">
                      {deadline.done ? (
                        "✓"
                      ) : deadline.daysLeft < 0 ? (
                        <span className="font-semibold text-rose" data-testid={`overdue-${deadline.key}`}>
                          {tl.overdue}
                        </span>
                      ) : (
                        `${deadline.daysLeft} ${tl.daysLeft}`
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{deadline.basis}</td>
                    <td className="w-20 px-3 py-2 text-right">
                      {!deadline.done ? (
                        <form action={markDeadlineDoneAction.bind(null, id, deadline.key)}>
                          <button type="submit" className={btn} data-testid={`deadline-done-${deadline.key}`}>
                            {tl.markDone}
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* C5.3 conventions */}
      <section className={card}>
        <div className="flex items-center justify-between">
          <h2 className={heading}>{tl.conventions}</h2>
          <form action={rapportSpecialAction.bind(null, id)}>
            <button type="submit" className={btn} data-testid="rapport-special">
              {tl.rapportSpecial}
            </button>
          </form>
        </div>
        <form action={addConventionAction.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-2">
          <label className={label}>
            {tl.parties}
            <input name="parties" required className={`${input} mt-1`} data-testid="conv-parties" />
          </label>
          <label className={label}>
            {tl.interested}
            <input name="interested" required className={`${input} mt-1`} data-testid="conv-interested" />
          </label>
          <label className={label}>
            {tl.capacity}
            <select name="capacity" className={`${input} mt-1`} data-testid="conv-capacity">
              {CONVENTION_CAPACITIES.map((capacity) => (
                <option key={capacity} value={capacity}>
                  {tl.capacities[capacity]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            {tl.nature}
            <input name="nature" required className={`${input} mt-1`} data-testid="conv-nature" />
          </label>
          <label className={label}>
            {tl.terms}
            <input name="terms" className={`${input} mt-1`} data-testid="conv-terms" />
          </label>
          <label className={label}>
            {tl.amounts}
            <input name="amountsPeriod" type="number" className={`${input} mt-1`} />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted">
            <input type="checkbox" name="continuing" /> {tl.continuing}
          </label>
          <label className={label}>
            {tl.boardAuthRef}
            <input name="boardAuthRef" className={`${input} mt-1`} data-testid="conv-auth" />
          </label>
          <label className={label}>
            {tl.notifiedAt}
            <input name="notifiedAt" type="date" className={`${input} mt-1`} />
          </label>
          <button type="submit" className={btn} data-testid="add-convention">
            {tl.addConvention}
          </button>
        </form>
        {register.conventions.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5 text-sm" data-testid="conventions-list">
            {register.conventions.map((convention) => (
              <li key={convention.id} className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2">
                <span className="font-medium text-ink">{convention.nature}</span>{" "}
                <span className="text-muted">
                  — {convention.parties} · {convention.interested} ({tl.capacities[convention.capacity]})
                  {convention.continuing && convention.amountsPeriod !== null
                    ? ` · ${formatFCFA(convention.amountsPeriod)}`
                    : ""}
                </span>
                {convention.unauthorized ? (
                  <span
                    className="ml-2 rounded-[var(--radius-atlas-xs)] bg-[var(--color-rose-soft)] px-1.5 py-0.5 text-xs font-semibold text-rose"
                    data-testid={`conv-unauthorized-${convention.id}`}
                  >
                    {tl.unauthorized}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* C5.4 art. 715 + C5.7 attestation */}
      <section className={card}>
        <div className="flex flex-wrap gap-2">
          <form action={article715Action.bind(null, id)}>
            <button type="submit" className={btn} data-testid="article-715">
              {tl.article715}
            </button>
          </form>
          <form action={titresAttestationAction.bind(null, id)}>
            <button type="submit" className={btn} data-testid="titres-attestation">
              {tl.titres} · {tl.generateAttestation}
            </button>
          </form>
        </div>
      </section>

      {/* C5.5 alerte */}
      <section className={card}>
        <h2 className={heading}>{tl.alerte}</h2>
        {alerte === null ? (
          <form action={startAlerteAction.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-2">
            <label className={`${label} w-full max-w-96`}>
              {tl.note}
              <input name="note" required className={`${input} mt-1 w-full`} data-testid="alerte-note" />
            </label>
            <button type="submit" className={btn} data-testid="start-alerte">
              {tl.startAlerte}
            </button>
          </form>
        ) : (
          <div className="mt-3 text-sm text-ink-soft">
            <p data-testid="alerte-stage">
              {tl.stage}: <strong>{stageName(alerte.stage)}</strong>
              {alerte.stageDeadline ? ` · ${tl.stageDeadline}: ${alerte.stageDeadline}` : ""}
              {alerte.discontinued ? ` · ${tl.discontinued} ${alerte.resumableUntil}` : ""}
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
              {alerte.events.map((event, index) => (
                <li key={`${event.stage}-${index}`}>
                  {event.createdAt} — {stageName(event.stage)}
                  {event.note ? ` · ${event.note}` : ""}
                </li>
              ))}
            </ul>
            {alerte.discontinued ? (
              <form action={resumeAlerteAction.bind(null, id, alerte.id)} className="mt-3 flex items-end gap-2">
                <label className={label}>
                  {tl.note}
                  <input name="note" className={`${input} mt-1 w-72`} />
                </label>
                <button type="submit" className={btn} data-testid="resume-alerte">
                  {tl.resume}
                </button>
              </form>
            ) : alerte.nextStages.length > 0 ? (
              <form action={advanceAlerteAction.bind(null, id, alerte.id)} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="toStage" value={alerte.nextStages[0]} />
                <label className={label}>
                  {tl.note}
                  <input name="note" className={`${input} mt-1 w-72`} data-testid="alerte-advance-note" />
                </label>
                {alerte.nextStages[0] === "reply_recorded" ? (
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <input type="checkbox" name="satisfactory" data-testid="alerte-satisfactory" /> {tl.satisfactory}
                  </label>
                ) : null}
                <button type="submit" className={btn} data-testid="advance-alerte">
                  {tl.advance}: {stageName(alerte.nextStages[0])}
                </button>
              </form>
            ) : null}
          </div>
        )}
      </section>

      {/* C5.6 faits délictueux (partner only) */}
      {isPartner ? (
        <section className={card}>
          <h2 className={heading}>{tl.faits}</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <form action={revealFaitAction.bind(null, id)} className="flex flex-col gap-2">
              <textarea
                name="description"
                rows={2}
                required
                placeholder={tl.faitDescription} aria-label={tl.faitDescription}
                className={`${input} w-full`}
                data-testid="fait-description"
              />
              <button type="submit" className={`${btn} self-start`} data-testid="reveal-fait">
                {tl.revealFait}
              </button>
            </form>
            <form action={irregularitiesAction.bind(null, id)} className="flex flex-col gap-2">
              <label className={label}>
                {tl.irregularitiesTarget}
                <select name="target" className={`${input} mt-1`}>
                  <option value="ag">{tl.toAg}</option>
                  <option value="board">{tl.toBoard}</option>
                </select>
              </label>
              <textarea name="points" rows={2} required placeholder={tl.points} aria-label={tl.points} className={`${input} w-full`} />
              <button type="submit" className={`${btn} self-start`} data-testid="irregularities-letter">
                {tl.irregularities} · {tl.generateLetter}
              </button>
            </form>
          </div>
          {faits.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1 text-xs text-muted" data-testid="faits-list">
              {faits.map((fait) => (
                <li key={fait.id}>
                  {fait.revealedAt} — {fait.description}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {/* C5.8 equity */}
      <section className={card}>
        <h2 className={heading}>{tl.equity}</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <form action={setShareCapitalAction.bind(null, id)} className="flex items-end gap-2">
            <label className={label}>
              {tl.shareCapital}
              <input name="amount" type="number" required className={`${input} mt-1`} data-testid="share-capital" />
            </label>
            <button type="submit" className={btn} data-testid="save-capital">
              {tl.saveCapital}
            </button>
          </form>
          <form action={equityCheckAction.bind(null, id)}>
            <button type="submit" className={btn} data-testid="equity-check">
              {tl.runEquityCheck}
            </button>
          </form>
        </div>
        {deadlines.some((deadline) => deadline.key === "egm_equity") ? (
          <p className="mt-3 rounded-[var(--radius-atlas-sm)] bg-[var(--color-rose-soft)] px-3 py-2 text-sm font-medium text-rose" data-testid="equity-breach">
            {tl.equityBreach}
          </p>
        ) : null}
      </section>

      {/* C5.9 co-CAC */}
      <section className={card}>
        <h2 className={heading}>{tl.cocac}</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {(
            [
              { key: "worksplit", title: tl.worksplit, record: worksplit },
              { key: "crossreview", title: tl.crossreview, record: crossreview },
              { key: "disagreement", title: tl.disagreement, record: disagreement },
            ] as const
          ).map((panel) => (
            <form
              key={panel.key}
              action={cocacAction.bind(null, id)}
              className="flex flex-col gap-2 rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-3"
            >
              <p className="text-xs font-semibold text-ink">{panel.title}</p>
              <input type="hidden" name="key" value={panel.key} />
              <textarea
                name="text"
                rows={3}
                aria-label={panel.title}
                defaultValue={String(panel.record?.text ?? "")}
                className={`${input} w-full`}
                data-testid={`cocac-${panel.key}`}
              />
              <label className="flex items-center gap-1 text-xs text-muted">
                <input type="checkbox" name="confirmed" defaultChecked={panel.record?.confirmed === true} />{" "}
                {tl.confirmed}
              </label>
              <button type="submit" className={`${btn} self-start`} data-testid={`cocac-save-${panel.key}`}>
                {tl.save}
              </button>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}
