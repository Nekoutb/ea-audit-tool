"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Messages } from "@/lib/i18n";
import { SUB_LEDGER_KINDS } from "@/lib/subledger-kinds";

export function UploadDataset({
  engagementId,
  messages,
}: {
  engagementId: string;
  messages: Messages["planning"];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/engagements/${engagementId}/subledgers`, {
      method: "POST",
      body: form,
    });
    setPending(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      const code = (body.error ?? "file-required") as keyof typeof messages.errors;
      setError(messages.errors[code] ?? String(body.error));
      return;
    }
    router.refresh();
  }

  const input =
    "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <select name="kind" className={input} data-testid="dataset-kind">
        {SUB_LEDGER_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {messages.dataPage.kinds[kind]}
          </option>
        ))}
      </select>
      <input
        type="file"
        name="file"
        accept=".csv,.xlsx,.txt"
        required
        data-testid="dataset-file"
        className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 dark:text-slate-400 dark:file:border-slate-700 dark:file:bg-slate-900 dark:file:text-slate-300"
      />
      <button
        type="submit"
        disabled={pending}
        data-testid="dataset-upload"
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {messages.dataPage.upload}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </form>
  );
}
