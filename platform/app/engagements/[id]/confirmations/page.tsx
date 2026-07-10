import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  addManualAction,
  alternativeAction,
  approveAction,
  disposeAction,
  generateLetterForAction,
  remindAction,
  replyAction,
  selectConfirmationsAction,
  sendAction,
  summaryAction,
} from "@/app/actions/confirmations";
import { AppNav } from "@/components/AppNav";
import { EngagementTabs } from "@/components/EngagementTabs";
import { ErrorBanner } from "@/components/GatesPanel";
import { CONFIRMATION_TYPES, confirmationSummary, listConfirmationsFor } from "@/lib/confirmations";
import { getEngagement, listFileItems } from "@/lib/engagements";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listDatasets } from "@/lib/subledgers";

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
  const [confirmations, summary, datasets, items] = await Promise.all([
    listConfirmationsFor(id),
    confirmationSummary(id),
    listDatasets(id),
    listFileItems(id),
  ]);
  const eSections = items.filter((item) => item.section === "E");

  const btn =
    "rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
  const input =
    "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const card = "mt-6 rounded-xl border border-slate-200 p-5 dark:border-slate-800";

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {engagement.clientName} — {engagement.fiscalYear} · {tc.title}
      </h1>
      <EngagementTabs engagementId={id} locale={locale} active="confirmations" />
      <ErrorBanner error={error} locale={locale} />

      <section className={card}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <form action={selectConfirmationsAction.bind(null, id)} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tc.select}</p>
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
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input type="checkbox" name="includeNil" /> {tc.includeNil}
              </label>
              <button type="submit" className={btn} data-testid="conf-select">
                {tc.select}
              </button>
            </div>
          </form>

          <form action={addManualAction.bind(null, id)} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tc.manual}</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <select name="ctype" className={input} data-testid="manual-type">
                {CONFIRMATION_TYPES.map((ctype) => (
                  <option key={ctype} value={ctype}>{tc.types[ctype]}</option>
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
              <button type="submit" className={btn} data-testid="manual-add">
                +
              </button>
            </div>
          </form>
        </div>

        {summary.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-3 text-sm" data-testid="conf-summary">
            {summary.map((row) => (
              <span key={row.ctype} className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">
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
      </section>

      <section className={card}>
        {confirmations.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{tc.empty}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm" data-testid="confirmations-table">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
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
                  <tr key={confirmation.id} className="border-t border-slate-200 dark:border-slate-800" data-testid={`conf-row-${confirmation.partyName}`}>
                    <td className="px-3 py-2 text-xs">{tc.types[confirmation.ctype]}</td>
                    <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                      {confirmation.partyName}
                      {confirmation.reminderCount > 0 ? (
                        <span className="ml-1 text-xs text-slate-500">({confirmation.reminderCount}↻)</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {confirmation.bookAmount !== null ? formatFCFA(confirmation.bookAmount) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        data-testid={`conf-status-${confirmation.partyName}`}
                        className={
                          confirmation.status === "exception"
                            ? "rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300"
                            : confirmation.status === "reconciled" || confirmation.status === "closed"
                              ? "rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }
                      >
                        {tc.statuses[confirmation.status]}
                      </span>
                      {confirmation.altProcedure ? (
                        <span className="ml-1 text-xs text-slate-500">· {confirmation.altProcedure}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {confirmation.difference !== null ? formatFCFA(confirmation.difference) : ""}
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
      </section>
    </main>
  );
}
