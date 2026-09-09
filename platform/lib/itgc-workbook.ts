// E1.1 ITGC Testing — the working paper as the firm's own workbook.
//
// Seven tabs:
//   1 Cover        the Readme inputs, the two generic IT risks, the domain and
//                  IT-process conclusions, the IPE accuracy criteria
//   2 Applications the relevant IT applications and what the audit takes from each
//   3 Changes      \
//   4 Access        |  one tab per IT process domain: the controls tested, their
//   5 IT Operations |  attributes, the items examined and the domain conclusion
//   6 Support      /
//   7 Deficiencies the three-axis diagnostic, the route taken and the SOCD reference
//
// The handbook names four IT process domains and no more, so there are four
// domain tabs and no fifth. Program development is not one of them.
//
// Two rules of the methodology decide what this file computes and what it
// refuses to compute:
//
//   - an ineffective ITGC does not necessarily make the IT process ineffective.
//     So the workbook counts — controls, items examined, deviations — and stops
//     there. Every domain conclusion (Effective / Reliable / Ineffective) and
//     the IT-process conclusion (Support IT / Not support IT) arrive as entry
//     cells with a drop-down, pre-filled only from a conclusion the preparer has
//     already recorded in the tool. Nothing here derives the second conclusion
//     from the first, because the handbook says the two can differ.
//   - when the ITGCs are not effective there are three routes, not one, so the
//     Deficiencies tab offers all three and asks which was taken.
//
// Engagement identity is typed ONCE, in the Readme block on the Cover. Every
// other tab reads those cells by formula, so a corrected client name or a
// changed reviewer propagates through the file instead of being retyped.
//
// The builder is a pure function over ItgcView so it can be tested without a
// database; lib/itgc-export.ts supplies the view.

import ExcelJS from "exceljs";

/* ============================== the domains ============================= */

/**
 * The four IT process domains, in the handbook's own order. `sheet` is the tab
 * name, so it stays within Excel's 31-character limit and carries no character
 * Excel forbids in a sheet name.
 */
export const ITGC_DOMAINS = [
  { key: "changes", sheet: "Changes", en: "Changes", fr: "Changements" },
  { key: "access", sheet: "Access", en: "Access", fr: "Accès" },
  { key: "operations", sheet: "IT Operations", en: "IT Operations", fr: "Exploitation informatique" },
  { key: "support", sheet: "Support", en: "Support", fr: "Support" },
] as const;

export type ItgcDomain = (typeof ITGC_DOMAINS)[number]["key"];

/** The states a domain concludes to. The preparer picks one; nothing derives it. */
export const DOMAIN_STATES = ["Effective", "Reliable", "Ineffective"] as const;
export type DomainState = "effective" | "reliable" | "ineffective";

/** The two states the IT process itself concludes to, with the strategy each carries. */
export const PROCESS_STATES = ["Support IT", "Not support IT"] as const;
export type ProcessState = "support" | "not_support";

/**
 * The five shapes an ITGC deficiency takes. Kept free of commas because Excel's
 * list validation splits its options on them.
 */
export const DEFICIENCY_CATEGORIES = [
  "Condition in the IT process",
  "No control exists",
  "Control badly designed for the risk",
  "Control designed but not implemented",
  "Control did not operate throughout the period",
] as const;

/** The three routes open when the ITGCs are not effective. Also comma-free. */
export const RESPONSE_ROUTES = [
  "Compensating control — IT process",
  "Compensating control — SCOT",
  "Substantive procedures — SCOT",
] as const;

/** The two generic IT risks every ITGC in this file answers. */
export const GENERIC_IT_RISKS: readonly { en: string; fr: string }[] = [
  {
    en: "The data is not processed correctly by the IT application.",
    fr: "Les données ne sont pas correctement traitées par l'application informatique.",
  },
  {
    en: "The data is not the right data.",
    fr: "Les données ne sont pas les bonnes données.",
  },
] as const;

/**
 * The eight criteria that take the IPE accuracy sample from 25 items to 10.
 * They are carried in full, and answered one by one on the Cover, because the
 * reduction turns on all eight holding at once.
 */
export const IPE_CRITERIA: readonly string[] = [
  "The control environment supports the prevention, detection and correction of a material misstatement (ELC 5.1).",
  "There is no significant risk and no fraud risk at the level of the account or the assertion concerned.",
  "The account is not a higher-risk accounting estimate.",
  "The substantive procedure is not the only substantive procedure performed on that significant account or assertion.",
  "The understanding of the IT processes — manage change and manage access — identified nothing that increases the risk.",
  "The understanding of the SCOT producing the IPE, including the understanding of the relevant IT applications, identified nothing that increases the risk.",
  "The IPE is not itself complex: few formulas, no contra-line items, debits and credits not in the same listing, data points not drawn from several source applications.",
  "The data point is not created solely with an end-user computing tool, and the IPE is not used in a procedure performed at a shared service centre whose component financial statements are audited.",
] as const;

export const IPE_ACCURACY_BASELINE = 25;
export const IPE_ACCURACY_REDUCED = 10;
export const IPE_ACCURACY_EXTENDED = 60;

/**
 * The accuracy sample for an IPE. 25 items, falling to 10 only when every one
 * of the eight criteria is met, and rising to 60 where the circumstances call
 * for it. An unanswered criterion is not a met one, so a partly answered
 * checklist keeps the baseline.
 */
export function ipeAccuracySize(criteriaMet: readonly boolean[], extended = false): number {
  if (extended) return IPE_ACCURACY_EXTENDED;
  const allMet =
    criteriaMet.length === IPE_CRITERIA.length && criteriaMet.every((met) => met === true);
  return allMet ? IPE_ACCURACY_REDUCED : IPE_ACCURACY_BASELINE;
}

/* ================================ the view ============================== */

export interface ItgcGridRow {
  ref: string;
  date: string;
  desc: string;
  /** the evidence inspected for this item */
  evidence?: string;
  /** attribute key → outcome; "" is an unanswered cell, never read as a pass */
  results: Record<string, "pass" | "fail" | "na" | "">;
  note?: string;
}

