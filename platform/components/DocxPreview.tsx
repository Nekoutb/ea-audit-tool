"use client";

import { useEffect, useRef, useState } from "react";

/**
 * In-browser working-paper preview (no Word needed): fetches the version bytes
 * and renders them with docx-preview. See DECISIONS.md — server-side PDF/A
 * conversion arrives with the Phase 7 archive.
 */
export function DocxPreview({
  documentId,
  versionNo,
  loadingLabel,
}: {
  documentId: string;
  versionNo: number;
  loadingLabel: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const response = await fetch(`/api/documents/${documentId}/versions/${versionNo}`);
        if (!response.ok) throw new Error(`download failed: ${response.status}`);
        const blob = await response.blob();
        const { renderAsync } = await import("docx-preview");
        if (cancelled || !container.current) return;
        container.current.innerHTML = "";
        await renderAsync(blob, container.current, undefined, {
          ignoreWidth: true,
          ignoreHeight: true,
        });
        if (!cancelled) setState("done");
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [documentId, versionNo]);

  return (
    <div>
      {state === "loading" ? (
        <p className="text-sm text-muted">{loadingLabel}</p>
      ) : null}
      <div
        ref={container}
        data-testid="docx-preview"
        className="max-h-[540px] overflow-auto rounded-[var(--radius-atlas)] border border-line bg-surface p-2 [&_.docx-wrapper]:bg-surface [&_.docx-wrapper]:p-4"
      />
    </div>
  );
}
