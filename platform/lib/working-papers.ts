// The working paper that sits inside every task, mirroring the engagement-console
// design proposal: a standards anchor, the record the paper owns, fields the tool
// layer fills in (read-only, shown as "from a tool"), and the judgement fields the
// preparer completes. Persisted in form_response under a `wp:` code prefix so it
// never collides with the legacy FORM_DEFINITIONS forms.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { groupOfTask, type SectionKey } from "@/lib/task-groups";

export interface PaperField {
  key: string;
  /** input = the preparer writes it; auto = a tool or the engagement record fills it. */
  kind: "input" | "auto";
  labelEn: string;
  labelFr: string;
  /** auto fields only: which tool produces the value. */
  source?: string;
}

export interface PaperDef {
  /** ISA / ISQM anchor shown under the title. */
  std: string;
  /** One line: the record this paper owns in the file. */
  ownsEn: string;
  ownsFr: string;
  fields: PaperField[];
  /** Tool ids whose output appears in this paper. */
  tools?: string[];
}

const PROCEDURES: PaperField = {
  key: "procedures",
  kind: "input",
  labelEn: "Procedures performed",
  labelFr: "Procédures mises en œuvre",
};
const RESULTS: PaperField = {
  key: "results",
  kind: "input",
  labelEn: "Results, with the working-paper reference of the evidence filed",
  labelFr: "Résultats, avec la référence du dossier de travail",
};
const EXCEPTIONS: PaperField = {
  key: "exceptions",
  kind: "input",
  labelEn: "Exceptions identified and how each was resolved",
  labelFr: "Exceptions relevées et leur résolution",
};
const CONCLUSION: PaperField = {
  key: "conclusion",
  kind: "input",
  labelEn: "Conclusion",
  labelFr: "Conclusion",
};

/** Anchor and framing per group, used where a task has no bespoke paper. */
const GROUP_DEFAULT: Record<string, { std: string; en: string; fr: string }> = {
  st1: { std: "ISQM 1 ¶30 · ISA 220 (Revised) ¶22–28 · ISA 210", en: "the acceptance conclusion", fr: "la conclusion d'acceptation" },
  st2: { std: "ISA 300 ¶7–12 · ISA 315 (Revised 2019) ¶17", en: "the strategy record", fr: "le cadrage de la mission" },
  st3: { std: "ISA 315 (Revised 2019) ¶19, ¶24–25", en: "the understanding of the entity", fr: "la connaissance de l'entité" },
  st4: { std: "ISA 315 (Revised 2019) ¶25–26 · ISA 402", en: "the IT and reliance conclusion", fr: "la conclusion informatique" },
  st5: { std: "ISA 320 · ISA 315 (Revised 2019) ¶28–34", en: "the risk and materiality record", fr: "le seuil et les risques" },
  st6: { std: "ISA 315 (Revised 2019) ¶28–34 · ISA 330 ¶5–15", en: "the assessed risks and planned responses", fr: "les risques évalués et les réponses" },
  e1: { std: "ISA 315 (Revised 2019) ¶25–26 · ISA 330", en: "the flow understanding and its testing", fr: "la compréhension du flux et ses tests" },
  e2: { std: "ISA 315 (Revised 2019) ¶26(b)–(c) · ISA 330 ¶8–17", en: "the IT controls conclusion", fr: "la conclusion sur les contrôles informatiques" },
  e3: { std: "ISA 330 ¶18–23 · ISA 500 · ISA 520", en: "the evidence obtained on the account", fr: "les éléments probants du compte" },
  e4: { std: "ISA 330 · ISA 500", en: "the evidence obtained", fr: "les éléments probants obtenus" },
  e5: { std: "ISA 450 · ISA 240", en: "the response and its outcome", fr: "la réponse et son résultat" },
  c1: { std: "ISA 700 ¶12–15 · ISA 220 (Revised) ¶29–35", en: "the completion conclusion", fr: "la conclusion d'achèvement" },
  c2: { std: "ISA 450 ¶10–15 · ISA 701", en: "the evaluation of matters found", fr: "l'évaluation des points relevés" },
  c3: { std: "ISA 560 · ISA 570 (Revised)", en: "the subsequent events and going concern conclusion", fr: "la conclusion événements postérieurs et continuité" },
  c4: { std: "ISA 580 · ISA 505", en: "the representations obtained", fr: "les déclarations obtenues" },
  c5: { std: "ISA 260 (Revised) · ISA 265 · ISQM 2 · ISA 230", en: "the governance and quality record", fr: "le dossier gouvernance et qualité" },
  c6: { std: "OHADA — Acte uniforme relatif au droit des sociétés commerciales", en: "the statutory report", fr: "le rapport statutaire" },
};

