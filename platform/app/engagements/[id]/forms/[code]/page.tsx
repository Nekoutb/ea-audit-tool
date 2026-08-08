import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { setDueDateAction, signOffReviewerAction } from "@/app/actions/audit-file";
import {
  addEstimateAction,
  addRelatedPartyAction,
  raiseRiskAction,
  saveFormAction,
} from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { NavLink } from "@/components/NavLink";
import { SubmitButton, SubmitOnceButton } from "@/components/SubmitButton";
import { Panel, PanelHeader, Chip, btnPrimary, btnGhost } from "@/components/ui/atlas";
import { withTenant } from "@/lib/db";
import {
  PHASE_SLUG_OF,
  initials,
  phaseDeadline,
  phaseOfTask,
  taskForItem,
} from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { shortTitle } from "@/lib/file-index";
import { fieldLabel, FORM_DEFINITIONS, loadForm } from "@/lib/forms";
import { listReviewNotes, listVersions, type ReviewNoteInfo, type VersionInfo } from "@/lib/documents";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { appliedTemplate } from "@/lib/template-overrides";
import { displayCode, groupOfTask, groupTitle } from "@/lib/task-groups";
import { requireTenant } from "@/lib/tenant";

export async function generateMetadata(props: { params: Promise<{ code: string }> }) {
  const { code: raw } = await props.params;
  const code = decodeURIComponent(raw);
  return { title: `${code} ${shortTitle(code, "en", "")} · AuditISA`.replace(/\s{2,}/g, " ") };
}

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
  const [{ values, carried }, registers, task, template] = await Promise.all([
    loadForm(id, code),
    subRegisters(id, code),
    taskForItem(id, code),
    appliedTemplate(code),
  ]);
  const group = groupOfTask(code);
  const backHref = group ? `/engagements/${id}/groups/${group.id}` : `/engagements/${id}/phases/${phaseSlug}`;
  const backLabel = group
    ? tk.backTo.replace("{phase}", `${group.code} · ${groupTitle(group, locale)}`)
    : tk.backTo.replace("{phase}", t.dashboard.phaseNames[phase]);
  const [notes, versions]: [ReviewNoteInfo[], VersionInfo[]] = task?.documentId
    ? await Promise.all([listReviewNotes(task.documentId), listVersions(task.documentId)])
    : [[], []];

  const deadlineIso = task?.dueDate ?? phaseDeadline(engagement.periodEnd, phase);
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
      {group ? <input type="hidden" name="returnTo" value={backHref} /> : null}
    </>
  ) : null;

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />

      {/* NAV: back to the phase task list (canvas block 1) */}
      <div>
        <NavLink
          href={backHref}
          className="inline-flex min-h-[24px] items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          testId="back-to-phase"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          {backLabel}
        </NavLink>

        {/* HEADER: code badge + task name + status + meta (canvas block 2) */}
        <h1 className="mt-2 flex flex-wrap items-center gap-2.5 text-2xl font-bold tracking-[-0.02em] text-ink">
          <span
            title={code}
            className="rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface-2 px-2 py-0.5 font-mono text-[14px] font-extrabold text-ink-soft"
          >
            {displayCode(code)}
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

        {/* META STRIP (Canvas-style): assignee · sign-off state · workpaper versions */}
        <div
          data-testid="task-meta-strip"
          className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-muted"
        >
          <span className="inline-flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
            </svg>
            <span className="font-semibold text-ink-soft">{task?.ownerName ?? "—"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`sobox ${task?.preparerName ? "p" : "off"}`} aria-hidden>P</span>
            <span className={`sobox ${task?.reviewerName ? "r" : "off"}`} aria-hidden>R</span>
          </span>
          {task?.documentId ? (
            <span className="tnum">
              {versions.length} version{versions.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {task ? (
          <form action={setDueDateAction} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="fileItemId" value={task.id} />
            <input type="hidden" name="engagementId" value={id} />
            <input type="hidden" name="returnTo" value={`/engagements/${id}/forms/${encodeURIComponent(code)}`} />
            <label className="flex items-center gap-2 text-[12px] text-muted">
              {t.dashboard.setDeadline}
              <input
                type="date"
                name="dueDate"
                defaultValue={task.dueDate ?? ""}
                className="rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[12px] text-ink outline-none tnum focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                data-testid="due-date-input"
              />
            </label>
            <SubmitButton
              className="min-h-[24px] rounded-[var(--radius-atlas-xs)] border border-line-strong px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft hover:bg-surface-2"
              testId="due-date-save"
            >
              {tp.save}
            </SubmitButton>
          </form>
        ) : null}
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

      {/* EVIDENCE: workpaper version trail + open link (canvas block 4b) */}
      <Panel data-testid="task-evidence">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted">
            {locale === "fr" ? "Éléments probants" : "Evidence"}
          </div>
          {task?.documentId ? (
            <NavLink
              href={`/documents/${task.documentId}`}
              className="text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
              testId="open-workpaper"
            >
              {locale === "fr" ? "Ouvrir la feuille de travail →" : "Open working paper →"}
            </NavLink>
          ) : null}
        </div>
        {task?.documentId ? (
          <div className="mt-2">
            {versions.slice(0, 8).map((version) => (
              <div
                key={version.versionNo}
                className="flex items-center gap-2.5 border-t border-line py-2 text-[13px] first:border-t-0"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="flex-shrink-0 text-muted"
                  aria-hidden
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
                <span className="font-mono text-xs font-semibold text-ink tnum">v{version.versionNo}</span>
                <span className="min-w-0 flex-1 truncate text-ink-soft">{version.note ?? ""}</span>
                <span className="flex-shrink-0 text-[12px] text-muted tnum">{version.createdAt}</span>
                <a
                  href={`/api/documents/${task.documentId}/versions/${version.versionNo}`}
                  className="flex-shrink-0 font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {t.document.download}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-muted">
            {locale === "fr"
              ? "Pas encore de feuille de travail — « Enregistrer et transmettre » la crée."
              : "No working paper yet — Save & hand off creates it."}
          </p>
        )}
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
          <SubmitOnceButton formId="task-form" className={btnGhost} testId="save-form">
            {tp.save}
          </SubmitOnceButton>
          {task && !task.preparerName ? (
            <SubmitOnceButton
              formId="task-form"
              name="handoff"
              value="1"
              className={btnPrimary}
              testId="save-handoff"
            >
              {tk.saveHandoff}
            </SubmitOnceButton>
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
            <input name="name" placeholder="Nom / Name" aria-label="Nom / Name" required className={input} data-testid="rp-name" />
            <input name="relationship" placeholder="Relation" aria-label="Relation" required className={input} data-testid="rp-relationship" />
            <input name="notes" placeholder="Notes" aria-label="Notes" className={input} />
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
            <input name="nature" placeholder="Nature" aria-label="Nature" required className={input} />
            <input name="method" placeholder="Méthode / Method" aria-label="Méthode / Method" className={input} />
            <input name="uncertainty" placeholder="Incertitude / Uncertainty" aria-label="Incertitude / Uncertainty" className={input} />
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
            placeholder={tp.riskDescription} aria-label={tp.riskDescription}
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
