import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  blankItgcTemplate,
  buildItgcWorkbook,
  domainSummary,
  evaluateItgcControl,
  ipeAccuracySize,
  IPE_ACCURACY_BASELINE,
  IPE_ACCURACY_EXTENDED,
  IPE_ACCURACY_REDUCED,
  IPE_CRITERIA,
  ITGC_DOMAINS,
  type ItgcControl,
  type ItgcView,
} from "@/lib/itgc-workbook";

/* ------------------------- the domains the firm has ------------------------ */

describe("ITGC_DOMAINS", () => {
  it("carries the four IT process domains the handbook names, and no fifth", () => {
    expect(ITGC_DOMAINS.map((d) => d.en)).toEqual([
      "Changes", "Access", "IT Operations", "Support",
    ]);
  });

  it("names each domain in French as well", () => {
    expect(ITGC_DOMAINS.map((d) => d.fr)).toEqual([
      "Changements", "Accès", "Exploitation informatique", "Support",
    ]);
  });
});

/* ------------------------------ the IPE sample ----------------------------- */

describe("ipeAccuracySize", () => {
  const allMet = IPE_CRITERIA.map(() => true);

  it("works to 25 items until every one of the eight criteria is met", () => {
    expect(ipeAccuracySize([])).toBe(IPE_ACCURACY_BASELINE);
    expect(ipeAccuracySize(allMet.map((_, i) => i !== 3))).toBe(IPE_ACCURACY_BASELINE);
  });

  it("reduces to 10 only when all eight hold at once", () => {
    expect(ipeAccuracySize(allMet)).toBe(IPE_ACCURACY_REDUCED);
  });

  it("treats a partly answered checklist as unmet rather than met", () => {
    expect(ipeAccuracySize([true, true, true])).toBe(IPE_ACCURACY_BASELINE);
  });

  it("extends to 60 whatever the criteria say", () => {
    expect(ipeAccuracySize(allMet, true)).toBe(IPE_ACCURACY_EXTENDED);
    expect(ipeAccuracySize([], true)).toBe(IPE_ACCURACY_EXTENDED);
  });
});

/* ----------------------------- control results ----------------------------- */

const control = (patch: Partial<ItgcControl> = {}): ItgcControl => ({
  ref: "CHG-1",
  domain: "changes",
  application: "Sage X3",
  name: "Program changes are tested and approved before release",
  description: null,
  owner: "IT manager",
  frequency: "on each change",
  population: 42,
  populationSource: "Change log extracted 12 Jan; total agreed to the release register",
  risksAddressed: ["The data is not processed correctly by the IT application."],
  extentBasis: null,
  attributes: ["A1", "A2"],
  rows: [],
  designImplemented: null,
  operatingEval: null,
  ipe: [],
  ...patch,
});

const row = (results: Record<string, "pass" | "fail" | "na" | "">) => ({
  ref: "CHG-2025-014", date: "2025-03-04", desc: "Invoice numbering patch", results,
});

describe("evaluateItgcControl", () => {
  it("counts an item failing any attribute as one deviation, not one per attribute", () => {
    const result = evaluateItgcControl(control({
      rows: [row({ A1: "fail", A2: "fail" }), row({ A1: "pass", A2: "pass" })],
    }));
    expect(result.deviations).toBe(1);
    expect(result.tested).toBe(2);
  });

  it("never reads an unanswered attribute cell as a pass", () => {
    const result = evaluateItgcControl(control({ rows: [row({ A1: "pass", A2: "" })] }));
    expect(result.unanswered).toBe(1);
    expect(result.deviations).toBe(0);
  });
});

/* -------------------------------- workbook --------------------------------- */

const view = (patch: Partial<ItgcView> = {}): ItgcView => ({
  clientName: "ELIMELEC",
  fiscalYear: 2025,
  periodEnd: "2025-12-31",
  periodOfReliance: "01 Jan – 31 Dec 2025",
  preparer: "A. Preparer",
  reviewer: "B. Reviewer",
  partner: "C. Partner",
  conclusion: null,
  itProcess: null,
  applications: [
    {
      ref: "APP-1", name: "Sage X3", layers: "Application · database",
      scots: ["Revenue"], dependency: "", criticality: "", strategy: "", serviceOrg: "", note: "",
    },
  ],
  controls: [control({ rows: [row({ A1: "pass", A2: "pass" })] })],
  domains: ITGC_DOMAINS.map((d) => ({ domain: d.key, state: null, basis: "" })),
  deficiencies: [],
  ...patch,
});

const read = async (buffer: Buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
};

const SHEETS = ["Cover", "Applications", "Changes", "Access", "IT Operations", "Support", "Deficiencies"];

