import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

// parseTabularFile is pure, but its module pulls the tenant/auth stack in.
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

import { parseTabularFile } from "@/lib/subledgers";

describe("parseTabularFile header-row handling", () => {
  it("first row as headers (default)", async () => {
    const csv = Buffer.from("Compte,Intitulé,Solde\n411000,Clients,1500\n701000,Ventes,-1500\n");
    const t = await parseTabularFile("tb.csv", csv);
    expect(t.headers).toEqual(["Compte", "Intitulé", "Solde"]);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0].Compte).toBe("411000");
  });

  it("headerRow=false: columns become col_N and row 1 stays data", async () => {
    const csv = Buffer.from("411000,Clients,1500\n701000,Ventes,-1500\n");
    const t = await parseTabularFile("tb.csv", csv, false);
    expect(t.headers).toEqual(["col_1", "col_2", "col_3"]);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0].col_1).toBe("411000");
  });

  it("headerRow=false accepts a single-line file", async () => {
    const t = await parseTabularFile("tb.csv", Buffer.from("411000,Clients,1500\n"), false);
    expect(t.rows).toHaveLength(1);
  });

  it("xlsx: a blank banner row no longer swallows the real headers", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("TB");
    ws.addRow([]); // banner/blank row the export tools love to emit
    ws.addRow(["Compte", "Intitulé", "Solde"]);
    ws.addRow(["411000", "Clients", 1500]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const t = await parseTabularFile("tb.xlsx", buffer);
    expect(t.headers).toEqual(["Compte", "Intitulé", "Solde"]);
    expect(t.rows).toHaveLength(1);
    expect(String(t.rows[0].Compte)).toBe("411000");
  });

  it("xlsx headerRow=false: every row is data under col_N names", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("TB");
    ws.addRow(["411000", "Clients", 1500]);
    ws.addRow(["701000", "Ventes", -1500]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const t = await parseTabularFile("tb.xlsx", buffer, false);
    expect(t.headers).toEqual(["col_1", "col_2", "col_3"]);
    expect(t.rows).toHaveLength(2);
  });
});
