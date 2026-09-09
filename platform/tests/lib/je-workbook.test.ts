// The E3.1 workbook, read back with ExcelJS. buildJeWorkbook is a pure function
// over JeView for exactly this reason: the assembly that needs a database lives
// in lib/je-export.ts, so everything the file actually says can be asserted here
// without one.
//
// Two kinds of assertion below. The mechanical ones — no leading "=", the
// declared column outline level, the frozen panes — guard against the failures
// that make Excel call a file damaged and silently empty a sheet. The rest guard
// the argument the paper makes: that the population came before the selection,
// that every item carries the reason it was picked, and that nothing in the file
// presents journal entry testing as a random sample.

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  blankJeTemplate,
  buildJeWorkbook,
  formatSettings,
  type JeCriterion,
  type JeSelectedLine,
  type JeView,
} from "@/lib/je-workbook";

const TABS = ["Cover", "Population", "Criteria", "Selection", "Exceptions"];

const criterion = (patch: Partial<JeCriterion> = {}): JeCriterion => ({
  key: "weekend-posting",
  name: "Posted on a weekend",
  description: "Lines dated on a Saturday or a Sunday.",
  rationale: "A posting made outside the normal working week was made outside the controls that normally surround it.",
  settings: { dateBasis: "journal" },
  matchedEntries: 3,
  matchedLines: 7,
  ...patch,
});

const line = (patch: Partial<JeSelectedLine> = {}): JeSelectedLine => ({
  jeNumber: "OD-2026-0114",
  lineNo: 2,
  journalCode: "OD",
  journalDate: "2026-12-27",
  entryDate: "2026-12-28",
  account: "701100",
  accountName: "Ventes de marchandises",
  description: "Divers",
  debit: 0,
  credit: 12_000_000,
  signed: -12_000_000,
  preparer: "A. Mbarga",
  reviewer: "A. Mbarga",
  approver: null,
  reference: null,
  thirdPartyName: null,
  costCenter: null,
  entryLines: 4,
  entryGrossValue: 24_000_000,
  reasons: [
    { label: "Posted on a weekend", detail: "journal date 2026-12-27: a Sunday" },
    { label: "Preparer and reviewer are the same person", detail: "A. Mbarga both recorded and reviewed this line" },
  ],
  ...patch,
});

const view = (patch: Partial<JeView> = {}): JeView => ({
  locale: "en",
  clientName: "ELIMELEC",
  fiscalYear: 2026,
  periodEnd: "2026-12-31",
  preparer: "A. Preparer",
  reviewer: "B. Reviewer",
  partner: "C. Partner",
  dateBasis: "journal",
  ledger: {
    sourceFilename: "grand-livre-2026.xlsx",
    timing: "post_audit",
    datasetRows: 48_120,
    lines: 47_988,
    entries: 9_412,
    datedLines: 47_988,
  },
  populationChecks: [
    { key: "mandatory-mapped", label: "Mandatory fields mapped", status: "passed", detail: "Account, JE number, description, journal date and amount are all mapped." },
    { key: "entries-balanced", label: "Entries balance", status: "warning", detail: "2 entries do not balance." },
  ],
  criteria: [criterion()],
  selectedEntries: 3,
  selectedLines: 4,
  lines: [line()],
  exceptions: [],
  notes: [
    "Selection is risk-directed, not random. International Audit Methodology 321.03 and ISA 240 rule out a random sample of 25 entries for journal-entry testing.",
  ],
  ceilingHit: false,
  truncated: false,
  ...patch,
});

const read = async (buffer: Buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
};

const textOf = (wb: ExcelJS.Workbook, sheet: string): string =>
  JSON.stringify(wb.getWorksheet(sheet)!.getSheetValues());

/* ------------------------------- parameters ------------------------------- */

