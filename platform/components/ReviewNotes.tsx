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
  const [error, setError] = useState<string | null>(null);
  // Set once the server says the file is archived: the composer is then
  // pointless and is hidden rather than left to fail again (UAT B43).
  const [archived, setArchived] = useState(false);

  // A refusal used to vanish — `if (!ok) return;` with nothing shown — and the
  // typed note with it. The error code now comes back and is said out loud.
  const errorText = (code: string | null): string => {
    if (code === "engagement-archived" || code === "archived")
      return fr ? "Dossier archivé — lecture seule. La note n'a pas été enregistrée." : "Archived file — read-only. The note was not saved.";
    if (code === "forbidden") return fr ? "Votre rôle ne permet pas cette action." : "Your role does not allow this action.";
    // clearing is the reviewer's call (UAT B19); the preparer replies instead
    if (code === "not-preparer-clears")
      return fr ? "Vous avez préparé cette feuille — répondez à la note et laissez le réviseur la régler." : "You prepared this paper — reply to the note and let the reviewer clear it.";
    if (code === "requires-manager-or-author")
      return fr ? "Seuls l'auteur de la note ou un manager n'ayant pas préparé la feuille peuvent la régler. Utilisez Répondre." : "Only the note's author or a manager who did not prepare the paper can clear it. Use Reply instead.";
    if (code === "response-required") return fr ? "Rédigez d'abord une réponse." : "Write a reply first.";
    if (code === null) return fr ? "Connexion interrompue — la note n'a pas été enregistrée." : "The connection dropped — the note was not saved.";
    return fr ? `Échec de l'enregistrement (${code}).` : `Save failed (${code}).`;
  };

  async function post(path: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/engagements/${engagementId}/task-notes${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) return true;
    const code = response
      ? await response.json().then((d: { error?: string }) => d.error ?? String(response.status)).catch(() => String(response.status))
      : null;
    if (code === "engagement-archived" || code === "archived") setArchived(true);
    setError(errorText(code));
    return false;
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
    setList((l) => l.map((n) => (n.id === id ? { ...n, status: "cleared", response: [n.response, answer].filter(Boolean).join("\n") || null } : n)));
    setAnswering(null);
    setAnswer("");
  }

  // Reply WITHOUT clearing (UAT B19): the preparer answers, the exchange is
  // kept on the note, and the reviewer who raised it decides it is resolved.
  async function reply(id: string) {
    if (!answer.trim()) return;
    const ok = await post("/respond", { noteId: id, response: answer });
    if (!ok) return;
    const line = `[${fr ? "Vous" : "You"}] ${answer.trim()}`;
    setList((l) => l.map((n) => (n.id === id ? { ...n, response: [n.response, line].filter(Boolean).join("\n") } : n)));
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
        {canRaise && !archived ? (
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

      {error ? (
        <p role="alert" className="mt-1.5 text-[11.5px] font-semibold text-rose" data-testid="wp-note-error">
          {error}
        </p>
      ) : null}

      {adding && !archived ? (
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
                    <span className="mt-1 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void reply(note.id)}
                        disabled={busy || !answer.trim()}
                        className="rounded-[var(--radius-atlas-xs)] bg-emerald-700 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                        data-testid={`wp-note-reply-${note.id}`}
                      >
                        {fr ? "Répondre" : "Reply"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void clear(note.id)}
                        disabled={busy}
                        className="rounded-[var(--radius-atlas-xs)] border border-line-strong px-2 py-0.5 text-[11px] font-medium text-ink-soft hover:bg-surface"
                        data-testid={`wp-note-clear-${note.id}`}
                      >
                        {fr ? "Régler" : "Clear"}
                      </button>
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setAnswering(note.id); setAnswer(""); }}
                    className="mt-0.5 text-[10.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                    data-testid={`wp-note-answer-open-${note.id}`}
                  >
                    {fr ? "Répondre / régler" : "Reply / clear"}
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
