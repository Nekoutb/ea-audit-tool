"use client";

// E4 — the account working paper as an Excel sheet: a tab strip with the lead
// schedule first, then ONE TAB PER SUBSTANTIVE PROCEDURE (E-1, E-2 … OSP-n),
// and a "+" tab to add another procedure. Balance-sheet and income-statement
// indexes never share a tab — each procedure belongs to exactly one index.
// A procedure tab carries the objective/guidance, the assertions, the yellow
// execution box and the done tick. Procedures generate only for accounts
// present in the index.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApLeadSchedule } from "@/lib/analytical-procedures";
import type { PspStep } from "@/lib/psp";

const ASSERTION_CODES = ["C", "E", "A", "V", "P"] as const;
const n = (x: number) => new Intl.NumberFormat("fr-FR").format(Math.round(x));
// the compact Excel-grid convention
const TH = "border border-[color:var(--line-strong,#c9c9c9)] bg-surface-2 px-1.5 py-[2px] text-left text-[9.5px] font-extrabold uppercase tracking-[0.05em] text-muted";
const TD = "border border-[color:var(--line-strong,#c9c9c9)] px-1.5 py-[2px] text-[10.8px]";

export function AccountWorkpaper({
  engagementId,
  fileItemId,
  taskCode,
  schedules,
  steps,
  results,
  locale,
}: {
  engagementId: string;
  fileItemId: string;
  taskCode: string;
  schedules: ApLeadSchedule[];
  steps: PspStep[];
  results: Record<string, string>;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const [tab, setTab] = useState<string>("lead");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
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

  const presentIndexes = schedules.map((s) => s.def.code);
  const inIndex = presentIndexes.length > 0;
  const refOf = (s: PspStep) => s.description.split(" — ")[0];
  const active = steps.find((s) => refOf(s) === tab) ?? null;

  const tabBtn = (key: string, label: string, complete?: boolean) => (
    <button
      key={key}
      type="button"
      onClick={() => setTab(key)}
      className={`whitespace-nowrap rounded-t-[6px] border border-b-0 px-3 py-1 text-[11.5px] font-semibold transition ${
        tab === key
          ? "border-line-strong bg-white text-ink dark:bg-surface"
          : "border-transparent bg-surface-2 text-muted hover:text-ink"
      } ${complete ? "text-emerald-700 dark:text-emerald-400" : ""}`}
      data-testid={`wp-tab-${key}`}
    >
      {complete ? "✓ " : ""}{label}
    </button>
  );

  return (
    <div className="flex flex-col" data-testid="account-workpaper">
      <div className="flex items-end gap-0.5 overflow-x-auto">
        {tabBtn("lead", fr ? "Feuille maîtresse" : "Lead schedule")}
        {steps.map((s) => tabBtn(refOf(s), refOf(s), s.status === "complete"))}
        {tabBtn("plus", "＋")}
        {error ? <span className="mb-1 ml-2 text-[11px] font-semibold text-rose">{error}</span> : null}
      </div>
      <div className="rounded-b-[var(--radius-atlas-sm)] rounded-tr-[var(--radius-atlas-sm)] border border-line-strong bg-white p-3 dark:bg-surface">
        {tab === "lead" ? (
          <div className="flex flex-col gap-3" data-testid="wp-lead-tab">
            {!inIndex ? (
              <p className="text-[12px] text-muted">
                {fr ? "Ce compte n'est pas présent dans l'index — importer la balance pré-audit d'abord." : "This account is not in the index — import the pre-audit TB first."}
              </p>
            ) : (
              schedules.map((s) => (
                <div key={s.def.code} className="overflow-x-auto" data-testid={`lead-${s.def.code}`}>
                  <p className="mb-0.5 text-[11px] font-bold text-ink">
                    <span className="mr-1 font-mono text-emerald-800 dark:text-emerald-300">{s.def.code}</span>
                    {s.def.labelEn}
                  </p>
                  <table className="w-auto min-w-[560px] table-auto border-collapse">
                    <thead>
                      <tr>
                        <th className={TH}>{fr ? "Compte" : "Account"}</th>
                        <th className={TH}>{fr ? "Intitulé" : "Name"}</th>
                        <th className={`${TH} text-right`}>{fr ? "N" : "Current Y"}</th>
                        <th className={`${TH} text-right`}>N-1</th>
                        <th className={`${TH} text-right`}>{fr ? "Mvt" : "Movement"}</th>
                        <th className={`${TH} text-right`}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.accounts.map((a) => (
                        <tr key={a.account}>
                          <td className={`${TD} font-mono text-[10px]`}>{a.account}</td>
                          <td className={`${TD} max-w-[260px] truncate`}>{a.name}</td>
                          <td className={`${TD} text-right tnum`}>{n(a.closing)}</td>
                          <td className={`${TD} text-right tnum`}>{n(a.prior)}</td>
                          <td className={`${TD} text-right tnum`}>{n(a.movement)}</td>
                          <td className={`${TD} text-right tnum`}>{a.variancePct ?? "—"}</td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className={TD} colSpan={2}>TOTAL {s.def.code}</td>
                        <td className={`${TD} text-right tnum`}>{n(s.closing)}</td>
                        <td className={`${TD} text-right tnum`}>{n(s.prior)}</td>
                        <td className={`${TD} text-right tnum`}>{n(s.movement)}</td>
                        <td className={`${TD} text-right tnum`}>{s.variancePct ?? "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))
            )}
            {steps.length === 0 && inIndex ? (
              <div className="flex items-center gap-3 border-t border-line pt-2">
                <p className="text-[12px] text-ink-soft">
                  {fr ? `Générer les procédures substantives du guide (${presentIndexes.join(", ")}) — un onglet par procédure.` : `Generate the guide's substantive procedures (${presentIndexes.join(", ")}) — one tab per procedure.`}
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={async () => { setPending(true); await op({ op: "generate", fileItemId, taskCode, presentIndexes }); setPending(false); }}
                  className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1 text-[12px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  data-testid="psp-generate"
                >
                  {pending ? "…" : fr ? "Générer" : "Generate"}
                </button>
              </div>
            ) : null}
          </div>
        ) : tab === "plus" ? (
          <div className="flex flex-col gap-2" data-testid="wp-plus-tab">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
              {fr ? "Ajouter une autre procédure substantive" : "Add another substantive procedure"}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder={fr ? "Objectif et description de la procédure…" : "Objective and description of the procedure…"}
                className="min-w-[260px] flex-1 rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[12px] outline-none focus:border-emerald-600"
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
                onClick={() => { if (otherText.trim()) void op({ op: "addOther", fileItemId, description: otherText, assertions: otherA }).then((ok) => { if (ok) { setOtherText(""); setOtherA([]); } }); }}
                className="rounded-[var(--radius-atlas-xs)] bg-emerald-700 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-emerald-800"
                data-testid="psp-other-add"
              >
                ＋ {fr ? "Créer l'onglet" : "Create tab"}
              </button>
            </div>
          </div>
        ) : active ? (
          <div className="flex flex-col gap-2" data-testid={`wp-proc-${refOf(active)}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                  {fr ? "Objectif & procédure" : "Working-paper objective & procedure"}
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-ink">{active.description.slice(refOf(active).length + 3)}</p>
              </div>
              <span className="flex flex-shrink-0 items-center gap-2">
                <span className="font-mono text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300">[{active.assertions.join("")}]</span>
                <label className="flex items-center gap-1 text-[11.5px] font-semibold text-ink-soft">
                  <input
                    type="checkbox"
                    defaultChecked={active.status === "complete"}
                    onChange={(e) => void op({ op: "toggleDone", stepId: active.id, done: e.target.checked })}
                    className="h-4 w-4 accent-emerald-700"
                    data-testid={`psp-done-${refOf(active)}`}
                  />
                  {fr ? "Fait" : "Done"}
                </label>
              </span>
            </div>
            <p className="text-[10.5px] leading-snug text-muted">
              {fr
                ? "Consigner le travail effectué, la population et l'échantillon testés, les résultats et anomalies, et la référence des pièces classées au dossier."
                : "Record the work performed, the population and sample tested, the results and exceptions, and the reference of the evidence filed."}
            </p>
            <textarea
              spellCheck={false}
              rows={7}
              defaultValue={results[`r_${active.id}`] ?? ""}
              placeholder={fr ? "Exécution de la procédure…" : "Execution of the procedure…"}
              onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }}
              onBlur={(e) => { const v = results[`r_${active.id}`] ?? ""; if (e.target.value !== v) void op({ op: "saveResult", taskCode, stepId: active.id, value: e.target.value }); }}
              className="w-full resize-none overflow-hidden rounded-[var(--radius-atlas-xs)] bg-[color:var(--wp-input)] px-2.5 py-2 text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-muted focus:ring-1 focus:ring-emerald-600/40"
              data-testid={`psp-result-${refOf(active)}`}
            />
          </div>
        ) : (
          <p className="text-[12px] text-muted">—</p>
        )}
      </div>
    </div>
  );
}
