"use client";

// S1.4 — Understand and Evaluate the FSCP. The close is one process per
// engagement — a separate non-routine class of transactions that turns the
// accounting records into the financial statements and their disclosures
// (ISA 315 ¶25(a)(ii)). The form walks its critical path, works BACKWARDS from
// the statements to find the WCGWs, covers accounting changes and error
// corrections (IAS 8), then records the strategy and the design/implementation
// confirmations — controls over journal entries are confirmed on EVERY audit,
// whatever the strategy (ISA 240 ¶32). Answers blur-save under code 'fscp'.

import { useRouter } from "next/navigation";
import { useState } from "react";

interface FscpField {
  key: string;
  en: string;
  fr: string;
  guideEn: string;
  guideFr: string;
  kind?: "text" | "yn" | "strategy";
}

const SECTIONS: { titleEn: string; titleFr: string; fields: FscpField[] }[] = [
  {
    titleEn: "A — The critical path of the close",
    titleFr: "A — Le chemin critique de la clôture",
    fields: [
      {
        key: "tb_preparation",
        en: "Preparing the trial balance and any consolidation",
        fr: "Préparation de la balance et des consolidations éventuelles",
        guideEn: "How the trial balance is compiled from the ledgers, including consolidating adjustments, intercompany eliminations and currency translation where they apply.",
        guideFr: "Comment la balance est établie à partir des livres, y compris les écritures de consolidation, les éliminations intragroupe et la conversion des devises le cas échéant.",
      },
      {
        key: "je_process",
        en: "Closing journal entries — initiation, authorisation, recording",
        fr: "Écritures de clôture — initiation, autorisation, enregistrement",
        guideEn: "Recurring and non-recurring entries (corrections, reclassifications, eliminations): who may raise them, who approves them, and how non-standard entries are identified — electronically or on paper.",
        guideFr: "Écritures récurrentes et non récurrentes (corrections, reclassements, éliminations) : qui peut les initier, qui les approuve, et comment les écritures non standard sont identifiées.",
      },
      {
        key: "fs_preparation",
        en: "Preparing the financial statements and disclosures",
        fr: "Préparation des états financiers et des annexes",
        guideEn: "How the trial balance becomes the statements and notes — the mapping, the tools and spreadsheets involved, and who reviews the result.",
        guideFr: "Comment la balance devient les états et les notes — le passage, les outils et tableurs utilisés, et qui revoit le résultat.",
      },
      {
        key: "disclosure_sources",
        en: "Where disclosure information comes from",
        fr: "Origine de l'information des annexes",
        guideEn: "Disclosures drawn from significant accounts, from specially-extracted data (commitments, leases, related parties), and from the close itself — including information from OUTSIDE the ledgers and how it is verified.",
        guideFr: "Annexes tirées des comptes significatifs, de données extraites spécialement (engagements, baux, parties liées) et de la clôture elle-même — y compris l'information HORS des livres et sa vérification.",
      },
      {
        key: "policies_it",
        en: "Policies, procedures and IT applications of the close",
        fr: "Politiques, procédures et applications informatiques de la clôture",
        guideEn: "The written close procedures and calendar, the IT applications relevant to the close, and any manual hand-offs between them.",
        guideFr: "Les procédures écrites et le calendrier de clôture, les applications informatiques concernées, et les transferts manuels entre elles.",
      },
      {
        key: "override_risk",
        en: "Management override exposure",
        fr: "Exposition au contournement par la direction",
        guideEn: "The close is where override is easiest: final adjustments involving judgement, who can post outside the normal path, and the history of past misstatements and their remediation.",
        guideFr: "La clôture est le terrain privilégié du contournement : ajustements finaux impliquant du jugement, qui peut passer outre le circuit normal, et l'historique des anomalies passées.",
      },
    ],
  },
  {
    titleEn: "B — What can go wrong (work back from the statements)",
    titleFr: "B — Ce qui peut mal tourner (partir des états financiers)",
    fields: [
      {
        key: "wcgw_tb",
        en: "Ledger to trial balance",
        fr: "Du grand livre à la balance",
        guideEn: "Are the combinations from the general ledger to the trial balance complete and mathematically accurate?",
        guideFr: "Les regroupements du grand livre vers la balance sont-ils exhaustifs et arithmétiquement exacts ?",
      },
      {
        key: "wcgw_je",
        en: "Journal entries",
        fr: "Écritures comptables",
        guideEn: "Are all necessary entries identified, recorded correctly and on time, and properly authorised — especially the non-standard ones?",
        guideFr: "Toutes les écritures nécessaires sont-elles identifiées, enregistrées correctement et à temps, et dûment autorisées — surtout les écritures non standard ?",
      },
      {
        key: "wcgw_disclosures",
        en: "Disclosures",
        fr: "Annexes",
        guideEn: "Are the quantitative and qualitative disclosure requirements identified and addressed? Could a disclosure be omitted, incomplete, inaccurate — or presented in a way that obscures its meaning?",
        guideFr: "Les exigences quantitatives et qualitatives des annexes sont-elles identifiées et traitées ? Une annexe peut-elle être omise, incomplète, inexacte — ou présentée de façon à en obscurcir le sens ?",
      },
    ],
  },
  {
    titleEn: "C — Accounting changes and error corrections (IAS 8)",
    titleFr: "C — Changements comptables et corrections d'erreurs (IAS 8)",
    fields: [
      {
        key: "policy_changes",
        en: "Changes in accounting policies",
        fr: "Changements de méthodes comptables",
        guideEn: "What changed and why — required by a new standard or voluntary. Is the new policy permitted by the framework, is the transition method correct, is the justification of preferability documented, and are the disclosures adequate?",
        guideFr: "Ce qui a changé et pourquoi — imposé par un nouveau texte ou volontaire. La nouvelle méthode est-elle admise, la transition correcte, la justification documentée, et les annexes suffisantes ?",
      },
      {
        key: "estimate_changes",
        en: "Changes in accounting estimates",
        fr: "Changements d'estimations comptables",
        guideEn: "The trigger, the new computation and its approval; applied prospectively, with each change judged separately and in aggregate.",
        guideFr: "Le déclencheur, le nouveau calcul et son approbation ; application prospective, chaque changement jugé isolément et en cumul.",
      },
      {
        key: "error_corrections",
        en: "Corrections of prior-period errors",
        fr: "Corrections d'erreurs de périodes antérieures",
        guideEn: "Nature and amount, retrospective treatment and disclosure. A move from an unacceptable method to an acceptable one is an error correction, not a policy change.",
        guideFr: "Nature et montant, traitement rétrospectif et information donnée. Passer d'une méthode inacceptable à une méthode admise est une correction d'erreur, pas un changement de méthode.",
      },
      {
        key: "tcwg_comms",
        en: "Communication to those charged with governance",
        fr: "Communication aux personnes constituant le gouvernement d'entreprise",
        guideEn: "Significant policy selections and changes, and the effect of policies in controversial or judgement-heavy areas, are communicated to those charged with governance (ISA 260).",
        guideFr: "Les choix et changements de méthodes significatifs, et l'effet des méthodes dans les zones controversées, sont communiqués au gouvernement d'entreprise (ISA 260).",
      },
    ],
  },
  {
    titleEn: "D — Strategy and confirmation",
    titleFr: "D — Stratégie et confirmation",
    fields: [
      {
        key: "fscp_strategy",
        en: "Preliminary strategy for the close",
        fr: "Stratégie préliminaire pour la clôture",
        guideEn: "Controls reliance — identify, evaluate and test the controls over the close sub-processes; or substantive only — but the journal-entry controls below are understood and confirmed on every audit.",
        guideFr: "Appui sur les contrôles — identifier, évaluer et tester les contrôles de la clôture ; ou substantif seul — mais les contrôles sur les écritures ci-dessous sont compris et confirmés dans tous les cas.",
        kind: "strategy",
      },
      {
        key: "je_controls_design",
        en: "Controls over journal entries are appropriately designed",
        fr: "Les contrôles sur les écritures sont conçus de façon appropriée",
        guideEn: "Required whatever the strategy: the controls over initiating, authorising and recording journal entries answer the WCGWs above.",
        guideFr: "Exigé quelle que soit la stratégie : les contrôles sur l'initiation, l'autorisation et l'enregistrement des écritures répondent aux WCGW ci-dessus.",
        kind: "yn",
      },
      {
        key: "je_controls_implemented",
        en: "Controls over journal entries are implemented",
        fr: "Les contrôles sur les écritures sont mis en œuvre",
        guideEn: "Confirmed by walkthrough, inquiry and observation of the people performing the close — each period.",
        guideFr: "Confirmé par cheminement, entretien et observation des personnes qui exécutent la clôture — à chaque période.",
        kind: "yn",
      },
      {
        key: "fscp_walkthrough",
        en: "Walkthrough of the close",
        fr: "Cheminement de la clôture",
        guideEn: "Which period-end was walked through, what was traced from trial balance to statements and notes, and any difference between the described close and what was observed.",
        guideFr: "Quelle clôture a été suivie, ce qui a été tracé de la balance aux états et annexes, et tout écart entre la clôture décrite et l'observé.",
      },
      {
        key: "fscp_conclusion",
        en: "Conclusion",
        fr: "Conclusion",
        guideEn: "The understanding of the close is confirmed; matters carried to controls selection (S2.1), the CRA (S3.1) or journal-entry testing (E2.1).",
        guideFr: "La compréhension de la clôture est confirmée ; éléments reportés vers la sélection des contrôles (S2.1), l'ECR (S3.1) ou les tests d'écritures (E2.1).",
      },
    ],
  },
];

