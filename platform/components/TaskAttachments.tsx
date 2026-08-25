"use client";

import { useEffect, useRef, useState } from "react";
import { Panel, PanelHeader } from "@/components/ui/atlas";
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

/** File-type icon: a coloured tile with the family letter. */
function FileIcon({ name }: { name: string }) {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const [letter, bg] =
    ext === "doc" || ext === "docx"
      ? ["W", "#2b579a"]
      : ext === "xls" || ext === "xlsx" || ext === "csv"
        ? ["X", "#217346"]
        : ext === "ppt" || ext === "pptx"
          ? ["P", "#d24726"]
          : ext === "pdf"
            ? ["PDF", "#c11e1e"]
            : ["F", "#6b7280"];
  return (
    <span
      className="grid h-5 w-5 flex-shrink-0 place-items-center rounded text-[8px] font-extrabold text-white"
      style={{ background: bg }}
      aria-hidden
      data-testid={`file-icon-${letter}`}
    >
      {letter}
    </span>
  );
}

/** A file living on another task of this engagement, offered by the picker. */
interface ExistingFile {
  id: string;
  name: string;
  sizeBytes: number;
  taskCode: string;
  uploadedAt: string;
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
  canManage = false,
}: {
  compact?: boolean;
  fileItemId: string;
  initial: AttachmentRow[];
  locale: "en" | "fr";
  /** the signed-in user may rename or delete evidence (manager and above) */
  canManage?: boolean;
}) {
  const fr = locale === "fr";
  const [rows, setRows] = useState<AttachmentRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLSpanElement>(null);
  const [pickerFiles, setPickerFiles] = useState<ExistingFile[] | null>(null);
  /** attachment name → watcher state */
  const [watching, setWatching] = useState<Record<string, number>>({});
  const [renaming, setRenaming] = useState<string | null>(null);
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

  // The add-files menu closes like a real menu: choosing an option or
  // clicking anywhere else dismisses it.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  async function upload(file: File): Promise<AttachmentRow | null> {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/attachments/${fileItemId}`, { method: "POST", body });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string; allowed?: string[] };
      const reason =
        j.error === "file-size"
          ? fr ? "vide ou au-delà de 25 Mo" : "empty or over the 25 MB ceiling"
          : j.allowed
            ? fr
              ? `type de fichier refusé (permis : ${j.allowed.join(", ")})`
              : `file type refused (allowed: ${j.allowed.join(", ")})`
            : j.error === "archived"
              ? fr ? "dossier archivé — lecture seule" : "archived file — read-only"
              : j.error === "forbidden"
                ? fr ? "droits insuffisants" : "insufficient rights"
                : fr
                  ? `le téléversement a échoué (${j.error ?? res.status})`
                  : `the upload failed (${j.error ?? res.status})`;
      setError((prev) => [prev, `${file.name}: ${reason}`].filter(Boolean).join(" · "));
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
    setMenuOpen(false);
    setBusy(true);
    setError(null);
    let ok = 0;
    try {
      for (const f of Array.from(files)) {
        if (await upload(f)) ok += 1;
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
    setDone(ok > 0 ? (fr ? `✓ ${ok} fichier(s) ajouté(s)` : `✓ ${ok} file(s) added`) : null);
  }

  /** "Attach an existing engagement file": fetch the candidates, copy one here. */
  async function openPicker() {
    setPickerOpen(true);
    setPickerFiles(null);
    const res = await fetch(`/api/attachments/${fileItemId}`);
    if (!res.ok) {
      setPickerFiles([]);
      return;
    }
    const j = (await res.json()) as { files: ExistingFile[] };
    setPickerFiles(j.files);
  }

  async function attachExisting(f: ExistingFile) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/attachments/${fileItemId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copyFrom: f.id }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(`${f.name}: ${fr ? "l'ajout a échoué" : "could not attach"}`);
      return;
    }
    const j = (await res.json()) as { attachment: AttachmentRow };
    setRows((prev) => [{ ...j.attachment, uploadedBy: fr ? "moi" : "me" }, ...prev.filter((r) => r.name !== j.attachment.name)]);
    setDone(fr ? `✓ ${f.name} rattaché` : `✓ ${f.name} attached`);
    setPickerOpen(false);
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

  async function remove(row: AttachmentRow) {
    if (!window.confirm(fr
      ? `Supprimer « ${row.name} » ? Le fichier reste récupérable pendant 30 jours.`
      : `Delete "${row.name}"? It stays recoverable for 30 days.`)) return;
    const response = await fetch(`/api/attachments/file/${row.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(fr ? "Suppression impossible" : "Could not delete the file");
      return;
    }
    stopWatch(row.name);
    setRows((list) => list.filter((r) => r.name !== row.name));
  }
  async function commitRename(row: AttachmentRow, value: string) {
    setRenaming(null);
    const next = value.trim();
    if (!next || next === row.name) return;
    const res = await fetch(`/api/attachments/file/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    });
    if (!res.ok) {
      setError(fr ? "Le renommage a échoué." : "The rename failed.");
      return;
    }
    const j = (await res.json()) as { name: string };
    stopWatch(row.name); // the watcher is keyed by name — re-arm after renaming
    setRows((prev) => prev.map((r) => (r.name === row.name ? { ...r, name: j.name } : r)));
    setError(null);
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
          <span className="relative inline-flex" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex min-h-[28px] cursor-pointer items-center gap-1.5 rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-800"
              data-testid="attachment-add-menu"
            >
              {busy ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
                  {fr ? "Téléversement…" : "Uploading…"}
                </>
              ) : (
                <>{fr ? "+ Ajouter des fichiers" : "+ Add files"} ▾</>
              )}
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 flex min-w-[230px] flex-col rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface p-1 shadow-atlas-sm">
                <label className="cursor-pointer rounded px-2.5 py-1.5 text-left text-xs text-ink hover:bg-surface-2">
                  {fr ? "Depuis cet ordinateur… (multiples)" : "From this computer… (multiple)"}
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
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); void openPicker(); }}
                  className="rounded px-2.5 py-1.5 text-left text-xs text-ink hover:bg-surface-2"
                  data-testid="attachment-from-existing"
                >
                  {fr ? "Un fichier déjà dans la mission…" : "A file already in the engagement…"}
                </button>
              </div>
            ) : null}
          </span>
        }
      />
      {error ? <p className="mt-2 text-xs font-semibold text-rose" data-testid="attachment-error">{error}</p> : null}
      {done && !error ? <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400" data-testid="attachment-done">{done}</p> : null}
      {pickerOpen ? (
        <div className="mt-2 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface-2/60 p-2" data-testid="attachment-picker">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
              {fr ? "Fichiers de la mission" : "Engagement files"}
            </span>
            <button type="button" onClick={() => setPickerOpen(false)} className="text-xs text-muted hover:text-ink">✕</button>
          </div>
          {pickerFiles === null ? (
            <p className="px-1 py-1 text-xs text-muted">{fr ? "Chargement…" : "Loading…"}</p>
          ) : pickerFiles.length === 0 ? (
            <p className="px-1 py-1 text-xs text-muted">{fr ? "Aucun autre fichier dans la mission." : "No other files in this engagement."}</p>
          ) : (
            <ul className="max-h-44 overflow-y-auto">
              {pickerFiles.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => void attachExisting(f)}
                    disabled={busy}
                    className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs text-ink-soft hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                    data-testid={`attachment-existing-${f.id}`}
                  >
                    <FileIcon name={f.name} />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="flex-shrink-0 font-mono text-[10px] text-muted">{f.taskCode}</span>
                    <span className="flex-shrink-0 text-[10px] text-muted tnum">{fmtSize(f.sizeBytes)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted" data-testid="attachments-empty">
          {fr ? "Aucun fichier sur cette tâche." : "No file on this task yet."}
        </p>
      ) : (
        <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto pr-1" data-testid="attachments-list">
          {rows.map((row) => (
            <li key={row.name} className="flex items-center gap-2 py-1.5">
              <FileIcon name={row.name} />
              <span className="min-w-0 flex-1">
                {renaming === row.name ? (
                  <input
                    autoFocus
                    defaultValue={row.name}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(row, (e.target as HTMLInputElement).value);
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    onBlur={(e) => commitRename(row, e.target.value)}
                    className="w-full rounded-[var(--radius-atlas-xs)] border border-emerald-600 bg-surface px-1.5 py-0.5 text-sm text-ink outline-none"
                    data-testid={`attachment-rename-input-${row.name}`}
                  />
                ) : (
                  <span className="block truncate text-[12.5px] font-medium text-ink">{row.name}</span>
                )}
                <span className="block truncate text-[10.5px] text-muted tnum">
                  v{watching[row.name] ?? row.version} · {fmtSize(row.sizeBytes)} · {row.uploadedAt}
                  {watching[row.name] !== undefined ? (fr ? " · suivi actif" : " · watching saves") : ""}
                </span>
              </span>
              {/* rename — evidence metadata is a managed change */}
              {canManage ? (
              <button
                type="button"
                onClick={() => setRenaming(row.name)}
                title={fr ? "Renommer" : "Rename"}
                aria-label={fr ? "Renommer" : "Rename"}
                className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink"
                data-testid={`attachment-rename-${row.name}`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              </button>
              ) : null}
              {/* edit locally / stop watching */}
              {watching[row.name] !== undefined ? (
                <button
                  type="button"
                  onClick={() => stopWatch(row.name)}
                  title={fr ? "Arrêter le suivi" : "Stop watching"}
                  aria-label={fr ? "Arrêter le suivi" : "Stop watching"}
                  className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-emerald-700 transition hover:bg-surface-2 dark:text-emerald-400"
                  data-testid={`attachment-stop-${row.name}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
                </button>
              ) : canWatch ? (
                <button
                  type="button"
                  onClick={() => editLocally(row)}
                  title={fr ? "Modifier en local — chaque enregistrement remonte automatiquement" : "Edit locally — each save syncs back automatically"}
                  aria-label={fr ? "Modifier en local" : "Edit locally"}
                  className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-emerald-700"
                  data-testid={`attachment-edit-${row.name}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3" /><path d="M21 3v6h-6" /></svg>
                </button>
              ) : null}
              {/* download */}
              <a
                href={`/api/attachments/file/${row.id}`}
                title={fr ? "Télécharger" : "Download"}
                aria-label={fr ? "Télécharger" : "Download"}
                className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-emerald-700"
                data-testid={`attachment-download-${row.name}`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
              </a>
              {/* delete — recoverable for 30 days, manager and above only */}
              {canManage ? (
              <button
                type="button"
                onClick={() => void remove(row)}
                title={fr ? "Supprimer" : "Delete"}
                aria-label={fr ? "Supprimer" : "Delete"}
                className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-muted transition hover:bg-[var(--color-rose-soft)] hover:text-rose"
                data-testid={`attachment-delete-${row.name}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
