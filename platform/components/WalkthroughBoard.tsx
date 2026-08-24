"use client";

// S1.3 — walkthroughs by SCOT. The board replicates every SCOT identified on
// S1.1; opening one reveals the "Understand the SCOT & Walkthrough" standard
// form: guidance per inquiry, an answer space per line, and the design /
// implementation confirmations the walkthrough exists to give (ISA 315 ¶25-26).
// Answers blur-save per field under form_response `wt:<scot_id>`.
// v1 scaffold — the firm's standard form material will refine the inquiries.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScotStudioView } from "@/lib/scots";

const slug = (s: string) => s.replace(/[^A-Za-z0-9]/g, "_");

interface WtField {
  key: string;
  en: string;
  fr: string;
  guideEn: string;
  guideFr: string;
  kind?: "text" | "yn";
}

const SECTION_A: WtField[] = [
  {
    key: "flow_initiation",
    en: "Initiation",
    fr: "Initiation",
    guideEn: "How a transaction starts: the trigger event, who raises it, and the first document or system entry.",
    guideFr: "Comment la transaction naît : l'événement déclencheur, qui l'initie, et le premier document ou la première saisie système.",
  },
  {
    key: "flow_recording",
    en: "Recording",
    fr: "Enregistrement",
    guideEn: "How and by whom it enters the accounting records; the journal it lands in and the supporting document filed.",
    guideFr: "Comment et par qui elle entre dans la comptabilité ; le journal concerné et la pièce justificative classée.",
  },
  {
    key: "flow_processing",
    en: "Processing",
    fr: "Traitement",
    guideEn: "Approvals, transformations and interfaces it passes through, including corrections of errors.",
    guideFr: "Approbations, transformations et interfaces traversées, y compris la correction des erreurs.",
  },
  {
    key: "flow_reporting",
    en: "Reporting",
    fr: "Restitution",
    guideEn: "How it reaches the general ledger and the financial statements, including period-end procedures.",
    guideFr: "Comment elle atteint le grand livre et les états financiers, y compris les travaux de clôture.",
  },
  {
    key: "people",
    en: "Key people and roles",
    fr: "Personnes clés et rôles",
    guideEn: "Who performs each step, and the segregation between initiation, approval, recording and custody.",
    guideFr: "Qui exécute chaque étape, et la séparation entre initiation, approbation, enregistrement et garde.",
  },
  {
    key: "documents",
    en: "Key documents and records",
    fr: "Documents et enregistrements clés",
    guideEn: "The documents produced at each step (orders, delivery notes, invoices, journals) and where they are kept.",
    guideFr: "Les documents produits à chaque étape (bons, factures, journaux) et leur lieu de conservation.",
  },
  {
    key: "systems",
    en: "IT applications at each step",
    fr: "Applications informatiques à chaque étape",
    guideEn: "The systems the flow passes through and any manual hand-offs between them.",
    guideFr: "Les systèmes traversés par le flux et les transferts manuels entre eux.",
  },
];

const SECTION_B: WtField[] = [
  {
    key: "wt_item",
    en: "Transaction selected",
    fr: "Transaction sélectionnée",
    guideEn: "Reference, date and amount of the transaction walked through, and why it is representative.",
    guideFr: "Référence, date et montant de la transaction suivie, et pourquoi elle est représentative.",
  },
  {
    key: "wt_trace",
    en: "Trace performed",
    fr: "Cheminement effectué",
    guideEn: "Each step followed from initiation to reporting: what was inspected, observed or reperformed at each stop.",
    guideFr: "Chaque étape suivie de l'initiation à la restitution : ce qui a été inspecté, observé ou réexécuté.",
  },
  {
    key: "wt_evidence",
    en: "Evidence obtained",
    fr: "Éléments probants obtenus",
    guideEn: "Copies, screenshots and references filed to the working papers.",
    guideFr: "Copies, captures et références classées au dossier.",
  },
  {
    key: "wt_exceptions",
    en: "Differences observed",
    fr: "Écarts observés",
    guideEn: "Any difference between the process as described by management and what the walkthrough showed.",
    guideFr: "Tout écart entre le processus décrit par la direction et ce que le cheminement a montré.",
  },
  {
    key: "wt_design",
    en: "Conclusion — the controls over this SCOT are effectively DESIGNED",
    fr: "Conclusion — les contrôles de ce SCOT sont efficacement CONÇUS",
    guideEn: "ISA 315 ¶26(a): the walkthrough corroborates the flow as described and shows the identified controls, as designed, capable of preventing or detecting the WCGWs they answer.",
    guideFr: "ISA 315 ¶26(a) : le cheminement corrobore le flux décrit et montre que les contrôles identifiés, tels que conçus, peuvent prévenir ou détecter les WCGW qu'ils couvrent.",
    kind: "yn",
  },
  {
    key: "wt_implemented",
    en: "The identified controls are implemented",
    fr: "Les contrôles identifiés sont mis en œuvre",
    guideEn: "ISA 315 ¶26(b): the controls exist and are in use — not merely described in a manual.",
    guideFr: "ISA 315 ¶26(b) : les contrôles existent et sont utilisés — pas seulement décrits dans un manuel.",
    kind: "yn",
  },
  {
    key: "wt_conclusion",
    en: "Conclusion of the walkthrough",
    fr: "Conclusion du cheminement",
    guideEn: "Overall conclusion, and any WCGW or control to revisit on S1.2 following what was observed.",
    guideFr: "Conclusion globale, et tout WCGW ou contrôle à revoir sur S1.2 suite aux observations.",
  },
];

