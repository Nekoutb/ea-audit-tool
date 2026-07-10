"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Messages } from "@/lib/i18n";

export function UploadTb({
  engagementId,
  messages,
}: {
  engagementId: string;
  messages: Messages["planning"];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/engagements/${engagementId}/tb`, {
      method: "POST",
      body: form,
    });
    setPending(false);
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      status?: string;
      versionNo?: number;
    };
    if (!response.ok) {
      const code = (body.error ?? "file-required") as keyof typeof messages.errors;
      setError(messages.errors[code] ?? String(body.error));
      return;
    }
    setStatus(`v${body.versionNo}: ${body.status}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input
        type="file"
        name="file"
        accept=".csv,.xlsx,.txt"
        required
        data-testid="tb-file"
        className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 dark:text-slate-400 dark:file:border-slate-700 dark:file:bg-slate-900 dark:file:text-slate-300"
      />
      <button
        type="submit"
        disabled={pending}
        data-testid="tb-upload"
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {messages.tbPage.import}
      </button>
      {status ? (
        <span className="text-sm text-emerald-700 dark:text-emerald-400" data-testid="tb-import-status">
          {status}
        </span>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </form>
  );
}
