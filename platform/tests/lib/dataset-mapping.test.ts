import { describe, expect, it } from "vitest";
import { autoMap, jeNumberLooksLikeJournalCode } from "@/lib/dataset-mapping";

// The ELIMELEC general ledger as it arrived: a "C.j" journal-code column, a
// "JE N°" entry number and a "N° pièce" voucher number. The old guess left the
// entry number on the journal code, and every journal became one entry.
const ELIMELEC = ["C.j", "Let", "Date", "Amount", "JE N°", "N° pièce", "N° de compte", "Mouvement débit", "Mouvement crédit", "Libellé écriture", "Intitulé du compte"];

describe("autoMap on a general ledger", () => {
  it("puts the entry number on JE N° and the journal code on C.j", () => {
    const m = autoMap("journal_entries", ELIMELEC);
    expect(m.jeNumber).toBe("JE N°");
    expect(m.journalCode).toBe("C.j");
    expect(m.account).toBe("N° de compte");
    expect(m.accountName).toBe("Intitulé du compte");
    expect(m.jeDescription).toBe("Libellé écriture");
    expect(m.journalDate).toBe("Date");
    expect(m.amount).toBe("Amount");
    expect(m.debit).toBe("Mouvement débit");
    expect(m.credit).toBe("Mouvement crédit");
    expect(m.reference).toBe("N° pièce");
  });

  it("never maps one header twice", () => {
    const m = autoMap("journal_entries", ELIMELEC);
    const headers = Object.values(m);
    expect(new Set(headers).size).toBe(headers.length);
  });

  it("still finds the French spellings", () => {
    const m = autoMap("journal_entries", ["Journal", "N° écriture", "Compte", "Libellé", "Débit", "Crédit", "Date opération"]);
    expect(m.journalCode).toBe("Journal");
    expect(m.jeNumber).toBe("N° écriture");
    expect(m.account).toBe("Compte");
    expect(m.journalDate).toBe("Date opération");
  });
});

describe("jeNumberLooksLikeJournalCode", () => {
  it("flags eleven values over thirty-three thousand lines", () => {
    expect(jeNumberLooksLikeJournalCode(33_336, 11)).toBe(true);
  });
  it("accepts eight thousand entries over the same ledger", () => {
    expect(jeNumberLooksLikeJournalCode(33_336, 8_059)).toBe(false);
  });
  it("says nothing about a tiny file", () => {
    expect(jeNumberLooksLikeJournalCode(60, 2)).toBe(false);
  });
});
