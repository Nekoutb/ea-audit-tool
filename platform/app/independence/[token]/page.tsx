import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { submitConfirmationAction } from "@/app/actions/planning";
import { ErrorBanner } from "@/components/GatesPanel";
import { IndependenceQuestionField } from "@/components/IndependenceQuestionField";
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
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-xl rounded-[var(--radius-atlas)] border border-line bg-surface p-8 shadow-[var(--shadow-atlas-lg)]">
        <h1 className="text-2xl font-semibold text-ink">{t.formTitle}</h1>
        <ErrorBanner error={error} locale={locale} />

        {finished ? (
          <div className="mt-4" data-testid="confirmation-done">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">{t.doneTitle}</p>
            <p className="mt-1 text-sm text-ink-soft">{t.doneBody}</p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-soft">{t.formIntro}</p>
            <form action={submitConfirmationAction.bind(null, token)} className="mt-5 flex flex-col gap-4">
              {INDEPENDENCE_QUESTIONS.map((question) => (
                <IndependenceQuestionField
                  key={question.key}
                  qkey={question.key}
                  label={locale === "fr" ? question.labelFr : question.labelEn}
                  yesLabel={t.yes}
                  noLabel={t.no}
                  noteLabel={
                    locale === "fr"
                      ? "Décrivez les circonstances et les facteurs d'atténuation / mesures de sauvegarde"
                      : "Describe the circumstances and the mitigating factors / safeguards"
                  }
                  notePlaceholder={
                    locale === "fr"
                      ? "Nature du lien, montants, période, mesures prises ou proposées…"
                      : "Nature of the relationship, amounts, period, measures taken or proposed…"
                  }
                />
              ))}
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-soft">{t.signature}</span>
                <input
                  name="signature"
                  required
                  className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                  data-testid="signature-input"
                />
              </label>
              <button
                type="submit"
                className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
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
