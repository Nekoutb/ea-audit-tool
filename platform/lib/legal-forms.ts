// The legal forms a client can take under the AUSCGIE, and what each one
// calls its organs (F052, firm decision 2026-10-27). Client-safe: no database,
// no server import — the engagement wizard and the paper renderer both read it.
//
// The OHADA statutory papers (C5.3–C5.10) and the documents lib/legal.ts
// generates speak to a board of directors on an SA, to the administrateur
// général on an SA without a board, to the gérant on a SARL, to the président
// on a SAS, to the administrateur of a GIE. The paper definitions carry
// [[lf.<organ>]] tokens where the organ's name depends on the form, and
// `resolveLegalFormPaper` substitutes them for the engagement's client — the
// same mechanism as the {{ISA…}} edition tokens of lib/standards-edition.ts,
// with a different delimiter so the two resolvers never read each other's
// tokens. A procedure or an evaluation item may also name the forms it applies
// to (`forms`); the resolver drops it for the others.

import type { PaperDef } from "@/lib/papers/types";

/** SA = SA with a board of directors; SA_AG = SA with an administrateur général (AUSCGIE arts. 494 et s.). */
export type LegalForm = "SA" | "SA_AG" | "SARL" | "SAS" | "GIE" | "OTHER";

export const LEGAL_FORMS: readonly LegalForm[] = ["SA", "SA_AG", "SARL", "SAS", "GIE", "OTHER"];

export function isLegalForm(value: unknown): value is LegalForm {
  return typeof value === "string" && (LEGAL_FORMS as readonly string[]).includes(value);
}

/** The legal form as the reader sees it: 'OTHER' reads 'Autre' / 'Other' (UAT B115), 'SA_AG' spells out the administrateur général. */
export function legalFormLabel(form: string, locale: "en" | "fr"): string {
  if (form === "OTHER") return locale === "fr" ? "Autre" : "Other";
  if (form === "SA_AG") return locale === "fr" ? "SA (administrateur général)" : "SA (administrateur général)";
  if (form === "SA") return locale === "fr" ? "SA (conseil d'administration)" : "SA (board of directors)";
  return form;
}

/** The two SA variants share the shareholders' vocabulary and the SA articles of the Act. */
export function isSocieteAnonyme(form: string | null | undefined): boolean {
  return form === "SA" || form === "SA_AG";
}

/* ------------------------------------------------------------ vocabulary --- */

type Pair = readonly [en: string, fr: string];

/** The organ names a statutory paper needs, per legal form. */
export interface LegalFormVocabulary {
  /** the form, spelled out: "SA with a board of directors" */
  form: Pair;
  /** the collegiate organ that arrêtes the accounts and authorises conventions, or the person who stands in for it */
  board: Pair;
  /** who presides that organ */
  chair: Pair;
  /** who runs the company day to day: DG or PDG, administrateur général, gérant, président */
  ceo: Pair;
  /** the organ the alert letter and the special report address first */
  executive: Pair;
  /** the owners' assembly */
  meeting: Pair;
  /** the owners */
  members: Pair;
  /** the persons the regulated-agreements regime catches */
  officers: Pair;
}

const VOCAB: Record<LegalForm, LegalFormVocabulary> = {
  SA: {
    form: ["SA with a board of directors", "SA avec conseil d'administration"],
    board: ["board of directors", "conseil d'administration"],
    chair: ["chairman of the board of directors (PCA)", "président du conseil d'administration (PCA)"],
    ceo: ["managing director (DG) or chairman and managing director (PDG)", "directeur général (DG) ou président-directeur général (PDG)"],
    executive: ["chairman of the board of directors or the PDG", "président du conseil d'administration ou PDG"],
    meeting: ["general meeting of shareholders", "assemblée générale des actionnaires"],
    members: ["shareholders", "actionnaires"],
    officers: ["directors, the managing director and the deputy managing directors", "administrateurs, directeur général et directeurs généraux adjoints"],
  },
  SA_AG: {
    form: ["SA with an administrateur général (no board)", "SA avec administrateur général (sans conseil)"],
    board: ["administrateur général (the SA has no board of directors)", "administrateur général (la SA n'a pas de conseil d'administration)"],
    chair: ["administrateur général", "administrateur général"],
    ceo: ["administrateur général", "administrateur général"],
    executive: ["administrateur général", "administrateur général"],
    meeting: ["general meeting of shareholders", "assemblée générale des actionnaires"],
    members: ["shareholders", "actionnaires"],
    officers: ["administrateur général and the administrateur général adjoint", "administrateur général et administrateur général adjoint"],
  },
  SARL: {
    form: ["SARL", "SARL"],
    board: ["gérant (the SARL has no board)", "gérant (la SARL n'a pas de conseil)"],
    chair: ["gérant", "gérant"],
    ceo: ["gérant", "gérant"],
    executive: ["gérant", "gérant"],
    meeting: ["members' meeting", "assemblée des associés"],
    members: ["members", "associés"],
    officers: ["gérant(s)", "gérant(s)"],
  },
  SAS: {
    form: ["SAS", "SAS"],
    board: ["président and the organs the statutes create", "président et organes statutaires"],
    chair: ["président", "président"],
    ceo: ["président (or the directeur général the statutes provide for)", "président (ou le directeur général prévu par les statuts)"],
    executive: ["président", "président"],
    meeting: ["collective decisions of the members, in the form the statutes set", "décisions collectives des associés, dans les formes prévues par les statuts"],
    members: ["members", "associés"],
    officers: ["président and the other dirigeants the statutes name", "président et autres dirigeants désignés par les statuts"],
  },
  GIE: {
    form: ["GIE", "GIE"],
    board: ["administrator(s) of the GIE", "administrateur(s) du GIE"],
    chair: ["administrator", "administrateur"],
    ceo: ["administrator", "administrateur"],
    executive: ["administrator", "administrateur"],
    meeting: ["assembly of the members", "assemblée des membres"],
    members: ["members", "membres"],
    officers: ["administrator(s)", "administrateur(s)"],
  },
  OTHER: {
    form: ["entity of another legal form", "entité d'une autre forme juridique"],
    board: ["governing body", "organe de gouvernance"],
    chair: ["chair of the governing body", "président de l'organe de gouvernance"],
    ceo: ["chief executive", "dirigeant"],
    executive: ["chief executive", "dirigeant"],
    meeting: ["general meeting", "assemblée générale"],
    members: ["members or shareholders", "associés ou actionnaires"],
    officers: ["officers", "dirigeants"],
  },
};

