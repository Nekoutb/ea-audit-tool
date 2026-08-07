// Wave 5 of the ISA engine build prompt (A4): the report library. The ISA 700
// (Revised) required-components checklist as data, a tolerant structural
// validator ("the engine refuses a template missing a required component"),
// and the template-slot matrix (framework × opinion × listing + the ISA
// 570/706 inserts) that firm-supplied house templates drop into. Pure data +
// pure functions — no DB access; callers decide what text to validate.

export type ReportComponentKey =
  | "title"
  | "addressee"
  | "opinion"
  | "basisForOpinion"
  | "goingConcernMaterialUncertainty"
  | "kam"
  | "responsibilitiesManagement"
  | "responsibilitiesAuditor"
  | "otherReporting"
  | "partnerName"
  | "signature"
  | "date"
  | "address";

/**
 * When a component is required:
 * - "always"              — every auditor's report (ISA 700.21–.49).
 * - "listed"              — listed entities only (KAM per ISA 701; partner name
 *                           per ISA 700.46).
 * - "materialUncertainty" — only when a going-concern material uncertainty is
 *                           adequately disclosed (ISA 570.22).
 * - "manual"              — depends on facts outside {listed, materialUncertainty}
 *                           (other legal/regulatory duties); never auto-required
 *                           by validateReportTemplate.
 */
export type ReportComponentWhen = "always" | "listed" | "materialUncertainty" | "manual";

export interface ReportComponent {
  key: ReportComponentKey;
  en: string;
  fr: string;
  when: ReportComponentWhen;
  /** Tolerant EN+FR keyword detection applied to template/report text. */
  pattern: RegExp;
}