/** Bespoke papers: the tasks the tool layer feeds, and the judgement-heavy ones. */
const PAPERS: Record<string, PaperDef> = {
  "D3.1": {
    std: "ISQM 1 ¶30 · ISA 220 (Revised) ¶22–24 · IESBA Code §320",
    ownsEn: "the client risk rating and the integrity conclusion",
    ownsFr: "la notation du risque client et la conclusion sur l'intégrité",
    tools: ["independence"],
    fields: [
      { key: "sources", kind: "input", labelEn: "Sources consulted: registry extract, screening, media, references, predecessor", labelFr: "Sources consultées : registre, criblage, médias, références, prédécesseur" },
      { key: "screening", kind: "input", labelEn: "Screening performed — database, date, terms, and the disposition of every match", labelFr: "Criblage effectué — base, date, termes et traitement de chaque correspondance" },
      { key: "integrity", kind: "input", labelEn: "Integrity evaluation, and the reasons for the client risk rating", labelFr: "Évaluation de l'intégrité et motifs de la notation du risque client" },
      { key: "change", kind: "input", labelEn: "Reason for the change of auditor, corroborated with the predecessor", labelFr: "Motif du changement d'auditeur, corroboré auprès du prédécesseur" },
      CONCLUSION,
    ],
  },
  "D6.1": {
    std: "ISA 220 (Revised) ¶25–28 · ISA 210 ¶9–13 · ISQM 2",
    ownsEn: "the resources, terms and review-requirement conclusions",
    ownsFr: "les conclusions ressources, termes et exigence de revue",
    fields: [
      { key: "resources", kind: "input", labelEn: "Competence, capability and time available to the team", labelFr: "Compétence, capacité et temps disponibles" },
      { key: "letter", kind: "input", labelEn: "Engagement letter — date signed and countersigned, and the components it contains", labelFr: "Lettre de mission — dates de signature et éléments qu'elle contient" },
      { key: "eqr", kind: "input", labelEn: "Engagement quality review required? Basis, and the reviewer appointed", labelFr: "Revue de qualité requise ? Motif et réviseur désigné" },
      CONCLUSION,
    ],
  },
  "D5.1": {
    std: "ISA 320 ¶10–14 · ISA 450 ¶5",
    ownsEn: "materiality, performance materiality and the clearly trivial threshold",
    ownsFr: "le seuil de signification, le seuil de travail et le seuil négligeable",
    tools: ["materiality"],
    fields: [
      { key: "benchmark", kind: "auto", labelEn: "Benchmark, percentage and amounts", labelFr: "Référence, pourcentage et montants", source: "materiality" },
      { key: "why_benchmark", kind: "input", labelEn: "Reasons for the benchmark selected, and why an alternative was not used", labelFr: "Motifs du choix de la référence" },
      { key: "why_pm", kind: "input", labelEn: "Reasons for the performance materiality percentage: assessed risk, prior misstatements, expected number and size", labelFr: "Motifs du pourcentage du seuil de travail" },
      { key: "specific", kind: "input", labelEn: "Specific materiality, where a class or disclosure has a lower threshold", labelFr: "Seuil spécifique, le cas échéant" },
      { key: "revisions", kind: "input", labelEn: "Revisions during the engagement, and their effect on procedures already performed", labelFr: "Révisions et leur effet sur les procédures" },
    ],
  },
  "D5.2": {
    std: "ISA 315 (Revised 2019) ¶14(b), ¶29 · ISA 520",
    ownsEn: "the account universe and the significance conclusion",
    ownsFr: "l'univers des comptes et la conclusion de significativité",
    tools: ["trial-balance", "significance"],
    fields: [
      { key: "universe", kind: "auto", labelEn: "Account universe and mapping", labelFr: "Univers des comptes et rattachement", source: "trial-balance" },
      { key: "significant", kind: "auto", labelEn: "Accounts assessed as significant, and the basis", labelFr: "Comptes significatifs et base retenue", source: "significance" },
      { key: "expectation", kind: "input", labelEn: "Expectation formed before the current-against-prior comparison was reviewed", labelFr: "Attente formée avant l'examen des variations" },
      { key: "variances", kind: "input", labelEn: "Each variance investigated, and how the explanation was corroborated", labelFr: "Variations examinées et corroboration des explications" },
      { key: "qualitative", kind: "input", labelEn: "Reasons for each qualitative significance conclusion", labelFr: "Motifs de chaque conclusion qualitative" },
    ],
  },
  "D7.2": {
    std: "ISA 315 (Revised 2019) ¶28–34 · ISA 330 ¶5–15 · ISA 240",
    ownsEn: "the assessed risks and the planned response to each",
    ownsFr: "les risques évalués et la réponse prévue",
    tools: ["what-can-go-wrong", "strategy"],
    fields: [
      { key: "register", kind: "auto", labelEn: "Assertion-level risks and the strategy set against each", labelFr: "Risques par assertion et stratégie retenue", source: "strategy" },
      { key: "fs_level", kind: "input", labelEn: "Financial statement level risks and the overall responses, including the unpredictability element", labelFr: "Risques au niveau des états financiers et réponses globales" },
      { key: "separate", kind: "input", labelEn: "Inherent risk and control risk assessed separately, with the reasons", labelFr: "Risque inhérent et risque lié au contrôle évalués séparément" },
      { key: "significant", kind: "input", labelEn: "Significant risks, and the test of details responding to each", labelFr: "Risques importants et tests de détail correspondants" },
      CONCLUSION,
    ],
  },
  "D4.2": {
    std: "ISA 315 (Revised 2019) ¶19(a)–(c), ¶22",
    ownsEn: "the understanding of the entity, its environment and the framework",
    ownsFr: "la connaissance de l'entité, de son environnement et du référentiel",
    fields: [
      { key: "business", kind: "input", labelEn: "Business model, activities, markets and locations", labelFr: "Modèle économique, activités, marchés et implantations" },
      { key: "governance", kind: "input", labelEn: "Ownership, group structure and governance", labelFr: "Actionnariat, structure du groupe et gouvernance" },
      { key: "external", kind: "input", labelEn: "Industry, regulatory and other external factors", labelFr: "Secteur, réglementation et autres facteurs externes" },
      { key: "policies", kind: "input", labelEn: "Accounting policies, changes in the period, and their appropriateness", labelFr: "Méthodes comptables, changements et pertinence" },
      { key: "carried", kind: "input", labelEn: "Matters carried into the risk assessment", labelFr: "Points reportés dans l'évaluation des risques" },
    ],
  },
  "E100": {
    std: "ISA 315 (Revised 2019) ¶25–26 · ISA 330 ¶18–23 · ISA 505",
    ownsEn: "the revenue and receivables flow, and the evidence obtained",
    ownsFr: "le flux ventes et créances et les éléments probants",
    tools: ["what-can-go-wrong"],
    fields: [
      { key: "flow", kind: "input", labelEn: "Critical path: initiation, recording, processing, reporting — actors, documents, applications, control points", labelFr: "Chemin critique : initiation, enregistrement, traitement, restitution" },
      { key: "walkthrough", kind: "input", labelEn: "Walkthrough: the item traced, the evidence at each step, and any deviation", labelFr: "Test de cheminement : élément tracé, preuves et écarts" },
      PROCEDURES,
      RESULTS,
      EXCEPTIONS,
      CONCLUSION,
    ],
  },
  "B5": {
    std: "ISA 450 ¶5–15",
    ownsEn: "the misstatement schedule and its evaluation",
    ownsFr: "le récapitulatif des anomalies et son évaluation",
    fields: [
      { key: "reassess", kind: "input", labelEn: "Materiality reassessed against the final results", labelFr: "Seuil réévalué au regard des résultats définitifs" },
      { key: "nature", kind: "input", labelEn: "Evaluation by nature as well as size: covenants, loss into profit, related parties, trends", labelFr: "Évaluation par nature autant que par montant" },
      { key: "communicated", kind: "input", labelEn: "Communication to those charged with governance, and the reasons given for items not corrected", labelFr: "Communication au gouvernement d'entreprise et motifs de non-correction" },
      CONCLUSION,
    ],
  },
  "B7": {
    std: "ISA 560 · ISA 570 (Revised)",
    ownsEn: "the subsequent events and going concern conclusions",
    ownsFr: "les conclusions événements postérieurs et continuité d'exploitation",
    fields: [
      { key: "se_procedures", kind: "input", labelEn: "Subsequent events procedures, and the date to which they extend", labelFr: "Procédures événements postérieurs et date de fin" },
      { key: "se_events", kind: "input", labelEn: "Events identified, classified as adjusting or non-adjusting, and how reflected", labelFr: "Événements relevés, classement et traitement" },
      { key: "gc_assessment", kind: "input", labelEn: "Management's assessment, the period it covers, and its evaluation", labelFr: "Évaluation de la direction, période couverte et appréciation" },
      { key: "gc_conclusion", kind: "input", labelEn: "Material uncertainty? Conclusion and the effect on the report", labelFr: "Incertitude significative ? Conclusion et effet sur le rapport" },
    ],
  },
  "B8": {
    std: "ISA 580 ¶9–20",
    ownsEn: "the written representations obtained",
    ownsFr: "les déclarations écrites obtenues",
    fields: [
      { key: "requested", kind: "input", labelEn: "Representations requested, and the ISA that requires each", labelFr: "Déclarations demandées et norme applicable" },
      { key: "received", kind: "input", labelEn: "Signatories, the date of the letter, and the date of the auditor's report", labelFr: "Signataires, date de la lettre et date du rapport" },
      { key: "consistency", kind: "input", labelEn: "Consistency with other evidence, and the resolution of any inconsistency", labelFr: "Cohérence avec les autres éléments et résolution des écarts" },
      CONCLUSION,
    ],
  },
  "C1": {
    std: "ISA 700 · ISA 705 (Revised) · ISA 706 (Revised) · ISA 710",
    ownsEn: "the opinion and the auditor's report",
    ownsFr: "l'opinion et le rapport de l'auditeur",
    fields: [
      { key: "opinion", kind: "input", labelEn: "Opinion determined, and the basis for it", labelFr: "Opinion retenue et son fondement" },
      { key: "components", kind: "input", labelEn: "Required components confirmed against the drafted report", labelFr: "Composantes requises vérifiées sur le projet de rapport" },
      { key: "extra", kind: "input", labelEn: "Emphasis of matter, other matter and key audit matters included", labelFr: "Paragraphes d'observation, autres points et questions clés" },
      { key: "dating", kind: "input", labelEn: "Date of the report, and the date sufficient appropriate evidence was obtained", labelFr: "Date du rapport et date d'obtention des éléments suffisants" },
    ],
  },
};

