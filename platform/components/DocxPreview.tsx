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
        <p className="text-sm text-slate-500 dark:text-slate-400">{loadingLabel}</p>
      ) : null}
      <div
        ref={container}
        data-testid="docx-preview"
        className="max-h-[540px] overflow-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 [&_.docx-wrapper]:bg-white [&_.docx-wrapper]:p-4"
      />
    </div>
  );
}