export interface ItgcControl {
  /** CHG-1, ACC-1 … assigned in view order within the domain */
  ref: string;
  domain: ItgcDomain;
  /** the application or layer the control sits on */
  application: string;
  name: string;
  description: string | null;
  owner: string | null;
  /** free text as recorded: daily, on each change, quarterly … */
  frequency: string | null;
  /** occurrences over the period, when the extraction has produced a count */
  population: number | null;
  /** how the population was extracted and how its completeness was established */
  populationSource: string | null;
  /** which of the two generic IT risks the control answers */
  risksAddressed: string[];
  /** the extent decided: a test of one, or a wider test, and why */
  extentBasis: string | null;
  attributes: string[];
  rows: ItgcGridRow[];
  /** design and implementation, tested where the control supports a relevant control */
  designImplemented: boolean | null;
  /** the documented conclusion on this control after the exceptions were analysed */
  operatingEval: "effective" | "not_effective" | null;
  /** reports or extracts the control or its test leans on */
  ipe: string[];
}

export interface ItgcApplication {
  ref: string;
  name: string;
  /** application / database / operating system / network */
  layers: string;
  scots: string[];
  /** the application controls, IT-dependent manual controls and IPEs the audit takes from it */
  dependency: string;
  /** how critical those dependencies are to the SCOTs they serve */
  criticality: string;
  /** the IT strategy recorded on S2.3, in words */
  strategy: string;
  /** the service organisation running it, and the SOC or ISAE 3402 report held */
  serviceOrg: string;
  note: string;
}

/**
 * One recorded deficiency, carrying the three-axis diagnostic. Fields the tool
 * does not yet capture arrive empty and are written as entry cells: the
 * workbook never asserts a judgement the preparer has not made.
 */
export interface ItgcDeficiency {
  ref: string;
  domain: ItgcDomain | null;
  application: string;
  /** one of DEFICIENCY_CATEGORIES, or "" while undecided */
  category: string;
  condition: string;
  /** design / operating / both · preventive / detective / corrective · criticality */
  nature: string;
  /** the part of the period the failure covers, and whether and when it was remediated */
  timing: string;
  /** accumulation, IT processes touched, IT dependencies supported, entities affected */
  extent: string;
  /** whether this deficiency makes the IT process ineffective, and why */
  processEffect: string;
  /** one of RESPONSE_ROUTES, or "" while undecided */
  route: string;
  responseDetail: string;
  residualRisk: string;
  craEffect: string;
  socdRef: string;
  communicated: string;
}

export interface ItgcDomainConclusion {
  domain: ItgcDomain;
  state: DomainState | null;
  basis: string;
}

export interface ItgcView {
  clientName: string;
  fiscalYear: number;
  periodEnd: string;
  periodOfReliance: string | null;
  preparer: string | null;
  reviewer: string | null;
  partner: string | null;
  /** the E1.1 section conclusion as recorded in the tool, when there is one */
  conclusion: string | null;
  /** Support IT / Not support IT, when the preparer has already reached it */
  itProcess: ProcessState | null;
  applications: ItgcApplication[];
  controls: ItgcControl[];
  domains: ItgcDomainConclusion[];
  deficiencies: ItgcDeficiency[];
}

/* ============================ blank template =========================== */

/**
 * The empty E1.1 paper, for the Templates section. Every list is empty: the
 * builder provisions a blank application row, a blank control block on each
 * domain tab and blank deficiency rows on its own, so the auditor opens the
 * structure rather than a set of instructions about it. Nothing is asserted.
 */
export function blankItgcTemplate(): ItgcView {
  return {
    clientName: "",
    fiscalYear: new Date().getFullYear(),
    periodEnd: "",
    periodOfReliance: null,
    preparer: null,
    reviewer: null,
    partner: null,
    conclusion: null,
    itProcess: null,
    applications: [],
    controls: [],
    domains: ITGC_DOMAINS.map((d) => ({ domain: d.key, state: null, basis: "" })),
    deficiencies: [],
  };
}

/* ========================== derived per control ======================== */

export interface ItgcControlResult {
  /** items examined */
  tested: number;
  /** rows carrying a Fail in any attribute */
  deviations: number;
  /** a grid cell left blank on a tested row — the count must be nil to conclude */
  unanswered: number;
}

/** A row failing any attribute is one deviation, not one per attribute. */
export function evaluateItgcControl(control: ItgcControl): ItgcControlResult {
  let deviations = 0;
  let unanswered = 0;
  for (const row of control.rows) {
    let failed = false;
    for (const attribute of control.attributes) {
      const value = row.results[attribute] ?? "";
      if (value === "fail") failed = true;
      if (value === "") unanswered += 1;
    }
    if (failed) deviations += 1;
  }
  return { tested: control.rows.length, deviations, unanswered };
}

export interface ItgcDomainSummary {
  controls: number;
  tested: number;
  deviations: number;
  /** controls the preparer has concluded are not effective */
  ineffective: number;
  deficiencies: number;
}

/**
 * What was done in a domain, counted. Deliberately no state: the handbook is
 * explicit that an ineffective ITGC does not necessarily make the IT process
 * ineffective, so the conclusion is the preparer's and this returns only the
 * facts it rests on.
 */
export function domainSummary(view: ItgcView, domain: ItgcDomain): ItgcDomainSummary {
  const controls = view.controls.filter((c) => c.domain === domain);
  let tested = 0;
  let deviations = 0;
  for (const control of controls) {
    const r = evaluateItgcControl(control);
    tested += r.tested;
    deviations += r.deviations;
  }
  return {
    controls: controls.length,
    tested,
    deviations,
    ineffective: controls.filter((c) => c.operatingEval === "not_effective").length,
    deficiencies: view.deficiencies.filter((d) => d.domain === domain).length,
  };
}

/* ============================== styling =============================== */

const HDR = "FFD9D9D9";
const BAND = "FFC0C0C0";
const ENTRY = "FFFFF2CC";
const OK = "FFC6EFCE";
const BAD = "FFFFC7CE";
const WARN = "FFFFEB9C";
const OK_TEXT = "FF006100";
const BAD_TEXT = "FF9C0006";

/** The glyphs the preparer picks from, and what they mean. */
const TICK = "✓";
const CROSS = "✗";
const NA = "n/a";

/** Attribute columns provisioned on each domain grid. Those beyond the ones in
 *  use are grouped and collapsed, so Excel draws its own clickable "+" above
 *  them; expanding brings the next attribute column into view. */
const MAX_ATTRS = 8;

/** Grid rows written for a control the tool holds no items for. */
const BLANK_GRID_ROWS = 10;

const fill = (cell: ExcelJS.Cell, argb: string) => {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
};
const box = (cell: ExcelJS.Cell) => {
  cell.border = {
    top: { style: "thin", color: { argb: "FF999999" } },
    left: { style: "thin", color: { argb: "FF999999" } },
    bottom: { style: "thin", color: { argb: "FF999999" } },
    right: { style: "thin", color: { argb: "FF999999" } },
  };
};

