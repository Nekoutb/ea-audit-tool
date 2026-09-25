"use client";

// The read-only "from the file" block on C1.2 (UAT B151): the matters the
// summary review memo has to cover, listed from where the file already holds
// them, with a button that copies the list as text into the clipboard so the
// memo starts from the file rather than from a blank box.

import { useState } from "react";
import type { SrmMatters } from "@/lib/summary-review-memo";

export function SrmMattersPanel({ matters, locale }: { matters: SrmMatters; locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const T = (en: string, frText: string) => (fr ? frText : en);
  const [copied, setCopied] = useState(false);
  const n = (x: number) => new Intl.NumberFormat("fr-FR").format(Math.round(x));

  const groups: { title: string; lines: string[]; testId: string }[] = [
    {
      title: T("Significant risks (S3.1)", "Risques importants (S3.1)"),
      lines: matters.risks.map((r) => `${r.description} — ${r.status.replace(/_/g, " ")}`),
      testId: "srm-risks",
    },
    {
      title: T("Misstatements above clearly trivial (C1.1)", "Anomalies au-delà du seuil négligeable (C1.1)"),
      lines: matters.misstatements.map(
        (m) => `${m.description} — ${n(m.amount)} · ${m.mtype} · ${m.corrected ? T("corrected", "corrigée") : T("uncorrected", "non corrigée")}`,
      ),
      testId: "srm-misstatements",
    },
    {
      title: T("Consultations (C1.3)", "Consultations (C1.3)"),
      lines: matters.consultations,
      testId: "srm-consultations",
    },
    {
      title: T("Open significant findings (b4)", "Constats significatifs ouverts (b4)"),
      lines: matters.findings.map((f) => `${f.code ? `[${f.code}] ` : ""}${f.title}`),
      testId: "srm-findings",
    },
  ];
  const total = groups.reduce((sum, g) => sum + g.lines.length, 0);
  const text = groups
    .filter((g) => g.lines.length > 0)
    .map((g) => `${g.title}\n${g.lines.map((l) => `- ${l}`).join("\n")}`)
    .join("\n\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      className="mb-3 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-4 py-3"
      data-testid="srm-matters"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-muted">
            {T("Significant matters from the file", "Points significatifs issus du dossier")}
          </p>
          <p className="text-[11.5px] text-muted">
            {T(
              "Read from S3.1, C1.1, C1.3 and the open findings — the memo records the conclusion reached on each.",
              "Lus depuis S3.1, C1.1, C1.3 et les constats ouverts — le mémo consigne la conclusion retenue sur chacun.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          disabled={total === 0}
          className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-surface disabled:opacity-50"
          data-testid="srm-copy"
        >
          {copied ? T("Copied", "Copié") : T("Copy as text", "Copier en texte")}
        </button>
      </div>
      {total === 0 ? (
        <p className="mt-2 text-[12px] text-muted" data-testid="srm-empty">
          {T("The file records no significant risk, misstatement, consultation or open finding yet.", "Le dossier ne consigne encore aucun risque important, anomalie, consultation ni constat ouvert.")}
        </p>
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.testId} data-testid={g.testId}>
              <p className="text-[11px] font-bold text-ink">
                {g.title} <span className="font-normal text-muted tnum">({g.lines.length})</span>
              </p>
              {g.lines.length === 0 ? (
                <p className="text-[11.5px] text-muted">{T("None", "Aucun")}</p>
              ) : (
                <ul className="mt-0.5 list-disc pl-4 text-[11.5px] text-ink-soft">
                  {g.lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
