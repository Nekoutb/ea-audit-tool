"use client";

// E4 — the account working paper as an Excel-style sheet with tabs:
//   Lead schedule  — the account's index schedules from the pre-audit TB
//   Substantive procedures — the PSPs generated from the guide, indexed with
//   the SAME letters as the significant accounts (E-1, E-2 …), plus the
//   user's "other substantive procedures" (OSP-n). Results blur-save; ticking
//   a procedure marks it complete. Procedures generate ONLY for accounts
//   present in the index.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApLeadSchedule } from "@/lib/analytical-procedures";
import type { PspStep } from "@/lib/psp";

const ASSERTION_CODES = ["C", "E", "A", "V", "P"] as const;
const n = (x: number) => new Intl.NumberFormat("fr-FR").format(Math.round(x));

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
  const [tab, setTab] = useState<"lead" | "psp">(steps.length > 0 ? "psp" : "lead");
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
  const done = steps.filter((s) => s.status === "complete").length;

  const tabBtn = (key: "lead" | "psp", label: string, testid: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`rounded-t-[var(--radius-atlas-sm)] border border-b-0 px-4 py-1.5 text-[12.5px] font-semibold transition ${
        tab === key
          ? "border-line-strong bg-white text-ink dark:bg-surface"
          : "border-transparent bg-surface-2 text-muted hover:text-ink"
      }`}
      data-testid={testid}
    >
      {label}
    </button>
  );

  const th = "border border-[color:var(--line-strong,#c9c9c9)] bg-surface-2 px-2 py-1.5 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const td = "border border-[color:var(--line-strong,#c9c9c9)] px-2 py-1.5 text-[11.8px]";

  return (
    <div className="flex flex-col" data-testid="account-workpaper">
      <div className="flex items-end gap-1">
        {tabBtn("lead", fr ? "Feuille maîtresse" : "Lead schedule", "wp-tab-lead")}
        {tabBtn("psp", `${fr ? "Procédures substantives" : "Substantive procedures"}${steps.length > 0 ? ` (${done}/${steps.length})` : ""}`, "wp-tab-psp")}
        {error ? <span className="mb-1 ml-2 text-[11px] font-semibold text-rose">{error}</span> : null}
      </div>
      <div className="rounded-b-[var(--radius-atlas-sm)] rounded-tr-[var(--radius-atlas-sm)] border border-line-strong bg-white p-3 dark:bg-surface">
        {tab === "lead" ? (
          <div className="flex flex-col gap-4" data-testid="wp-lead-tab">
            {!inIndex ? (
              <p className="text-[12.5px] text-muted">
                {fr ? "Ce compte n'est pas présent dans l'index (aucune ligne de balance) — importer la balance pré-audit d'abord." : "This account is not in the index (no trial-balance lines) — import the pre-audit TB first."}
              </p>
            ) : (
              schedules.map((s) => (
                <div key={s.def.code} className="overflow-x-auto" data-testid={`lead-${s.def.code}`}>
                  <p className="mb-1 text-[12px] font-bold text-ink">
                    <span className="mr-1.5 font-mono text-emerald-800 dark:text-emerald-300">{s.def.code}</span>
                    {s.def.labelEn}
                  </p>
                  <table className="w-full table-fixed border-collapse">
                    <colgroup>
                      <col style={{ width: "90px" }} /><col /><col style={{ width: "110px" }} /><col style={{ width: "110px" }} /><col style={{ width: "100px" }} /><col style={{ width: "64px" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className={th}>{fr ? "Compte" : "Account"}</th>
                        <th className={th}>{fr ? "Intitulé" : "Name"}</th>
                        <th className={`${th} text-right`}>{fr ? "N (clôture)" : "Current Y"}</th>
                        <th className={`${th} text-right`}>{fr ? "N-1" : "Prior Y"}</th>
                        <th className={`${th} text-right`}>{fr ? "Mouvement" : "Movement"}</th>
                        <th className={`${th} text-right`}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.accounts.map((a) => (
                        <tr key={a.account}>
                          <td className={`${td} font-mono text-[10.8px]`}>{a.account}</td>
                          <td className={`${td} truncate`}>{a.name}</td>
                          <td className={`${td} text-right tnum`}>{n(a.closing)}</td>
                          <td className={`${td} text-right tnum`}>{n(a.prior)}</td>
                          <td className={`${td} text-right tnum`}>{n(a.movement)}</td>
                          <td className={`${td} text-right tnum`}>{a.variancePct ?? "—"}</td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className={td} colSpan={2}>TOTAL {s.def.code}</td>
                        <td className={`${td} text-right tnum`}>{n(s.closing)}</td>
                        <td className={`${td} text-right tnum`}>{n(s.prior)}</td>
                        <td className={`${td} text-right tnum`}>{n(s.movement)}</td>
                        <td className={`${td} text-right tnum`}>{s.variancePct ?? "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2" data-testid="wp-psp-tab">
            {steps.length === 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[12.5px] text-ink-soft">
                  {inIndex
                    ? fr ? `Générer les procédures substantives du guide pour ${presentIndexes.join(", ")}.` : `Generate the guide's substantive procedures for ${presentIndexes.join(", ")}.`
                    : fr ? "Compte hors index — aucune procédure à générer." : "Account not in the index — nothing to generate."}
                </p>
                {inIndex ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={async () => { setPending(true); await op({ op: "generate", fileItemId, taskCode, presentIndexes }); setPending(false); }}
                    className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    data-testid="psp-generate"
                  >
                    {pending ? "…" : fr ? "Générer les procédures" : "Generate procedures"}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse" data-testid="psp-grid">
                  <colgroup>
                    <col style={{ width: "58px" }} /><col /><col style={{ width: "70px" }} /><col style={{ width: "34%" }} /><col style={{ width: "52px" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={th}>Réf</th>
                      <th className={th}>{fr ? "Procédure substantive" : "Substantive procedure"}</th>
                      <th className={th}>{fr ? "Assert." : "Assert."}</th>
                      <th className={th}>{fr ? "Résultat & référence" : "Result & working-paper ref"}</th>
                      <th className={`${th} text-center`}>{fr ? "Fait" : "Done"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {steps.map((s) => {
                      const ref = s.description.split(" — ")[0];
                      const text = s.description.slice(ref.length + 3);
                      const v = results[`r_${s.id}`] ?? "";
                      return (
                        <tr key={s.id} className={s.status === "complete" ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""} data-testid={`psp-row-${ref}`}>
                          <td className={`${td} font-mono text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300`}>{ref}</td>
                          <td className={`${td} whitespace-normal leading-snug`}>{text}</td>
                          <td className={`${td} font-mono text-[10px] font-bold`}>{s.assertions.join("")}</td>
                          <td className={`${td} p-0 align-top`}>
                            <textarea spellCheck={false}
                              rows={1}
                              defaultValue={v}
                              placeholder={fr ? "Travail effectué, résultat, réf. dossier…" : "Work done, result, file ref…"}
                              onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }}
                              onBlur={(e) => { if (e.target.value !== v) void op({ op: "saveResult", taskCode, stepId: s.id, value: e.target.value }); }}
                              className="w-full resize-none overflow-hidden bg-[color:var(--wp-input)] px-2 py-1.5 text-[11.8px] text-ink outline-none placeholder:text-muted focus:ring-1 focus:ring-emerald-600/40"
                              data-testid={`psp-result-${ref}`}
                            />
                          </td>
                          <td className={`${td} text-center`}>
                            <input
                              type="checkbox"
                              defaultChecked={s.status === "complete"}
                              onChange={(e) => void op({ op: "toggleDone", stepId: s.id, done: e.target.checked })}
                              className="h-4 w-4 accent-emerald-700"
                              data-testid={`psp-done-${ref}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {steps.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
                <span className="text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-muted">
                  {fr ? "Autre procédure substantive" : "Other substantive procedure"}
                </span>
                <input
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (otherText.trim()) void op({ op: "addOther", fileItemId, description: otherText, assertions: otherA }).then((ok) => { if (ok) { setOtherText(""); setOtherA([]); } }); } }}
                  placeholder={fr ? "Décrire la procédure complémentaire…" : "Describe the additional procedure…"}
                  className="min-w-[240px] flex-1 rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[11.8px] outline-none focus:border-emerald-600"
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
                  ＋ {fr ? "Ajouter" : "Add"}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