describe("buildItgcWorkbook", () => {
  it("leads with the Cover and the applications, then one tab per domain", async () => {
    const wb = await read(await buildItgcWorkbook(view()));
    expect(wb.worksheets.map((w) => w.name)).toEqual(SHEETS);
  });

  it("freezes panes on every tab, including the Cover", async () => {
    const wb = await read(await buildItgcWorkbook(view()));
    for (const name of SHEETS) {
      const v = wb.getWorksheet(name)!.views[0] as { state?: string; ySplit?: number };
      expect(v.state, name).toBe("frozen");
      expect(v.ySplit ?? 0, name).toBeGreaterThan(0);
    }
  });

  // Excel repairs a workbook whose XML breaks the schema, and a repair drops the
  // sheet's contents. Both rules below were broken once on the E1.2 workbook and
  // emptied a tab; they are cheap to assert and expensive to rediscover.
  it("writes no formula with a leading '=', which Excel treats as damage", async () => {
    const wb = await read(await buildItgcWorkbook(view()));
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

  it("declares on every domain tab the column outline level it actually uses", async () => {
    const wb = await read(await buildItgcWorkbook(view()));
    for (const name of ["Changes", "Access", "IT Operations", "Support"]) {
      const sheet = wb.getWorksheet(name)!;
      const deepest = Math.max(
        0,
        ...Array.from({ length: 20 }, (_, i) => sheet.getColumn(i + 1).outlineLevel ?? 0),
      );
      expect(sheet.properties.outlineLevelCol ?? 0, name).toBe(deepest);
    }
  });

  it("types engagement identity once and reads it everywhere else by formula", async () => {
    const wb = await read(await buildItgcWorkbook(view()));
    // The Readme block on the Cover holds the literal value…
    expect(wb.getWorksheet("Cover")!.getCell("D4").value).toBe("ELIMELEC");
    // …and every other tab points at it rather than repeating it.
    for (const name of SHEETS.slice(1)) {
      const cell = wb.getWorksheet(name)!.getCell("A3").value as { formula?: string };
      expect(cell?.formula, name).toContain("Cover!$D$4");
    }
  });

  it("carries the two generic IT risks onto the Cover", async () => {
    const wb = await read(await buildItgcWorkbook(view()));
    const text = JSON.stringify(wb.getWorksheet("Cover")!.getSheetValues());
    expect(text).toContain("not processed correctly by the IT application");
    expect(text).toContain("not the right data");
  });

  it("carries all eight IPE reduction criteria in full rather than summarising them", async () => {
    const wb = await read(await buildItgcWorkbook(view()));
    const text = JSON.stringify(wb.getWorksheet("Cover")!.getSheetValues());
    for (const criterion of IPE_CRITERIA) {
      expect(text, criterion.slice(0, 40)).toContain(criterion.slice(0, 60));
    }
  });

  it("offers all three response routes on the deficiency tab, not just a substantive one", async () => {
    const wb = await read(await buildItgcWorkbook(view()));
    const text = JSON.stringify(wb.getWorksheet("Deficiencies")!.getSheetValues());
    expect(text).toContain("Compensating control — IT process");
    expect(text).toContain("Compensating control — SCOT");
    expect(text).toContain("Substantive procedures — SCOT");
  });

  it("names no fifth domain — program development is not one of the firm's", async () => {
    const wb = await read(await buildItgcWorkbook(view()));
    const text = wb.worksheets.map((ws) => JSON.stringify(ws.getSheetValues())).join(" ");
    expect(text.toLowerCase()).not.toContain("program development");
  });

  // The handbook is explicit that an ineffective ITGC does not necessarily make
  // the IT process ineffective. A deviation must therefore leave both the domain
  // and the process conclusion for the preparer, not decide them.
  it("leaves the domain conclusion blank when a control deviated, instead of deciding it", async () => {
    const failing = view({
      controls: [control({ operatingEval: "not_effective", rows: [row({ A1: "fail", A2: "pass" })] })],
    });
    const wb = await read(await buildItgcWorkbook(failing));
    const changes = wb.getWorksheet("Changes")!;
    let found: string | null = null;
    changes.eachRow((r) => {
      if (String(r.getCell(1).value ?? "") === "Conclusion for this domain") {
        found = String(r.getCell(4).value ?? "");
      }
    });
    expect(found).toBe("");
  });

  it("leaves the IT-process conclusion blank until the preparer has recorded one", async () => {
    const wb = await read(await buildItgcWorkbook(view({
      controls: [control({ operatingEval: "not_effective", rows: [row({ A1: "fail", A2: "pass" })] })],
    })));
    const text = JSON.stringify(wb.getWorksheet("Cover")!.getSheetValues());
    // the drop-down options are described, but neither is asserted as the answer
    expect(text).toContain("Support IT — rely on the control");
    expect(domainSummary(view(), "changes").deviations).toBe(0);
  });

  it("prints the conclusion the preparer did record", async () => {
    const wb = await read(await buildItgcWorkbook(view({
      itProcess: "not_support",
      conclusion: "Access to production is unrestricted; the IT process does not support reliance.",
      domains: ITGC_DOMAINS.map((d) => ({
        domain: d.key,
        state: d.key === "access" ? ("ineffective" as const) : ("effective" as const),
        basis: "Tested over the whole period.",
      })),
    })));
    const text = JSON.stringify(wb.getWorksheet("Cover")!.getSheetValues());
    expect(text).toContain("Not support IT");
    expect(text).toContain("does not support reliance");
    expect(text).toContain("Ineffective");
  });

  it("builds a usable blank paper with a block on every domain tab", async () => {
    const wb = await read(await buildItgcWorkbook(blankItgcTemplate()));
    expect(wb.worksheets.map((w) => w.name)).toEqual(SHEETS);
    for (const name of ["Changes", "Access", "IT Operations", "Support"]) {
      const sheet = wb.getWorksheet(name)!;
      const text = JSON.stringify(sheet.getSheetValues());
      expect(text, name).toContain("Attribute descriptions");
      expect(text, name).toContain("Conclusion for this domain");
    }
  });
});

describe("domainSummary", () => {
  it("counts what was done in the domain and states nothing about the conclusion", () => {
    const summary = domainSummary(
      view({ controls: [control({ rows: [row({ A1: "fail", A2: "pass" }), row({ A1: "pass", A2: "pass" })] })] }),
      "changes",
    );
    expect(summary).toEqual({
      controls: 1, tested: 2, deviations: 1, ineffective: 0, deficiencies: 0,
    });
  });

  it("reports nothing for a domain with no control recorded", () => {
    expect(domainSummary(view(), "support")).toEqual({
      controls: 0, tested: 0, deviations: 0, ineffective: 0, deficiencies: 0,
    });
  });
});
