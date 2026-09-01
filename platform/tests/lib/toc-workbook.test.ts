import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { tocEvaluate, tocSuggested } from "@/lib/toc-sampling";
import {
  buildTocWorkbook,
  evaluateControl,
  isSoleControl,
  type TocControl,
  type TocView,
} from "@/lib/toc-workbook";

const size = (...args: Parameters<typeof tocSuggested>) => {
  const s = tocSuggested(...args);
  return s && "size" in s ? s.size : null;
};

/* ------------------------- the paper's sample table ------------------------ */

describe("tocSuggested — SAMPLE 3.3 table", () => {
  it("takes 25 for a high-volume daily control, and 60 when it is the sole control", () => {
    expect(size("manual", "daily", 3610, false, false)).toBe(25);
    expect(size("manual", "daily", 3610, true, false)).toBe(60);
  });

  it("applies the occurrence rule to a low-volume daily control", () => {
    expect(size("manual", "daily", 250, false, false)).toBe(25);
    expect(size("manual", "daily", 120, false, false)).toBe(12);
    expect(size("manual", "daily", 49, false, false)).toBe(5);
    expect(size("manual", "daily", 4, false, false)).toBe(4);
  });

  it("gives a test of one to an automated control only", () => {
    expect(size("automated", null, null, false, false)).toBe(1);
  });

  it("tests an IT-DEPENDENT manual control on its frequency, not as a test of one", () => {
    // A person still performs it; the report it leans on is tested as IPE.
    expect(size("it_dependent", "daily", 3610, false, false)).toBe(25);
    expect(size("it_dependent", "monthly", 12, false, false)).toBe(2);
  });

  it("asks for the population before sizing a daily plan", () => {
    expect(tocSuggested("manual", "daily", null, false, false)).toEqual({ needPopulation: true });
  });
});

describe("tocEvaluate — approved deviation rule", () => {
  it("relies on a clean 25, extends on one, refuses on two", () => {
    expect(tocEvaluate(25, 25, 0)).toBe("rely");
    expect(tocEvaluate(25, 25, 1)).toBe("extend");
    expect(tocEvaluate(25, 25, 2)).toBe("none");
  });

  it("re-judges an extended test on the 60 rule", () => {
    expect(tocEvaluate(25, 60, 1)).toBe("moderate");
    expect(tocEvaluate(25, 60, 0)).toBe("high");
    expect(tocEvaluate(25, 60, 2)).toBe("none");
  });

  it("treats any deviation on a small plan as fatal to reliance", () => {
    for (const plan of [1, 2, 5, 12]) {
      expect(tocEvaluate(plan, plan, 0)).toBe("rely");
      expect(tocEvaluate(plan, plan, 1)).toBe("none");
    }
  });
});

/* ----------------------------- control results ---------------------------- */

const control = (patch: Partial<TocControl> = {}): TocControl => ({
  ref: "C-1",
  scot: "Revenue",
  wcgws: ["Invoice differs from dispatch"],
  assertions: ["Accuracy"],
  name: "Three-way match",
  description: null,
  owner: "Invoicing clerk",
  controlType: "it_dependent",
  frequency: "daily",
  population: 3610,
  soleControl: false,
  itgcEffective: true,
  attributes: ["A1", "A2"],
  rows: [],
  operatingEval: null,
  testDesign: null,
  rotation: null,
  ...patch,
});

const row = (results: Record<string, "pass" | "fail" | "na" | "">) => ({
  ref: "FAC-1", date: "2025-01-01", desc: "Client", results,
});

describe("evaluateControl", () => {
  it("counts a row with any failed attribute as one deviation, not one per attribute", () => {
    const result = evaluateControl(control({
      rows: [row({ A1: "fail", A2: "fail" }), row({ A1: "pass", A2: "pass" })],
    }));
    expect(result.deviations).toBe(1);
    expect(result.tested).toBe(2);
  });

  it("never reads an unanswered attribute cell as a pass", () => {
    const result = evaluateControl(control({ rows: [row({ A1: "pass", A2: "" })] }));
    expect(result.unanswered).toBe(1);
    expect(result.deviations).toBe(0);
  });

  it("flags a sample short of its plan", () => {
    expect(evaluateControl(control({ rows: [row({ A1: "pass", A2: "pass" })] })).shortOfPlan).toBe(true);
  });

  it("reports the ITGC problem instead of inventing a sample size", () => {
    const result = evaluateControl(control({ controlType: "automated", frequency: "automated", itgcEffective: false }));
    expect(result.planProblem).toBe("itgc-not-effective");
    expect(result.planSize).toBeNull();
  });

  it("asks for a population rather than sizing a daily plan without one", () => {
    const result = evaluateControl(control({ population: null }));
    expect(result.planProblem).toBe("need-population");
    expect(result.planSize).toBeNull();
  });

  it("leaves reliance unresolved until something has been tested", () => {
    expect(evaluateControl(control()).reliance).toBeNull();
  });
});

