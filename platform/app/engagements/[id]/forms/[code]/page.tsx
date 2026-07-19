import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { signOffReviewerAction } from "@/app/actions/audit-file";
import {
  addEstimateAction,
  addRelatedPartyAction,
  raiseRiskAction,
  saveFormAction,
} from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { NavLink } from "@/components/NavLink";
import { Panel, PanelHeader, Chip, btnPrimary, btnGhost } from "@/components/ui/atlas";
import { withTenant } from "@/lib/db";
import {
  PHASE_SLUG_OF,
  initials,
  phaseDeadline,
  phaseOfTask,
  phaseTasks,
} from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { shortTitle } from "@/lib/file-index";
import { fieldLabel, FORM_DEFINITIONS, loadForm } from "@/lib/forms";
import { listReviewNotes, type ReviewNoteInfo } from "@/lib/documents";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { appliedTemplate } from "@/lib/template-overrides";
import { requireTenant } from "@/lib/tenant";

async function subRegisters(engagementId: string, code: string) {
  if (code !== "D5.6" && code !== "D5.7") return { parties: [], estimates: [] };
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const parties =
      code === "D5.6"
        ? (
            await tx.query<{ id: string; name: string; relationship: string; notes: string | null; carried_forward: boolean }>(
              "SELECT id, name, relationship, notes, carried_forward FROM related_party WHERE engagement_id = $1 ORDER BY name",
              [engagementId],
            )
          ).rows
        : [];
    const estimates =
      code === "D5.7"
        ? (
            await tx.query<{ id: string; nature: string; method: string | null; uncertainty: string | null }>(
              "SELECT id, nature, method, uncertainty FROM accounting_estimate WHERE engagement_id = $1 ORDER BY created_at",
              [engagementId],
            )
          ).rows
        : [];
    return { parties, estimates };
  });
}