const DOMAIN_STATE_LABEL: Record<DomainState, string> = {
  effective: "Effective",
  reliable: "Reliable",
  ineffective: "Ineffective",
};
const PROCESS_STATE_LABEL: Record<ProcessState, string> = {
  support: "Support IT",
  not_support: "Not support IT",
};

/* ===================== the Readme inputs on the Cover =================== */

/**
 * Fixed addresses. Every other tab reads these, so they must not move without
 * updating inputRef below.
 */
const INPUT_ROW_START = 4;
const INPUT_FIELDS = [
  "Client / company",
  "Engagement",
  "Fiscal year",
  "Period end",
  "Period of reliance",
  "Prepared by",
  "Date prepared",
  "Reviewed by",
  "Date reviewed",
  "Partner",
  "Date approved",
] as const;

/**
 * A reference into the Readme block, written WITHOUT a leading "=".
 *
 * The `<f>` element of a cell holds the formula body only; a leading "=" is not
 * part of it. Excel treats a file that carries one as damaged, repairs it on
 * open, and silently drops the sheet's contents.
 */
const inputRef = (field: (typeof INPUT_FIELDS)[number]): string =>
  `Cover!$D$${INPUT_ROW_START + INPUT_FIELDS.indexOf(field)}`;

/* ============================== builder =============================== */

