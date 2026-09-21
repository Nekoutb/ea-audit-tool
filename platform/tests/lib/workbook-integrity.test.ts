import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { blankFsChecklistTemplate, buildFsChecklistWorkbook } from "@/lib/fs-checklist-workbook";
import { blankItgcTemplate, buildItgcWorkbook } from "@/lib/itgc-workbook";
import { blankJeTemplate, buildJeWorkbook } from "@/lib/je-workbook";
import { blankTocTemplate, buildTocWorkbook } from "@/lib/toc-workbook";

// Two defects in a generated workbook make Excel declare the file damaged,
// repair it on open and drop a sheet's contents without saying which — so the
// auditor sees an empty tab and no error. Both have shipped before: an E1.2
// workbook went out with every cross-sheet formula carrying a leading "=", and
// the Tests tab came back blank.
//
// The per-workbook suites check what their own builder writes. This one holds
// the two rules that are true of every workbook the product will ever generate,
// so a new builder inherits the cover rather than having to remember it. Add
// each new builder to the list below.
const WORKBOOKS = [
  ["E1.1 ITGC", () => buildItgcWorkbook(blankItgcTemplate())],
  ["E1.2 tests of controls", () => buildTocWorkbook(blankTocTemplate())],
  ["E3.1 journal entries", () => buildJeWorkbook(blankJeTemplate())],
  ["E6.10 OHADA financial statement checklist", () => buildFsChecklistWorkbook(blankFsChecklistTemplate())],
] as const;

describe("every generated workbook opens undamaged", () => {
  for (const [name, build] of WORKBOOKS) {
    it(`${name}: no formula carries a leading "=" and outlined columns declare their level`, async () => {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load((await build()) as unknown as ArrayBuffer);
      expect(wb.worksheets.length).toBeGreaterThan(0);

      wb.eachSheet((ws) => {
        ws.eachRow({ includeEmpty: false }, (row) => {
          row.eachCell({ includeEmpty: false }, (cell) => {
            // The <f> element holds the formula BODY. A leading "=" is not part
            // of it, and Excel treats a file carrying one as damaged.
            const formula = (cell.value as { formula?: string } | null)?.formula;
            if (typeof formula === "string") {
              expect(
                formula.startsWith("="),
                `${name} · ${ws.name}!${cell.address} · ${formula}`,
              ).toBe(false);
            }
          });
        });

        // A column grouped into an outline without properties.outlineLevelCol
        // is the other way a sheet reads as damaged.
        const grouped = ws.columns?.some((column) => (column?.outlineLevel ?? 0) > 0);
        if (grouped) {
          expect(ws.properties.outlineLevelCol, `${name} · ${ws.name}`).toBeGreaterThan(0);
        }
      });
    });
  }
});