/** ISA 700 (Revised) required components, in report order (spec §05 A4). */
export const REPORT_COMPONENTS: readonly ReportComponent[] = [
  {
    key: "title",
    en: "Title — Independent Auditor's Report",
    fr: "Titre — Rapport de l'auditeur indépendant",
    when: "always",
    pattern:
      /independent auditor['’]?s report|rapport (du commissaire aux comptes|des commissaires aux comptes|de l['’]auditeur ind[ée]pendant)/i,
  },
  {
    key: "addressee",
    en: "Addressee",
    fr: "Destinataire",
    when: "always",
    pattern:
      /to the (shareholders|members|board|general meeting)|addressee|aux actionnaires|aux associ[ée]s|[àa] l['’]assembl[ée]e|au conseil d['’]administration|destinataire/i,
  },
  {
    key: "opinion",
    en: "Opinion (entity, statements enumerated, period, framework)",
    fr: "Opinion (entité, états énumérés, exercice, référentiel)",
    when: "always",
    pattern: /\bopinions?\b/i,
  },
  {
    key: "basisForOpinion",
    en: "Basis for Opinion (ISAs, independence and ethics)",
    fr: "Fondement de l'opinion (normes ISA, indépendance et déontologie)",
    when: "always",
    pattern:
      /basis for (qualified |adverse )?opinion|basis for disclaimer of opinion|fondement de l['’](opinion|impossibilit[ée])/i,
  },
  {
    key: "goingConcernMaterialUncertainty",
    en: "Material uncertainty related to going concern",
    fr: "Incertitude significative liée à la continuité d'exploitation",
    when: "materialUncertainty",
    pattern:
      /material uncertainty relat(ed|ing) to going concern|going concern|continuit[ée] d['’]exploitation/i,
  },
  {
    key: "kam",
    en: "Key audit matters",
    fr: "Points clés de l'audit",
    when: "listed",
    pattern: /key audit matters?|points? cl[ée]s de l['’]audit/i,
  },
  {
    key: "responsibilitiesManagement",
    en: "Responsibilities of management",
    fr: "Responsabilités de la direction",
    when: "always",
    pattern:
      /management['’]s responsibilit|responsibilit(y|ies) of management|those charged with governance|responsabilit[ée]s? de la direction|responsables de la gouvernance/i,
  },
  {
    key: "responsibilitiesAuditor",
    en: "Auditor's responsibilities for the audit",
    fr: "Responsabilités de l'auditeur relatives à l'audit",
    when: "always",
    pattern:
      /auditor['’]s responsibilit|responsibilit(y|ies) of the auditor|responsabilit[ée]s? (de l['’]auditeur|du commissaire aux comptes)/i,
  },
  {
    key: "otherReporting",
    en: "Other legal and regulatory reporting",
    fr: "Autres obligations légales et réglementaires",
    when: "manual",
    pattern:
      /other (legal|reporting|information)|report on other|v[ée]rifications (et informations )?sp[ée]cifiques|autres obligations/i,
  },
  {
    key: "partnerName",
    en: "Engagement partner name (listed entities)",
    fr: "Nom de l'associé responsable (entités cotées)",
    when: "listed",
    pattern: /engagement partner|associ[ée] responsable|nom de l['’]associ[ée]|\{\{\s*partner/i,
  },
  {
    key: "signature",
    en: "Signature",
    fr: "Signature",
    when: "always",
    pattern:
      /signature|signed by|les? commissaires? aux comptes\.|\{\{\s*signature/i,
  },
  {
    key: "date",
    en: "Date of the report",
    fr: "Date du rapport",
    when: "always",
    pattern: /date of (the )?(auditor['’]s )?report|\bdated\b|fait le|date du rapport/i,
  },
  {
    key: "address",
    en: "Auditor's address",
    fr: "Adresse de l'auditeur",
    when: "always",
    pattern: /\baddress\b|\badresse\b/i,
  },
];

export interface TemplateValidation {
  ok: boolean;
  missing: ReportComponentKey[];
}

/**
 * Structural check of a report template (or issued report text): every
 * component required for this engagement's profile must be detectable.
 * Tolerant by design — keyword/regex per component, EN + FR — because house
 * templates carry the firm's own wording; the platform validates structure,
 * the firm supplies wording (spec §05 A4).
 */
export function validateReportTemplate(
  text: string,
  opts: { listed: boolean; materialUncertainty: boolean },
): TemplateValidation {
  const missing = REPORT_COMPONENTS.filter((component) => {
    const required =
      component.when === "always" ||
      (component.when === "listed" && opts.listed) ||
      (component.when === "materialUncertainty" && opts.materialUncertainty);
    return required && !component.pattern.test(text);
  }).map((component) => component.key);
  return { ok: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Template slots (spec §05 A4): the matrix a house template library fills.
// Full reports keyed framework × opinion × listing, plus the three inserts.
// Illustrative bases: the four ISA 700 and five ISA 705 appendix illustrations.

export type SlotOpinion = "unmodified" | "qualified" | "adverse" | "disclaimer";
export type SlotFramework = "IFRS" | "SYSCOHADA";
export type SlotListing = "listed" | "non-listed";

export interface TemplateSlot {
  key: string;
  kind: "report" | "insert";
  /** null on inserts (they attach to any opinion) — and framework/listing are
   *  null where the slot applies across the axis. */
  opinion: SlotOpinion | null;
  framework: SlotFramework | null;
  listing: SlotListing | null;
  /** Illustrative basis the slot is modeled on. */
  basis: string;
  en: string;
  fr: string;
}

export const TEMPLATE_SLOTS: readonly TemplateSlot[] = [
  { key: "unmodified-ifrs-listed", kind: "report", opinion: "unmodified", framework: "IFRS", listing: "listed", basis: "ISA 700 App.", en: "Unmodified — IFRS, listed", fr: "Non modifiée — IFRS, cotée" },
  { key: "unmodified-ifrs-nonlisted", kind: "report", opinion: "unmodified", framework: "IFRS", listing: "non-listed", basis: "ISA 700 App.", en: "Unmodified — IFRS, non-listed", fr: "Non modifiée — IFRS, non cotée" },
  { key: "unmodified-syscohada-listed", kind: "report", opinion: "unmodified", framework: "SYSCOHADA", listing: "listed", basis: "ISA 700 App. (adapted)", en: "Unmodified — SYSCOHADA, listed", fr: "Non modifiée — SYSCOHADA, cotée" },
  { key: "unmodified-syscohada-nonlisted", kind: "report", opinion: "unmodified", framework: "SYSCOHADA", listing: "non-listed", basis: "ISA 700 App. (adapted)", en: "Unmodified — SYSCOHADA, non-listed", fr: "Non modifiée — SYSCOHADA, non cotée" },
  { key: "qualified-misstatement", kind: "report", opinion: "qualified", framework: null, listing: null, basis: "ISA 705 Ill. 1", en: "Qualified — material misstatement", fr: "Avec réserves — anomalie significative" },
  { key: "qualified-scope", kind: "report", opinion: "qualified", framework: null, listing: null, basis: "ISA 705 Ill. 3", en: "Qualified — scope limitation", fr: "Avec réserves — limitation de l'étendue" },
  { key: "adverse", kind: "report", opinion: "adverse", framework: null, listing: null, basis: "ISA 705 Ill. 2", en: "Adverse", fr: "Défavorable" },
  { key: "disclaimer-single", kind: "report", opinion: "disclaimer", framework: null, listing: null, basis: "ISA 705 Ill. 4", en: "Disclaimer — single element", fr: "Impossibilité d'exprimer une opinion — élément unique" },
  { key: "disclaimer-multiple", kind: "report", opinion: "disclaimer", framework: null, listing: null, basis: "ISA 705 Ill. 5", en: "Disclaimer — multiple elements", fr: "Impossibilité d'exprimer une opinion — éléments multiples" },
  { key: "insert-material-uncertainty", kind: "insert", opinion: null, framework: null, listing: null, basis: "ISA 570 (Revised)", en: "Material-uncertainty insert (going concern)", fr: "Insert incertitude significative (continuité d'exploitation)" },
  { key: "insert-eom", kind: "insert", opinion: null, framework: null, listing: null, basis: "ISA 706 (Revised)", en: "Emphasis-of-matter insert", fr: "Insert paragraphe d'observation" },
  { key: "insert-om", kind: "insert", opinion: null, framework: null, listing: null, basis: "ISA 706 (Revised)", en: "Other-matter insert", fr: "Insert paragraphe relatif à d'autres points" },
];
