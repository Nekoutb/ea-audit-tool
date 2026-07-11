import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LoginForm } from "@/components/LoginForm";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function LoginPage() {
  // Already signed in? Skip the form.
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  const locale = await getLocale();
  const messages = getMessages(locale);

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
        <LoginForm messages={messages.login} />
      </div>
    </main>
  );
}