/** The paper for a task: bespoke where defined, otherwise built from its group. */
export function paperFor(code: string): PaperDef {
  const bespoke = PAPERS[code];
  if (bespoke) return bespoke;
  const group = groupOfTask(code);
  const d = (group && GROUP_DEFAULT[group.id]) ?? {
    std: "ISA 230 ¶8–11",
    en: "the work performed and the conclusion reached",
    fr: "les travaux effectués et la conclusion",
  };
  return {
    std: d.std,
    ownsEn: d.en,
    ownsFr: d.fr,
    fields: [PROCEDURES, RESULTS, EXCEPTIONS, CONCLUSION],
  };
}

export function paperOwns(def: PaperDef, locale: "en" | "fr"): string {
  return locale === "fr" ? def.ownsFr : def.ownsEn;
}
export function fieldLabelOf(f: PaperField, locale: "en" | "fr"): string {
  return locale === "fr" ? f.labelFr : f.labelEn;
}

/** A paper is complete when every input field carries text. */
export function paperComplete(def: PaperDef, values: Record<string, string>): boolean {
  return def.fields
    .filter((f) => f.kind === "input")
    .every((f) => (values[f.key] ?? "").trim().length > 0);
}

const WP = (code: string) => `wp:${code}`;

export async function loadPaper(
  engagementId: string,
  code: string,
): Promise<Record<string, string>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ field_key: string; value: unknown }>(
      "SELECT field_key, value FROM form_response WHERE engagement_id = $1 AND code = $2",
      [engagementId, WP(code)],
    );
    const out: Record<string, string> = {};
    for (const row of r.rows) out[row.field_key] = typeof row.value === "string" ? row.value : String(row.value ?? "");
    return out;
  });
}

