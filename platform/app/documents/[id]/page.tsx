import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  addNoteAction,
  cancelCheckoutAction,
  checkoutAction,
  clearNoteAction,
  reopenAction,
  restoreVersionAction,
  signAction,
} from "@/app/actions/audit-file";
import { AppNav } from "@/components/AppNav";
import { DocxPreview } from "@/components/DocxPreview";
import { UploadVersion } from "@/components/UploadVersion";
import { Chip, Panel, PanelHeader } from "@/components/ui/atlas";
import {
  getDocument,
  listReviewNotes,
  listSignoffs,
  listVersions,
} from "@/lib/documents";
import { initials } from "@/lib/engagement-dashboard";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Working paper · AuditISA" };

export default async function DocumentPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const td = t.document;

  const document = await getDocument(id);
  if (!document) notFound();
  const [versions, signoffs, notes] = await Promise.all([
    listVersions(id),
    listSignoffs(id),
    listReviewNotes(id),
  ]);

  const isSigned = document.status === "signed";
  const checkedOutByMe = document.checkedOutBy === session.user.id;
  const openNotes = notes.filter((note) => note.status === "open");
  const errorText = error ? (td.errors[error as keyof typeof td.errors] ?? error) : null;

  const btn =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2 disabled:opacity-50";
  const btnPrimary =
    "rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50";
  const inputClass =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const summaryClass =
    "flex cursor-pointer select-none list-none items-center justify-between gap-3 px-5 py-3.5 text-sm font-semibold tracking-[-0.01em] text-ink [&::-webkit-details-marker]:hidden";
  const caret = (
    <span
      aria-hidden
      className="text-xs text-muted transition-transform group-open:rotate-90 motion-reduce:transition-none"
    >
      ›
    </span>
  );

  return (
    <main className="min-h-screen w-full px-6 py-10">
      <AppNav locale={locale} />

      <div className="mt-8">
        <Link
          href={`/engagements/${document.engagementId}`}
          className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ← {td.backToFile}
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-ink">
            {document.fileItemCode} — {document.title}
          </h1>
          <span data-testid="doc-status">
            <Chip tone={isSigned ? "good" : "warn"}>
              {isSigned ? td.statusSigned : td.statusDraft}
            </Chip>
          </span>
        </div>
        {document.checkedOutBy ? (
          <p className="mt-1 text-sm text-warn" data-testid="checkout-info">
            {td.checkedOutBy}: {document.checkedOutByName}
          </p>
        ) : null}
      </div>

      {errorText ? (
        <p
          role="alert"
          data-testid="doc-error"
          className="mt-4 rounded-[var(--radius-atlas-sm)] border border-line bg-[var(--color-rose-soft)] px-4 py-2 text-sm text-rose"
        >
          {errorText}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_360px]">
        {/* Document: preview + editing controls */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-wrap items-center gap-3">
            {!isSigned && !document.checkedOutBy ? (
              <form
                action={async () => {
                  "use server";
                  await checkoutAction(id);
                }}
              >
                <button type="submit" className={btnPrimary} data-testid="checkout">
                  {td.checkout}
                </button>
              </form>
            ) : null}
            {checkedOutByMe ? (
              <form
                action={async () => {
                  "use server";
                  await cancelCheckoutAction(id);
                }}
              >
                <button type="submit" className={btn} data-testid="cancel-checkout">
                  {td.cancelCheckout}
                </button>
              </form>
            ) : null}
            {document.currentVersion > 0 ? (
              <a
                href={`/api/documents/${id}/versions/${document.currentVersion}`}
                className={btn}
                data-testid="download-current"
              >
                {td.downloadCurrent} (v{document.currentVersion})
              </a>
            ) : null}
          </section>

          {checkedOutByMe ? (
            <section className="rounded-[var(--radius-atlas)] border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
              <p className="mb-3 text-sm text-ink-soft">{td.uploadHint}</p>
              <UploadVersion documentId={id} messages={td} />
            </section>
          ) : null}

          {document.currentVersion > 0 ? (
            <section>
              <h2 className="text-lg font-semibold text-ink">{td.previewTitle}</h2>
              <div className="mt-3">
                <DocxPreview
                  documentId={id}
                  versionNo={document.currentVersion}
                  loadingLabel={td.previewLoading}
                />
              </div>
            </section>
          ) : null}
        </div>

        {/* Review pane */}
        <Panel flush data-testid="review-pane" className="min-w-0 lg:sticky lg:top-6">
          <section className="border-b border-line px-5 py-4">
            <PanelHeader title={td.signoffs} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(["preparer", "reviewer", "partner"] as const).map((role) => {
                const label =
                  role === "preparer"
                    ? td.signPreparer
                    : role === "reviewer"
                      ? td.signReviewer
                      : td.signPartner;
                const active = signoffs.find((s) => s.role === role && !s.voidedAt);
                if (active) {
                  const detail = `${label}: ${active.userName} · v${active.versionNo} · ${active.signedAt}`;
                  return (
                    <span
                      key={role}
                      data-testid={`signed-${role}`}
                      title={detail}
                      className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-2.5 text-[11px] font-bold ${
                        role === "preparer"
                          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-extrabold ${
                          role === "preparer"
                            ? "bg-emerald-200/80 dark:bg-emerald-900"
                            : "bg-indigo-200/80 dark:bg-indigo-900"
                        }`}
                      >
                        {role === "reviewer" ? "R" : "P"}
                      </span>
                      {initials(active.userName)}
                      <span className="sr-only">{detail}</span>
                    </span>
                  );
                }
                if (isSigned) return null;
                return (
                  <form
                    key={role}
                    action={async () => {
                      "use server";
                      await signAction(id, role);
                    }}
                  >
                    <button type="submit" className={btn} data-testid={`sign-${role}`}>
                      {label}
                    </button>
                  </form>
                );
              })}
            </div>

            {isSigned ? (
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await reopenAction(id, formData);
                }}
                className="mt-4 flex flex-wrap items-center gap-2"
              >
                <input
                  name="reason"
                  required
                  placeholder={td.reopenReason}
                  className={`${inputClass} w-96 max-w-full`}
                  data-testid="reopen-reason"
                />
                <button type="submit" className={btn} data-testid="reopen">
                  {td.reopen}
                </button>
              </form>
            ) : null}

            {signoffs.some((s) => s.voidedAt) ? (
              <ul className="mt-3 text-xs text-muted">
                {signoffs
                  .filter((s) => s.voidedAt)
                  .map((s) => (
                    <li key={s.id}>
                      {s.role} — {s.userName} · v{s.versionNo} · {td.voided} {s.voidedAt} ({s.voidReason})
                    </li>
                  ))}
              </ul>
            ) : null}
          </section>

          <details open className="group border-b border-line">
            <summary className={summaryClass}>
              <span>
                {td.reviewNotes} ({openNotes.length})
              </span>
              {caret}
            </summary>
            <div className="px-5 pb-5">
              <ul className="flex flex-col gap-2" data-testid="review-notes">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className={`rounded-[var(--radius-atlas)] border p-3 text-sm ${
                      note.status === "open"
                        ? "border-line bg-[var(--color-warn-soft)]"
                        : "border-line"
                    }`}
                  >
                    <p className="text-ink">
                      <span className="font-medium">{note.authorName}</span> · {note.createdAt} ·{" "}
                      {note.status === "open" ? td.noteOpen : td.noteCleared}
                    </p>
                    <p className="mt-1 text-ink-soft">{note.body}</p>
                    {note.response ? (
                      <p className="mt-1 text-muted">
                        {td.noteResponse}: {note.response}
                      </p>
                    ) : null}
                    {note.status === "open" ? (
                      <form
                        action={async (formData: FormData) => {
                          "use server";
                          await clearNoteAction(id, note.id, formData);
                        }}
                        className="mt-2 flex flex-wrap items-center gap-2"
                      >
                        <input
                          name="response"
                          required
                          placeholder={td.noteResponse}
                          className={inputClass}
                          data-testid={`note-response-${note.id}`}
                        />
                        <button type="submit" className={btn} data-testid={`clear-note-${note.id}`}>
                          {td.clearNote}
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await addNoteAction(id, formData);
                }}
                className="mt-3 flex flex-wrap items-center gap-2"
              >
                <input
                  name="body"
                  required
                  placeholder={td.noteBody}
                  className={`${inputClass} w-96 max-w-full`}
                  data-testid="note-body"
                />
                <button type="submit" className={btn} data-testid="add-note">
                  {td.addNote}
                </button>
              </form>
            </div>
          </details>

          <details className="group">
            <summary className={summaryClass}>
              <span>
                {td.versions} ({versions.length})
              </span>
              {caret}
            </summary>
            <div className="px-5 pb-5">
              <div className="overflow-x-auto rounded-[var(--radius-atlas)] border border-line bg-surface shadow-[var(--shadow-atlas)]">
                <table className="w-full text-sm" data-testid="versions-table">
                  <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-2.5">{td.versionCol}</th>
                      <th className="px-4 py-2.5">{td.sizeCol}</th>
                      <th className="px-4 py-2.5">{td.byCol}</th>
                      <th className="px-4 py-2.5">{td.dateCol}</th>
                      <th className="px-4 py-2.5">{td.noteCol}</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((version) => (
                      <tr
                        key={version.versionNo}
                        className="border-t border-line hover:bg-surface-2"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-ink tnum">
                          v{version.versionNo}
                        </td>
                        <td className="px-4 py-2.5 text-ink-soft tnum">
                          {(version.byteSize / 1024).toFixed(1)} KB
                        </td>
                        <td className="px-4 py-2.5 text-ink-soft">
                          {version.createdByName}
                        </td>
                        <td className="px-4 py-2.5 text-ink-soft tnum">
                          {version.createdAt}
                        </td>
                        <td className="px-4 py-2.5 text-muted">
                          {version.note}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <a
                            href={`/api/documents/${id}/versions/${version.versionNo}`}
                            className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            {td.download}
                          </a>
                          {!isSigned &&
                          !document.checkedOutBy &&
                          version.versionNo !== document.currentVersion ? (
                            <form
                              action={async () => {
                                "use server";
                                await restoreVersionAction(id, version.versionNo);
                              }}
                              className="ml-3 inline"
                            >
                              <button
                                type="submit"
                                className="font-medium text-ink-soft hover:underline"
                                data-testid={`restore-${version.versionNo}`}
                              >
                                {td.restore}
                              </button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </Panel>
      </div>
    </main>
  );
}
