// E1.2 Tests of Controls — the working paper as the firm's own workbook.
//
// Four tabs:
//   1 Cover      the Readme inputs, the conclusion, the sampling reference
//   2 IPE        completeness and accuracy of the data the tests rely on
//   3 Tests      every control as its own working paper: header, attributes, grid
//   4 Exceptions one row per deviation, carrying the whole analysis
//
// Engagement identity is typed ONCE, in the Readme block on the Cover. Every
// other tab reads those cells by formula, so a corrected client name or a
// changed reviewer propagates through the file instead of being retyped.
//
// Each control carries its own working paper on the Tests tab — its plan, its
// attributes, its grid and its conclusion — so there is no separate board
// restating what the blocks already say.
//
// Sample sizes and the deviation rule come from lib/toc-sampling.ts — the
// SAMPLE 3.3 table the sampling studio and the on-screen board already share.
// Nothing here re-states a number that module owns, so the workbook, the
// studio's suggestion and the board can never drift apart.
//
// The builder is a pure function over TocView so it can be tested without a
// database; the route supplies the view.

import ExcelJS from "exceljs";
import {
  TOC_EXTENDED_SIZE,
  tocEvaluate,
  tocSuggested,
  type TocReliance,
} from "@/lib/toc-sampling";

/* ============================== the view ============================== */

export interface TocGridRow {
  ref: string;
  date: string;
  desc: string;
  /** attribute key → outcome; "" is an unanswered cell, never read as a pass */
  results: Record<string, "pass" | "fail" | "na" | "">;
  /** set on rows added when a test was extended after a deviation */
  extension?: boolean;
  note?: string;
}

export interface TocControl {
  /** C-1, C-2 … assigned in view order */
  ref: string;
  scot: string;
  /** every WCGW this control answers, in register order */
  wcgws: string[];
  assertions: string[];
  name: string;
  description: string | null;
  owner: string | null;
  controlType: "manual" | "it_dependent" | "automated";
  /** free text as recorded on S2.2; normalised by lib/toc-sampling */
  frequency: string | null;
  population: number | null;
  soleControl: boolean;
  itgcEffective: boolean;
  attributes: string[];
  rows: TocGridRow[];
  /** the documented conclusion after evaluating exceptions */
  operatingEval: "effective" | "not_effective" | null;
  testDesign: string | null;
  /** prior-period reliance, when the control is rotated */
  rotation: TocRotation | null;
  /** reports or extracts the control or its test leans on — listed on IPE */
  ipe?: string[];
}

export interface TocRotation {
  lastTested: string | null;
  effectiveThen: boolean;
  environmentSound: boolean;
  understandingReconfirmed: boolean;
  noRelevantChange: boolean;
  withinThreeAudits: boolean;
  /** never rotate a significant-risk, non-routine, estimate or bank-rec control */
  eligibleByType: boolean;
}

/**
 * A recorded deviation. The fields the tool does not yet capture arrive null
 * and are written as entry cells: the workbook never asserts a judgement the
 * preparer has not made.
 */
export interface TocException {
  ref: string;
  controlRef: string;
  item: string;
  cause: string;
  implication: string;
  decision: string;
  deficiency: boolean | null;
  significant: boolean | null;
  s31Effect: string;
  communicated: string;
}

export interface TocView {
  clientName: string;
  fiscalYear: number;
  periodEnd: string;
  periodOfReliance: string | null;
  preparer: string | null;
  reviewer: string | null;
  partner: string | null;
  controls: TocControl[];
  exceptions: TocException[];
}

/* ============================ blank template =========================== */

/**
 * The empty E1.2 paper, for the Templates section: one control block with no
 * attributes described yet and room for a 25-item plan, so the auditor sees the
 * structure rather than a set of instructions about it. Nothing is asserted —
 * every identity, plan and result cell arrives as an entry cell.
 */
