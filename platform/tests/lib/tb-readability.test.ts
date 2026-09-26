import { describe, expect, it, vi } from "vitest";

// lib/tb reaches the session module on import; nothing below touches it
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
import { extractTbRows, inferTbMapping, readabilityOf, validateTbRows } from "@/lib/tb";
import { explainTbSummary } from "@/lib/tb-reasons";

// A trial balance whose figures the parser cannot read must say so — which
// column, which rows, which values — instead of reading them as 0 and calling
// the balance "invalid" with no reason attached.

const HEADERS = ["Compte", "Libellé", "Débit", "Crédit"];
const rows = (...r: Record<string, unknown>[]) => ({ headers: HEADERS, rows: r });

describe("readabilityOf", () => {
  it("names the column, the row, the account and the value that could not be read", () => {
    const table = rows(
      { Compte: "411100", Libellé: "Clients", Débit: "1 500 000", Crédit: "" },
      { Compte: "701100", Libellé: "Ventes", Débit: "", Crédit: "1 500 000" },
      { Compte: "521100", Libellé: "Banque", Débit: "N/A", Crédit: "" },
      { Compte: "601100", Libellé: "Achats", Débit: "12.345,67 FCFA", Crédit: "" },
      { Compte: "", Libellé: "TOTAL", Débit: "1 512 345", Crédit: "1 500 000" },
    );
    const mapping = inferTbMapping(HEADERS);
    const r = readabilityOf(table, mapping);
    expect(r.rows).toBe(5);
    expect(r.rowsWithoutAccount).toBe(1);
    expect(r.unreadable).toHaveLength(1);
    const u = r.unreadable[0];
    expect(u.column).toBe("debit");
    expect(u.header).toBe("Débit");
    expect(u.count).toBe(1);
    expect(u.examples).toEqual([{ row: 3, account: "521100", value: "N/A" }]);
  });

  it("makes the import invalid and explains it in words a preparer can act on", () => {
    const table = rows(
      { Compte: "411100", Libellé: "Clients", Débit: "abc", Crédit: "" },
      { Compte: "701100", Libellé: "Ventes", Débit: "", Crédit: "100" },
    );
    const mapping = inferTbMapping(HEADERS);
    const summary = validateTbRows(extractTbRows(table, mapping), ["41", "70"], null, mapping, readabilityOf(table, mapping));
    expect(summary.status).toBe("invalid");
    const en = explainTbSummary(summary, "en");
    expect(en.some((l) => l.blocking && l.text.includes('Column "Débit"') && l.text.includes("row 1 (411100)") && l.text.includes('"abc"'))).toBe(true);
    expect(en.some((l) => l.text.startsWith("Movements do not balance") && l.text.includes("difference"))).toBe(true);
    const fr = explainTbSummary(summary, "fr");
    expect(fr.some((l) => l.text.includes("Colonne « Débit »"))).toBe(true);
  });

  it("ties P&L and result accounts to the prior year in one aggregate check (UAT B27)", () => {
    const mapping = { account: "c", openingDebit: "od", openingCredit: "oc", debit: "d", credit: "c2" } as never;
    const row = (account: string, od: number, oc: number) =>
      ({ account, label: null, openingDebit: od, openingCredit: oc, debit: 0, credit: 0, raw: {} });
    // prior year: sales 45m credit, purchases 33m debit -> 12m profit to carry
    const prior = new Map([["521000", 2_000_000], ["601000", 33_000_000], ["701000", -45_000_000]]);
    const ok = validateTbRows(
      [row("521000", 2_000_000, 0), row("601000", 0, 0), row("701000", 0, 0), row("130000", 0, 12_000_000)],
      ["52", "60", "70", "13"], prior, mapping,
    );
    expect(ok.checks.openingTiesToPrior.exceptions).toEqual([]);
    const off = validateTbRows([row("521000", 2_000_000, 0), row("130000", 0, 10_000_000)], ["52", "13"], prior, mapping);
    expect(off.checks.openingTiesToPrior.exceptions).toEqual([{ account: "12x/13x", opening: -10_000_000, priorClosing: -12_000_000 }]);
    expect(explainTbSummary(off, "fr").some((l) => l.text.includes("résultat reporté 12x/13x"))).toBe(true);
  });

  it("points unreadable amounts at the physical CSV line (UAT B135)", async () => {
    const { parseTabularFile } = await import("@/lib/subledgers");
    const table = await parseTabularFile("t.csv", Buffer.from("BALANCE\n\nCompte;Libellé;Débit;Crédit\n411100;Clients;100;\n\n521100;Banque;n/a;\n701100;Ventes;;100\n"));
    const r = readabilityOf(table, inferTbMapping(table.headers));
    expect(r.unreadable[0].examples).toEqual([{ row: 6, account: "521100", value: "n/a" }]);
  });

  it("skips a merged title banner and finds the real header row (UAT B64)", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const { parseTabularFile } = await import("@/lib/subledgers");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("TB");
    ws.getCell("A1").value = "BALANCE GENERALE 2025";
    ws.mergeCells("A1:D1");
    ws.getRow(3).values = ["Compte", "Libellé", "Débit", "Crédit"];
    ws.getRow(4).values = ["411100", "Clients", 100, null];
    ws.getRow(5).values = ["701100", "Ventes", "n/a", 100];
    const table = await parseTabularFile("t.xlsx", Buffer.from(await wb.xlsx.writeBuffer()));
    expect(table.headers).toEqual(["Compte", "Libellé", "Débit", "Crédit"]);
    expect(table.rows).toHaveLength(2);
    const r = readabilityOf(table, inferTbMapping(table.headers));
    expect(r.unreadable[0].examples).toEqual([{ row: 5, account: "701100", value: "n/a" }]);
  });

  it("says nothing about a clean file", () => {
    const table = rows(
      { Compte: "411100", Libellé: "Clients", Débit: "100", Crédit: "" },
      { Compte: "701100", Libellé: "Ventes", Débit: "", Crédit: "100" },
    );
    const mapping = inferTbMapping(HEADERS);
    const summary = validateTbRows(extractTbRows(table, mapping), ["41", "70"], null, mapping, readabilityOf(table, mapping));
    expect(summary.status).toBe("valid");
    expect(explainTbSummary(summary, "en")).toEqual([]);
  });
});