export type LegalFormTokenKey = keyof LegalFormVocabulary;

/** The organ's name for one form, in one language: organName('SARL', 'board', 'fr') → "gérant (la SARL n'a pas de conseil)". */
export function organName(form: string | null | undefined, key: LegalFormTokenKey, locale: "en" | "fr"): string {
  const vocab = VOCAB[isLegalForm(form) ? form : "OTHER"];
  return locale === "fr" ? vocab[key][1] : vocab[key][0];
}

/* ------------------------------------------------------------ resolution --- */

const TOKEN = /\[\[lf\.([a-z]+)\]\]/g;

/** Substitute every [[lf.key]] in one string for the form and language given. Unknown keys are left visible. */
export function resolveLegalFormText(text: string, form: string | null | undefined, locale: "en" | "fr"): string {
  if (!text.includes("[[lf.")) return text;
  return text.replace(TOKEN, (whole, key: string) =>
    key in VOCAB.OTHER ? organName(form, key as LegalFormTokenKey, locale) : whole,
  );
}

/** True when a text still carries a legal-form token — the test that guards the papers. */
export function hasUnresolvedLegalFormToken(text: string): boolean {
  return /\[\[lf\.[a-z]+\]\]/.test(text);
}

function langOf(key: string): "en" | "fr" {
  return key === "fr" || key.endsWith("Fr") ? "fr" : "en";
}

/** Whether a procedure or an item restricted to some forms applies to this one. */
export function appliesToForm(forms: readonly string[] | undefined, form: string | null | undefined): boolean {
  if (!forms || forms.length === 0) return true;
  return forms.includes(isLegalForm(form) ? form : "OTHER");
}

function resolveValue(value: unknown, form: LegalForm, locale: "en" | "fr"): unknown {
  if (typeof value === "string") return resolveLegalFormText(value, form, locale);
  if (Array.isArray(value)) {
    return value
      // a procedure or an item that names its forms is dropped for the others
      .filter((v) => !(v && typeof v === "object" && "forms" in (v as object)) || appliesToForm((v as { forms?: string[] }).forms, form))
      .map((v) => resolveValue(v, form, locale));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveValue(v, form, langOf(k));
    }
    return out;
  }
  return value;
}

const CACHE = new Map<LegalForm, WeakMap<PaperDef, PaperDef>>();

/**
 * The paper as the engagement's client reads it: every [[lf.token]] replaced
 * by the organ's name under the client's legal form, and every procedure or
 * item restricted to other forms removed. Unknown or missing form → the
 * generic vocabulary, nothing removed. Cached per definition and form.
 */
export function resolveLegalFormPaper(def: PaperDef, form: string | null | undefined): PaperDef {
  const f: LegalForm = isLegalForm(form) ? form : "OTHER";
  let byDef = CACHE.get(f);
  if (!byDef) {
    byDef = new WeakMap();
    CACHE.set(f, byDef);
  }
  const hit = byDef.get(def);
  if (hit) return hit;
  const resolved = resolveValue(def, f, "en") as PaperDef;
  byDef.set(def, resolved);
  return resolved;
}

/* ----------------------------------------------------- file-index scoping --- */

/**
 * Tasks that exist only for some legal forms. C5.7 (registered securities
 * register) is an SA/SAS matter — a SARL or a GIE issues no titres nominatifs —
 * so the task is not instantiated for them (F052); on existing files
 * 20261104000002 marks it conditional rather than deleting it.
 */
const FORM_EXCLUDED: Record<string, readonly LegalForm[]> = {
  "C5.7": ["SARL", "GIE"],
};

/** Whether a file-index code is instantiated on a file of this legal form (unknown form: yes). */
export function taskAppliesToForm(code: string, form: string | null | undefined): boolean {
  const excluded = FORM_EXCLUDED[code];
  if (!excluded || !isLegalForm(form)) return true;
  return !excluded.includes(form);
}