export function WalkthroughBoard({
  engagementId,
  view,
  values,
  locale,
}: {
  engagementId: string;
  view: ScotStudioView;
  values: Record<string, Record<string, string>>;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(scotId: string, key: string, value: string) {
    setError(null);
    const r = await fetch(`/api/engagements/${engagementId}/scots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "saveWalkthrough", scotId, key, value }),
    }).catch(() => null);
    if (!r?.ok) { setError(fr ? "Échec de l'enregistrement." : "Save failed."); return; }
    router.refresh();
  }

  if (view.scots.length === 0) {
    return (
      <p className="rounded-[var(--radius-atlas-sm)] bg-surface-2 px-3 py-2 text-[12.5px] text-muted" data-testid="wt-empty">
        {fr ? "Aucun SCOT — identifiez-les d'abord sur S1.1." : "No SCOTs yet — identify them on S1.1 first."}
      </p>
    );
  }

  const field = (scotId: string, f: WtField) => {
    const v = values[scotId]?.[f.key] ?? "";
    return (
      <div key={f.key} className="rounded-[var(--radius-atlas-xs)] border border-line px-2.5 py-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-ink">{fr ? f.fr : f.en}</p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-muted">{fr ? f.guideFr : f.guideEn}</p>
          </div>
          {f.kind === "yn" ? (
            <span className="flex flex-shrink-0 gap-2">
              {(["yes", "no"] as const).map((o) => (
                <label key={o} className="flex cursor-pointer items-center gap-1 text-[12px] text-ink-soft">
                  <input
                    type="radio"
                    name={`wt-${scotId}-${f.key}`}
                    checked={v === o}
                    onChange={() => void save(scotId, f.key, o)}
                    data-testid={`wt-${f.key}-${o}`}
                    className="h-3.5 w-3.5 accent-emerald-700"
                  />
                  {o === "yes" ? (fr ? "Oui" : "Yes") : fr ? "Non" : "No"}
                </label>
              ))}
            </span>
          ) : null}
        </div>
        {f.kind !== "yn" ? (
          <textarea spellCheck={false}
            rows={2}
            defaultValue={v}
            placeholder={fr ? "Réponse suite aux entretiens avec la direction…" : "Answer following the inquiries of management…"}
            onBlur={(e) => { if (e.target.value !== v) void save(scotId, f.key, e.target.value); }}
            // Grow with the answer: interviews produce paragraphs, not lines —
            // the box follows its content instead of scrolling inside itself.
            ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }}
            onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }}
            className="mt-1 w-full resize-none overflow-hidden rounded-[var(--radius-atlas-xs)] bg-[color:var(--wp-input)] px-2 py-1 text-[12px] text-ink outline-none placeholder:text-muted focus:ring-1 focus:ring-emerald-600/40"
            data-testid={`wt-${f.key}`}
          />
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2" data-testid="walkthrough-board">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
          {fr ? "Cheminements par SCOT" : "Walkthroughs by SCOT"}
        </span>
        <span className="text-[11px] text-muted tnum">
          {view.scots.filter((s) => values[s.id]?.wt_design).length}/{view.scots.length} {fr ? "conclu(s)" : "concluded"}
        </span>
        {error ? <span className="text-[11px] font-semibold text-rose">{error}</span> : null}
      </div>

      {view.scots.map((scot) => {
        const isOpen = open === scot.id;
        const v = values[scot.id] ?? {};
        const answered = [...SECTION_A, ...SECTION_B].filter((f) => (v[f.key] ?? "") !== "").length;
        const concluded = v.wt_design === "yes" && v.wt_implemented === "yes";
        const exceptions = v.wt_design === "no" || v.wt_implemented === "no";
        return (
          <div key={scot.id} className="rounded-[var(--radius-atlas-sm)] border border-line">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : scot.id)}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-surface-2"
              data-testid={`wt-scot-${slug(scot.name)}`}
            >
              <span className="text-[12.5px] font-bold text-ink">{scot.name}</span>
              <span className="font-mono text-[10px] text-emerald-800 dark:text-emerald-300">
                {scot.indexes.map((i) => i.indexCode).join(", ")}
              </span>
              <span className="text-[10.5px] text-muted tnum">
                {answered}/{SECTION_A.length + SECTION_B.length} {fr ? "réponses" : "answered"}
              </span>
              <span
                className={`ml-auto rounded-full px-2 py-[1px] text-[10px] font-bold ${
                  concluded
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : exceptions
                      ? "bg-[var(--color-rose-soft)] text-rose"
                      : "bg-surface-2 text-muted"
                }`}
                data-testid={`wt-status-${slug(scot.name)}`}
              >
                {concluded ? (fr ? "Confirmé" : "Confirmed") : exceptions ? (fr ? "Écarts" : "Exceptions") : fr ? "À faire" : "To do"}
              </span>
              <span className="text-muted">{isOpen ? "▾" : "▸"}</span>
            </button>

            {isOpen ? (
              <div className="flex flex-col gap-1.5 border-t border-line px-2.5 py-2" data-testid={`wt-form-${slug(scot.name)}`}>
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-emerald-700 dark:text-emerald-400">
                  {fr ? "A — Comprendre le SCOT" : "A — Understand the SCOT"}
                </p>
                {scot.applications ? (
                  <p className="rounded-[var(--radius-atlas-xs)] bg-[color:var(--wp-auto)] px-2 py-1 text-[11px] text-ink-soft">
                    {fr ? "Applications déclarées sur S1.1 : " : "Applications recorded on S1.1: "}
                    <b>{scot.applications}</b>
                  </p>
                ) : null}
                {SECTION_A.map((f) => field(scot.id, f))}
                <p className="mt-1 text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-emerald-700 dark:text-emerald-400">
                  {fr ? "B — Cheminement (walkthrough)" : "B — Walkthrough"}
                </p>
                {SECTION_B.map((f) => field(scot.id, f))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