describe("formatSettings", () => {
  it("keeps the engine's own parameter names, so a run can be reproduced", () => {
    expect(formatSettings({ roundMin: 100000, roundStep: 100000 }))
      .toBe("roundMin = 100000   ·   roundStep = 100000");
  });

  it("cuts a long list rather than filling the column with filler terms", () => {
    const terms = Array.from({ length: 20 }, (_, i) => `t${i}`);
    const shown = formatSettings({ uninformativeTerms: terms });
    expect(shown).toContain("t0, t1, t2, t3, t4, t5");
    expect(shown).toContain("(+14)");
    expect(shown).not.toContain("t19");
  });
});

/* --------------------------------- the file -------------------------------- */

describe("buildJeWorkbook", () => {
  it("puts the population in front of the selection", async () => {
    const wb = await read(await buildJeWorkbook(view()));
    expect(wb.worksheets.map((w) => w.name)).toEqual(TABS);
  });

  it("freezes panes on every tab, including the Cover", async () => {
    const wb = await read(await buildJeWorkbook(view()));
    for (const name of TABS) {
      const v = wb.getWorksheet(name)!.views[0] as { state?: string; ySplit?: number };
      expect(v.state, name).toBe("frozen");
      expect(v.ySplit ?? 0, name).toBeGreaterThan(0);
    }
  });

  // Excel repairs a workbook whose XML breaks the schema, and a repair drops the
  // sheet's contents. Both rules below are cheap to assert and expensive to
  // rediscover.
  it("writes no formula with a leading '=', which Excel treats as damage", async () => {
    const wb = await read(await buildJeWorkbook(view()));
    let checked = 0;
    for (const ws of wb.worksheets) {
      ws.eachRow((r) => r.eachCell((cell) => {
        const f = (cell.value as { formula?: string } | null)?.formula;
        if (typeof f === "string") {
          checked += 1;
          expect(f.startsWith("="), `${ws.name}!${cell.address} = ${f}`).toBe(false);
        }
      }));
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("declares the column outline level every sheet actually uses", async () => {
    const wb = await read(await buildJeWorkbook(view()));
    for (const ws of wb.worksheets) {
      const deepest = Math.max(
        0,
        ...Array.from({ length: 30 }, (_, i) => ws.getColumn(i + 1).outlineLevel ?? 0),
      );
      expect(ws.properties.outlineLevelCol ?? 0, ws.name).toBe(deepest);
    }
  });

  it("types engagement identity once and reads it everywhere else by formula", async () => {
    const wb = await read(await buildJeWorkbook(view()));
    expect(wb.getWorksheet("Cover")!.getCell("D4").value).toBe("ELIMELEC");
    for (const name of TABS.slice(1)) {
      const cell = wb.getWorksheet(name)!.getCell("A3").value as { formula?: string };
      expect(cell?.formula, name).toContain("Cover!$D$4");
    }
  });

  it("sets every ordinary cell at 10pt", async () => {
    const wb = await read(await buildJeWorkbook(view()));
    const sizes = new Set<number>();
    for (const ws of wb.worksheets) {
      ws.eachRow((row) => row.eachCell((cell) => { if (cell.font?.size) sizes.add(cell.font.size); }));
    }
    expect([...sizes].sort((a, b) => a - b)).toEqual([10, 13]);
  });

  /* ------------------------------ the method ------------------------------ */

  it("states that a random sample of a fixed number of entries is not the method", async () => {
    const wb = await read(await buildJeWorkbook(view()));
    const cover = textOf(wb, "Cover");
    expect(cover).toContain("The selection is directed by risk");
    expect(cover).toContain("is not appropriate for journal entry testing");
    expect(cover).toContain("IAM 321.03");
    // and the criteria tab refuses the other half of the same mistake
    expect(textOf(wb, "Criteria")).toContain("never because a number of items had to be reached");
  });

  it("carries the four unpredictability levers and the four controls on the Cover", async () => {
    const cover = textOf(await read(await buildJeWorkbook(view())), "Cover");
    for (const lever of [
      "Amounts and types of entry selected",
      "Timing of the testing",
      "Locations or organisational units selected",
      "Extent of the procedures",
    ]) expect(cover, lever).toContain(lever);
    for (const control of [
      "Segregation of duties over authorising, posting, reviewing and reconciling",
      "Access rights over who may record and who may approve",
      "Oversight by management or internal audit, including post-entry review",
      "Regular testing of those controls by internal audit",
    ]) expect(cover, control).toContain(control);
  });

  it("asks for the likelihood of override and the partner's approval of the strategy", async () => {
    const cover = textOf(await read(await buildJeWorkbook(view())), "Cover");
    expect(cover).toContain("Likelihood of override assessed as");
    expect(cover).toContain("Partner approval of the strategy");
    expect(cover).toContain("formalised review of the procedures");
  });

  /* ---------------------------- the population ---------------------------- */

  it("records the ledger relied on and treats the entry population as IPE", async () => {
    const wb = await read(await buildJeWorkbook(view()));
    const text = textOf(wb, "Population");
    expect(text).toContain("information produced by the entity");
    expect(text).toContain("Completeness");
    expect(text).toContain("Accuracy");
    expect(text).toContain("grand-livre-2026.xlsx");
    expect(text).toContain("Mandatory fields mapped");
    expect(text).toContain("Entries balance");
    // and it keeps room for the work only the auditor can do
    expect(text).toContain("Completeness — procedure performed and evidence retained");
    expect(text).toContain("Extract parameters");
  });

  it("says plainly when no ledger is registered instead of showing an empty population", async () => {
    const wb = await read(await buildJeWorkbook(view({ ledger: null, populationChecks: [], criteria: [], lines: [] })));
    expect(textOf(wb, "Population")).toContain("No journal entry dataset is registered");
    expect(textOf(wb, "Selection")).toContain("No item has been selected");
  });

  /* ------------------------------ the criteria ---------------------------- */

  it("gives each criterion its parameters, its reason and its coverage", async () => {
    const wb = await read(await buildJeWorkbook(view({
      criteria: [
        criterion(),
        criterion({
          key: "round-amount",
          name: "Round-number amount",
          settings: { roundMin: 100000, roundStep: 100000 },
          matchedEntries: 11,
          matchedLines: 14,
        }),
      ],
    })));
    const text = textOf(wb, "Criteria");
    expect(text).toContain("weekend-posting");
    expect(text).toContain("round-amount");
    expect(text).toContain("roundMin = 100000");
    expect(text).toContain("outside the controls that normally surround it");
    expect(text).toContain("Why on this engagement");
    expect(text).toContain("Criteria considered and not applied");
    // the criterion that found nothing is still a documented answer
    expect(text).toContain("Out-of-hours posting is not offered as a criterion");
  });

  /* ----------------------------- the selection ---------------------------- */

  it("carries every reason a line was selected, on the line itself", async () => {
    const wb = await read(await buildJeWorkbook(view()));
    const text = textOf(wb, "Selection");
    expect(text).toContain("OD-2026-0114");
    expect(text).toContain("journal date 2026-12-27: a Sunday");
    expect(text).toContain("A. Mbarga both recorded and reviewed this line");
  });

  it("opens the four ISA 240 tests as drop-down columns and computes the outcome", async () => {
    const wb = await read(await buildJeWorkbook(view()));
    const sheet = wb.getWorksheet("Selection")!;
    const text = JSON.stringify(sheet.getSheetValues());
    expect(text).toContain("Legend:");
    expect(text).toContain("Rationale");
    expect(text).toContain("Author.");
    expect(text).toContain("Account.");
    expect(text).toContain("Period");

    let listed = 0;
    let formula: string | undefined;
    sheet.eachRow((r) => r.eachCell((cell) => {
      const dv = cell.dataValidation as { formulae?: string[] } | undefined;
      if (dv?.formulae?.[0]?.includes("✓")) listed += 1;
      const v = cell.value as { formula?: string } | null;
      if (v?.formula?.startsWith("IF(COUNTIF(")) formula = v.formula;
    }));
    expect(listed).toBeGreaterThanOrEqual(4);
    expect(formula).toContain('"✗"');
    expect(formula).toContain("COUNTBLANK");
  });

  it("colours the four tests and the outcome by conditional formatting", async () => {
    const wb = await read(await buildJeWorkbook(view()));
    const cf = (wb.getWorksheet("Selection") as unknown as {
      conditionalFormattings: { rules: { formulae?: string[] }[] }[];
    }).conditionalFormattings;
    const formulae = cf.flatMap((f) => f.rules.flatMap((r) => r.formulae ?? []));
    expect(formulae).toContain('"✓"');
    expect(formulae).toContain('"✗"');
    expect(formulae).toContain('"Clean"');
    expect(formulae).toContain('"Exception"');
  });

  it("warns rather than implies coverage when the page is cut short", async () => {
    const wb = await read(await buildJeWorkbook(view({ truncated: true })));
    expect(textOf(wb, "Selection")).toContain("first page of the selection");
    expect(textOf(wb, "Cover")).toContain("More lines were selected than this file lists");
  });

  it("puts the engine's own notes on the Cover", async () => {
    const wb = await read(await buildJeWorkbook(view({
      ceilingHit: true,
      notes: ["The criteria flagged at least 20000 lines, the ceiling this engine reasons about."],
    })));
    expect(textOf(wb, "Cover")).toContain("the ceiling this engine reasons about");
  });

  /* ----------------------------- the exceptions --------------------------- */

  it("states the position plainly when nothing failed a test", async () => {
    const wb = await read(await buildJeWorkbook(view()));
    expect(textOf(wb, "Exceptions")).toContain("No item selected failed any of the four tests");
    expect(textOf(wb, "Cover")).toContain("No exception");
  });

  it("leaves the fraud judgement blank when nobody has made it", async () => {
    const wb = await read(await buildJeWorkbook(view({
      exceptions: [{
        ref: "EXC-1",
        jeNumber: "OD-2026-0114",
        lineNo: 2,
        criteria: "Posted on a weekend",
        what: "No supporting document could be produced.",
        amount: -12_000_000,
        fraudIndication: null,
        misstatement: "",
        implication: "",
        resolution: "",
        communicated: "",
      }],
    })));
    const values = wb.getWorksheet("Exceptions")!.getSheetValues();
    const row = values.find((r) => Array.isArray(r) && (r as unknown[]).includes("EXC-1")) as unknown[];
    expect(row[7] ?? "").toBe("");
    expect(textOf(wb, "Cover")).toContain("Exceptions");
    expect(textOf(wb, "Exceptions")).toContain("reliability of management's representations");
  });

  /* -------------------------------- French -------------------------------- */

  it("builds the same paper in French, including the method statement", async () => {
    const wb = await read(await buildJeWorkbook(view({ locale: "fr" })));
    expect(wb.worksheets.map((w) => w.name)).toEqual(TABS);
    const cover = textOf(wb, "Cover");
    expect(cover).toContain("Écritures comptables et autres ajustements");
    expect(cover).toContain("n'est pas appropriée pour le test des écritures");
    expect(cover).toContain("Imprévisibilité");
    expect(textOf(wb, "Population")).toContain("information produite par l'entité");
    expect(textOf(wb, "Selection")).toContain("Motif de sélection de cet élément");
  });

  /* ------------------------------ the template ----------------------------- */

  it("ships a blank template that asserts nothing", async () => {
    const template = blankJeTemplate();
    expect(template.ledger).toBeNull();
    expect(template.exceptions).toEqual([]);
    const wb = await read(await buildJeWorkbook(template));
    expect(wb.worksheets.map((w) => w.name)).toEqual(TABS);
    expect(wb.getWorksheet("Cover")!.getCell("D4").value).toBe("");
    expect(textOf(wb, "Population")).toContain("No journal entry dataset is registered");
    // twenty selection rows waiting, and no criterion claimed
    const rows = wb.getWorksheet("Selection")!.rowCount;
    expect(rows).toBeGreaterThan(20);
  });
});
