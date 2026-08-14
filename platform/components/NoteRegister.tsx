"use client";

// The review-note register: every note of the engagement in one filterable
// table — the task it was raised on, its owner, the note, its state, and how
// long it took to resolve. A row opens the task it belongs to.

import Link from "next/link";
import { useMemo, useState } from "react";
import type { NoteRegisterRow } from "@/lib/task-notes";
import { GRID_CELL, GRID_HEAD } from "@/components/ui/grid";

type Scope = "all" | "for_me" | "by_me";
type State = "all" | "open" | "cleared";

const COLS = [
  { width: "62px" },   // task code
  { width: "190px" },  // task
  { width: "130px" },  // owner
  { width: undefined },// note
  { width: "84px" },   // status
  { width: "116px" },  // raised
  { width: "104px" },  // resolution
];

export function NoteRegister({
  engagementId,
  notes,
  initialScope,
  locale,
}: {
  engagementId: string;
  notes: NoteRegisterRow[];
  initialScope: Scope;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const [scope, setScope] = useState<Scope>(initialScope);
  const [state, setState] = useState<State>("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (scope === "for_me" && !n.forMe) return false;
      if (scope === "by_me" && !n.mine) return false;
      if (state !== "all" && n.status !== state) return false;
      if (q && !`${n.code} ${n.taskTitle} ${n.body} ${n.ownerName ?? ""} ${n.authorName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [notes, scope, state, query]);

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-[11.5px] font-semibold transition ${
      active ? "bg-emerald-700 text-white" : "border border-line text-ink-soft hover:border-emerald-600 hover:text-emerald-700"
    }`;

  const open = rows.filter((n) => n.status === "open").length;

  return (
    <div className="flex flex-col gap-2" data-testid="note-register">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setScope("all")} className={chip(scope === "all")} data-testid="nr-scope-all">
          {fr ? "Toutes" : "All"}
        </button>
        <button type="button" onClick={() => setScope("for_me")} className={chip(scope === "for_me")} data-testid="nr-scope-for-me">
          {fr ? "Pour moi" : "For me"}
        </button>
        <button type="button" onClick={() => setScope("by_me")} className={chip(scope === "by_me")} data-testid="nr-scope-by-me">
          {fr ? "Par moi" : "By me"}
        </button>
        <span className="mx-1 h-4 w-px bg-line-strong" />
        <button type="button" onClick={() => setState("all")} className={chip(state === "all")} data-testid="nr-state-all">
          {fr ? "Tous états" : "Any state"}
        </button>
        <button type="button" onClick={() => setState("open")} className={chip(state === "open")} data-testid="nr-state-open">
          {fr ? "Ouvertes" : "Open"}
        </button>
        <button type="button" onClick={() => setState("cleared")} className={chip(state === "cleared")} data-testid="nr-state-cleared">
          {fr ? "Réglées" : "Resolved"}
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={fr ? "Rechercher…" : "Search…"}
          data-testid="nr-search"
          className="ml-auto w-56 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-[12px] text-ink outline-none focus:border-emerald-600"
        />
        <span className="text-[11.5px] text-muted tnum" data-testid="nr-count">
          {rows.length} {fr ? "note(s)" : "note(s)"} · {open} {fr ? "ouverte(s)" : "open"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line">
        <table className="w-full table-fixed border-collapse bg-white dark:bg-surface" data-testid="nr-grid">
          <colgroup>
            {COLS.map((c, i) => (
              <col key={i} style={c} />
            ))}
          </colgroup>
          <thead>
            <tr className={GRID_HEAD}>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Code" : "Code"}</th>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Section" : "Section"}</th>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Responsable" : "Owner"}</th>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Note de revue" : "Review note"}</th>
              <th className={`${GRID_CELL} text-left`}>{fr ? "État" : "Status"}</th>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Émise le" : "Raised"}</th>
              <th className={`${GRID_CELL} text-left`}>{fr ? "Résolution" : "Resolution"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className={`${GRID_CELL} text-muted`} colSpan={7} data-testid="nr-empty">
                  {fr ? "Aucune note pour ce filtre." : "No notes match this filter."}
                </td>
              </tr>
            ) : (
              rows.map((note) => (
                <tr key={note.id} className="hover:bg-surface-2" data-testid={`nr-row-${note.id}`}>
                  <td className={`${GRID_CELL} p-0`}>
                    <Link
                      href={`/engagements/${engagementId}/sections/${note.fileItemId}`}
                      className="block px-1.5 py-[1px] font-mono font-bold text-emerald-800 hover:underline dark:text-emerald-300"
                      data-testid={`nr-link-${note.id}`}
                    >
                      {note.code}
                    </Link>
                  </td>
                  <td className={`${GRID_CELL} overflow-hidden text-ellipsis`} title={note.taskTitle}>
                    <Link href={`/engagements/${engagementId}/sections/${note.fileItemId}`} className="hover:underline">
                      {note.taskTitle}
                    </Link>
                  </td>
                  <td className={`${GRID_CELL} overflow-hidden text-ellipsis`}>
                    {note.ownerName ?? <span className="text-muted">{fr ? "non affecté" : "unassigned"}</span>}
                  </td>
                  <td className={`${GRID_CELL} whitespace-normal align-top leading-snug`}>
                    {note.body}
                    {note.response ? (
                      <span className="mt-0.5 block border-l-2 border-emerald-600/40 pl-1.5 text-muted">{note.response}</span>
                    ) : null}
                  </td>
                  <td className={GRID_CELL}>
                    <span
                      className={`rounded-full px-1.5 py-[1px] text-[10px] font-bold ${
                        note.status === "open"
                          ? "bg-[var(--color-warn-soft)] text-warn"
                          : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}
                    >
                      {note.status === "open" ? (fr ? "Ouverte" : "Open") : fr ? "Réglée" : "Resolved"}
                    </span>
                  </td>
                  <td className={`${GRID_CELL} text-muted tnum`}>{note.createdAt}</td>
                  <td className={`${GRID_CELL} text-muted tnum`}>
                    {note.status === "cleared"
                      ? note.resolutionHours !== null
                        ? note.resolutionHours < 24
                          ? `${note.resolutionHours} h`
                          : `${Math.round(note.resolutionHours / 24)} ${fr ? "j" : "d"}`
                        : (note.clearedAt ?? "—")
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
