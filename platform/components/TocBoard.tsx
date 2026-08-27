"use client";

// E1.2 — Test Controls over Significant Classes of Transactions.
//
// The board is the CONCLUSION sheet, nothing more: each SCOT, the controls
// selected for testing in the S2.2 design, the assertions each answers, and
// the operating-effectiveness conclusion — Effective / Not effective
// (EY GAM CONTROLS 7.3). The testing itself — population, sample, the items
// examined and their attributes — is performed and documented in the
// standard test-of-controls working paper of this task, and the evidence is
// attached to it; the board never duplicates that work.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScotStudioView } from "@/lib/scots";

export function TocBoard({
  engagementId,
  view,
  locale,
}: {
  engagementId: string;
  view: ScotStudioView;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function patch(controlId: string, body: Record<string, unknown>) {
    setError(null);
    const r = await fetch(`/api/engagements/${engagementId}/scots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "updateControl", controlId, ...body }),
    }).catch(() => null);
    if (!r?.ok) { setError(fr ? "Échec de l'enregistrement." : "Save failed."); return false; }
    router.refresh();
    return true;
  }

  /** union of the assertions of the WCGWs a control answers */
  const assertionsOf = (scotId: string, wcgwIds: string[]): string[] => {
    const scot = view.scots.find((s) => s.id === scotId);
    const out = new Set<string>();
    for (const w of scot?.wcgws ?? []) if (wcgwIds.includes(w.id)) w.assertions.forEach((a) => out.add(a));
    return [...out].sort();
  };

  const scots = view.scots.filter((s) => s.controls.some((c) => c.selectedForTesting));
  const input = "rounded-[var(--radius-atlas-xs)] border border-line-strong bg-surface px-2 py-1 text-[11.8px] text-ink outline-none focus:border-emerald-600";
  const th = "px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-muted";
  const td = "px-2.5 py-2 align-top";

  if (scots.length === 0) {
    return (
      <p className="rounded-[var(--radius-atlas-sm)] bg-surface-2 px-3 py-2 text-[12.5px] text-muted" data-testid="toc-empty">
        {fr
          ? "Aucun contrôle retenu pour test — sélectionner les contrôles pertinents par WCGW en S2.2 d'abord."
          : "No controls selected for testing yet — select the relevant controls per WCGW in S2.2 first."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="toc-board">
      <p className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
        {fr
          ? "Les travaux (population, échantillon, éléments testés et attributs) sont exécutés et documentés dans le papier de travail standard de cette tâche, les éléments probants y étant joints. Ce tableau ne porte que la conclusion par contrôle : efficace ou non efficace. Une exception : en établir la cause et l'incidence, l'évaluer en déficience, puis conclure."
          : "The work — population, sample, items tested and their attributes — is performed and documented in this task's standard test-of-controls working paper, with the evidence attached to it. This board carries only the conclusion per control: effective or not effective. Any exception: establish its cause and implication, evaluate it as a deficiency, then conclude."}
      </p>
      {error ? <p className="text-[12px] font-semibold text-rose">{error}</p> : null}

      {scots.map((scot) => {
        const tested = scot.controls.filter((c) => c.selectedForTesting);
        return (
          <div key={scot.id} className="overflow-hidden rounded-[var(--radius-atlas-sm)] border border-line bg-surface" data-testid={`toc-scot-${scot.id}`}>
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
              <span className="text-[12.8px] font-bold text-ink">{scot.name}</span>
              <span className="rounded-full border border-line-strong px-2 py-0.5 text-[10.5px] font-semibold text-muted">{scot.transactionType}</span>
              <span className="ml-auto text-[11px] text-muted">
                {fr ? "Contrôles testés" : "Controls tested"}: <b className="text-ink tnum">{tested.length}</b>
                <span className="px-1.5 text-line-strong">·</span>
                {fr ? "conclus" : "concluded"}: <b className="text-ink tnum">{tested.filter((c) => c.operatingEval).length}</b>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left" data-testid={`toc-table-${scot.id}`}>
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <th className={th} style={{ minWidth: 280 }}>{fr ? "Contrôle" : "Control"}</th>
                    <th className={th} style={{ width: 120 }}>{fr ? "Type · fréquence" : "Type · frequency"}</th>
                    <th className={th} style={{ width: 110 }}>{fr ? "Assertions" : "Assertions"}</th>
                    <th className={th} style={{ width: 170 }}>{fr ? "Conclusion" : "Conclusion"}</th>
                  </tr>
                </thead>
                <tbody>
                  {tested.map((c) => {
                    const asserts = assertionsOf(scot.id, c.wcgwIds);
                    return (
                      <tr key={c.id} className="border-b border-line align-top" data-testid={`toc-control-${c.id}`}>
                        <td className={td}>
                          <span className="block text-[12.3px] font-semibold leading-snug text-ink">{c.name}</span>
                          {c.owner ? <span className="block text-[10.5px] text-muted">{c.owner}</span> : null}
                          {c.testDesign ? <span className="mt-0.5 block text-[10.5px] italic leading-snug text-muted">{c.testDesign}</span> : null}
                        </td>
                        <td className={`${td} text-[11px] text-ink-soft`}>
                          {c.controlType}
                          {c.frequency ? <span className="block text-muted">{c.frequency}</span> : null}
                        </td>
                        <td className={`${td} text-[12px] font-bold text-ink`} data-testid={`toc-asserts-${c.id}`}>
                          {asserts.join(" ") || "—"}
                        </td>
                        <td className={td}>
                          <select
                            value={c.operatingEval ?? ""}
                            onChange={(e) => void patch(c.id, { operatingEval: e.target.value })}
                            className={`${input} w-full font-semibold ${c.operatingEval === "effective" ? "text-emerald-700 dark:text-emerald-400" : c.operatingEval === "not_effective" ? "text-rose" : "text-muted"}`}
                            data-testid={`toc-eval-${c.id}`}
                          >
                            {c.operatingEval === null ? <option value="" disabled hidden /> : null}
                            <option value="effective">{fr ? "Efficace" : "Effective"}</option>
                            <option value="not_effective">{fr ? "Non efficace" : "Not effective"}</option>
                          </select>
                          {c.operatingEval === "not_effective" ? (
                            <span className="mt-0.5 block text-[10px] leading-snug text-amber-700 dark:text-amber-400">
                              {fr
                                ? "Évaluer la déficience, réviser S3.1 (pas d'appui), étendre les procédures de substance."
                                : "Evaluate the deficiency, revise S3.1 to not-rely, extend the substantive procedures."}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