export async function buildItgcWorkbook(view: ItgcView): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditISA";
  wb.created = new Date();

  const page = (ws: ExcelJS.Worksheet, footer: string) => {
    ws.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
    ws.headerFooter = { oddFooter: `&L${footer}&R&P / &N` };
  };

  /**
   * The identity band every tab except the Cover carries. Values are formulas
   * into the Readme block, never copies of it.
   */
  const identityBand = (ws: ExcelJS.Worksheet, title: string) => {
    const t = ws.addRow([`E1.1 ITGC Testing — ${title}`]);
    t.font = { bold: true, size: 13 };
    const fields: (typeof INPUT_FIELDS)[number][] = [
      "Client / company", "Engagement", "Period end", "Prepared by", "Reviewed by",
    ];
    const keyRow = ws.addRow([...fields, "Index"]);
    keyRow.eachCell((cell) => { fill(cell, HDR); box(cell); cell.font = { bold: true }; });
    const cached: Record<(typeof INPUT_FIELDS)[number], string> = {
      "Client / company": view.clientName,
      Engagement: `Statutory audit — FY ${view.fiscalYear}`,
      "Fiscal year": String(view.fiscalYear),
      "Period end": view.periodEnd,
      "Period of reliance": view.periodOfReliance ?? "",
      "Prepared by": view.preparer ?? "",
      "Date prepared": "",
      "Reviewed by": view.reviewer ?? "",
      "Date reviewed": "",
      Partner: view.partner ?? "",
      "Date approved": "",
    };
    const valRow = ws.addRow([]);
    fields.forEach((field, i) => {
      valRow.getCell(i + 1).value = {
        formula: inputRef(field),
        result: cached[field],
      } as ExcelJS.CellFormulaValue;
    });
    valRow.getCell(fields.length + 1).value = "E1.1";
    valRow.eachCell((cell) => { box(cell); cell.alignment = { wrapText: true, vertical: "top" }; });
    ws.addRow([]);
  };

  const sectionBand = (ws: ExcelJS.Worksheet, label: string, span: number) => {
    const row = ws.addRow([label]);
    ws.mergeCells(row.number, 1, row.number, span);
    for (let c = 1; c <= span; c += 1) { fill(row.getCell(c), BAND); box(row.getCell(c)); }
    row.getCell(1).font = { bold: true };
    return row;
  };

  /* ----------------------------- 1 Cover ------------------------------ */
  const cover = wb.addWorksheet("Cover");
  page(cover, "Cover");
  cover.columns = [
    { width: 6 }, { width: 18 }, { width: 26 }, { width: 44 }, { width: 34 }, { width: 20 },
  ] as ExcelJS.Column[];

  const coverTitle = cover.addRow(["E1.1 ITGC Testing"]);
  coverTitle.font = { bold: true, size: 13 };
  cover.addRow([]);
  sectionBand(cover, "Readme — enter these once; every tab in this file reads them", 6);

  const inputValue: Record<(typeof INPUT_FIELDS)[number], string | number> = {
    "Client / company": view.clientName,
    Engagement: `Statutory audit — FY ${view.fiscalYear}`,
    "Fiscal year": view.fiscalYear,
    "Period end": view.periodEnd,
    "Period of reliance": view.periodOfReliance ?? "",
    "Prepared by": view.preparer ?? "",
    "Date prepared": "",
    "Reviewed by": view.reviewer ?? "",
    "Date reviewed": "",
    Partner: view.partner ?? "",
    "Date approved": "",
  };
  INPUT_FIELDS.forEach((field, i) => {
    const row = cover.addRow(["", field, "", inputValue[field]]);
    cover.mergeCells(row.number, 2, row.number, 3);
    cover.mergeCells(row.number, 4, row.number, 6);
    const key = row.getCell(2);
    key.font = { bold: true };
    fill(key, HDR);
    box(key);
    const value = row.getCell(4);
    box(value);
    fill(value, ENTRY);
    value.alignment = { vertical: "top", wrapText: true };
    if (row.number !== INPUT_ROW_START + i) throw new Error("readme-layout-moved");
  });
  cover.addRow([]);

  /** Label in column 2, text across 3–6. The Cover's workhorse row. */
  const coverLine = (label: string, text: string, entry = false) => {
    const row = cover.addRow(["", label, text]);
    cover.mergeCells(row.number, 3, row.number, 6);
    row.getCell(2).font = { bold: true };
    row.getCell(2).alignment = { vertical: "top", wrapText: true };
    box(row.getCell(2));
    const v = row.getCell(3);
    v.alignment = { wrapText: true, vertical: "top" };
    box(v);
    if (entry || text === "") fill(v, ENTRY);
    row.height = text.length > 220 ? 44 : text.length > 110 ? 30 : 18;
    return row;
  };

  sectionBand(cover, "Scope and standards", 6);
  coverLine(
    "This paper owns",
    "The ITGC testing over the IT processes supporting the audit-relevant applications — scope, walkthroughs, tests, the deficiency diagnostic, and the per-domain and IT-process conclusions.",
  );
  coverLine("Standards", "ISA 315 (Revised 2019) ¶26 · ISA 330 ¶13(c), ¶14(b)");
  coverLine(
    "Feeds from · into",
    "S1.1 SCOT register · S2.3 IT applications · P4.3 IT environment · S2.2 control design   →   E1.2 tests of controls · S3.1 strategy · the SOCD",
  );
  cover.addRow([]);

  sectionBand(cover, "The two generic IT risks every ITGC here answers", 6);
  GENERIC_IT_RISKS.forEach((risk, i) => coverLine(`IT risk ${i + 1}`, risk.en));
  coverLine(
    "How they are used",
    "A control appears in this file because it addresses one of the two risks, and the conclusion on it is expressed against them. Record which risk each control answers on its own block.",
  );
  cover.addRow([]);

  sectionBand(cover, "Conclusion — the IT process", 6);
  const processLabel = view.itProcess ? PROCESS_STATE_LABEL[view.itProcess] : "";
  const verdict = cover.addRow(["", processLabel, view.conclusion ?? ""]);
  cover.mergeCells(verdict.number, 3, verdict.number, 6);
  const verdictCell = verdict.getCell(2);
  verdictCell.dataValidation = {
    type: "list", allowBlank: true, formulae: [`"${PROCESS_STATES.join(",")}"`],
  };
  verdictCell.font = {
    bold: true,
    color: { argb: view.itProcess === "not_support" ? BAD_TEXT : OK_TEXT },
  };
  box(verdictCell);
  fill(
    verdictCell,
    view.itProcess === "support" ? OK : view.itProcess === "not_support" ? BAD : ENTRY,
  );
  const verdictText = verdict.getCell(3);
  verdictText.alignment = { wrapText: true, vertical: "top" };
  box(verdictText);
  if (!view.conclusion) fill(verdictText, ENTRY);
  verdict.height = 46;
  coverLine(
    "Strategy carried",
    "Support IT — rely on the control. Not support IT — do not rely on the control, and answer the dependency by one of the three routes below.",
  );
  coverLine(
    "Read this before concluding",
    "An ineffective ITGC does not necessarily make the IT process ineffective. Conclude each domain below on its own, and conclude the IT process here on the diagnostic recorded on the Deficiencies tab — saying, where the two differ, what carries the difference.",
  );
  cover.addRow([]);

  sectionBand(cover, "IT process domains", 6);
  const domainHead = cover.addRow([
    "Domain", "Controls", "Items examined", "Deviations", "Deficiencies", "Conclusion",
  ]);
  domainHead.eachCell((cell) => { fill(cell, HDR); box(cell); cell.font = { bold: true }; });
  for (const domain of ITGC_DOMAINS) {
    const s = domainSummary(view, domain.key);
    const recorded = view.domains.find((d) => d.domain === domain.key)?.state ?? null;
    const row = cover.addRow([
      `${domain.en} / ${domain.fr}`, s.controls, s.tested, s.deviations, s.deficiencies,
      recorded ? DOMAIN_STATE_LABEL[recorded] : "",
    ]);
    row.eachCell({ includeEmpty: true }, (cell, c) => { if (c <= 6) box(cell); });
    const state = row.getCell(6);
    state.dataValidation = {
      type: "list", allowBlank: true, formulae: [`"${DOMAIN_STATES.join(",")}"`],
    };
    fill(
      state,
      recorded === "ineffective" ? BAD : recorded === null ? ENTRY : OK,
    );
    if (recorded) state.font = { bold: true, color: { argb: recorded === "ineffective" ? BAD_TEXT : OK_TEXT } };
  }
  coverLine(
    "",
    "Effective · Reliable · Ineffective. The counts are what the domain tabs record; the conclusion is yours. Each domain tab carries its controls, their attributes, the items examined and the basis for the conclusion.",
  );
  cover.addRow([]);

  sectionBand(cover, "IPE reliability — completeness and accuracy", 6);
  coverLine(
    "Reliability",
    "An IPE is reliable when it is complete and accurate, both established before anything is selected from it. The population extracted for an ITGC test is itself usually an IPE.",
  );
  coverLine(
    "Accuracy sample",
    `${IPE_ACCURACY_BASELINE} items. It falls to ${IPE_ACCURACY_REDUCED} — and the completeness procedures fall with it — only when all eight criteria below are met, and it is extended to ${IPE_ACCURACY_EXTENDED} where the circumstances require. The reduction to ${IPE_ACCURACY_REDUCED} is not available on a PCAOB engagement.`,
  );
  const criteriaHead = cover.addRow(["", "#", "Criterion", "", "", "Met?"]);
  cover.mergeCells(criteriaHead.number, 3, criteriaHead.number, 5);
  [2, 3, 6].forEach((c) => {
    fill(criteriaHead.getCell(c), HDR);
    box(criteriaHead.getCell(c));
    criteriaHead.getCell(c).font = { bold: true };
  });
  const firstCriterion = criteriaHead.number + 1;
  IPE_CRITERIA.forEach((criterion, i) => {
    const row = cover.addRow(["", i + 1, criterion]);
    cover.mergeCells(row.number, 3, row.number, 5);
    [2, 3, 6].forEach((c) => box(row.getCell(c)));
    row.getCell(2).alignment = { horizontal: "center", vertical: "top" };
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
    const met = row.getCell(6);
    met.dataValidation = { type: "list", allowBlank: true, formulae: ['"Yes,No"'] };
    met.alignment = { horizontal: "center" };
    fill(met, ENTRY);
    row.height = criterion.length > 150 ? 40 : criterion.length > 100 ? 30 : 22;
  });
  const lastCriterion = cover.rowCount;
  const metColumn = cover.getColumn(6).letter;
  const sizeRow = cover.addRow(["", "Items", "Accuracy sample this file works to"]);
  cover.mergeCells(sizeRow.number, 3, sizeRow.number, 5);
  [2, 3, 6].forEach((c) => { box(sizeRow.getCell(c)); fill(sizeRow.getCell(c), HDR); });
  sizeRow.getCell(2).font = { bold: true };
  sizeRow.getCell(6).value = {
    formula:
      `IF(COUNTIF(${metColumn}${firstCriterion}:${metColumn}${lastCriterion},"Yes")=${IPE_CRITERIA.length},`
      + `${IPE_ACCURACY_REDUCED},${IPE_ACCURACY_BASELINE})`,
    result: IPE_ACCURACY_BASELINE,
  } as ExcelJS.CellFormulaValue;
  sizeRow.getCell(6).font = { bold: true };
  sizeRow.getCell(6).alignment = { horizontal: "center" };
  cover.addRow([]);

  sectionBand(cover, "Extent of the ITGC testing", 6);
  coverLine(
    "Nature of the control",
    "A test of one, or a wider test where the number of occurrences of the control is high. Record the basis on the control's own block.",
  );
  coverLine(
    "Timing",
    "The period the test covers, including the update test between the interim and the year end.",
  );
  coverLine(
    "Sole control",
    "Where a single control covers the assertion, the sample is increased — 60 items for a daily control.",
  );
  coverLine(
    "Rotation",
    "Where nothing relevant has changed, a control relied on is tested at least once every three audits, and some controls in every audit. A control relied on in a significant-risk area is tested in the current period.",
  );
  cover.addRow([]);

  sectionBand(cover, "When the ITGCs are not effective — three routes, not one", 6);
  coverLine(
    RESPONSE_ROUTES[0],
    "A compensating control at IT-process level, or an IT-substantive procedure. The objective of an IT-substantive procedure is to establish that the facts which could result from the uncovered IT risk did not occur.",
  );
  coverLine(RESPONSE_ROUTES[1], "A compensating control inside the SCOT, tested as a control.");
  coverLine(
    RESPONSE_ROUTES[2],
    "Substantive procedures inside the SCOT, including direct testing of the application controls, the IT-dependent manual controls and the IPEs the application supports.",
  );
  coverLine(
    "Then",
    "Assess the residual risk, record the effect on the control risk assessment, report the deficiency in the SOCD and communicate it to the entity. The route is chosen after the diagnostic, on the Deficiencies tab.",
  );
  cover.addRow([]);

  sectionBand(cover, "Sign-off", 6);
  const signHead = cover.addRow(["", "Role", "Name", "Date"]);
  [2, 3, 4].forEach((c) => { fill(signHead.getCell(c), HDR); box(signHead.getCell(c)); signHead.getCell(c).font = { bold: true }; });
  ([
    ["Prepared by", "Prepared by", "Date prepared"],
    ["Reviewed by", "Reviewed by", "Date reviewed"],
    ["Partner", "Partner", "Date approved"],
  ] as [string, (typeof INPUT_FIELDS)[number], (typeof INPUT_FIELDS)[number]][]).forEach(([label, nameField, dateField]) => {
    const row = cover.addRow(["", label]);
    row.getCell(3).value = {
      formula: inputRef(nameField), result: String(inputValue[nameField] ?? ""),
    } as ExcelJS.CellFormulaValue;
    row.getCell(4).value = {
      formula: inputRef(dateField), result: String(inputValue[dateField] ?? ""),
    } as ExcelJS.CellFormulaValue;
    for (const c of [2, 3, 4]) box(row.getCell(c));
  });
  const signNote = cover.addRow([
    "", "Sign-off is held by the tool. These cells read the Readme block and are not typed over.",
  ]);
  cover.mergeCells(signNote.number, 2, signNote.number, 6);
  signNote.getCell(2).font = { italic: true };

  cover.views = [{ state: "frozen", ySplit: 3 }];

  /* -------------------------- 2 Applications --------------------------- */
  const apps = wb.addWorksheet("Applications");
  page(apps, "Applications — the audit's IT dependency");
  const APP_SPAN = 10;
  apps.columns = [
    { width: 8 }, { width: 26 }, { width: 26 }, { width: 30 }, { width: 38 },
    { width: 18 }, { width: 24 }, { width: 26 }, { width: 22 }, { width: 34 },
  ] as ExcelJS.Column[];
  identityBand(apps, "Applications");

  sectionBand(apps, "What this tab records", APP_SPAN);
  const appLines: [string, string][] = [
    [
      "Scope",
      "The applications the audit depends on: those involved in the business processes and in producing the financial statements. The question is which applications the audit depends on, not which ones the entity owns.",
    ],
    [
      "Layers",
      "An ITGC is tested at a layer, not at a company. Record for each application which layers are in scope — application, database, operating system, network — because that is where the controls on the domain tabs sit.",
    ],
    [
      "Audit dependency",
      "What the audit actually takes from the application: the automated application controls, the IT-dependent manual controls, and the IPEs it produces. These are the dependencies the domain conclusions carry, and the ones the deficiency diagnostic counts.",
    ],
    [
      "Service organisations",
      "Where the application is run by a service organisation the audit relies on, record the SOC or ISAE 3402 report held, its type and period, and confirm the scope covers the right IT environment and the right databases.",
    ],
  ];
  for (const [term, text] of appLines) {
    const row = apps.addRow([term, text]);
    apps.mergeCells(row.number, 2, row.number, APP_SPAN);
    const k = row.getCell(1);
    k.font = { bold: true };
    k.alignment = { vertical: "top", wrapText: true };
    box(k);
    const v = row.getCell(2);
    v.alignment = { wrapText: true, vertical: "top" };
    box(v);
    row.height = text.length > 220 ? 44 : 34;
  }
  apps.addRow([]);

  sectionBand(apps, "Relevant IT applications", APP_SPAN);
  const appHead = apps.addRow([
    "Ref", "Application", "Layers in scope", "SCOTs served",
    "Audit dependency — application controls · IT-dependent manual controls · IPEs",
    "Criticality", "IT strategy (S2.3)", "Service organisation · SOC / ISAE 3402",
    "Domains in scope", "Note",
  ]);
  appHead.eachCell((cell) => {
    fill(cell, HDR); box(cell); cell.font = { bold: true };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  appHead.height = 40;

  const appRows = Math.max(view.applications.length + 2, 5);
  for (let i = 0; i < appRows; i += 1) {
    const app = view.applications[i];
    const row = apps.addRow([
      app?.ref ?? `APP-${i + 1}`,
      app?.name ?? "",
      app?.layers ?? "",
      app?.scots.join(" · ") ?? "",
      app?.dependency ?? "",
      app?.criticality ?? "",
      app?.strategy ?? "",
      app?.serviceOrg ?? "",
      "",
      app?.note ?? "",
    ]);
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      if (c > APP_SPAN) return;
      box(cell);
      cell.alignment = { wrapText: true, vertical: "top" };
      if (cell.value === "" || cell.value === null || cell.value === undefined) fill(cell, ENTRY);
    });
    row.height = 30;
  }
  apps.views = [{ state: "frozen", ySplit: appHead.number, xSplit: 2 }];

  /* --------------------- 3–6 one tab per domain ------------------------ */
  const SPAN = 5 + MAX_ATTRS + 2; // # ref date item evidence | A1..An | result note
  const FIRST_ATTR = 6;
  const RESULT_COL = 5 + MAX_ATTRS + 1;

  for (const domain of ITGC_DOMAINS) {
    const ws = wb.addWorksheet(domain.sheet);
    page(ws, `${domain.en} / ${domain.fr}`);
    ws.columns = [
      { width: 6 }, { width: 22 }, { width: 12 }, { width: 36 }, { width: 24 },
      ...Array.from({ length: MAX_ATTRS }, () => ({ width: 7 })),
      { width: 11 }, { width: 40 },
    ] as ExcelJS.Column[];

    const controls = view.controls.filter((c) => c.domain === domain.key);

    // Spare attribute columns collapse into an outline group, so Excel draws its
    // own "+" above them. Clicking it reveals the next attribute column, ready
    // to be used the moment a description is entered for it.
    ws.properties.outlineProperties = { summaryBelow: true, summaryRight: false };
    const attrsInUse = Math.max(
      1,
      ...controls.map((c) => Math.min(c.attributes.length, MAX_ATTRS)),
    );
    for (let a = attrsInUse; a < MAX_ATTRS; a += 1) {
      const column = ws.getColumn(FIRST_ATTR + a);
      column.outlineLevel = 1;
      column.hidden = true;
    }
    // sheetFormatPr must declare the deepest column outline actually used. Left
    // at 0 while the columns claim level 1, Excel reads the sheet as damaged.
    if (attrsInUse < MAX_ATTRS) ws.properties.outlineLevelCol = 1;

    identityBand(ws, `${domain.en} / ${domain.fr}`);

    const legend = ws.addRow([
      `Legend:  ${TICK} attribute present   ${CROSS} attribute absent — the item is a deviation   ${NA} not applicable to this item.`
      + `   Pick from the drop-down in each attribute cell; Result is a formula — Fail if any attribute is ${CROSS}, blank until every attribute is answered.`
      + `   To add an attribute: click the + above the attribute columns to reveal the next one, then describe it in the block's attribute list.`,
    ]);
    ws.mergeCells(legend.number, 1, legend.number, SPAN);
    legend.getCell(1).alignment = { wrapText: true, vertical: "top" };
    legend.getCell(1).font = { italic: true };
    legend.height = 40;
    fill(legend.getCell(1), HDR);
    box(legend.getCell(1));
    ws.addRow([]);
    ws.views = [{ state: "frozen", ySplit: ws.rowCount }];

    const attrLetter = (index: number) => ws.getColumn(FIRST_ATTR + index).letter;

    // A domain with nothing recorded still gets one block, so the tab opens as
    // a paper to fill rather than an empty sheet.
    const blocks: (ItgcControl | null)[] = controls.length > 0 ? controls : [null];

    for (const [index, control] of blocks.entries()) {
      const ref = control?.ref ?? `${domain.sheet.slice(0, 3).toUpperCase()}-${index + 1}`;
      const result = control
        ? evaluateItgcControl(control)
        : { tested: 0, deviations: 0, unanswered: 0 };
      const used = Math.max(1, Math.min(control?.attributes.length ?? 0, MAX_ATTRS));

      const title = ws.addRow([
        `${ref}  ·  ${domain.en} / ${domain.fr}  ·  ${control?.application ?? ""}  ·  ${control?.name ?? ""}`,
      ]);
      ws.mergeCells(title.number, 1, title.number, SPAN);
      fill(title.getCell(1), BAND);
      box(title.getCell(1));
      title.getCell(1).font = { bold: true };
      title.getCell(1).alignment = { vertical: "middle", wrapText: true };
      title.height = 22;

      const yn = (v: boolean | null) => (v === null ? "" : v ? "Yes" : "No");
      const meta: [string, string][] = [
        ["Control", control?.description ?? control?.name ?? ""],
        ["Application · layer", control?.application ?? ""],
        [
          "Frequency · performed by",
          control ? `${control.frequency ?? "—"} · ${control.owner ?? "—"}` : "",
        ],
        [
          "Generic IT risk addressed",
          control?.risksAddressed.join(" · ") ?? "",
        ],
        [
          "Attributes — who · when · on what · how · with what · why",
          "",
        ],
        [
          "Population · how it was extracted and its completeness established",
          control
            ? [
                control.population === null ? "" : `${control.population} occurrences over the period`,
                control.populationSource ?? "",
              ].filter(Boolean).join(" — ")
            : "",
        ],
        ["Nature · timing · extent of the test", control?.extentBasis ?? ""],
        ["Design and implementation tested (D&I)", yn(control?.designImplemented ?? null)],
        ["IPE relied on", control?.ipe.join(" · ") ?? ""],
      ];

      for (const [key, value] of meta) {
        const row = ws.addRow([key]);
        ws.mergeCells(row.number, 1, row.number, 3);
        ws.mergeCells(row.number, 4, row.number, SPAN);
        const k = row.getCell(1);
        k.font = { bold: true };
        k.alignment = { vertical: "top", wrapText: true };
        fill(k, HDR);
        box(k);
        const v = row.getCell(4);
        v.value = value;
        v.alignment = { wrapText: true, vertical: "top" };
        box(v);
        if (value === "") fill(v, ENTRY);
        row.height = value.length > 110 ? 30 : 16;
      }

      // --- attribute descriptions, one row each, with spare rows to add more
      const attrTitle = ws.addRow(["Attribute descriptions"]);
      ws.mergeCells(attrTitle.number, 1, attrTitle.number, SPAN);
      fill(attrTitle.getCell(1), HDR);
      box(attrTitle.getCell(1));
      attrTitle.getCell(1).font = { bold: true };

      const attributes = control?.attributes ?? [];
      const attrRowsToWrite = Math.min(Math.max(attributes.length + 2, 4), MAX_ATTRS);
      for (let i = 0; i < attrRowsToWrite; i += 1) {
        const attribute = attributes[i];
        const row = ws.addRow([`A${i + 1}`, attribute ?? ""]);
        ws.mergeCells(row.number, 2, row.number, SPAN);
        const code = row.getCell(1);
        code.font = { bold: true };
        code.alignment = { horizontal: "center", vertical: "top" };
        box(code);
        const desc = row.getCell(2);
        desc.alignment = { wrapText: true, vertical: "top" };
        box(desc);
        if (!attribute) {
          fill(code, ENTRY);
          fill(desc, ENTRY);
          desc.value = i === attributes.length
            ? `+  describe the attribute fixed at the walkthrough here; its test column is A${i + 1} — click the + above the attribute columns if it is hidden`
            : "";
          desc.font = { italic: true };
        }
        row.height = (attribute ?? "").length > 110 ? 28 : 16;
      }

      // --- grid
      const gridHead = ws.addRow([
        "#", "Reference", "Date", "Item examined", "Evidence inspected",
        ...Array.from({ length: MAX_ATTRS }, (_, i) => `A${i + 1}`),
        "Result", "Note",
      ]);
      gridHead.eachCell({ includeEmpty: true }, (cell, c) => {
        if (c > SPAN) return;
        fill(cell, HDR); box(cell); cell.font = { bold: true };
        if (c >= FIRST_ATTR && c < RESULT_COL) cell.alignment = { horizontal: "center" };
      });

      const firstDataRow = gridHead.number + 1;
      const gridRows: (ItgcGridRow | null)[] =
        control && control.rows.length > 0
          ? control.rows
          : Array.from({ length: BLANK_GRID_ROWS }, () => null);

      gridRows.forEach((gridRow, i) => {
        const row = ws.addRow([
          i + 1, gridRow?.ref ?? "", gridRow?.date ?? "", gridRow?.desc ?? "", gridRow?.evidence ?? "",
        ]);
        let failed = false;
        let blank = false;
        // Every provisioned column gets the drop-down, so a newly revealed
        // attribute column is usable the moment it is unhidden.
        for (let a = 0; a < MAX_ATTRS; a += 1) {
          const cell = row.getCell(FIRST_ATTR + a);
          const attribute = attributes[a];
          const value = attribute && gridRow ? gridRow.results[attribute] ?? "" : "";
          if (attribute) {
            if (value === "fail") failed = true;
            if (value === "") blank = true;
          }
          cell.value = value === "pass" ? TICK : value === "fail" ? CROSS : value === "na" ? NA : "";
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.dataValidation = { type: "list", allowBlank: true, formulae: [`"${TICK},${CROSS},${NA}"`] };
          box(cell);
          if (cell.value === "") fill(cell, ENTRY);
        }
        const from = `${attrLetter(0)}${row.number}`;
        const to = `${attrLetter(used - 1)}${row.number}`;
        row.getCell(RESULT_COL).value = {
          formula: `IF(COUNTIF(${from}:${to},"${CROSS}")>0,"Fail",IF(COUNTBLANK(${from}:${to})>0,"","Pass"))`,
          result: blank ? "" : failed ? "Fail" : "Pass",
        } as ExcelJS.CellFormulaValue;
        row.getCell(RESULT_COL).alignment = { horizontal: "center" };
        row.getCell(RESULT_COL).font = { bold: true };
        row.getCell(SPAN).value = gridRow?.note ?? "";
        for (let c = 1; c <= SPAN; c += 1) box(row.getCell(c));
        row.getCell(SPAN).alignment = { wrapText: true, vertical: "top" };
        for (const c of [2, 3, 4, 5, SPAN]) {
          const cell = row.getCell(c);
          if (cell.value === "" || cell.value === null || cell.value === undefined) fill(cell, ENTRY);
        }
      });

      const lastDataRow = ws.rowCount;
      // Formatting covers every provisioned column, so a revealed one colours
      // the same way without the file being regenerated.
      const attrRef = `${attrLetter(0)}${firstDataRow}:${attrLetter(MAX_ATTRS - 1)}${lastDataRow}`;
      ws.addConditionalFormatting({
        ref: attrRef,
        rules: [
          { type: "cellIs", operator: "equal", priority: 1, formulae: [`"${TICK}"`],
            style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: OK } }, font: { color: { argb: OK_TEXT }, bold: true } } },
          { type: "cellIs", operator: "equal", priority: 2, formulae: [`"${CROSS}"`],
            style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: BAD } }, font: { color: { argb: BAD_TEXT }, bold: true } } },
        ],
      });
      const resultLetter = ws.getColumn(RESULT_COL).letter;
      ws.addConditionalFormatting({
        ref: `${resultLetter}${firstDataRow}:${resultLetter}${lastDataRow}`,
        rules: [
          { type: "cellIs", operator: "equal", priority: 1, formulae: ['"Pass"'],
            style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: OK } }, font: { color: { argb: OK_TEXT }, bold: true } } },
          { type: "cellIs", operator: "equal", priority: 2, formulae: ['"Fail"'],
            style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: BAD } }, font: { color: { argb: BAD_TEXT }, bold: true } } },
        ],
      });

      const subtotal = ws.addRow([`${ref} subtotal`]);
      ws.mergeCells(subtotal.number, 1, subtotal.number, 5);
      subtotal.getCell(1).font = { bold: true };
      subtotal.getCell(RESULT_COL).value = {
        formula: `COUNTIF(${resultLetter}${firstDataRow}:${resultLetter}${lastDataRow},"Fail")`,
        result: result.deviations,
      } as ExcelJS.CellFormulaValue;
      subtotal.getCell(RESULT_COL).alignment = { horizontal: "center" };
      subtotal.getCell(SPAN).value =
        `${result.tested} item${result.tested === 1 ? "" : "s"} examined · deviations at left · `
        + `${control?.operatingEval === "effective" ? "control effective" : control?.operatingEval === "not_effective" ? "control not effective" : "conclusion pending"}`
        + (result.unanswered > 0 ? ` · ${result.unanswered} unanswered attribute cell${result.unanswered === 1 ? "" : "s"}` : "");
      subtotal.getCell(SPAN).alignment = { wrapText: true, vertical: "top" };
      for (let c = 1; c <= SPAN; c += 1) { box(subtotal.getCell(c)); fill(subtotal.getCell(c), HDR); }
      subtotal.font = { bold: true };
      ws.addRow([]);
    }

    /* --- the domain's own conclusion, reached by the preparer --- */
    sectionBand(ws, `Conclusion — ${domain.en} / ${domain.fr}`, SPAN);
    const summary = domainSummary(view, domain.key);
    const recorded = view.domains.find((d) => d.domain === domain.key) ?? null;

    const conclusionLine = (label: string, value: string, entry: boolean) => {
      const row = ws.addRow([label]);
      ws.mergeCells(row.number, 1, row.number, 3);
      ws.mergeCells(row.number, 4, row.number, SPAN);
      const k = row.getCell(1);
      k.font = { bold: true };
      k.alignment = { vertical: "top", wrapText: true };
      fill(k, HDR);
      box(k);
      const v = row.getCell(4);
      v.value = value;
      v.alignment = { wrapText: true, vertical: "top" };
      box(v);
      if (entry && value === "") fill(v, ENTRY);
      row.height = value.length > 150 ? 34 : 18;
      return v;
    };

    conclusionLine(
      "What was done",
      `${summary.controls} control${summary.controls === 1 ? "" : "s"} tested · `
      + `${summary.tested} item${summary.tested === 1 ? "" : "s"} examined · `
      + `${summary.deviations} deviation${summary.deviations === 1 ? "" : "s"} · `
      + `${summary.deficiencies} deficiency record${summary.deficiencies === 1 ? "" : "s"} raised on the Deficiencies tab`,
      false,
    );
    const stateCell = conclusionLine(
      "Conclusion for this domain",
      recorded?.state ? DOMAIN_STATE_LABEL[recorded.state] : "",
      true,
    );
    stateCell.dataValidation = {
      type: "list", allowBlank: true, formulae: [`"${DOMAIN_STATES.join(",")}"`],
    };
    if (recorded?.state) {
      fill(stateCell, recorded.state === "ineffective" ? BAD : OK);
      stateCell.font = {
        bold: true,
        color: { argb: recorded.state === "ineffective" ? BAD_TEXT : OK_TEXT },
      };
    }
    conclusionLine("Basis for that conclusion", recorded?.basis ?? "", true);
    const caution = ws.addRow([
      "An ineffective ITGC in this domain does not by itself make the IT process ineffective. Record the diagnostic and the route taken on the Deficiencies tab, and conclude the IT process on the Cover.",
    ]);
    ws.mergeCells(caution.number, 1, caution.number, SPAN);
    fill(caution.getCell(1), WARN);
    box(caution.getCell(1));
    caution.getCell(1).alignment = { wrapText: true, vertical: "top" };
    caution.getCell(1).font = { italic: true };
    caution.height = 26;
  }

  /* -------------------------- 7 Deficiencies --------------------------- */
  const def = wb.addWorksheet("Deficiencies");
  page(def, "Deficiencies — diagnostic and response");
  const DEF_SPAN = 15;
  def.columns = [
    { width: 8 }, { width: 14 }, { width: 22 }, { width: 26 }, { width: 36 },
    { width: 34 }, { width: 34 }, { width: 34 }, { width: 28 }, { width: 26 },
    { width: 34 }, { width: 24 }, { width: 20 }, { width: 16 }, { width: 18 },
  ] as ExcelJS.Column[];
  identityBand(def, "Deficiencies");

  sectionBand(def, "The diagnostic — three axes", DEF_SPAN);
  const axes: [string, string][] = [
    [
      "Nature",
      "Is the deficiency one of design, of operating effectiveness, or both? Is the control preventive, detective or corrective? How critical is it to the IT process it belongs to?",
    ],
    [
      "Timing",
      "What part of the period does the failure cover — days, weeks, months? Was it remediated, and when? The answer sets the period the substantive response has to reach.",
    ],
    [
      "Extent",
      "Do deficiencies accumulate, and across how many IT processes? How many IT dependencies does the application support — IPEs, application controls, IT-dependent manual controls — and how critical are they to the SCOTs? How many entities are affected?",
    ],
    [
      "Then the route",
      `One of three: ${RESPONSE_ROUTES.join(" · ")}. Assess the residual risk, record the effect on the control risk assessment, report the deficiency in the SOCD and communicate it to the entity.`,
    ],
  ];
  for (const [term, text] of axes) {
    const row = def.addRow([term, text]);
    def.mergeCells(row.number, 2, row.number, DEF_SPAN);
    const k = row.getCell(1);
    k.font = { bold: true };
    k.alignment = { vertical: "top", wrapText: true };
    box(k);
    const v = row.getCell(2);
    v.alignment = { wrapText: true, vertical: "top" };
    box(v);
    row.height = text.length > 220 ? 40 : 30;
  }
  def.addRow([]);

  sectionBand(def, "Deficiencies identified", DEF_SPAN);
  const defHead = def.addRow([
    "Ref", "Domain", "Application · IT process", "Category", "The condition found",
    "Nature", "Timing", "Extent", "Effect on the IT process", "Route taken",
    "Response performed · working-paper reference", "Residual risk", "Effect on the CRA",
    "SOCD ref", "Communicated",
  ]);
  defHead.eachCell((cell) => {
    fill(cell, HDR); box(cell); cell.font = { bold: true };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  defHead.height = 34;
  def.views = [{ state: "frozen", ySplit: defHead.number, xSplit: 1 }];

  const domainLabel = (key: ItgcDomain | null) =>
    key === null ? "" : ITGC_DOMAINS.find((d) => d.key === key)?.en ?? "";

  const defRows = Math.max(view.deficiencies.length + 2, 5);
  for (let i = 0; i < defRows; i += 1) {
    const d = view.deficiencies[i];
    const row = def.addRow([
      d?.ref ?? `DEF-${i + 1}`,
      domainLabel(d?.domain ?? null),
      d?.application ?? "",
      d?.category ?? "",
      d?.condition ?? "",
      d?.nature ?? "",
      d?.timing ?? "",
      d?.extent ?? "",
      d?.processEffect ?? "",
      d?.route ?? "",
      d?.responseDetail ?? "",
      d?.residualRisk ?? "",
      d?.craEffect ?? "",
      d?.socdRef ?? "",
      d?.communicated ?? "",
    ]);
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      if (c > DEF_SPAN) return;
      box(cell);
      cell.alignment = { wrapText: true, vertical: "top" };
      if (cell.value === "" || cell.value === null || cell.value === undefined) fill(cell, ENTRY);
    });
    row.getCell(2).dataValidation = {
      type: "list", allowBlank: true,
      formulae: [`"${ITGC_DOMAINS.map((x) => x.en).join(",")}"`],
    };
    row.getCell(4).dataValidation = {
      type: "list", allowBlank: true, formulae: [`"${DEFICIENCY_CATEGORIES.join(",")}"`],
    };
    row.getCell(10).dataValidation = {
      type: "list", allowBlank: true, formulae: [`"${RESPONSE_ROUTES.join(",")}"`],
    };
    row.height = 32;
  }
  def.addRow([]);
  const defNote = def.addRow([
    "A deficiency with no route recorded leaves the dependency unanswered: the IT process cannot conclude to Support IT on it. Where the route is a substantive one, it has to reach the whole period the Timing column describes.",
  ]);
  def.mergeCells(defNote.number, 1, defNote.number, DEF_SPAN);
  defNote.getCell(1).font = { italic: true };
  defNote.getCell(1).alignment = { wrapText: true, vertical: "top" };
  defNote.height = 26;

  /* ------------------- house style: 10pt everywhere ------------------- */
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const current = cell.font ?? {};
        cell.font = {
          ...current,
          name: current.name ?? "Calibri",
          size: (current.size ?? 0) >= 12 ? current.size : 10,
        };
      });
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
