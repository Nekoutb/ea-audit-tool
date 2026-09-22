import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { planTod } from "@/lib/tod-plan";
import { buildTodWorkbook, tabName, type TodSideView } from "@/lib/tod-workbook";

// One workbook per side of the financial statements, one tab per index. The
// mechanical guards (tab names Excel accepts, no formula with a leading "=")
// keep the file openable; the rest holds what the paper says: the parameters
// on every tab, the key items in full, the sample beneath, entry cells for
// the tester.

function view(): TodSideView {
  const lines = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => ({ ref: `${prefix}${i + 1}`, account: prefix === "UA" ? "701100" : "605100", amount: 250_000 * (i + 1), description: `Line ${i + 1}`, date: "2025-06-30" }));
  return {
    locale: "en",
    side: "is",
    clientName: "Test SA",
    fiscalYear: 2025,
    periodEnd: "2025-12-31",
    currency: "XAF",
    preparer: "A. Tester",
    te: 3_000_000,
    ledgerFilename: "gl.xlsx",
    sheets: [
      { indexCode: "UA", labelEn: "Revenue", labelFr: "Chiffre d'affaires", taskCode: "E4.20", cra: "high_sr", craFromS31: true, thresholdFromS31: true, assurance: "little", plan: planTod({ lines: lines("UA", 40), te: 3_000_000, threshold: 6_000_000, cra: "high_sr", assurance: "little", startFraction: 0.3 }) },
      { indexCode: "VA1", labelEn: "Purchases", labelFr: "Achats", taskCode: "E4.24", cra: "moderate", craFromS31: false, thresholdFromS31: false, assurance: "some", plan: planTod({ lines: lines("VA", 12), te: 3_000_000, cra: "moderate", assurance: "some", startFraction: 0.1 }) },
    ],
    emptyIndexes: [{ indexCode: "U1", labelEn: "Exceptional Income", labelFr: "Produits exceptionnels" }],
  };
}

describe("tabName", () => {
  it("strips what Excel refuses and caps at 31 characters", () => {
    expect(tabName("VD1", "Non-Stored Purchases, Transport & External Services").length).toBeLessThanOrEqual(31);
    expect(tabName("O1", "Tax: Receivables [net] / other?")).not.toMatch(/[[\]:*?/\\]/);
  });
});

describe("buildTodWorkbook", () => {
  it("writes a cover and one tab per index, with parameters, key items, sample and entry cells", async () => {
    const v = view();
    const buffer = await buildTodWorkbook(v);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Cover", "UA Revenue", "VA1 Purchases"]);

    for (const ws of wb.worksheets) {
      ws.eachRow((row) => row.eachCell((cell) => {
        const f = (cell.value as { formula?: string })?.formula;
        if (f) expect(f.startsWith("="), `${ws.name}!${cell.address}`).toBe(false);
      }));
    }

    const ua = wb.getWorksheet("UA Revenue")!;
    const text: string[] = [];
    ua.eachRow((row) => row.eachCell((cell) => text.push(String(cell.text ?? cell.value ?? ""))));
    expect(text).toContain("CRA (S3.1)");
    expect(text).toContain("High + significant risk");
    expect(text.some((t) => t.startsWith("Key items — examined in full — "))).toBe(true);
    expect(text.some((t) => t.startsWith("Representative sample — systematic MUS — "))).toBe(true);
    const keyCount = text.filter((t) => t === "Key item").length;
    expect(keyCount).toBe(v.sheets[0].plan.keyItems.length);
    const sampleCount = text.filter((t) => t === "Sample").length;
    expect(sampleCount).toBe(v.sheets[0].plan.sample.length);
    expect(sampleCount).toBeGreaterThan(0);

    // the cover names every index of the side, the empty one included
    const cover = wb.getWorksheet("Cover")!;
    const coverText: string[] = [];
    cover.eachRow((row) => row.eachCell((cell) => coverText.push(String(cell.text ?? cell.value ?? ""))));
    expect(coverText).toContain("U1");
    expect(coverText).toContain("— no ledger line —");
    expect(coverText).toContain("VA1");
  });
});