export function FscpForm({
  engagementId,
  values,
  locale,
}: {
  engagementId: string;
  values: Record<string, string>;
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function save(key: string, value: string) {
    setError(null);
    const r = await fetch(`/api/engagements/${engagementId}/scots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "saveFscp", key, value }),
    }).catch(() => null);
    if (!r?.ok) { setError(fr ? "Échec de l'enregistrement." : "Save failed."); return; }
    router.refresh();
  }

  const total = SECTIONS.reduce((n, s) => n + s.fields.length, 0);
  const answered = SECTIONS.reduce((n, s) => n + s.fields.filter((f) => (values[f.key] ?? "") !== "").length, 0);
  const confirmed = values.je_controls_design === "yes" && values.je_controls_implemented === "yes";
  const exceptions = values.je_controls_design === "no" || values.je_controls_implemented === "no";

  return (
    <div className="flex flex-col gap-1.5" data-testid="fscp-form">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
          {fr ? "Comprendre et évaluer le processus de clôture" : "Understand & evaluate the close process"}
        </span>
        <span className="text-[11px] text-muted tnum">{answered}/{total} {fr ? "réponses" : "answered"}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
            confirmed
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : exceptions
                ? "bg-[var(--color-rose-soft)] text-rose"
                : "bg-surface-2 text-muted"
          }`}
          data-testid="fscp-status"
        >
          {confirmed ? (fr ? "Contrôles JE confirmés" : "JE controls confirmed") : exceptions ? (fr ? "Écarts" : "Exceptions") : fr ? "À faire" : "To do"}
        </span>
        {error ? <span className="text-[11px] font-semibold text-rose">{error}</span> : null}
      </div>

      {SECTIONS.map((section) => (
        <div key={section.titleEn} className="flex flex-col gap-1.5">
          <p className="mt-1 text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-emerald-700 dark:text-emerald-400">
            {fr ? section.titleFr : section.titleEn}
          </p>
          {section.fields.map((f) => {
            const v = values[f.key] ?? "";
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
                            name={`fscp-${f.key}`}
                            checked={v === o}
                            onChange={() => void save(f.key, o)}
                            data-testid={`fscp-${f.key}-${o}`}
                            className="h-3.5 w-3.5 accent-emerald-700"
                          />
                          {o === "yes" ? (fr ? "Oui" : "Yes") : fr ? "Non" : "No"}
                        </label>
                      ))}
                    </span>
                  ) : f.kind === "strategy" ? (
                    <span className="flex flex-shrink-0 gap-1.5">
                      {(["controls", "substantive"] as const).map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => void save(f.key, o)}
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                            v === o ? "border-emerald-600 bg-emerald-600 text-white" : "border-line-strong text-ink-soft hover:border-emerald-600"
                          }`}
                          data-testid={`fscp-strategy-${o}`}
                        >
                          {o === "controls" ? (fr ? "Contrôles" : "Controls") : fr ? "Substantif seul" : "Substantive only"}
                        </button>
                      ))}
                    </span>
                  ) : null}
                </div>
                {f.kind !== "yn" && f.kind !== "strategy" ? (
                  <textarea
                    rows={2}
                    defaultValue={v}
                    placeholder={fr ? "Réponse suite aux entretiens avec la direction…" : "Answer following the inquiries of management…"}
                    onBlur={(e) => { if (e.target.value !== v) void save(f.key, e.target.value); }}
                    className="mt-1 w-full resize-none rounded-[var(--radius-atlas-xs)] bg-[color:var(--wp-input)] px-2 py-1 text-[12px] text-ink outline-none placeholder:text-muted focus:ring-1 focus:ring-emerald-600/40"
                    data-testid={`fscp-${f.key}`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
