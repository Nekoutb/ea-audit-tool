"use client";

// Review notes on a task: raise one (it reaches the assignee's dashboard),
// answer and clear it. Sized to sit beneath Guidance / Practical
// considerations, scrolling internally like the other side panels.

import { useState } from "react";
import { RichText } from "@/components/RichText";
import type { TaskNote } from "@/lib/task-notes";

export function ReviewNotes({
  engagementId,
  fileItemId,
  notes,
  canRaise,
  locale,
}: {
  engagementId: string;
  fileItemId: string;
  notes: TaskNote[];
  canRaise: boolean;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const [list, setList] = useState(notes);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answering, setAnswering] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");

  async function post(path: string, body: unknown): Promise<boolean> {
    setBusy(true);
    const response = await fetch(`/api/engagements/${engagementId}/task-notes${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    return Boolean(response?.ok);
  }

  async function raise() {
    if (!draft.trim()) return;
    const ok = await post("", { fileItemId, body: draft });
    if (!ok) return;
    setList((l) => [
      {
        id: `tmp-${Date.now()}`,
        body: draft.trim(),
        response: null,
        status: "open",
        authorName: fr ? "Vous" : "You",
        assigneeName: null,
        createdAt: fr ? "à l'instant" : "just now",
        clearedAt: null,
      },
      ...l,
    ]);
    setDraft("");
    setAdding(false);
  }

  async function clear(id: string) {
    const ok = await post("/clear", { noteId: id, response: answer });
    if (!ok) return;
    setList((l) => l.map((n) => (n.id === id ? { ...n, status: "cleared", response: answer || null } : n)));
    setAnswering(null);
    setAnswer("");
  }

  const open = list.filter((n) => n.status === "open").length;

  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-atlas)] border border-glass-border bg-surface px-4 py-3 shadow-atlas-sm backdrop-blur-xl"
      data-testid="wp-review-notes"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
          {fr ? "Notes de revue" : "Review notes"}
          {open > 0 ? (
            <span className="ml-1.5 rounded-full bg-[var(--color-warn-soft)] px-1.5 py-0.5 text-[10px] font-bold text-warn" data-testid="wp-notes-open">
              {open}
            </span>
          ) : null}
        </h2>
        {canRaise ? (
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            data-testid="wp-note-add"
          >
            {adding ? (fr ? "Annuler" : "Cancel") : fr ? "+ Note" : "+ Note"}
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className="mt-1.5">
          <RichText
            defaultValue={draft}
            onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
            placeholder={fr ? "Ce qui doit être corrigé ou complété…" : "What needs correcting or completing…"}
            rows={3}
            testId="wp-note-body"
            className="w-full resize-none rounded-[var(--radius-atlas-sm)] bg-[color:var(--wp-input,#f4f4f2)] px-2 py-1.5 text-[11.8px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-emerald-600/25"
          />
          <button
            type="button"
            onClick={() => void raise()}
            disabled={busy || !draft.trim()}
            className="mt-1 rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1 text-[11.5px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            data-testid="wp-note-save"
          >
            {fr ? "Adresser la note" : "Raise the note"}
          </button>
        </div>
      ) : null}

      <ul className="mt-1.5 flex min-h-0 flex-col gap-1.5 overflow-y-auto" data-testid="wp-notes-list">
        {list.length === 0 ? (
          <li className="text-[11.5px] text-muted">{fr ? "Aucune note." : "No notes."}</li>
        ) : (
          list.map((note) => (
            <li
              key={note.id}
              className={`rounded-[var(--radius-atlas-xs)] border px-2 py-1.5 ${
                note.status === "open" ? "border-[var(--color-warn)]/40 bg-[var(--color-warn-soft)]" : "border-line bg-surface-2/60"
              }`}
              data-testid={`wp-note-${note.id}`}
            >
              <p className="whitespace-pre-wrap break-words text-[11.8px] leading-snug text-ink">{note.body}</p>
              <p className="mt-0.5 text-[10px] text-muted">
                {note.authorName} · {note.createdAt}
                {note.assigneeName ? ` · ${fr ? "pour" : "for"} ${note.assigneeName}` : ""}
                {note.status === "cleared" ? ` · ${fr ? "réglée" : "cleared"}` : ""}
              </p>
              {note.response ? (
                <p className="mt-1 whitespace-pre-wrap break-words border-l-2 border-emerald-600/40 pl-1.5 text-[11.3px] text-ink-soft">
                  {note.response}
                </p>
              ) : null}
              {note.status === "open" ? (
                answering === note.id ? (
                  <div className="mt-1">
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={2}
                      placeholder={fr ? "Réponse…" : "Response…"}
                      className="w-full resize-none rounded-[var(--radius-atlas-xs)] bg-surface px-1.5 py-1 text-[11.3px] text-ink outline-none focus:ring-1 focus:ring-emerald-600/40"
                      data-testid={`wp-note-answer-${note.id}`}
                    />
                    <button
                      type="button"
                      onClick={() => void clear(note.id)}
                      disabled={busy}
                      className="mt-1 rounded-[var(--radius-atlas-xs)] border border-line-strong px-2 py-0.5 text-[11px] font-medium text-ink-soft hover:bg-surface"
                      data-testid={`wp-note-clear-${note.id}`}
                    >
                      {fr ? "Régler" : "Clear"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setAnswering(note.id); setAnswer(""); }}
                    className="mt-0.5 text-[10.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                    data-testid={`wp-note-answer-open-${note.id}`}
                  >
                    {fr ? "Répondre & régler" : "Answer & clear"}
                  </button>
                )
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
