"use client";

import { FilePicker } from "@/components/FilePicker";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Messages } from "@/lib/i18n";

export function UploadVersion({
  documentId,
  messages,
  locale = "fr",
}: {
  documentId: string;
  messages: Messages["document"];
  locale?: "en" | "fr";
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
      <FilePicker name="file" accept=".docx" required locale={locale} testId="upload-file" />
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