/* --------------------------------- loader --------------------------------- */

describe("isSoleControl", () => {
  const mk = (id: string, wcgwIds: string[], selected = true) =>
    ({ id, wcgwIds, selectedForTesting: selected } as Parameters<typeof isSoleControl>[0]);

  it("is sole when no other selected control shares a WCGW", () => {
    const c = mk("a", ["w1"]);
    expect(isSoleControl(c, [c, mk("b", ["w2"])])).toBe(true);
  });

  it("is not sole when a sibling answers the same WCGW", () => {
    const c = mk("a", ["w1"]);
    expect(isSoleControl(c, [c, mk("b", ["w1"])])).toBe(false);
  });

  it("ignores siblings that were not selected for testing", () => {
    const c = mk("a", ["w1"]);
    expect(isSoleControl(c, [c, mk("b", ["w1"], false)])).toBe(true);
  });
});

/* -------------------------------- workbook -------------------------------- */

const view = (patch: Partial<TocView> = {}): TocView => ({
  clientName: "ELIMELEC",
  fiscalYear: 2025,
  periodEnd: "2025-12-31",
  periodOfReliance: "01 Jan – 31 Dec 2025",
  preparer: "A. Preparer",
  reviewer: "B. Reviewer",
  partner: "C. Partner",
  controls: [control({ rows: [row({ A1: "pass", A2: "pass" })] })],
  exceptions: [],
  ...patch,
});

const read = async (buffer: Buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
};

