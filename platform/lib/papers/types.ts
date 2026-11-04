// Working-paper structure. Two generations coexist on purpose: `fields` is the
// simple form every task started with, `sections` is the richer structure ported
// from the console proposal — procedures with their expected sources, Yes/No
// factor checklists that open an explanation box on "No", and the standards
// narrative that says what the requirement actually is.

export interface PaperField {
  key: string;
  /** input = typed; auto = tool-filled; select = one clickable option. */
  kind: "input" | "auto" | "select";
  labelEn: string;
  labelFr: string;
  /** auto fields only: which tool produces the value. */
  source?: string;
  /** select fields only: the clickable options. */
  options?: { value: string; en: string; fr: string }[];
}

/**
 * The empty state of an auto field, in the reader's language: the tool's name,
 * never the raw source key (UAT B127: "Renseigné par « materiality »").
 */
const AUTO_SOURCES: Record<string, [string, string]> = {
  materiality: ["the materiality tool — no approved materiality yet", "l'outil de seuil de signification — aucun seuil approuvé"],
  strategy: ["the risk strategy tool — nothing recorded yet", "l'outil de stratégie des risques — rien d'enregistré"],
  "je-selection": ["the journal-entry selection tool — no design recorded yet", "l'outil de sélection des écritures — aucune conception enregistrée"],
  "engagement record": ["the engagement record", "la fiche de la mission"],
};

export function autoFieldEmpty(source: string | undefined, fr: boolean): string {
  const pair = source ? AUTO_SOURCES[source] : undefined;
  if (fr) return `Renseigné par ${pair ? pair[1] : "l'outil lié"}`;
  return `Filled by ${pair ? pair[0] : "the linked tool"}`;
}

/** One numbered procedure: what to do, where the information comes from. */
export interface PaperProc {
  key: string;
  en: string;
  fr: string;
  /** expected sources, e.g. "RCCM extract · share register" */
  srcEn: string;
  srcFr: string;
  /** practical considerations: how to actually perform this, shown beside the wizard page */
  tipEn?: string;
  tipFr?: string;
  /**
   * The legal forms this procedure applies to (F052, lib/legal-forms.ts);
   * absent = every form. The resolver drops it on the others, so a SARL file
   * never shows the board's prior authorisation of an SA.
   */
  forms?: readonly string[];
}

/** One Yes/No factor. A "No" opens an explanation box beneath the question. */
export interface PaperItem {
  key: string;
  en: string;
  fr: string;
  /** the legal forms this factor applies to (F052); absent = every form */
  forms?: readonly string[];
  /**
   * Kept for the papers that set it: since F040 (2026-10-27) every item offers
   * Not-applicable, and an N/A must carry its reason. The flag no longer
   * changes anything on screen.
   */
  na?: boolean;
  /** practical considerations for answering this factor */
  tipEn?: string;
  tipFr?: string;
}

export type PaperSection =
  | { kind: "fields"; titleEn: string; titleFr: string; introEn?: string; introFr?: string; fields: PaperField[] }
  | { kind: "proc"; titleEn: string; titleFr: string; introEn?: string; introFr?: string; procs: PaperProc[] }
  | { kind: "yn"; titleEn: string; titleFr: string; introEn?: string; introFr?: string; items: PaperItem[] };

export interface PaperDef {
  /** ISA / ISQM anchor shown under the title. */
  std: string;
  /** One line: the record this paper owns in the file. */
  ownsEn: string;
  ownsFr: string;
  /** "What the standards require" — a short narrative, with citations. */
  reqEn?: string[];
  reqFr?: string[];
  /** The conclusion statements the preparer answers Yes/No. */
  conclEn?: string[];
  conclFr?: string[];
  /** Rich structure. When absent, `fields` is used. */
  sections?: PaperSection[];
  /** Simple structure, used by the group-derived default. */
  fields?: PaperField[];
  /** Tool ids whose output appears in this paper. */
  tools?: string[];
}

/* ---- storage keys, kept stable so saved answers survive edits ---- */
export const procKey = (k: string) => `p_${k}`;
/** "na" when the procedure was marked not applicable (F040), else empty */
export const procNaKey = (k: string) => `p_${k}_na`;
/** the reason a procedure is not applicable */
export const procWhyKey = (k: string) => `p_${k}_x`;
export const ynKey = (k: string) => `q_${k}`;
export const ynWhyKey = (k: string) => `q_${k}_x`;
export const conclKey = (i: number) => `c_${i}`;
export const conclWhyKey = (i: number) => `c_${i}_x`;

/** The stored value that marks a procedure or a factor not applicable. */
export const NA = "na";

/** Every key a paper can persist — used to validate what may be saved. */
export function paperKeys(def: PaperDef): Set<string> {
  // key_findings is universal: the working-paper screen records them on every task
  const keys = new Set<string>(["key_findings"]);
  (def.fields ?? []).forEach((f) => {
    if (f.kind === "input" || f.kind === "select") keys.add(f.key);
  });
  (def.sections ?? []).forEach((s) => {
    if (s.kind === "fields") s.fields.forEach((f) => (f.kind === "input" || f.kind === "select") && keys.add(f.key));
    if (s.kind === "proc")
      s.procs.forEach((p) => {
        keys.add(procKey(p.key));
        keys.add(procNaKey(p.key));
        keys.add(procWhyKey(p.key));
      });
    if (s.kind === "yn")
      s.items.forEach((i) => {
        keys.add(ynKey(i.key));
        keys.add(ynWhyKey(i.key));
      });
  });
  (def.conclEn ?? []).forEach((_, i) => {
    keys.add(conclKey(i));
    keys.add(conclWhyKey(i));
  });
  return keys;
}

/** Fields the preparer must complete, for the progress count. */
export function requiredKeys(def: PaperDef): string[] {
  const out: string[] = [];
  (def.fields ?? []).forEach((f) => (f.kind === "input" || f.kind === "select") && out.push(f.key));
  (def.sections ?? []).forEach((s) => {
    if (s.kind === "fields") s.fields.forEach((f) => (f.kind === "input" || f.kind === "select") && out.push(f.key));
    if (s.kind === "proc") s.procs.forEach((p) => out.push(procKey(p.key)));
    if (s.kind === "yn") s.items.forEach((i) => out.push(ynKey(i.key)));
  });
  (def.conclEn ?? []).forEach((_, i) => out.push(conclKey(i)));
  return out;
}

/**
 * Whether one required key carries an answer. Text and selects: non-blank.
 * A Yes/No factor: yes, no, or N/A WITH its reason — an N/A nobody explained
 * is not an answer (F040). A procedure: its result, or N/A with its reason.
 */
export function keyAnswered(def: PaperDef, key: string, values: Record<string, string>): boolean {
  const v = (k: string) => (values[k] ?? "").trim();
  if (key.startsWith("q_")) {
    const a = v(key);
    if (a === NA) return v(`${key}_x`).length > 0;
    return a.length > 0;
  }
  if (key.startsWith("p_") && isProcKey(def, key)) {
    if (v(`${key}_na`) === NA) return v(`${key}_x`).length > 0;
    return v(key).length > 0;
  }
  return v(key).length > 0;
}

function isProcKey(def: PaperDef, key: string): boolean {
  for (const s of def.sections ?? []) {
    if (s.kind === "proc" && s.procs.some((p) => procKey(p.key) === key)) return true;
  }
  return false;
}

/** The required keys still without an answer, in paper order. */
export function unansweredKeys(def: PaperDef, values: Record<string, string>): string[] {
  return requiredKeys(def).filter((k) => !keyAnswered(def, k, values));
}
