import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildTocSampleWorkbook, controlTabName, type TocSampleView } from "@/lib/toc-sample-workbook";
import { drawTocSample } from "@/lib/toc-sampling";

// The random draw for a test of controls and the workbook that carries it:
// distinct occurrence numbers within the population, as many as the table
// asks, different from one generation to the next; one tab per control with
// the items and the tester's columns.

describe("drawTocSample", () => {
  it("draws distinct occurrence numbers inside the population, as many as asked", () => {
    const items = drawTocSample(650, 25);
    expect(items).toHaveLength(25);
    expect(new Set(items).size).toBe(25);
    expect(items.every((v) => Number.isInteger(v) && v >= 1 && v <= 650)).toBe(true);
    expect([...items].sort((a, b) => a - b)).toEqual(items);
  });

  it("takes the whole population when it is smaller than the size, and nothing from nothing", () => {
    expect(drawTocSample(3, 5)).toEqual([1, 2, 3]);
    expect(drawTocSample(0, 5)).toEqual([]);
    expect(drawTocSample(10, 0)).toEqual([]);
  });

  it("is unbiased across the population and differs between generations", () => {
    const seen = new Set<number>();
    const draws = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const d = drawTocSample(650, 25);
      draws.add(d.join(","));
      for (const v of d) seen.add(v);
    }
    expect(draws.size).toBeGreaterThan(190);
    // 5 000 draws over 650 numbers: the high end is reached as surely as the low end
    expect(Math.max(...seen)).toBeGreaterThan(600);
    expect(Math.min(...seen)).toBeLessThan(50);
  });

  it("holds still under an injected generator", () => {
    let k = 0;
    const rng = () => ((k += 7) % 13) / 13;
    const a = drawTocSample(100, 10, rng);
    k = 0;
    const b = drawTocSample(100, 10, rng);
    expect(a).toEqual(b);
  });
});

describe("controlTabName", () => {
  it("keeps two same-named controls apart and within Excel's limits", () => {
    const a = controlTabName(0, "Three-way match: PO / GRN / invoice [daily]");
    const b = controlTabName(1, "Three-way match: PO / GRN / invoice [daily]");
    expect(a).not.toBe(b);
    expect(a.length).toBeLessThanOrEqual(31);
    expect(a).not.toMatch(/[[\]:*?/\\]/);
  });
});

describe("buildTocSampleWorkbook", () => {
  it("writes a cover and one tab per control with the drawn items and entry cells", async () => {
    const items = drawTocSample(650, 25);
    const view: TocSampleView = {
      locale: "en", clientName: "Test SA", fiscalYear: 2025, periodEnd: "2025-12-31", preparer: "A. Tester",
      controls: [
        { controlName: "Invoice approval", scotName: "Sales", controlType: "manual", frequency: "Daily", assertions: ["E", "A"], population: 650, sampleSize: 25, rule: "Daily, population > 250 → 25", items, drawnAt: "2026-09-22T10:00:00Z" },
        { controlName: "Bank reconciliation", scotName: "Cash", controlType: "manual", frequency: "Monthly", assertions: ["C"], population: 12, sampleSize: 2, rule: "Manual, Monthly → minimum 2", items: [], drawnAt: null },
      ],
    };
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildTocSampleWorkbook(view)) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Cover", "1. Invoice approval", "2. Bank reconciliation"]);
    const ws = wb.getWorksheet("1. Invoice approval")!;
    const text: string[] = [];
    ws.eachRow((row) => row.eachCell((cell) => text.push(String(cell.text ?? cell.value ?? ""))));
    expect(text.filter((t) => / \/ 650$/.test(t))).toHaveLength(25);
    expect(text).toContain(`${items[0]} / 650`);
    expect(text).toContain("Daily, population > 250 → 25");
    const empty = wb.getWorksheet("2. Bank reconciliation")!;
    const t2: string[] = [];
    empty.eachRow((row) => row.eachCell((cell) => t2.push(String(cell.text ?? cell.value ?? ""))));
    expect(t2).toContain("— no item drawn —");
  });
});
