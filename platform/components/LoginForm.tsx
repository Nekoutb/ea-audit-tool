"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Messages } from "@/lib/i18n";

export function LoginForm({ messages }: { messages: Messages["login"] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      redirect: false,
    });

    setPending(false);
    if (!result || result.error) {
      setError(messages.error);
      return;
    }
    // "/" resolves to the most-recently-worked engagement's dashboard.
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
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

      {error ? (
        <p role="alert" className="text-sm text-rose">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        data-testid="login-submit"
        disabled={pending}
        className="mt-2 rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-2 font-medium text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:opacity-60"
      >
        {pending ? messages.submitting : messages.submit}
      </button>
    </form>
  );
}