export default async function FormPage(props: {
  params: Promise<{ id: string; code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id, code: rawCode } = await props.params;
  const code = decodeURIComponent(rawCode);
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tp = t.planning;

  const definition = FORM_DEFINITIONS[code];
  const engagement = await getEngagement(id);
  if (!definition || !engagement) notFound();

  // Hub-and-spoke context: which phase this task belongs to, its sign-off
  // state, deadline read, template purpose/checklist, and any review notes.
  const phase = phaseOfTask("D", code);
  const phaseSlug = PHASE_SLUG_OF[phase];
  const tk = t.taskPage;
  const [{ values, carried }, registers, tasks, template] = await Promise.all([
    loadForm(id, code),
    subRegisters(id, code),
    phaseTasks(id, phase),
    appliedTemplate(code),
  ]);
  const task = tasks.find((row) => row.code === code) ?? null;
  const notes: ReviewNoteInfo[] = task?.documentId ? await listReviewNotes(task.documentId) : [];

  const deadlineIso = phaseDeadline(engagement.periodEnd, phase);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const overdueDays = Math.round((todayUtc - new Date(deadlineIso + "T00:00:00Z").getTime()) / 86_400_000);
  const statusChip =
    task?.status === "reviewed" ? (
      <Chip tone="good">{t.dashboard.rowStatus.reviewed}</Chip>
    ) : task?.status === "in_review" ? (
      <Chip tone="warn" pulse>{t.dashboard.rowStatus.in_review}</Chip>
    ) : task?.status === "in_progress" ? (
      <Chip tone="warn">{t.dashboard.rowStatus.in_progress}</Chip>
    ) : (
      <Chip tone="muted">{t.dashboard.rowStatus.not_started}</Chip>
    );

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  const signHidden = task ? (
    <>
      <input type="hidden" name="fileItemId" value={task.id} />
      <input type="hidden" name="engagementId" value={id} />
      <input type="hidden" name="phase" value={phaseSlug} />
    </>
  ) : null;

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-4">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />

      {/* NAV: back to the phase task list (canvas block 1) */}
      <div>
        <NavLink
          href={`/engagements/${id}/phases/${phaseSlug}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          testId="back-to-phase"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          {tk.backTo.replace("{phase}", t.dashboard.phaseNames[phase])}
        </NavLink>

        {/* HEADER: code badge + task name + status + meta (canvas block 2) */}
        <h1 className="mt-2 flex flex-wrap items-center gap-2.5 text-2xl font-bold tracking-[-0.02em] text-ink">
          <span className="rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface-2 px-2 py-0.5 font-mono text-[14px] font-extrabold text-ink-soft">
            {code}
          </span>
          <span>{shortTitle(code, locale, code)}</span>
          <span className="ml-1">{statusChip}</span>
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          {engagement.name ?? engagement.clientName}
          <span className="px-2 text-line-strong">·</span>
          {t.engagements.fiscalYear} {engagement.fiscalYear}
          <span className="px-2 text-line-strong">·</span>
          {tk.deadline}: <span className="tnum">{deadlineIso}</span>{" "}
          {task?.status === "reviewed" ? (
            <span className="font-semibold text-muted">{t.dashboard.deadlineTag.completed}</span>
          ) : overdueDays > 0 ? (
            <span className="font-semibold text-rose">
              {t.dashboard.deadlineTag.overdue} · {overdueDays} {overdueDays === 1 ? t.dashboard.deadlineTag.day : t.dashboard.deadlineTag.days}
            </span>
          ) : (
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{t.dashboard.deadlineTag.onTrack}</span>
          )}
        </p>
      </div>

      <ErrorBanner error={error} locale={locale} />

      {/* PURPOSE & GUIDANCE from the (firm-customisable) template (canvas block 3) */}
      <Panel className="p-5" data-testid="task-purpose">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted">{tk.objective}</div>
        <p className="mt-1.5 text-[13.5px] text-ink-soft">{template.purpose[locale]}</p>
        <ol className="mt-3">
          {template.items[locale].map((item, i) => (
            <li key={i} className="flex gap-2.5 border-t border-line py-1.5 text-[13.5px] text-ink-soft">
              <span className="min-w-[20px] pt-px text-[11px] font-extrabold text-emerald-700/60 tnum dark:text-emerald-400/60">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </Panel>

      {/* FORM FIELDS (canvas block 4) */}
      <Panel>
        <form id="task-form" action={saveFormAction.bind(null, id, code)} className="flex flex-col gap-4">
          {definition.fields.map((field) => {
            const value = values[field.key];
            const isCarried = carried.has(field.key);
            return (
              <label key={field.key} className="flex flex-col gap-1.5 text-sm">
                <span className="flex items-center gap-2 text-ink-soft">
                  <span>
                    {fieldLabel(field, locale)}
                    {field.required ? " *" : ""}
                  </span>
                  {isCarried ? (
                    <span data-testid={`carried-${field.key}`}>
                      <Chip tone="warn">{tp.carriedForward}</Chip>
                    </span>
                  ) : null}
                </span>
                {field.type === "boolean" ? (
                  // Yes/No select (not a checkbox): unanswered stays unanswered,
                  // so required checks are only "complete" once explicitly chosen.
                  <select
                    name={field.key}
                    defaultValue={value === true ? "yes" : value === false ? "no" : ""}
                    className={input}
                    data-testid={`field-${field.key}`}
                  >
                    <option value="" />
                    <option value="yes">{t.common.yes}</option>
                    <option value="no">{t.common.no}</option>
                  </select>
                ) : field.type === "select" ? (
                  <select
                    name={field.key}
                    defaultValue={value === undefined ? "" : String(value)}
                    className={input}
                    data-testid={`field-${field.key}`}
                  >
                    <option value="" />
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : field.type === "text" ? (
                  <textarea
                    name={field.key}
                    defaultValue={value === undefined ? "" : String(value)}
                    rows={2}
                    className={input}
                    data-testid={`field-${field.key}`}
                  />
                ) : (
                  <input
                    type={field.type === "number" ? "number" : "date"}
                    name={field.key}
                    defaultValue={value === undefined ? "" : String(value)}
                    className={`${input} tnum`}
                    data-testid={`field-${field.key}`}
                  />
                )}
              </label>
            );
          })}
        </form>
      </Panel>

      {/* SIGN-OFF footer bar (canvas block 5) */}
      <Panel className="flex flex-wrap items-center justify-between gap-3 !p-4" data-testid="task-signoff">
        <div className="flex flex-wrap items-center gap-6">
          <span className="flex items-center gap-2.5 text-[12.5px] text-ink-soft">
            <span className={`sobox ${task?.preparerName || task?.ownerName ? "p" : "off"}`} aria-hidden>P</span>
            <span>
              <b className="tracking-wide">
                {task?.preparerName ? initials(task.preparerName) : task?.ownerName ? initials(task.ownerName) : "—"}
              </b>{" "}
              ·{" "}
              {task?.preparerName ? (
                <span className="text-muted">{t.dashboard.signoff.prepDone}{task.preparerAt ? ` · ${task.preparerAt}` : ""}</span>
              ) : (
                <span className="font-semibold text-warn">{t.dashboard.signoff.awaitingHandoff}</span>
              )}
            </span>
          </span>
          <span className="flex items-center gap-2.5 text-[12.5px] text-ink-soft">
            {task && task.preparerName && !task.reviewerName ? (
              <form action={signOffReviewerAction} className="inline-flex">
                {signHidden}
                <button type="submit" className="sobox r" title={t.dashboard.signAsReviewer} aria-label={t.dashboard.signAsReviewer} data-testid="task-sign-reviewer">R</button>
              </form>
            ) : (
              <span className={`sobox ${task?.reviewerName ? "r" : "off"}`} aria-hidden>R</span>
            )}
            <span>
              <b className="tracking-wide">{task?.reviewerName ? initials(task.reviewerName) : "—"}</b> ·{" "}
              {task?.reviewerName ? (
                <span className="text-muted">{t.dashboard.signoff.revDone}{task.reviewerAt ? ` · ${task.reviewerAt}` : ""}</span>
              ) : task?.preparerName ? (
                <span className="font-semibold text-warn">{t.dashboard.signoff.awaitingReview}</span>
              ) : (
                <span className="text-muted">{t.dashboard.signoff.awaitingPreparer}</span>
              )}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <button type="submit" form="task-form" className={btnGhost} data-testid="save-form">
            {tp.save}
          </button>
          {task && !task.preparerName ? (
            <button
              type="submit"
              form="task-form"
              name="handoff"
              value="1"
              className={btnPrimary}
              data-testid="save-handoff"
            >
              {tk.saveHandoff}
            </button>
          ) : null}
        </div>
      </Panel>

      {/* REVIEW NOTES (canvas block 6) */}
      <Panel data-testid="task-review-notes">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted">{tk.reviewNotes}</div>
        {notes.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">{tk.reviewNotesEmpty}</p>
        ) : (
          <div className="mt-1">
            {notes.map((n) => (
              <div key={n.id} className="flex gap-2.5 border-t border-line py-2.5 first:border-t-0">
                <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-emerald-50 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {initials(n.authorName)}
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] text-muted"><b className="text-ink">{n.authorName}</b> · {n.createdAt}{n.status === "cleared" ? " · ✓" : ""}</p>
                  <p className="text-[13px] text-ink-soft">{n.body}</p>
                  {n.response ? <p className="mt-0.5 text-[12.5px] italic text-muted">↳ {n.response}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {code === "D5.6" ? (
        <Panel>
          <PanelHeader title={`${t.fileIndex.title} — D5.6`} />
          <ul className="mt-4 flex flex-col gap-2 text-sm" data-testid="related-parties">
            {registers.parties.map((party) => (
              <li
                key={party.id}
                className="flex flex-wrap items-center gap-x-1.5 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-ink-soft"
              >
                <span className="font-medium text-ink">{party.name}</span> — {party.relationship}
                {party.notes ? ` · ${party.notes}` : ""}
                {party.carried_forward ? <Chip tone="warn">{tp.carriedForward}</Chip> : null}
              </li>
            ))}
          </ul>
          <form action={addRelatedPartyAction.bind(null, id)} className="mt-4 flex flex-wrap items-end gap-3">
            <input name="name" placeholder="Nom / Name" required className={input} data-testid="rp-name" />
            <input name="relationship" placeholder="Relation" required className={input} data-testid="rp-relationship" />
            <input name="notes" placeholder="Notes" className={input} />
            <button type="submit" className={btnGhost} data-testid="rp-add">
              +
            </button>
          </form>
        </Panel>
      ) : null}

      {code === "D5.7" ? (
        <Panel>
          <ul className="flex flex-col gap-2 text-sm" data-testid="estimates">
            {registers.estimates.map((estimate) => (
              <li
                key={estimate.id}
                className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-ink-soft"
              >
                <span className="font-medium text-ink">{estimate.nature}</span>
                {estimate.method ? ` — ${estimate.method}` : ""}
                {estimate.uncertainty ? ` · ${estimate.uncertainty}` : ""}
              </li>
            ))}
          </ul>
          <form action={addEstimateAction.bind(null, id)} className="mt-4 flex flex-wrap items-end gap-3">
            <input name="nature" placeholder="Nature" required className={input} />
            <input name="method" placeholder="Méthode / Method" className={input} />
            <input name="uncertainty" placeholder="Incertitude / Uncertainty" className={input} />
            <button type="submit" className={btnGhost}>
              +
            </button>
          </form>
        </Panel>
      ) : null}

      <section className="rounded-[var(--radius-atlas)] border border-line bg-[var(--color-warn-soft)] p-5 shadow-[var(--shadow-atlas)]">
        <h2 className="text-sm font-semibold text-ink">{tp.raiseRisk}</h2>
        <form action={raiseRiskAction.bind(null, id, code)} className="mt-3 flex flex-wrap items-end gap-3">
          <input
            name="description"
            placeholder={tp.riskDescription}
            required
            className={`${input} w-96 max-w-full`}
            data-testid="raise-risk-description"
          />
          <button type="submit" className={btnGhost} data-testid="raise-risk">
            {tp.raiseRisk}
          </button>
        </form>
      </section>
    </main>
  );
}
