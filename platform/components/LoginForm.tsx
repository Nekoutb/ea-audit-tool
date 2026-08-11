// Server-action login: works with AND without JavaScript. Filtered networks
// (antivirus web-protection proxies) sometimes block script files entirely —
// with the old client-only form the submit degraded to a GET that leaked the
// password into the URL and never signed in. A server action degrades to a
// plain POST handled by Next, so the flow works everywhere.

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { SubmitButton } from "@/components/SubmitButton";
import type { Messages } from "@/lib/i18n";

async function loginAction(formData: FormData): Promise<void> {
  "use server";
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      // "/" resolves to the most-recently-worked engagement's dashboard.
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?error=1");
    throw error; // NEXT_REDIRECT on success must propagate
  }
}

export function LoginForm({
  messages,
  failed,
}: {
  messages: Messages["login"];
  failed?: boolean;
}) {
  return (
    <form action={loginAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink-soft">{messages.email}</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink-soft">{messages.password}</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
        />
      </label>

      {failed ? (
        <p role="alert" className="text-sm text-rose">
          {messages.error}
        </p>
      ) : null}

      <SubmitButton
        testId="login-submit"
        className="mt-2 rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-2 font-medium text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:opacity-60"
      >
        {messages.submit}
      </SubmitButton>
    </form>
  );
}
