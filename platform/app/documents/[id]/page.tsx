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
import {
  getDocument,
  listReviewNotes,
  listSignoffs,
  listVersions,
} from "@/lib/documents";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

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
    "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
  const btnPrimary =
    "rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50";
  const inputClass =
    "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <AppNav locale={locale} />

      <div className="mt-8">
        <Link
          href={`/engagements/${document.engagementId}`}
          className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ← {td.backToFile}
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {document.fileItemCode} — {document.title}
          </h1>
          <span
            data-testid="doc-status"
            className={
              isSigned
                ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            }
          >
            {isSigned ? td.statusSigned : td.statusDraft}
          </span>
        </div>
        {document.checkedOutBy ? (
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400" data-testid="checkout-info">
            {td.checkedOutBy}: {document.checkedOutByName}
          </p>
        ) : null}
      </div>

      {errorText ? (
        <p
          role="alert"
          data-testid="doc-error"
          className="mt-4 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorText}
        </p>
      ) : null}

      <section className="mt-6 flex flex-wrap items-center gap-3">
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
        <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{td.uploadHint}</p>
          <UploadVersion documentId={id} messages={td} />
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{td.signoffs}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {(["preparer", "reviewer", "partner"] as const).map((role) => {
            const active = signoffs.find((s) => s.role === role && !s.voidedAt);
            if (active) {
              return (
                <span
                  key={role}
                  data-testid={`signed-${role}`}
                  className="rounded-md bg-emerald-100 px-3 py-1.5 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                >
                  {role === "preparer"
                    ? td.signPreparer
                    : role === "reviewer"
                      ? td.signReviewer
                      : td.signPartner}
                  : {active.userName} · v{active.versionNo} · {active.signedAt}
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
                  {role === "preparer"
                    ? td.signPreparer
                    : role === "reviewer"
                      ? td.signReviewer
                      : td.signPartner}
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
            className="mt-4 flex flex-wrap items-center gap-3"
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
          <ul className="mt-3 text-xs text-slate-500 dark:text-slate-400">
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

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {td.reviewNotes} {openNotes.length > 0 ? `(${openNotes.length})` : ""}
        </h2>
        <ul className="mt-3 flex flex-col gap-2" data-testid="review-notes">
          {notes.map((note) => (
            <li
              key={note.id}
              className={`rounded-lg border p-3 text-sm ${
                note.status === "open"
                  ? "border-amber-300 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <p className="text-slate-800 dark:text-slate-200">
                <span className="font-medium">{note.authorName}</span> · {note.createdAt} ·{" "}
                {note.status === "open" ? td.noteOpen : td.noteCleared}
              </p>
              <p className="mt-1 text-slate-700 dark:text-slate-300">{note.body}</p>
              {note.response ? (
                <p className="mt-1 text-slate-500 dark:text-slate-400">
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
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{td.versions}</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm" data-testid="versions-table">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
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
                  className="border-t border-slate-200 dark:border-slate-800"
                >
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                    v{version.versionNo}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                    {(version.byteSize / 1024).toFixed(1)} KB
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                    {version.createdByName}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                    {version.createdAt}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
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
                          className="font-medium text-slate-600 hover:underline dark:text-slate-400"
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
      </section>

      {document.currentVersion > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {td.previewTitle}
          </h2>
          <div className="mt-3">
            <DocxPreview
              documentId={id}
              versionNo={document.currentVersion}
              loadingLabel={td.previewLoading}
            />
          </div>
        </section>
      ) : null}
    </main>
  );
}
