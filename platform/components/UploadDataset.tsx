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
  const [headerRow, setHeaderRow] = useState(true);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    form.set("headerRow", headerRow ? "1" : "0");
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
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

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
        className="text-sm text-ink-soft file:mr-3 file:rounded-[var(--radius-atlas-sm)] file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-soft"
      />
      <label className="flex items-center gap-1.5 text-[12px] text-ink-soft">
        <input
          type="checkbox"
          checked={headerRow}
          onChange={(e) => setHeaderRow(e.target.checked)}
          data-testid="dataset-upload-header-row"
        />
        {messages.tbPage.firstRowHeaders}
      </label>
      <button
        type="submit"
        disabled={pending}
        data-testid="dataset-upload"
        className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {messages.dataPage.upload}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-rose">
          {error}
        </p>
      ) : null}
    </form>
  );
}
