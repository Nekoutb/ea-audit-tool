import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LoginForm } from "@/components/LoginForm";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Already signed in? Skip the form.
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }
  const { error } = await props.searchParams;

  const locale = await getLocale();
  const messages = getMessages(locale);

  // A refused credential and a session that ended underneath someone are
  // different things and must not read the same. Anything unrecognised falls
  // back to the credential message, so a new code can never render blank.
  const notice =
    error === "session-ended"
      ? messages.login.sessionEnded
      : error === "too-many-attempts"
        ? messages.login.tooManyAttempts
        : error === "mfa-required"
          ? messages.login.mfaRequired
          : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-atlas)] border border-line bg-surface p-8 shadow-[var(--shadow-atlas)]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-500">
              {messages.common.appName}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">
              {messages.login.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {messages.login.subtitle}
            </p>
          </div>
          <LanguageSwitcher current={locale} />
        </div>
        <LoginForm messages={messages.login} failed={Boolean(error) && !notice} notice={notice} />
      </div>
    </main>
  );
}
