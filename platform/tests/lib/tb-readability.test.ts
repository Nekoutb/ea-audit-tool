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
