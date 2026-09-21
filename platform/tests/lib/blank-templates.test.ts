import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { blankFsChecklistTemplate, buildFsChecklistWorkbook } from "@/lib/fs-checklist-workbook";
import { blankItgcTemplate, buildItgcWorkbook } from "@/lib/itgc-workbook";
import { blankJeTemplate, buildJeWorkbook } from "@/lib/je-workbook";
import { blankTocTemplate, buildTocWorkbook } from "@/lib/toc-workbook";

// The blank papers on the Sample working papers shelf are what somebody takes a
// copy of before starting. They carry no client data, which is the point — but
// they were being generated from a view with no controls at all, and the builder
// dutifully rendered the nothing it was given: a title reading "C-1  ·    ·    ·",
// an em-dash in every field, "Frequency not recognised — record it on S2.2" where
// the sample size belongs, and a grid whose Result formula spanned one column, so
// anything ticked in the other three was silently ignored.
//
// A blank paper has to be a paper. These hold the parts of that which are easy to
// lose again: room to work, no diagnostics aimed at data that was never entered,
// and a Result that covers the columns the paper offers.

async function load(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb;
}

/** Everything written on a sheet, formulas as text, for a plain-text search. */
function textOf(ws: ExcelJS.Worksheet): string {
  const parts: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      parts.push(
        typeof v === "object" && v !== null && "formula" in v
          ? `=${(v as ExcelJS.CellFormulaValue).formula}`
          : String(v ?? ""),
      );
    });
  });
  return parts.join("\n");
}

describe("the blank tests-of-controls paper", () => {
  it("opens as a paper with room to work, not an empty shell", async () => {
    const wb = await load(await buildTocWorkbook(blankTocTemplate()));
    const tests = wb.getWorksheet("Tests")!;
    const text = textOf(tests);

    // More than one control block, each with attribute slots and a grid.
    expect(text).toContain("C-1");
    expect(text).toContain("C-2");
    expect(tests.rowCount).toBeGreaterThan(80);
  });

  it("says nothing is wrong with data nobody has entered", async () => {
    const text = textOf((await load(await buildTocWorkbook(blankTocTemplate()))).getWorksheet("Tests")!);
    // Diagnostics belong on a real control that is missing something, never on
    // a blank form: on a template they read as a fault in the template.
    expect(text).not.toContain("Frequency not recognised");
    expect(text).not.toContain("Population required");
    // And a title with nothing in it must not print its separators.
    expect(text).not.toMatch(/·\s+·/);
  });

  it("gives Result a span that covers the attribute columns it offers", async () => {
    const tests = (await load(await buildTocWorkbook(blankTocTemplate()))).getWorksheet("Tests")!;
    const formulas: string[] = [];
    tests.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value;
        if (typeof v === "object" && v !== null && "formula" in v) {
          const f = (v as ExcelJS.CellFormulaValue).formula;
          if (f.startsWith("IF(COUNTIF(")) formulas.push(f);
        }
      });
    });
    expect(formulas.length).toBeGreaterThan(0);
    // A single-column span means three of the four attribute columns the paper
    // offers would be ticked and counted for nothing.
    for (const f of formulas) {
      const [, from, to] = /COUNTIF\(([A-Z]+)\d+:([A-Z]+)\d+/.exec(f) ?? [];
      expect(from, f).toBeTruthy();
      expect(to, f).not.toBe(from);
    }
  });
});

describe("the blank ITGC paper", () => {
  it("references each domain's blocks with that domain's own code", async () => {
    const wb = await load(await buildItgcWorkbook(blankItgcTemplate()));
    // "IT Operations".slice(0, 3) is "IT ", which produced blocks called "IT -1".
    for (const [sheet, code] of [
      ["Changes", "CHG"], ["Access", "ACC"], ["IT Operations", "OPS"], ["Support", "SUP"],
    ] as const) {
      const text = textOf(wb.getWorksheet(sheet)!);
      expect(text, sheet).toContain(`${code}-1`);
      expect(text, sheet).not.toMatch(/\b[A-Z]{1,2} -\d/);
    }
  });

  it("opens every domain tab as a paper with room to work", async () => {
    const wb = await load(await buildItgcWorkbook(blankItgcTemplate()));
    for (const sheet of ["Changes", "Access", "IT Operations", "Support"]) {
      const ws = wb.getWorksheet(sheet)!;
      expect(textOf(ws), sheet).not.toMatch(/·\s+·/);
      expect(ws.rowCount, sheet).toBeGreaterThan(30);
    }
  });
});

describe("every blank paper", () => {
  const PAPERS = [
    ["E1.1 ITGC", () => buildItgcWorkbook(blankItgcTemplate())],
    ["E1.2 tests of controls", () => buildTocWorkbook(blankTocTemplate())],
    ["E3.1 journal entries", () => buildJeWorkbook(blankJeTemplate())],
    ["E6.10 OHADA financial statement checklist", () => buildFsChecklistWorkbook(blankFsChecklistTemplate())],
  ] as const;

  for (const [name, build] of PAPERS) {
    it(`${name}: every tab carries its headings`, async () => {
      const wb = await load(await build());
      for (const ws of wb.worksheets) {
        // A tab with only the identity band is a tab that reads as blank.
        expect(ws.rowCount, `${name} / ${ws.name}`).toBeGreaterThan(5);
      }
    });
  }
});