describe("buildTocWorkbook", () => {
  it("leads with the Cover, then IPE, and carries no board", async () => {
    const wb = await read(await buildTocWorkbook(view()));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Cover", "IPE", "Tests", "Exceptions"]);
  });

  it("freezes panes on every tab, including the Cover", async () => {
    const wb = await read(await buildTocWorkbook(view()));
    for (const name of ["Cover", "IPE", "Tests", "Exceptions"]) {
      const v = wb.getWorksheet(name)!.views[0] as { state?: string; ySplit?: number };
      expect(v.state, name).toBe("frozen");
      expect(v.ySplit ?? 0, name).toBeGreaterThan(0);
    }
  });

  // Excel repairs a workbook whose XML breaks the schema, and a repair drops
  // the sheet's contents. Both rules below were broken once and emptied the
  // Tests tab; they are cheap to assert and expensive to rediscover.
  it("writes no formula with a leading '=', which Excel treats as damage", async () => {
    const buffer = await buildTocWorkbook(view({
      controls: [control({ rows: [row({ A1: "pass", A2: "pass" })] })],
    }));
    const wb = await read(buffer);
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

  it("declares the column outline level it actually uses", async () => {
    const wb = await read(await buildTocWorkbook(view({
      controls: [control({ attributes: ["one", "two"], rows: [row({ one: "pass", two: "pass" })] })],
    })));
    const sheet = wb.getWorksheet("Tests")!;
    const deepest = Math.max(
      0,
      ...Array.from({ length: 20 }, (_, i) => sheet.getColumn(i + 1).outlineLevel ?? 0),
    );
    expect(sheet.properties.outlineLevelCol ?? 0).toBe(deepest);
  });

  it("types engagement identity once and reads it everywhere else by formula", async () => {
    const wb = await read(await buildTocWorkbook(view()));
    // The Readme block on the Cover holds the literal value…
    expect(wb.getWorksheet("Cover")!.getCell("D4").value).toBe("ELIMELEC");
    // …and other tabs point at it rather than repeating it.
    for (const name of ["IPE", "Tests", "Exceptions"]) {
      const cell = wb.getWorksheet(name)!.getCell("A3").value as { formula?: string };
      expect(cell?.formula, name).toContain("Cover!$D$4");
    }
  });

  it("drops the requirements, the glossary and the reviewer's checklist", async () => {
    const wb = await read(await buildTocWorkbook(view()));
    const text = JSON.stringify(wb.getWorksheet("Cover")!.getSheetValues());
    expect(text).not.toContain("what could go wrong");
    expect(text).not.toContain("discovery sampling");
    expect(text).not.toContain("Requirements");
    expect(text).not.toContain("checklist");
    expect(text).not.toContain("No conclusion rests on inquiry alone");
  });

  it("sets every ordinary cell at 10pt", async () => {
    const wb = await read(await buildTocWorkbook(view()));
    const sizes = new Set<number>();
    for (const ws of wb.worksheets) {
      ws.eachRow((row) => row.eachCell((cell) => { if (cell.font?.size) sizes.add(cell.font.size); }));
    }
    // 10 for the body; 13 only for the tab titles.
    expect([...sizes].sort((a, b) => a - b)).toEqual([10, 13]);
  });

  it("concludes Effective only when no control is not-effective", async () => {
    const clean = await read(await buildTocWorkbook(view({
      controls: [control({ operatingEval: "effective", rows: [row({ A1: "pass", A2: "pass" })] })],
    })));
    const coverText = JSON.stringify(clean.getWorksheet("Cover")!.getSheetValues());
    expect(coverText).toContain("Effective");
    expect(coverText).not.toContain("Revised");

    const failed = await read(await buildTocWorkbook(view({
      controls: [control({ operatingEval: "not_effective", rows: [row({ A1: "fail", A2: "pass" })] })],
    })));
    expect(JSON.stringify(failed.getWorksheet("Cover")!.getSheetValues())).toContain("Revised");
  });

  it("gives each control its own working paper carrying its plan basis", async () => {
    const wb = await read(await buildTocWorkbook(view({
      controls: [
        control({ ref: "C-1", rows: [row({ A1: "pass", A2: "pass" })] }),
        control({ ref: "C-2", scot: "Purchases", frequency: "annually", population: 1, rows: [row({ A1: "pass", A2: "pass" })] }),
      ],
    })));
    const text = JSON.stringify(wb.getWorksheet("Tests")!.getSheetValues());
    expect(text).toContain("C-1");
    expect(text).toContain("C-2");
    expect(text).toContain("Daily, population > 250");
    expect(text).toContain("minimum 1");
    // and the Cover keeps a one-line index of them
    expect(JSON.stringify(wb.getWorksheet("Cover")!.getSheetValues())).toContain("Controls tested");
  });

  it("says so on the working paper when an automated control has no ITGC support", async () => {
    const wb = await read(await buildTocWorkbook(view({
      controls: [control({ controlType: "automated", frequency: "automated", itgcEffective: false, rows: [] })],
    })));
    expect(JSON.stringify(wb.getWorksheet("Tests")!.getSheetValues())).toContain("ITGC not effective");
  });

  it("collapses spare attribute columns so Excel draws a + to reveal the next one", async () => {
    const wb = await read(await buildTocWorkbook(view({
      controls: [control({ attributes: ["A1 desc", "A2 desc"], rows: [row({ "A1 desc": "pass", "A2 desc": "pass" })] })],
    })));
    const sheet = wb.getWorksheet("Tests")!;
    // two attributes in use → columns F and G stay open, H onwards are grouped
    expect(sheet.getColumn(6).outlineLevel ?? 0).toBe(0);
    expect(sheet.getColumn(7).outlineLevel ?? 0).toBe(0);
    expect(sheet.getColumn(8).outlineLevel).toBe(1);
    expect(sheet.getColumn(8).hidden).toBe(true);
    expect(JSON.stringify(sheet.getSheetValues())).toContain("click the +");
  });

  it("offers a described row and a live column for an attribute not yet used", async () => {
    const wb = await read(await buildTocWorkbook(view({
      controls: [control({ attributes: ["A1 desc"], rows: [row({ "A1 desc": "pass" })] })],
    })));
    const sheet = wb.getWorksheet("Tests")!;
    const text = JSON.stringify(sheet.getSheetValues());
    expect(text).toContain("describe a new attribute here");
    // the grid row still carries a drop-down on the spare columns
    let spareWithList = 0;
    sheet.eachRow((r) => {
      const cell = r.getCell(8);
      const dv = cell.dataValidation as { formulae?: string[] } | undefined;
      if (dv?.formulae?.[0]?.includes("✓")) spareWithList += 1;
    });
    expect(spareWithList).toBeGreaterThan(0);
  });

  it("records rotation on the control's own paper now that the board is gone", async () => {
    const wb = await read(await buildTocWorkbook(view({
      controls: [control({
        rows: [row({ A1: "pass", A2: "pass" })],
        rotation: {
          lastTested: "FY 2024", effectiveThen: true, environmentSound: true,
          understandingReconfirmed: true, noRelevantChange: true, withinThreeAudits: true, eligibleByType: true,
        },
      })],
    })));
    const text = JSON.stringify(wb.getWorksheet("Tests")!.getSheetValues());
    expect(text).toContain("Rotation — prior-period reliance");
    expect(text).toContain("FY 2024");
  });

  it("explains what IPE means and what completeness and accuracy require", async () => {
    const wb = await read(await buildTocWorkbook(view()));
    const text = JSON.stringify(wb.getWorksheet("IPE")!.getSheetValues());
    expect(text).toContain("Information Produced by the Entity");
    expect(text).toContain("Completeness");
    expect(text).toContain("Accuracy");
    // the old pointer to the Cover is gone now that the Cover comes first
    expect(text).not.toContain("Why this tab comes first");
    expect(text).not.toContain("flow through this file");
  });

  it("leaves a judgement the tool has not captured as an empty cell", async () => {
    const wb = await read(await buildTocWorkbook(view({
      controls: [control({ operatingEval: "effective", rows: [row({ A1: "fail", A2: "pass" })] })],
      exceptions: [{
        ref: "EXC-1", controlRef: "C-1", item: "FAC-25-0641", cause: "Manager absent",
        implication: "", decision: "", deficiency: null, significant: null,
        s31Effect: "", communicated: "",
      }],
    })));
    const values = wb.getWorksheet("Exceptions")!.getSheetValues();
    const excRow = values.find((r) => Array.isArray(r) && (r as unknown[]).includes("EXC-1")) as unknown[];
    // deficiency (7) and significant (8) must be blank, not "No"
    expect(excRow[7] ?? "").toBe("");
    expect(excRow[8] ?? "").toBe("");
  });

  it("states the position plainly when nothing deviated", async () => {
    const wb = await read(await buildTocWorkbook(view()));
    expect(JSON.stringify(wb.getWorksheet("Exceptions")!.getSheetValues()))
      .toContain("No deviation was found");
  });

  it("marks a result cell unresolved when an attribute was left blank", async () => {
    const wb = await read(await buildTocWorkbook(view({
      controls: [control({ rows: [row({ A1: "pass", A2: "" })] })],
    })));
    const text = JSON.stringify(wb.getWorksheet("Tests")!.getSheetValues());
    expect(text).toContain("unanswered attribute cell");
  });

  it("writes tick and cross glyphs, with a legend and a drop-down on each cell", async () => {
    const wb = await read(await buildTocWorkbook(view({
      controls: [control({ rows: [row({ A1: "pass", A2: "fail" })] })],
    })));
    const sheet = wb.getWorksheet("Tests")!;
    const text = JSON.stringify(sheet.getSheetValues());
    expect(text).toContain("✓");
    expect(text).toContain("✗");
    expect(text).toContain("Legend:");
    // the glyph cells offer the list, so nobody types a stray character
    let listed = 0;
    sheet.eachRow((r) => r.eachCell((cell) => {
      const dv = cell.dataValidation as { formulae?: string[] } | undefined;
      if (dv?.formulae?.[0]?.includes("✓")) listed += 1;
    }));
    expect(listed).toBeGreaterThan(0);
  });

  it("computes Result with a live formula, not a frozen value", async () => {
    const wb = await read(await buildTocWorkbook(view({
      controls: [control({ rows: [row({ A1: "pass", A2: "fail" })] })],
    })));
    const sheet = wb.getWorksheet("Tests")!;
    let formula: string | undefined;
    sheet.eachRow((r) => r.eachCell((cell) => {
      const v = cell.value as { formula?: string } | null;
      if (v?.formula?.startsWith("IF(COUNTIF(")) formula = v.formula;
    }));
    expect(formula).toBeDefined();
    expect(formula).toContain('"✗"');
    expect(formula).toContain("COUNTBLANK");
  });

  it("colours pass green and fail red by conditional formatting", async () => {
    const wb = await read(await buildTocWorkbook(view({
      controls: [control({ rows: [row({ A1: "pass", A2: "fail" })] })],
    })));
    const cf = (wb.getWorksheet("Tests") as unknown as { conditionalFormattings: { rules: { formulae?: string[] }[] }[] }).conditionalFormattings;
    const formulae = cf.flatMap((f) => f.rules.flatMap((r) => r.formulae ?? []));
    expect(formulae).toContain('"✓"');
    expect(formulae).toContain('"✗"');
    expect(formulae).toContain('"Pass"');
    expect(formulae).toContain('"Fail"');
  });

  it("gives each attribute its own described row instead of one crushed line", async () => {
    const wb = await read(await buildTocWorkbook(view({
      controls: [control({
        attributes: ["Invoice quantity agrees to the dispatch note", "Price agrees to the approved order"],
        rows: [row({ "Invoice quantity agrees to the dispatch note": "pass", "Price agrees to the approved order": "pass" })],
      })],
    })));
    const values = wb.getWorksheet("Tests")!.getSheetValues();
    const codes = values.filter((r) => Array.isArray(r) && ((r as unknown[])[1] === "A1" || (r as unknown[])[1] === "A2"));
    expect(codes.length).toBe(2);
    expect(JSON.stringify(values)).toContain("Attribute descriptions");
  });

  it("documents data completeness on the IPE tab", async () => {
    const wb = await read(await buildTocWorkbook(view()));
    const text = JSON.stringify(wb.getWorksheet("IPE")!.getSheetValues());
    expect(text).toContain("Completeness — procedure performed");
    expect(text).toContain("Accuracy — procedure performed");
  });
});
