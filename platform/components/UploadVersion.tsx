"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Messages } from "@/lib/i18n";

export function UploadVersion({
  documentId,
  messages,
}: {
  documentId: string;
  messages: Messages["document"];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/documents/${documentId}/upload`, {
      method: "POST",
      body: form,
    });
    setPending(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      const code = body.error ?? "file-required";
      setError(messages.errors[code as keyof typeof messages.errors] ?? code);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input
        type="file"
        name="file"
        accept=".docx"
        required
        data-testid="upload-file"
        className="text-sm text-ink-soft file:mr-3 file:rounded-[var(--radius-atlas-sm)] file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-soft"
      />
      <button
        type="submit"
        disabled={pending}
        data-testid="upload-submit"
        className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {messages.upload}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-rose">
          {error}
        </p>
      ) : null}
    </form>
  );
}
