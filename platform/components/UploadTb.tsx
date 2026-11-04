"use client";

import { FilePicker } from "@/components/FilePicker";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Messages } from "@/lib/i18n";

export function UploadTb({
  engagementId,
  messages,
  locale = "fr",
}: {
  engagementId: string;
  messages: Messages["planning"];
  locale?: "en" | "fr";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [headerRow, setHeaderRow] = useState(true);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    form.set("headerRow", headerRow ? "1" : "0");
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
      <FilePicker name="file" accept=".csv,.xlsx,.txt" required locale={locale} testId="tb-file" />
      <label className="flex items-center gap-1.5 text-[12px] text-ink-soft">
        <input
          type="checkbox"
          checked={headerRow}
          onChange={(e) => setHeaderRow(e.target.checked)}
          data-testid="tb-upload-header-row"
        />
        {messages.tbPage.firstRowHeaders}
      </label>
      <button
        type="submit"
        disabled={pending}
        data-testid="tb-upload"
        className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {messages.tbPage.import}
      </button>
      {status ? (
        <span className="text-sm text-emerald-700 tnum" data-testid="tb-import-status">
          {status}
        </span>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-rose">
          {error}
        </p>
      ) : null}
    </form>
  );
}