export function blankTocTemplate(): TocView {
  return {
    clientName: "",
    fiscalYear: new Date().getFullYear(),
    periodEnd: "",
    periodOfReliance: null,
    preparer: null,
    reviewer: null,
    partner: null,
    controls: [
      {
        ref: "C-1",
        scot: "",
        wcgws: [],
        assertions: [],
        name: "",
        description: null,
        owner: null,
        controlType: "manual",
        frequency: null,
        population: null,
        soleControl: false,
        itgcEffective: false,
        attributes: [],
        rows: Array.from({ length: 25 }, () => ({
          ref: "", date: "", desc: "", results: {} as TocGridRow["results"],
        })),
        operatingEval: null,
        testDesign: null,
        rotation: null,
        ipe: [],
      },
    ],
    exceptions: [],
  };
}

/* ========================= mapping from the studio ===================== */

/** Structural shape of the fields sole-control depends on. */
export interface ControlSelection {
  id: string;
  wcgwIds: string[];
  selectedForTesting: boolean;
}

/**
 * A control is the only one on its assertion when no sibling selected for
 * testing shares a WCGW with it. A control linked to no WCGW is never treated
 * as sole: the 60-item plan would rest on an assertion nobody has recorded.
 */
export function isSoleControl(control: ControlSelection, siblings: ControlSelection[]): boolean {
  if (control.wcgwIds.length === 0) return false;
  return !siblings.some(
    (other) =>
      other.id !== control.id &&
      other.selectedForTesting &&
      other.wcgwIds.some((id) => control.wcgwIds.includes(id)),
  );
}

/* ========================== derived per control ======================== */

export interface TocControlResult {
  planSize: number | null;
  /** the SAMPLE 3.3 rule that produced the size */
  basis: string | null;
  /** why no plan could be produced */
  planProblem: "itgc-not-effective" | "need-population" | "unknown-frequency" | null;
  tested: number;
  deviations: number;
  /** a grid cell left blank on a tested row — the count must be nil to conclude */
  unanswered: number;
  reliance: TocReliance | null;
  shortOfPlan: boolean;
}

/** Rows carry a Fail in any attribute → the row is a deviation. */
export function evaluateControl(control: TocControl): TocControlResult {
  let planSize: number | null = null;
  let basis: string | null = null;
  let planProblem: TocControlResult["planProblem"] = null;

  if (control.controlType === "automated" && !control.itgcEffective) {
    // The test of one rests entirely on the E1.1 conclusion. Without it there
    // is no defined sample size, and the auditor decides whether to test the
    // control as manual or drop the reliance.
    planProblem = "itgc-not-effective";
  } else {
    const suggestion = tocSuggested(
      control.controlType,
      control.frequency,
      control.population,
      control.soleControl,
      false,
    );
    if (suggestion === null) planProblem = "unknown-frequency";
    else if ("needPopulation" in suggestion) planProblem = "need-population";
    else {
      planSize = suggestion.size;
      basis = suggestion.rule;
    }
  }

  const tested = control.rows.length;
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

  const reliance =
    planSize === null || tested === 0 ? null : tocEvaluate(planSize, tested, deviations);

  return {
    planSize,
    basis,
    planProblem,
    tested,
    deviations,
    unanswered,
    reliance,
    shortOfPlan: planSize !== null && tested < planSize,
  };
}

/* ============================== labels ================================ */

const PROBLEM_LABEL: Record<NonNullable<TocControlResult["planProblem"]>, string> = {
  "itgc-not-effective": "ITGC not effective (E1.1) — the test of one is not available",
  "need-population": "Population required before a sample size can be set",
  "unknown-frequency": "Frequency not recognised — record it on S2.2",
};

const RELIANCE_LABEL: Record<TocReliance, string> = {
  high: "High",
  moderate: "Moderate",
  rely: "Rely",
  extend: "Extend to 60",
  none: "Do not rely",
};

const TYPE_LABEL: Record<TocControl["controlType"], string> = {
  manual: "Manual",
  it_dependent: "IT-dependent manual",
  automated: "Automated",
};

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

/** Attribute columns provisioned on the Tests grid. Those beyond the ones in
 *  use are grouped and collapsed, so Excel draws its own clickable "+" above
 *  them; expanding brings the next attribute column into view. */
const MAX_ATTRS = 10;

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
 * open, and silently drops the sheet's contents — which is exactly how the
 * Tests tab came back empty.
 */
const inputRef = (field: (typeof INPUT_FIELDS)[number]): string =>
  `Cover!$D$${INPUT_ROW_START + INPUT_FIELDS.indexOf(field)}`;