export async function savePaper(
  engagementId: string,
  code: string,
  values: Record<string, string>,
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  const def = paperFor(code);
  const allowed = new Set(def.fields.filter((f) => f.kind === "input").map((f) => f.key));
  await withTenant(tenantId, async (tx) => {
    for (const [key, value] of Object.entries(values)) {
      if (!allowed.has(key)) continue;
      await tx.query(
        `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by, carried_forward)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         ON CONFLICT (engagement_id, code, field_key)
         DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
                       carried_forward = false, updated_at = now()`,
        [tenantId, engagementId, WP(code), key, JSON.stringify(value), userId],
      );
    }
  });
}

/** Phase intro shown at the head of each phase page. */
export const PHASE_INTRO: Record<SectionKey, { en: string; fr: string }> = {
  acceptance: {
    en: "Performed before any commitment is given to the client.",
    fr: "Réalisé avant tout engagement vis-à-vis du client.",
  },
  strategy: {
    en: "Establishes what the audit covers, at what threshold, against which risks, and by which strategy.",
    fr: "Définit le périmètre, le seuil, les risques et la stratégie de la mission.",
  },
  execution: {
    en: "Performs the programme the previous phase derived.",
    fr: "Met en œuvre le programme issu de la phase précédente.",
  },
  conclusion: {
    en: "Draws the file together, evaluates what was found, and forms the opinion.",
    fr: "Rassemble le dossier, évalue les constats et forme l'opinion.",
  },
};
