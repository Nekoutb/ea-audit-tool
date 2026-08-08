// The working paper that sits inside every task, mirroring the engagement-console
// design proposal: a standards anchor, the record the paper owns, fields the tool
// layer fills in (read-only, shown as "from a tool"), and the judgement fields the
// preparer completes. Persisted in form_response under a `wp:` code prefix so it
// never collides with the legacy FORM_DEFINITIONS forms.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { ACCEPTANCE_PAPERS } from "@/lib/papers/acceptance";
import { STRATEGY_PAPERS } from "@/lib/papers/strategy";
import { EXECUTION_PAPERS } from "@/lib/papers/execution";
import { CONCLUSION_PAPERS } from "@/lib/papers/conclusion";
import { paperKeys, requiredKeys, type PaperDef, type PaperField } from "@/lib/papers/types";
import { groupOfTask, type SectionKey } from "@/lib/task-groups";

export type { PaperField, PaperDef, PaperSection, PaperProc, PaperItem } from "@/lib/papers/types";

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

/** Every task's paper, one map per phase, consulted in phase order. */
const ALL_PAPERS: Record<string, PaperDef> = {
  ...ACCEPTANCE_PAPERS,
  ...STRATEGY_PAPERS,
  ...EXECUTION_PAPERS,
  ...CONCLUSION_PAPERS,
};

/** The paper for a task: bespoke where defined, otherwise built from its group. */
export function paperFor(code: string): PaperDef {
  const bespoke = ALL_PAPERS[code];
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
  return requiredKeys(def).every((k) => (values[k] ?? "").trim().length > 0);
}

/** Answered fields over required fields, for the progress count. */
export function paperProgress(def: PaperDef, values: Record<string, string>): { done: number; total: number } {
  const keys = requiredKeys(def);
  return { done: keys.filter((k) => (values[k] ?? "").trim().length > 0).length, total: keys.length };
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
  const allowed = paperKeys(paperFor(code));
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
