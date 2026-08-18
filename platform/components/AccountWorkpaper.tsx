"use client";

// E4 — the account working paper, per the sketch:
//   E1…En rows with a SHORT summary description, each rolling out in place.
//   An open row shows: description detailed + objective, guidance, practical
//   considerations on the left; working paper & evidence (+) on the right;
//   then Findings & conclusion with the proposed SAP adjustment
//   (debit account/amount, credit account/amount). Fields blur-save.
// One index per task; ＋ adds another substantive procedure.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PspStep } from "@/lib/psp";

const ASSERTION_CODES = ["C", "E", "A", "V", "P"] as const;
const ASSERTION_LABELS: Record<string, { en: string; fr: string }> = {
  C: { en: "completeness", fr: "exhaustivité" },
  E: { en: "existence", fr: "existence" },
  A: { en: "accuracy", fr: "exactitude" },
  V: { en: "valuation", fr: "évaluation" },
  P: { en: "presentation", fr: "présentation" },
};

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
  const fullOf = (s: PspStep) => s.description.slice(refOf(s).length + 3);
  // the list shows a SHORT summary; the detail carries the full text
  const summaryOf = (s: PspStep) => {
    const t = fullOf(s).split(/[;:(]/)[0].trim().replace(/\.$/, "");
    return t.length > 72 ? `${t.slice(0, 69)}…` : t;
  };
  const assertionsLine = (s: PspStep) =>
    s.assertions.map((a) => ASSERTION_LABELS[a] ? (fr ? ASSERTION_LABELS[a].fr : ASSERTION_LABELS[a].en) : a).join(", ");

  const saveField = (stepId: string, field: string, value: string, current: string) => {
    if (value !== current) void op({ op: "saveResult", taskCode, stepId, field, value });
  };
  const label = "text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const amber = "w-full resize-none overflow-hidden rounded-[var(--radius-atlas-xs)] bg-[color:var(--wp-input)] px-2.5 py-2 text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-muted focus:ring-1 focus:ring-emerald-600/40";
  const inputCls = "rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1.5 text-[12px] text-ink outline-none focus:border-emerald-600";

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

      {steps.length === 0 && inIndex && indexCode ? (
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

      {steps.map((s) => {
        const isOpen = openId === s.id;
        return (
          <div key={s.id} className={`rounded-[var(--radius-atlas-sm)] border ${isOpen ? "border-emerald-600/50" : "border-line"}`}>
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : s.id)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-surface-2"
              data-testid={`psp-row-${refOf(s)}`}
            >
              <span className="font-mono text-[12px] font-extrabold text-emerald-800 dark:text-emerald-300">{refOf(s)}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{summaryOf(s)}</span>
              <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-extrabold text-muted">{s.source === "psp" ? "PSP" : "OSP"}</span>
              {s.status === "complete" ? <span className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400">✓</span> : null}
              <span className="text-[13px] text-muted">{isOpen ? "▾" : "▸"}</span>
            </button>

            {isOpen ? (
              <div className="flex flex-col gap-3 border-t border-line px-3 py-3" data-testid={`psp-detail-${refOf(s)}`}>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_300px]">
                  <div className="flex flex-col gap-2.5">
                    <div>
                      <p className={label}>{fr ? "Description détaillée & objectif" : "Description detailed & objective"}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-ink">{fullOf(s)}</p>
                    </div>
                    <div>
                      <p className={label}>{fr ? "Guidance" : "Guidance"}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">
                        {fr
                          ? `La procédure répond aux assertions ${assertionsLine(s)}. Définir la population, appliquer l'étendue déterminée par l'outil d'échantillonnage le cas échéant, exécuter chaque élément et documenter les résultats — toute anomalie est reportée en constat ci-dessous.`
                          : `The procedure answers the ${assertionsLine(s)} assertion(s). Define the population, apply the extent from the sampling tool where relevant, perform each item and document the results — any exception is carried into the finding below.`}
                      </p>
                    </div>
                    <div>
                      <p className={label}>{fr ? "Considérations pratiques" : "Practical considerations"}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">
                        {fr
                          ? "Joindre la feuille de travail et les pièces probantes à droite ; référencer chaque montant testé à sa pièce ; conclure sur la procédure une fois l'étendue couverte."
                          : "Attach the working paper and the evidence on the right; reference each amount tested to its support; conclude on the procedure once the extent is covered."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5" data-testid="psp-attachments">
                    <p className={label}>{fr ? "Feuille de travail & pièces" : "Working paper & evidence"}</p>
                    {attachmentsSlot ?? null}
                  </div>
                </div>

                <div className="rounded-[var(--radius-atlas-sm)] border border-line px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={label}>{fr ? "Constats & conclusion" : "Findings & conclusion"}</p>
                    <label className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft">
                      <input
                        type="checkbox"
                        defaultChecked={s.status === "complete"}
                        onChange={(e) => void op({ op: "toggleDone", stepId: s.id, done: e.target.checked })}
                        className="h-4 w-4 accent-emerald-700"
                        data-testid={`psp-done-${refOf(s)}`}
                      />
                      {fr ? "Procédure exécutée" : "Procedure done"}
                    </label>
                  </div>
                  <textarea
                    spellCheck={false}
                    rows={3}
                    defaultValue={results[`finding_${s.id}`] ?? ""}
                    placeholder={fr ? "Description du constat…" : "Description of finding…"}
                    onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }}
                    onBlur={(e) => saveField(s.id, "finding", e.target.value, results[`finding_${s.id}`] ?? "")}
                    className={`${amber} mt-1.5`}
                    data-testid={`psp-finding-${refOf(s)}`}
                  />
                  <p className={`${label} mt-2`}>{fr ? "Ajustement SYSCOHADA proposé" : "SAP adjustment (proposed entry)"}</p>
                  <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                    {([
                      ["adj_debit_account", fr ? "Compte à débiter" : "Debit account"],
                      ["adj_debit_amount", fr ? "Montant débit" : "Debit amount"],
                      ["adj_credit_account", fr ? "Compte à créditer" : "Credit account"],
                      ["adj_credit_amount", fr ? "Montant crédit" : "Credit amount"],
                    ] as const).map(([field, ph]) => (
                      <input
                        key={field}
                        defaultValue={results[`${field}_${s.id}`] ?? ""}
                        placeholder={ph}
                        onBlur={(e) => saveField(s.id, field, e.target.value, results[`${field}_${s.id}`] ?? "")}
                        className={`${inputCls} ${field.endsWith("amount") ? "tnum" : ""}`}
                        data-testid={`psp-${field}-${refOf(s)}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      {/* other substantive procedures can be added before the TB arrives */}
      {adding ? (
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
      )}
    </div>
  );
}
