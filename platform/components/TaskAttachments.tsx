"use client";

import { useEffect, useRef, useState } from "react";
import { Chip, Panel, PanelHeader } from "@/components/ui/atlas";
import type { AttachmentRow } from "@/lib/attachments";

/** File System Access API surface used by the edit-locally watcher. */
interface FsFileHandle {
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  getFile(): Promise<File>;
}
declare global {
  interface Window {
    showSaveFilePicker?(options: {
      suggestedName?: string;
    }): Promise<FsFileHandle>;
  }
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The files of a task: upload, download, versioned re-uploads — and an
 * edit-locally mode. "Edit locally" saves the file to a location the user
 * picks, keeps the handle, and watches it while this page stays open: every
 * time the file is saved on disk, the watcher uploads it as the next version,
 * so the tool always holds the latest state of the document.
 */
export function TaskAttachments({
  compact = false,
  fileItemId,
  initial,
  locale,
}: {
  compact?: boolean;
  fileItemId: string;
  initial: AttachmentRow[];
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const [rows, setRows] = useState<AttachmentRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** attachment name → watcher state */
  const [watching, setWatching] = useState<Record<string, number>>({});
  const watchers = useRef<Map<string, { stop: () => void }>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);
  const canWatch = typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";

  useEffect(() => {
    const map = watchers.current;
    return () => {
      for (const w of map.values()) w.stop();
      map.clear();
    };
  }, []);

  async function upload(file: File): Promise<AttachmentRow | null> {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/attachments/${fileItemId}`, { method: "POST", body });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(
        j.error === "file-size"
          ? fr
            ? "Fichier vide ou au-delà de 25 Mo."
            : "Empty file, or larger than the 25 MB ceiling."
          : fr
            ? "Le téléversement a échoué."
            : "The upload failed.",
      );
      return null;
    }
    const j = (await res.json()) as { attachment: AttachmentRow };
    setError(null);
    setRows((prev) => {
      const rest = prev.filter((r) => r.name !== j.attachment.name);
      return [{ ...j.attachment, uploadedBy: fr ? "moi" : "me" }, ...rest];
    });
    return j.attachment;
  }

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    for (const f of Array.from(files)) await upload(f);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  /**
   * Edit locally: write the server's current bytes to a file the user picks,
   * then poll the handle — each local save round-trips as the next version.
   */
  async function editLocally(row: AttachmentRow) {
    if (!window.showSaveFilePicker) return;
    let handle: FsFileHandle;
    try {
      handle = await window.showSaveFilePicker({ suggestedName: row.name });
    } catch {
      return; // user cancelled the picker
    }
    const res = await fetch(`/api/attachments/file/${row.id}`);
    if (!res.ok) {
      setError(fr ? "Téléchargement impossible." : "Could not fetch the file.");
      return;
    }
    const blob = await res.blob();
    const w = await handle.createWritable();
    await w.write(blob);
    await w.close();
    let last = (await handle.getFile()).lastModified;
    let inFlight = false;
    const timer = setInterval(async () => {
      if (inFlight) return;
      try {
        const f = await handle.getFile();
        if (f.lastModified !== last && f.size > 0) {
          inFlight = true;
          const saved = await upload(new File([f], row.name, { type: f.type || row.mime }));
          last = f.lastModified;
          inFlight = false;
          if (saved) setWatching((prev) => ({ ...prev, [row.name]: saved.version }));
        }
      } catch {
        // the handle became invalid (file moved/deleted) — stop watching
        stopWatch(row.name);
      }
    }, 2000);
    watchers.current.get(row.name)?.stop();
    watchers.current.set(row.name, { stop: () => clearInterval(timer) });
    setWatching((prev) => ({ ...prev, [row.name]: row.version }));
  }

  function stopWatch(name: string) {
    watchers.current.get(name)?.stop();
    watchers.current.delete(name);
    setWatching((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  return (
    <Panel className={compact ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "mt-6"} data-testid="task-attachments">
      <PanelHeader
        title={fr ? "Fichiers de la tâche" : "Task files"}
        right={
          <label className="inline-flex min-h-[28px] cursor-pointer items-center rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-800">
            {busy ? (fr ? "Téléversement…" : "Uploading…") : fr ? "+ Téléverser un fichier" : "+ Upload a file"}
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              disabled={busy}
              onChange={(e) => onPick(e.target.files)}
              data-testid="attachment-input"
            />
          </label>
        }
      />
      <p className="mt-2 text-xs text-muted">
        {fr
          ? "Téléverser à nouveau un fichier du même nom crée la version suivante. « Modifier en local » surveille le fichier ouvert : chaque enregistrement remonte automatiquement dans l’outil tant que cette page reste ouverte."
          : "Re-uploading the same filename stores the next version. “Edit locally” watches the opened file: every save on your machine uploads automatically while this page stays open."}
      </p>
      {error ? <p className="mt-2 text-xs font-semibold text-rose">{error}</p> : null}
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted" data-testid="attachments-empty">
          {fr ? "Aucun fichier sur cette tâche." : "No file on this task yet."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line" data-testid="attachments-list">
          {rows.map((row) => (
            <li key={row.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{row.name}</span>
                <span className="block truncate text-[11.5px] text-muted tnum">
                  v{watching[row.name] ?? row.version} · {fmtSize(row.sizeBytes)} · {row.uploadedBy} · {row.uploadedAt}
                </span>
              </span>
              {watching[row.name] !== undefined ? (
                <>
                  <Chip tone="good">{fr ? "Suivi des enregistrements" : "Watching saves"}</Chip>
                  <button
                    type="button"
                    onClick={() => stopWatch(row.name)}
                    className="text-xs font-semibold text-muted hover:text-ink"
                    data-testid={`attachment-stop-${row.name}`}
                  >
                    {fr ? "Arrêter" : "Stop"}
                  </button>
                </>
              ) : canWatch ? (
                <button
                  type="button"
                  onClick={() => editLocally(row)}
                  className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  data-testid={`attachment-edit-${row.name}`}
                >
                  {fr ? "Modifier en local" : "Edit locally"}
                </button>
              ) : null}
              <a
                href={`/api/attachments/file/${row.id}`}
                className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                data-testid={`attachment-download-${row.name}`}
              >
                {fr ? "Télécharger" : "Download"}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
