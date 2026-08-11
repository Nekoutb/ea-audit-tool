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
}

/** One Yes/No factor. A "No" opens an explanation box beneath the question. */
export interface PaperItem {
  key: string;
  en: string;
  fr: string;
  /** offer a Not-applicable option as well as Yes/No */
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
export const ynKey = (k: string) => `q_${k}`;
export const ynWhyKey = (k: string) => `q_${k}_x`;
export const conclKey = (i: number) => `c_${i}`;
export const conclWhyKey = (i: number) => `c_${i}_x`;

/** Every key a paper can persist — used to validate what may be saved. */
export function paperKeys(def: PaperDef): Set<string> {
  // key_findings is universal: the working-paper screen records them on every task
  const keys = new Set<string>(["key_findings"]);
  (def.fields ?? []).forEach((f) => {
    if (f.kind === "input" || f.kind === "select") keys.add(f.key);
  });
  (def.sections ?? []).forEach((s) => {
    if (s.kind === "fields") s.fields.forEach((f) => (f.kind === "input" || f.kind === "select") && keys.add(f.key));
    if (s.kind === "proc") s.procs.forEach((p) => keys.add(procKey(p.key)));
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
