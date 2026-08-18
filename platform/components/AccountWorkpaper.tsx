"use client";

// E4 — the account working paper, per the sketch:
//   LIST: the primary substantive procedures of THIS index only —
//     "E1 — Confirm customer balances — PSP", "E2 — …", then
//     "+ Add substantive procedures".
//   DETAIL (click a row): the procedure's working paper — Objective,
//     Approach, Use of tools, Conclusion / Findings on the left, the
//     working-paper attachments on the right. Fields blur-save.
// One index per task: procedures generate only when the index has TB lines.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PspStep } from "@/lib/psp";

const ASSERTION_CODES = ["C", "E", "A", "V", "P"] as const;

const FIELDS = [
  { key: "objective", en: "Objective", fr: "Objectif" },
  { key: "approach", en: "Approach", fr: "Approche" },
  { key: "tools", en: "Use of tools", fr: "Utilisation des outils" },
  { key: "conclusion", en: "Conclusion / Findings", fr: "Conclusion / Constats" },
] as const;

export function AccountWorkpaper({
  engagementId,
  fileItemId,
  taskCode,
  indexCode,
  inIndex,
  steps,
  results,
  attachmentsSlot,
  locale,
}: {
  engagementId: string;
  fileItemId: string;
  taskCode: string;
  /** the ONE lead index this account task carries, e.g. "E" */
  indexCode: string | null;
  /** the index has trial-balance lines on this engagement */
  inIndex: boolean;
  steps: PspStep[];
  results: Record<string, string>;
  attachmentsSlot?: React.ReactNode;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [otherA, setOtherA] = useState<string[]>([]);

  async function op(body: Record<string, unknown>) {
    setError(null);
    const r = await fetch(`/api/engagements/${engagementId}/psp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!r?.ok) { setError(fr ? "Échec de l'enregistrement." : "Save failed."); return false; }
    router.refresh();
    return true;
  }

  const refOf = (s: PspStep) => s.description.split(" — ")[0];
  const titleOf = (s: PspStep) => s.description.slice(refOf(s).length + 3);
  const active = steps.find((s) => s.id === openId) ?? null;

  // ------------------------------------------------------------- detail --
  if (active) {
    return (
      <div className="flex flex-col gap-3" data-testid={`psp-detail-${refOf(active)}`}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="grid h-7 w-7 place-items-center rounded-full text-[15px] font-bold text-ink-soft hover:bg-surface-2 hover:text-ink"
            title={fr ? "Retour aux procédures" : "Back to the procedures"}
            data-testid="psp-back"
          >
            ←
          </button>
          <h2 className="min-w-0 flex-1 text-[15px] font-bold tracking-[-0.01em] text-ink">
            {refOf(active)} — {titleOf(active)}
            <span className="ml-2 rounded-md bg-surface-2 px-1.5 py-0.5 align-middle text-[10px] font-extrabold text-muted">
              {active.source === "psp" ? "PSP" : "OSP"}
            </span>
          </h2>
          <span className="font-mono text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300">[{active.assertions.join("")}]</span>
          <label className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft">
            <input
              type="checkbox"
              defaultChecked={active.status === "complete"}
              onChange={(e) => void op({ op: "toggleDone", stepId: active.id, done: e.target.checked })}
              className="h-4 w-4 accent-emerald-700"
              data-testid={`psp-done-${refOf(active)}`}
            />
            {fr ? "Procédure exécutée" : "Procedure done"}
          </label>
          {error ? <span className="text-[11px] font-semibold text-rose">{error}</span> : null}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-2.5">
            {FIELDS.map((f) => {
              const v = results[`${f.key}_${active.id}`] ?? "";
              return (
                <label key={f.key} className="flex flex-col gap-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">{fr ? f.fr : f.en}</span>
                  {f.key === "objective" ? (
                    <span className="text-[10.5px] leading-snug text-muted">{titleOf(active)}</span>
                  ) : null}
                  <textarea
                    spellCheck={false}
                    rows={f.key === "conclusion" || f.key === "approach" ? 4 : 2}
                    defaultValue={v}
                    onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }}
                    onBlur={(e) => { if (e.target.value !== v) void op({ op: "saveResult", taskCode, stepId: active.id, field: f.key, value: e.target.value }); }}
                    className="w-full resize-none overflow-hidden rounded-[var(--radius-atlas-xs)] bg-[color:var(--wp-input)] px-2.5 py-2 text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-muted focus:ring-1 focus:ring-emerald-600/40"
                    data-testid={`psp-${f.key}-${refOf(active)}`}
                  />
                </label>
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5" data-testid="psp-attachments">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
              {fr ? "Feuilles de travail jointes" : "Working papers attached"}
            </span>
            {attachmentsSlot ?? null}
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------- list --
  return (
    <div className="flex flex-col gap-1.5" data-testid="account-workpaper">
      {error ? <p className="text-[11px] font-semibold text-rose">{error}</p> : null}
      {!inIndex ? (
        <p className="rounded-[var(--radius-atlas-sm)] bg-surface-2 px-3 py-2 text-[12.5px] text-muted">
          {fr
            ? `Le compte ${indexCode ?? ""} n'a pas de lignes dans la balance — importer la balance pré-audit d'abord.`
            : `Account ${indexCode ?? ""} has no trial-balance lines yet — import the pre-audit TB first.`}
        </p>
      ) : null}

      {steps.length === 0 && inIndex ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-atlas-sm)] border border-line px-3 py-2.5">
          <p className="text-[12.5px] text-ink-soft">
            {fr ? `Générer les procédures substantives primaires du guide pour ${indexCode}.` : `Generate the guide's primary substantive procedures for ${indexCode}.`}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={async () => { setPending(true); await op({ op: "generate", fileItemId, taskCode, presentIndexes: [indexCode] }); setPending(false); }}
            className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            data-testid="psp-generate"
          >
            {pending ? "…" : fr ? "Générer" : "Generate"}
          </button>
        </div>
      ) : null}

      {steps.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => setOpenId(s.id)}
          className="flex w-full items-center gap-3 rounded-[var(--radius-atlas-sm)] border border-line px-3 py-2.5 text-left transition hover:border-emerald-600/60 hover:bg-surface-2"
          data-testid={`psp-row-${refOf(s)}`}
        >
          <span className="font-mono text-[12px] font-extrabold text-emerald-800 dark:text-emerald-300">{refOf(s)}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{titleOf(s)}</span>
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-extrabold text-muted">{s.source === "psp" ? "PSP" : "OSP"}</span>
          <span className="font-mono text-[10px] font-bold text-emerald-800/70 dark:text-emerald-300/70">[{s.assertions.join("")}]</span>
          {s.status === "complete" ? <span className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400">✓</span> : <span className="text-muted">›</span>}
        </button>
      ))}

      {/* other substantive procedures can be added before the TB arrives */}
      {true ? (
        adding ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-atlas-sm)] border border-emerald-600/40 px-3 py-2.5" data-testid="psp-add-form">
            <input
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder={fr ? "Description de la procédure substantive…" : "Description of the substantive procedure…"}
              className="min-w-[240px] flex-1 rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[12px] outline-none focus:border-emerald-600"
              data-testid="psp-other-text"
            />
            {ASSERTION_CODES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setOtherA((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))}
                className={`h-[18px] w-[18px] rounded-[3px] text-[9.5px] font-bold ${otherA.includes(a) ? "bg-emerald-700 text-white" : "border border-line text-muted"}`}
              >{a}</button>
            ))}
            <button
              type="button"
              onClick={() => { if (otherText.trim()) void op({ op: "addOther", fileItemId, description: otherText, assertions: otherA }).then((ok) => { if (ok) { setOtherText(""); setOtherA([]); setAdding(false); } }); }}
              className="rounded-[var(--radius-atlas-xs)] bg-emerald-700 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-emerald-800"
              data-testid="psp-other-add"
            >
              {fr ? "Ajouter" : "Add"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-[11.5px] text-muted hover:text-ink">
              {fr ? "Annuler" : "Cancel"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-2 rounded-[var(--radius-atlas-sm)] border border-dashed border-line-strong px-3 py-2.5 text-left text-[13px] font-semibold text-ink-soft transition hover:border-emerald-600 hover:text-emerald-700"
            data-testid="psp-add-row"
          >
            ＋ {fr ? "Ajouter des procédures substantives" : "Add substantive procedures"}
          </button>
        )
      ) : null}
    </div>
  );
}
