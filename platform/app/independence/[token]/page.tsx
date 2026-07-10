import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { submitConfirmationAction } from "@/app/actions/planning";
import { ErrorBanner } from "@/components/GatesPanel";
import { getMessages } from "@/lib/i18n";
import { getMyConfirmation, INDEPENDENCE_QUESTIONS } from "@/lib/independence";
import { getLocale } from "@/lib/locale";

export default async function IndependencePage(props: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { token } = await props.params;
  const { error, done } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale).planning.independence;

  const confirmation = await getMyConfirmation(token);
  if (!confirmation) notFound();

  const finished = done === "1" || confirmation.status === "completed" || confirmation.status === "exception";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t.formTitle}</h1>
        <ErrorBanner error={error} locale={locale} />

        {finished ? (
          <div className="mt-4" data-testid="confirmation-done">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">{t.doneTitle}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.doneBody}</p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t.formIntro}</p>
            <form action={submitConfirmationAction.bind(null, token)} className="mt-5 flex flex-col gap-4">
              {INDEPENDENCE_QUESTIONS.map((question) => (
                <fieldset key={question.key} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <legend className="px-1 text-slate-800 dark:text-slate-200">
                    {locale === "fr" ? question.labelFr : question.labelEn}
                  </legend>
                  <div className="mt-1 flex gap-5">
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name={question.key} value="no" defaultChecked required data-testid={`q-${question.key}-no`} />
                      {t.no}
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name={question.key} value="yes" data-testid={`q-${question.key}-yes`} />
                      {t.yes}
                    </label>
                  </div>
                </fieldset>
              ))}
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-700 dark:text-slate-300">{t.signature}</span>
                <input
                  name="signature"
                  required
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  data-testid="signature-input"
                />
              </label>
              <button
                type="submit"
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                data-testid="submit-confirmation"
              >
                {t.submit}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
