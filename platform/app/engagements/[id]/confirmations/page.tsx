import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  addManualAction,
  alternativeAction,
  approveAction,
  disposeAction,
  generateLetterForAction,
  noResponseAction,
  remindAction,
  replyAction,
  selectConfirmationsAction,
  sendAction,
  summaryAction,
} from "@/app/actions/confirmations";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { Panel } from "@/components/ui/atlas";
import {
  CONFIRMATION_SUBJECTS,
  CONFIRMATION_TYPES,
  confirmationSummary,
  listConfirmationsFor,
  NEGATIVE_CONDITION_KEYS,
  type ConfirmationSubject,
} from "@/lib/confirmations";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listDatasets } from "@/lib/subledgers";

export const metadata = { title: "Confirmations · AuditISA" };

export default async function ConfirmationsPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tc = t.planning.confirmations;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  // A1 additions are localized inline (EN/FR) — no messages/*.json edits.
  const fr = locale === "fr";
  const subjectLabels: Record<ConfirmationSubject, string> = fr
    ? { bank: "Banque", receivable: "Créances", payable: "Fournisseurs", inventory_third_party: "Stocks chez tiers", legal: "Juridique", lender: "Prêteurs" }
    : { bank: "Bank", receivable: "Receivables", payable: "Payables", inventory_third_party: "3rd-party inventory", legal: "Legal", lender: "Lenders" };
  // ISA 505.15 — the four conditions for a negative confirmation, in key order.
  const negConditionLabels: Record<(typeof NEGATIVE_CONDITION_KEYS)[number], string> = fr
    ? {
        low_rmm_with_controls: "RMM faible avec contrôles testés",
        homogeneous_small_value: "Population homogène de petits soldes",
        low_expected_exception: "Très faible taux d'exceptions attendu",
        no_reason_to_disregard: "Aucune raison d'ignorer la demande",
      }
    : {
        low_rmm_with_controls: "Low RMM with controls evidence",
        homogeneous_small_value: "Large homogeneous small-value population",
        low_expected_exception: "Very low expected exception rate",
        no_reason_to_disregard: "No reason to disregard the request",
      };
  const [confirmations, summary, datasets, items] = await Promise.all([
    listConfirmationsFor(id),
    confirmationSummary(id),
    listDatasets(id),
    listFileItems(id),
  ]);
  const eSections = items.filter((item) => item.section === "E");

  const btn =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-surface-2";
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={locale === "fr" ? "Retour aux outils" : "Back to tools"}
          aria-label={locale === "fr" ? "Retour" : "Back"}
          data-testid="confirmations-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {tc.title}
        </h1>
      </div>
      <ErrorBanner error={error} locale={locale} />

      <Panel className="mt-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <form action={selectConfirmationsAction.bind(null, id)} className="rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-3">
            <p className="text-sm font-semibold text-ink">{tc.select}</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <select name="datasetId" required className={input} data-testid="conf-dataset">
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
                ))}
              </select>
              <select name="ctype" className={input} data-testid="conf-type">
                {CONFIRMATION_TYPES.map((ctype) => (
                  <option key={ctype} value={ctype}>{tc.types[ctype]}</option>
                ))}
              </select>
              <select name="fileItemId" className={input} data-testid="conf-section">
                {eSections.map((section) => (
                  <option key={section.id} value={section.id}>{section.code}</option>
                ))}
              </select>
              <input name="threshold" type="number" placeholder={tc.threshold} className={input} data-testid="conf-threshold" />
              <input name="topN" type="number" placeholder={tc.topN} className={input} />
              <label className="flex items-center gap-1 text-xs text-muted">
                <input type="checkbox" name="includeNil" /> {tc.includeNil}
              </label>
              <button type="submit" className={btn} data-testid="conf-select">
                {tc.select}
              </button>
            </div>
          </form>

          <form action={addManualAction.bind(null, id)} className="rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-3">
            <p className="text-sm font-semibold text-ink">{tc.manual}</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <select name="ctype" className={input} data-testid="manual-type">
                {CONFIRMATION_TYPES.map((ctype) => (
                  <option key={ctype} value={ctype}>{tc.types[ctype]}</option>
                ))}
              </select>
              <select name="subject" defaultValue="receivable" className={input} data-testid="manual-subject">
                {CONFIRMATION_SUBJECTS.map((subject) => (
                  <option key={subject} value={subject}>{subjectLabels[subject]}</option>
                ))}
              </select>
              <select name="fileItemId" className={input}>
                {eSections.map((section) => (
                  <option key={section.id} value={section.id}>{section.code}</option>
                ))}
              </select>
              <input name="partyName" required placeholder={tc.party} className={input} data-testid="manual-party" />
              <input name="partyEmail" type="email" placeholder={tc.email} className={input} />
              <input name="bookAmount" type="number" placeholder={tc.book} className={input} />
              <label className="flex items-center gap-1 text-xs text-muted">
                <input type="radio" name="method" value="positive" defaultChecked data-testid="manual-method-positive" />
                {fr ? "Positive" : "Positive"}
              </label>
              {/* Named peer: checking "negative" reveals the ISA 505.15 checklist below. */}
              <input type="radio" name="method" value="negative" id="manual-method-negative" className="peer/negative" data-testid="manual-method-negative" />
              <label htmlFor="manual-method-negative" className="text-xs text-muted">
                {fr ? "Négative" : "Negative"}
              </label>
              <button type="submit" className={btn} data-testid="manual-add">
                +
              </button>
              <div
                className="hidden w-full rounded-[var(--radius-atlas-sm)] border border-line bg-surface p-2 peer-checked/negative:block"
                data-testid="negative-conditions"
              >
                <p className="text-xs font-semibold text-ink">
                  {fr
                    ? "Conditions ISA 505.15 — les quatre sont requises pour une confirmation négative"
                    : "ISA 505.15 conditions — all four are required for a negative confirmation"}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {NEGATIVE_CONDITION_KEYS.map((key) => (
                    <label key={key} className="flex items-center gap-1 text-xs text-muted">
                      <input type="checkbox" name={key} data-testid={`neg-${key}`} />
                      {negConditionLabels[key]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </form>
        </div>

        {summary.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-3 text-sm" data-testid="conf-summary">
            {summary.map((row) => (
              <span key={row.ctype} className="rounded-[var(--radius-atlas-xs)] bg-surface-2 px-2 py-1 text-ink-soft tnum">
                {tc.types[row.ctype]}: {row.replied}/{row.total} {tc.coverage}
                {row.outstanding > 0 ? ` · ${row.outstanding} ${tc.outstanding}` : ""}
              </span>
            ))}
            <form action={summaryAction.bind(null, id)}>
              <input type="hidden" name="fileItemId" value={eSections[0]?.id ?? ""} />
              <button type="submit" className={btn} data-testid="generate-summary">
                {tc.summary}
              </button>
            </form>
          </div>
        ) : null}
      </Panel>

      <Panel className="mt-6" flush>
        {confirmations.length === 0 ? (
          <p className="p-5 text-sm text-muted">{tc.empty}</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-atlas)]">
            <table className="w-full text-sm" data-testid="confirmations-table">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">{tc.type}</th>
                  <th className="px-3 py-2">{tc.party}</th>
                  <th className="px-3 py-2 text-right">{tc.book}</th>
                  <th className="px-3 py-2">{tc.statusLabel}</th>
                  <th className="px-3 py-2 text-right">{tc.difference}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {confirmations.map((confirmation) => (
                  <tr key={confirmation.id} className="border-t border-line hover:bg-surface-2" data-testid={`conf-row-${confirmation.partyName}`}>
                    <td className="px-3 py-2 text-xs text-ink-soft">
                      {tc.types[confirmation.ctype]}
                      <span
                        className="ml-1 rounded-[var(--radius-atlas-xs)] bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted"
                        data-testid={`subject-${confirmation.partyName}`}
                      >
                        {subjectLabels[confirmation.subject]}
                      </span>
                      {confirmation.method === "negative" ? (
                        <span
                          className="ml-1 rounded-[var(--radius-atlas-xs)] bg-[var(--color-warn-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-warn"
                          data-testid={`method-${confirmation.partyName}`}
                        >
                          {fr ? "négative" : "negative"}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-medium text-ink">
                      {confirmation.partyName}
                      {confirmation.reminderCount > 0 ? (
                        <span className="ml-1 text-xs text-muted">({confirmation.reminderCount}↻)</span>
                      ) : null}
                      {confirmation.status === "sent" && confirmation.daysSinceSent !== null ? (
                        <span
                          className={`ml-1 text-xs tnum ${confirmation.daysSinceSent >= 14 ? "text-warn" : "text-muted"}`}
                          data-testid={`cadence-${confirmation.partyName}`}
                        >
                          {fr
                            ? `${confirmation.daysSinceSent} j depuis l'envoi`
                            : `${confirmation.daysSinceSent}d since sent`}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tnum">
                      {confirmation.bookAmount !== null ? formatFCFA(confirmation.bookAmount) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        data-testid={`conf-status-${confirmation.partyName}`}
                        className={
                          confirmation.status === "exception"
                            ? "rounded-[var(--radius-atlas-xs)] bg-[var(--color-rose-soft)] px-1.5 py-0.5 text-xs font-semibold text-rose"
                            : confirmation.status === "reconciled" || confirmation.status === "closed"
                              ? "rounded-[var(--radius-atlas-xs)] bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "rounded-[var(--radius-atlas-xs)] bg-surface-2 px-1.5 py-0.5 text-xs text-ink-soft"
                        }
                      >
                        {tc.statuses[confirmation.status]}
                      </span>
                      {confirmation.altProcedure ? (
                        <span className="ml-1 text-xs text-muted">· {confirmation.altProcedure}</span>
                      ) : null}
                      {confirmation.scopeLimitation ? (
                        <span
                          className="ml-1 whitespace-nowrap rounded-[var(--radius-atlas-xs)] bg-[var(--color-warn-soft)] px-1.5 py-0.5 text-xs font-semibold text-warn"
                          data-testid={`scope-flag-${confirmation.partyName}`}
                        >
                          {fr
                            ? "limitation d'étendue possible — ISA 705"
                            : "possible scope limitation — ISA 705"}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tnum">
                      {confirmation.difference !== null ? formatFCFA(confirmation.difference) : ""}
                      {confirmation.difference !== null && confirmation.difference !== 0 && confirmation.fileItemId ? (
                        <Link
                          href={`/engagements/${id}/sections/${confirmation.fileItemId}`}
                          className="ml-1 whitespace-nowrap text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                          data-testid={`raise-${confirmation.partyName}`}
                        >
                          {fr ? "Signaler une anomalie →" : "Raise misstatement →"}
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {confirmation.letterDocumentId ? (
                          <Link href={`/documents/${confirmation.letterDocumentId}`} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                            {tc.letter}
                          </Link>
                        ) : (
                          <form action={generateLetterForAction.bind(null, id, confirmation.id)}>
                            <button type="submit" className={btn} data-testid={`letter-${confirmation.partyName}`}>
                              {tc.letter}
                            </button>
                          </form>
                        )}
                        {confirmation.status === "prepared" ? (
                          <form action={approveAction.bind(null, id, confirmation.id)}>
                            <button type="submit" className={btn} data-testid={`approve-${confirmation.partyName}`}>
                              {tc.approve}
                            </button>
                          </form>
                        ) : null}
                        {confirmation.status === "approved" ? (
                          <form action={sendAction.bind(null, id, confirmation.id)}>
                            <button type="submit" className={btn} data-testid={`send-${confirmation.partyName}`}>
                              {tc.send}
                            </button>
                          </form>
                        ) : null}
                        {confirmation.status === "sent" ? (
                          <>
                            <form action={remindAction.bind(null, id, confirmation.id)}>
                              <button type="submit" className={btn}>
                                {tc.remind}
                              </button>
                            </form>
                            <form action={replyAction.bind(null, id, confirmation.id)} className="flex items-center gap-1">
                              <input name="confirmedAmount" type="number" required placeholder={tc.confirmedAmount} className={input} data-testid={`reply-amount-${confirmation.partyName}`} />
                              <button type="submit" className={btn} data-testid={`reply-${confirmation.partyName}`}>
                                {tc.reply}
                              </button>
                            </form>
                            <form action={alternativeAction.bind(null, id, confirmation.id)} className="flex items-center gap-1">
                              <input name="procedure" placeholder={tc.altProcedure} className={input} data-testid={`alt-input-${confirmation.partyName}`} />
                              <button type="submit" className={btn} data-testid={`alt-${confirmation.partyName}`}>
                                {tc.alternative}
                              </button>
                            </form>
                            <form action={noResponseAction.bind(null, id, confirmation.id)}>
                              <button type="submit" className={btn} data-testid={`noreply-${confirmation.partyName}`}>
                                {fr ? "Sans réponse" : "No reply"}
                              </button>
                            </form>
                          </>
                        ) : null}
                        {confirmation.status === "exception" ? (
                          <form action={disposeAction.bind(null, id, confirmation.id)} className="flex items-center gap-1">
                            <select name="disposition" className={input} data-testid={`dispose-select-${confirmation.partyName}`}>
                              <option value="timing">{tc.dispositions.timing}</option>
                              <option value="client_error">{tc.dispositions.client_error}</option>
                              <option value="confirmee_error">{tc.dispositions.confirmee_error}</option>
                            </select>
                            <button type="submit" className={btn} data-testid={`dispose-${confirmation.partyName}`}>
                              {tc.dispose}
                            </button>
                          </form>
                        ) : null}
                      </div>
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