/* ============================== builder =============================== */

export async function buildTocWorkbook(view: TocView): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditISA";
  wb.created = new Date();

  const results = new Map<string, TocControlResult>();
  for (const control of view.controls) results.set(control.ref, evaluateControl(control));
  const notEffective = view.controls.filter((c) => c.operatingEval === "not_effective").length;

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
    const t = ws.addRow([`E1.2 Tests of Controls — ${title}`]);
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
    valRow.getCell(fields.length + 1).value = "E1.2";
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
    { width: 6 }, { width: 16 }, { width: 26 }, { width: 46 }, { width: 34 }, { width: 20 },
  ] as ExcelJS.Column[];

  const coverTitle = cover.addRow(["E1.2 Tests of Controls"]);
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

  sectionBand(cover, "Scope and standards", 6);
  const owns = cover.addRow([
    "", "This paper owns",
    "The tests of controls over the significant classes of transactions — selection, sampling, execution, exceptions and the operating-effectiveness conclusion per control.",
  ]);
  cover.mergeCells(owns.number, 3, owns.number, 6);
  owns.getCell(2).font = { bold: true };
  owns.getCell(3).alignment = { wrapText: true, vertical: "top" };
  owns.height = 32;
  const std = cover.addRow(["", "Standards", "ISA 330 ¶8–17 · ISA 530 · ISA 500 ¶9"]);
  std.getCell(2).font = { bold: true };
  cover.mergeCells(std.number, 3, std.number, 6);
  const feeds = cover.addRow([
    "", "Feeds from · into",
    "S2.2 control design · S1.2 SCOT register · S3.1 strategy · E1.1 ITGC conclusion   →   S3.1 revision · substantive response · deficiency register",
  ]);
  feeds.getCell(2).font = { bold: true };
  cover.mergeCells(feeds.number, 3, feeds.number, 6);
  feeds.getCell(3).alignment = { wrapText: true, vertical: "top" };
  feeds.height = 28;
  cover.addRow([]);

  sectionBand(cover, "Conclusion", 6);
  const effective = notEffective === 0;
  const conclusion = effective
    ? "The controls selected for testing over the significant classes of transactions operated effectively throughout the period of reliance. Every exception was evaluated and answered. The reliance recorded in S3.1 stands."
    : "One or more controls did not operate effectively. The reliance in S3.1 has been revised to not-rely for the affected assertions and the substantive response extended. Each deficiency has been evaluated and communicated.";
  const verdict = cover.addRow(["", effective ? "Effective" : "Revised", conclusion]);
  fill(verdict.getCell(2), effective ? OK : BAD);
  verdict.getCell(2).font = { bold: true, color: { argb: effective ? OK_TEXT : BAD_TEXT } };
  box(verdict.getCell(2));
  cover.mergeCells(verdict.number, 3, verdict.number, 6);
  verdict.getCell(3).alignment = { wrapText: true, vertical: "top" };
  verdict.height = 46;
  cover.addRow([]);

  sectionBand(cover, "Controls tested", 6);
  const summaryHead = cover.addRow(["Ref", "Min sample", "Tested", "Deviations", "Reliance", "Conclusion"]);
  summaryHead.eachCell((cell) => { fill(cell, HDR); box(cell); cell.font = { bold: true }; });
  for (const control of view.controls) {
    const r = results.get(control.ref)!;
    const row = cover.addRow([
      control.ref,
      r.planProblem ? "—" : r.planSize ?? "—",
      r.tested,
      r.deviations,
      r.reliance ? RELIANCE_LABEL[r.reliance] : "—",
      control.operatingEval === "effective" ? "Effective" : control.operatingEval === "not_effective" ? "Not effective" : "—",
    ]);
    row.eachCell((cell) => { box(cell); });
    fill(row.getCell(6), control.operatingEval === "effective" ? OK : control.operatingEval === "not_effective" ? BAD : HDR);
  }
  const summaryNote = cover.addRow([
    "", "Each control's own working paper — plan, attributes, items tested and conclusion — is on the Tests tab.",
  ]);
  cover.mergeCells(summaryNote.number, 2, summaryNote.number, 6);
  summaryNote.getCell(2).font = { italic: true };
  cover.addRow([]);

  sectionBand(cover, "Sampling reference — SAMPLE 3.3", 6);
  const paramHead = cover.addRow(["", "Control", "Min sample", "Note"]);
  cover.mergeCells(paramHead.number, 4, paramHead.number, 6);
  [2, 3, 4].forEach((c) => { fill(paramHead.getCell(c), HDR); box(paramHead.getCell(c)); paramHead.getCell(c).font = { bold: true }; });
  const PARAMS: [string, string | number, string][] = [
    ["Automated, ITGC effective (E1.1)", 1, "Applied first. Without E1.1 support the test of one is not available."],
    ["Annual", 1, ""],
    ["Semi-annual · Quarterly · Monthly", 2, ""],
    ["Weekly", 5, ""],
    ["Daily · many times a day · over 250 occurrences", 25, `${TOC_EXTENDED_SIZE} when the only control on its assertion`],
    ["Daily · 50–250 occurrences", "10 %", "Rounded up"],
    ["Daily · under 50 occurrences", 5, ""],
    ["Daily · under 5 occurrences", "All", ""],
  ];
  for (const [label, size, note] of PARAMS) {
    const row = cover.addRow(["", label, size, note]);
    cover.mergeCells(row.number, 4, row.number, 6);
    [2, 3, 4].forEach((c) => box(row.getCell(c)));
    row.getCell(4).alignment = { wrapText: true, vertical: "top" };
  }
  cover.addRow([]);
  const devHead = cover.addRow(["", "Plan", "Deviations", "Reliance"]);
  cover.mergeCells(devHead.number, 4, devHead.number, 6);
  [2, 3, 4].forEach((c) => { fill(devHead.getCell(c), HDR); box(devHead.getCell(c)); devHead.getCell(c).font = { bold: true }; });
  const DEV: [string, string, string][] = [
    ["25", "0", "Rely"],
    ["25", "1", "Extend to 60, then apply the 60 rule"],
    ["25", "2 or more", "Do not rely"],
    ["60", "0", "High"],
    ["60", "1", "Moderate — reduce the assurance taken in S3.1"],
    ["60", "2 or more", "Do not rely"],
    ["5 · 2 · 1 · occurrence plans", "0", "Rely"],
    ["5 · 2 · 1 · occurrence plans", "1 or more", "Do not rely"],
  ];
  for (const [plan, dev, reliance] of DEV) {
    const row = cover.addRow(["", plan, dev, reliance]);
    cover.mergeCells(row.number, 4, row.number, 6);
    [2, 3, 4].forEach((c) => box(row.getCell(c)));
  }
  const devNote = cover.addRow([
    "", "Extending is decided on the Exceptions tab once the cause is known, never by re-drawing until the count fits. Extension items come from the same population, excluding items already tested.",
  ]);
  cover.mergeCells(devNote.number, 2, devNote.number, 6);
  devNote.getCell(2).font = { italic: true };
  devNote.getCell(2).alignment = { wrapText: true };
  devNote.height = 26;
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

  /* ------------------------------ 2 IPE ------------------------------- */
  const ipe = wb.addWorksheet("IPE");
  page(ipe, "IPE — information produced by the entity");
  ipe.columns = [
    { width: 10 }, { width: 30 }, { width: 20 }, { width: 30 },
    { width: 40 }, { width: 40 }, { width: 26 }, { width: 18 }, { width: 16 },
  ] as ExcelJS.Column[];
  identityBand(ipe, "IPE");

  sectionBand(ipe, "Information produced by the entity — what this tab covers", 9);
  const ipeLines: [string, string][] = [
    [
      "IPE",
      "Information Produced by the Entity: any report, extract, listing or schedule generated from the entity's own systems or prepared by its staff, which the audit then uses as evidence. A sales-invoice listing, a general-ledger extract, an aged receivables report, an open goods-received-note listing and a system gap report are all IPE.",
    ],
    [
      "Why it matters here",
      "A test of controls is only as reliable as the data it is performed on. Where the population for a sample, or the evidence a control leaves behind, comes from the entity rather than from an independent source, the audit cannot assume the data is sound. It has to be established. Until that is done, a sample drawn from the report proves nothing about the population the report was meant to represent.",
    ],
    [
      "Completeness",
      "That the report contains every item it should — nothing dropped by a filter, a date range, a posting status or a permission. Establish it by agreeing record counts and control totals back to an independent source (the general ledger, a system control total, a physical sequence), and by testing the parameters the report was run with.",
    ],
    [
      "Accuracy",
      "That the fields the audit relies on carry the values held in the underlying system — amounts, dates, references, statuses. Establish it by tracing a sample of report lines back to source records and, where the report calculates or groups, by reperforming the calculation.",
    ],
    [
      "Recording it",
      "Record each report below with the procedure actually performed for completeness and for accuracy, the evidence retained, and the conclusion. Where the two cannot both be established, the report is not used as a sampling population and the control that depends on it is not relied on until the position is resolved.",
    ],
  ];
  for (const [term, text] of ipeLines) {
    const row = ipe.addRow([term, text]);
    ipe.mergeCells(row.number, 2, row.number, 9);
    const k = row.getCell(1);
    k.font = { bold: true };
    k.alignment = { vertical: "top", wrapText: true };
    box(k);
    const v = row.getCell(2);
    v.alignment = { wrapText: true, vertical: "top" };
    box(v);
    row.height = text.length > 300 ? 56 : text.length > 200 ? 44 : 34;
  }
  ipe.addRow([]);

  sectionBand(ipe, "Data relied on", 9);
  const ipeHead = ipe.addRow([
    "Ref", "Report, extract or listing", "Source system", "Used for",
    "Completeness — procedure performed", "Accuracy — procedure performed",
    "Evidence retained", "Performed by", "Conclusion",
  ]);
  ipeHead.eachCell((cell) => {
    fill(cell, HDR); box(cell); cell.font = { bold: true };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  ipeHead.height = 32;

  const ipeItems: { ref: string; report: string; usedFor: string }[] = [];
  for (const control of view.controls) {
    for (const report of control.ipe ?? []) {
      ipeItems.push({ ref: `IPE-${ipeItems.length + 1}`, report, usedFor: `${control.ref} — ${control.name}` });
    }
  }
  const ipeRowCount = Math.max(ipeItems.length + 3, 6);
  for (let i = 0; i < ipeRowCount; i += 1) {
    const item = ipeItems[i];
    const row = ipe.addRow([
      item?.ref ?? `IPE-${i + 1}`, item?.report ?? "", "", item?.usedFor ?? "", "", "", "", "", "",
    ]);
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      if (c > 9) return;
      box(cell);
      cell.alignment = { wrapText: true, vertical: "top" };
      if (cell.value === "" || cell.value === null || cell.value === undefined) fill(cell, ENTRY);
    });
    row.getCell(9).dataValidation = {
      type: "list", allowBlank: true,
      formulae: ['"Complete and accurate,Not relied on,Further work needed"'],
    };
    row.height = 28;
  }
  ipe.views = [{ state: "frozen", ySplit: ipeHead.number }];

  /* ----------------------------- 3 Tests ------------------------------ */
  const tests = wb.addWorksheet("Tests");
  page(tests, "Tests");
  const SPAN = 5 + MAX_ATTRS + 2; // # ref date desc amount | A1..An | result note
  const FIRST_ATTR = 6;
  const RESULT_COL = 5 + MAX_ATTRS + 1;
  tests.columns = [
    { width: 6 }, { width: 20 }, { width: 12 }, { width: 34 }, { width: 15 },
    ...Array.from({ length: MAX_ATTRS }, () => ({ width: 7 })),
    { width: 11 }, { width: 42 },
  ] as ExcelJS.Column[];

  // Spare attribute columns collapse into an outline group, so Excel draws its
  // own "+" above them. Clicking it reveals the next attribute column, ready to
  // be used the moment a description is entered for it.
  tests.properties.outlineProperties = { summaryBelow: true, summaryRight: false };
  const attrsInUse = Math.max(1, ...view.controls.map((c) => Math.min(c.attributes.length, MAX_ATTRS)));
  for (let a = attrsInUse; a < MAX_ATTRS; a += 1) {
    const column = tests.getColumn(FIRST_ATTR + a);
    column.outlineLevel = 1;
    column.hidden = true;
  }
  // sheetFormatPr must declare the deepest column outline actually used. Left
  // at 0 while the columns claim level 1, Excel reads the sheet as damaged.
  if (attrsInUse < MAX_ATTRS) tests.properties.outlineLevelCol = 1;

  identityBand(tests, "Tests");

  const legend = tests.addRow([
    `Legend:  ${TICK} attribute present   ${CROSS} attribute absent — the row is a deviation   ${NA} not applicable to this item.`
    + `   Pick from the drop-down in each attribute cell; Result is a formula — Fail if any attribute is ${CROSS}, blank until every attribute is answered.`
    + `   To add an attribute: click the + above the attribute columns to reveal the next one, then describe it in the block's attribute list.`,
  ]);
  tests.mergeCells(legend.number, 1, legend.number, SPAN);
  legend.getCell(1).alignment = { wrapText: true, vertical: "top" };
  legend.getCell(1).font = { italic: true };
  legend.height = 40;
  fill(legend.getCell(1), HDR);
  box(legend.getCell(1));
  tests.addRow([]);
  tests.views = [{ state: "frozen", ySplit: tests.rowCount }];

  const attrLetter = (index: number) => tests.getColumn(FIRST_ATTR + index).letter;

  for (const control of view.controls) {
    const r = results.get(control.ref)!;
    const used = Math.max(1, Math.min(control.attributes.length, MAX_ATTRS));

    const title = tests.addRow([
      `${control.ref}  ·  ${control.scot}  ·  ${control.assertions.join(", ")}  ·  ${control.name}`,
    ]);
    tests.mergeCells(title.number, 1, title.number, SPAN);
    fill(title.getCell(1), BAND);
    box(title.getCell(1));
    title.getCell(1).font = { bold: true };
    title.getCell(1).alignment = { vertical: "middle", wrapText: true };
    title.height = 22;

    const meta: [string, string][] = [
      ["Control", control.description ?? control.name],
      ["Type · Frequency · Performed by", `${TYPE_LABEL[control.controlType]} · ${control.frequency ?? "—"} · ${control.owner ?? "—"}`],
      ["WCGW addressed", control.wcgws.join(" · ") || "—"],
      ["Population · completeness", control.population === null ? "—" : `${control.population} occurrences over the period of reliance`],
      ["Sole control · Min sample · Basis", `${control.soleControl ? "Yes" : "No"}  ·  ${r.planProblem ? "—" : r.planSize ?? "—"}  ·  ${r.planProblem ? PROBLEM_LABEL[r.planProblem] : r.basis ?? "—"}`],
      ["Nature of test", control.testDesign ?? "Inquiry combined with inspection, observation, reperformance or data analysis."],
      ["IPE relied on", (control.ipe ?? []).join(" · ") || "None"],
    ];
    if (control.rotation) {
      const rot = control.rotation;
      const yn = (v: boolean) => (v ? "Yes" : "No");
      meta.push([
        "Rotation — prior-period reliance",
        !rot.eligibleByType
          ? "This control never rotates (significant risk, non-routine, estimate or bank reconciliation)."
          : `Last tested ${rot.lastTested ?? "—"} · effective then ${yn(rot.effectiveThen)} · environment sound ${yn(rot.environmentSound)}`
            + ` · understanding reconfirmed ${yn(rot.understandingReconfirmed)} · no relevant change ${yn(rot.noRelevantChange)}`
            + ` · tested within three audits ${yn(rot.withinThreeAudits)}`,
      ]);
    }
    meta.push(["Changed since S2.2", ""]);

    for (const [key, value] of meta) {
      const row = tests.addRow([key]);
      tests.mergeCells(row.number, 1, row.number, 3);
      tests.mergeCells(row.number, 4, row.number, SPAN);
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
    const attrTitle = tests.addRow(["Attribute descriptions"]);
    tests.mergeCells(attrTitle.number, 1, attrTitle.number, SPAN);
    fill(attrTitle.getCell(1), HDR);
    box(attrTitle.getCell(1));
    attrTitle.getCell(1).font = { bold: true };

    const attrRowsToWrite = Math.min(Math.max(control.attributes.length + 2, 4), MAX_ATTRS);
    for (let i = 0; i < attrRowsToWrite; i += 1) {
      const attribute = control.attributes[i];
      const row = tests.addRow([`A${i + 1}`, attribute ?? ""]);
      tests.mergeCells(row.number, 2, row.number, SPAN);
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
        desc.value = i === control.attributes.length
          ? "+  describe a new attribute here; its test column is A" + (i + 1) + " — click the + above the attribute columns if it is hidden"
          : "";
        desc.font = { italic: true };
      }
      row.height = (attribute ?? "").length > 110 ? 28 : 16;
    }

    // --- grid
    const gridHead = tests.addRow([
      "#", "Reference", "Date", "Counterparty / description", "Amount",
      ...Array.from({ length: MAX_ATTRS }, (_, i) => `A${i + 1}`),
      "Result", "Note",
    ]);
    gridHead.eachCell({ includeEmpty: true }, (cell, c) => {
      if (c > SPAN) return;
      fill(cell, HDR); box(cell); cell.font = { bold: true };
      if (c >= FIRST_ATTR && c < RESULT_COL) cell.alignment = { horizontal: "center" };
    });

    const firstDataRow = gridHead.number + 1;
    control.rows.forEach((gridRow, i) => {
      if (gridRow.extension && (i === 0 || !control.rows[i - 1].extension)) {
        const marker = tests.addRow([
          "Extension — items drawn from the same population, excluding items already tested",
        ]);
        tests.mergeCells(marker.number, 1, marker.number, SPAN);
        fill(marker.getCell(1), WARN);
        box(marker.getCell(1));
        marker.getCell(1).font = { bold: true };
      }
      const row = tests.addRow([i + 1, gridRow.ref, gridRow.date, gridRow.desc, null]);
      let failed = false;
      let blank = false;
      // Every provisioned column gets the drop-down, so a newly revealed
      // attribute column is usable the moment it is unhidden.
      for (let a = 0; a < MAX_ATTRS; a += 1) {
        const cell = row.getCell(FIRST_ATTR + a);
        const attribute = control.attributes[a];
        const value = attribute ? gridRow.results[attribute] ?? "" : "";
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
      row.getCell(SPAN).value = gridRow.note ?? "";
      for (let c = 1; c <= SPAN; c += 1) box(row.getCell(c));
      row.getCell(SPAN).alignment = { wrapText: true, vertical: "top" };
    });

    const lastDataRow = tests.rowCount;
    if (control.rows.length > 0) {
      // Formatting covers every provisioned column, so a revealed one colours
      // the same way without the file being regenerated.
      const attrRef = `${attrLetter(0)}${firstDataRow}:${attrLetter(MAX_ATTRS - 1)}${lastDataRow}`;
      tests.addConditionalFormatting({
        ref: attrRef,
        rules: [
          { type: "cellIs", operator: "equal", priority: 1, formulae: [`"${TICK}"`],
            style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: OK } }, font: { color: { argb: OK_TEXT }, bold: true } } },
          { type: "cellIs", operator: "equal", priority: 2, formulae: [`"${CROSS}"`],
            style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: BAD } }, font: { color: { argb: BAD_TEXT }, bold: true } } },
        ],
      });
      const resultLetter = tests.getColumn(RESULT_COL).letter;
      tests.addConditionalFormatting({
        ref: `${resultLetter}${firstDataRow}:${resultLetter}${lastDataRow}`,
        rules: [
          { type: "cellIs", operator: "equal", priority: 1, formulae: ['"Pass"'],
            style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: OK } }, font: { color: { argb: OK_TEXT }, bold: true } } },
          { type: "cellIs", operator: "equal", priority: 2, formulae: ['"Fail"'],
            style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: BAD } }, font: { color: { argb: BAD_TEXT }, bold: true } } },
        ],
      });
    }

    const subtotal = tests.addRow([`${control.ref} subtotal`]);
    tests.mergeCells(subtotal.number, 1, subtotal.number, 5);
    subtotal.getCell(1).font = { bold: true };
    if (control.rows.length > 0) {
      const resultLetter = tests.getColumn(RESULT_COL).letter;
      const range = `${resultLetter}${firstDataRow}:${resultLetter}${lastDataRow}`;
      subtotal.getCell(RESULT_COL).value = {
        formula: `COUNTIF(${range},"Fail")`, result: r.deviations,
      } as ExcelJS.CellFormulaValue;
      subtotal.getCell(RESULT_COL).alignment = { horizontal: "center" };
    }
    subtotal.getCell(SPAN).value =
      `${r.tested} tested · deviations at left · ${r.reliance ? RELIANCE_LABEL[r.reliance] : "—"} · `
      + `${control.operatingEval === "effective" ? "Effective" : control.operatingEval === "not_effective" ? "Not effective" : "conclusion pending"}`
      + (r.shortOfPlan ? ` · SHORT OF PLAN (${r.tested} of ${r.planSize})` : "")
      + (r.unanswered > 0 ? ` · ${r.unanswered} unanswered attribute cell${r.unanswered === 1 ? "" : "s"}` : "");
    subtotal.getCell(SPAN).alignment = { wrapText: true, vertical: "top" };
    for (let c = 1; c <= SPAN; c += 1) { box(subtotal.getCell(c)); fill(subtotal.getCell(c), HDR); }
    subtotal.font = { bold: true };
    tests.addRow([]);
  }

  /* --------------------------- 4 Exceptions --------------------------- */
  const exceptions = wb.addWorksheet("Exceptions");
  page(exceptions, "Exceptions");
  exceptions.columns = [
    { width: 8 }, { width: 9 }, { width: 18 }, { width: 40 }, { width: 40 }, { width: 34 },
    { width: 11 }, { width: 11 }, { width: 16 }, { width: 34 }, { width: 22 },
  ] as ExcelJS.Column[];
  identityBand(exceptions, "Exceptions");

  const excHead = exceptions.addRow([
    "Exc.", "Control", "Item", "Cause", "Implication", "Extend or stop",
    "Deficiency", "Significant", "Control conclusion", "S3.1 effect", "Communicated",
  ]);
  excHead.eachCell((cell) => {
    fill(cell, HDR); box(cell); cell.font = { bold: true };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  excHead.height = 30;
  exceptions.views = [{ state: "frozen", ySplit: excHead.number, xSplit: 1 }];

  if (view.exceptions.length === 0) {
    const none = exceptions.addRow([
      "No deviation was found in any control tested. Every control takes its conclusion on its own working paper.",
    ]);
    exceptions.mergeCells(none.number, 1, none.number, 11);
    none.getCell(1).font = { italic: true };
  }
  for (const exception of view.exceptions) {
    const control = view.controls.find((c) => c.ref === exception.controlRef);
    const row = exceptions.addRow([
      exception.ref, exception.controlRef, exception.item, exception.cause, exception.implication,
      exception.decision,
      exception.deficiency === null ? "" : exception.deficiency ? "Yes" : "No",
      exception.significant === null ? "" : exception.significant ? "Yes" : "No",
      control?.operatingEval === "effective" ? "Effective" : control?.operatingEval === "not_effective" ? "Not effective" : "—",
      exception.s31Effect, exception.communicated,
    ]);
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      if (c > 11) return;
      box(cell);
      cell.alignment = { wrapText: true, vertical: "top" };
    });
    for (const c of [5, 6, 7, 8, 10, 11]) {
      const value = row.getCell(c).value;
      if (value === "" || value === null || value === undefined) fill(row.getCell(c), ENTRY);
    }
    for (const c of [7, 8]) {
      row.getCell(c).dataValidation = { type: "list", allowBlank: true, formulae: ['"Yes,No"'] };
    }
    fill(row.getCell(9), control?.operatingEval === "effective" ? OK : control?.operatingEval === "not_effective" ? BAD : HDR);
    if (exception.significant === true) fill(row.getCell(8), BAD);
  }
  exceptions.addRow([]);
  const excNote = exceptions.addRow([
    "A control with no deviation takes its conclusion on its own working paper and never appears here. Significant deficiencies are communicated in writing to those charged with governance (ISA 265).",
  ]);
  exceptions.mergeCells(excNote.number, 1, excNote.number, 11);
  excNote.getCell(1).font = { italic: true };

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
