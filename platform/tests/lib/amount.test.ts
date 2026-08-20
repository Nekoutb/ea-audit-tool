import { describe, expect, it } from "vitest";
import { amountOr, parseAmount } from "@/lib/amount";

// The product is bilingual and FCFA-denominated, so the same figure arrives
// written three ways. Before this parser existed, three of five copies stripped
// every character outside [0-9.-], turning "1 500 000,75" into 150 000 075 —
// and that number fed the SAD debits-equals-credits control total.

describe("parseAmount — the same figure written three ways", () => {
  it("reads the French form the audit found broken", () => {
    expect(parseAmount("1 500 000,75")).toBe(1_500_000.75);
  });

  it("reads the English form", () => {
    expect(parseAmount("1,500,000.75")).toBe(1_500_000.75);
  });

  it("reads the dotted-grouping form", () => {
    expect(parseAmount("1.500.000,75")).toBe(1_500_000.75);
  });

  it("reads a non-breaking space as grouping, as spreadsheets emit it", () => {
    expect(parseAmount("1 500 000,75")).toBe(1_500_000.75);
    expect(parseAmount("1 500 000,75")).toBe(1_500_000.75);
  });
});

describe("parseAmount — the ambiguous single separator", () => {
  it("treats a lone comma before three digits as grouping", () => {
    expect(parseAmount("1,500")).toBe(1500);
  });

  it("treats a lone dot before three digits as grouping", () => {
    expect(parseAmount("1.500")).toBe(1500);
  });

  it("treats it as a decimal when spaces already did the grouping", () => {
    // 12 345,678 cannot mean twelve million — the spaces group, so the comma
    // must be the decimal point.
    expect(parseAmount("12 345,678")).toBe(12_345.678);
  });

  it("treats one or two trailing digits as a decimal", () => {
    expect(parseAmount("1,5")).toBe(1.5);
    expect(parseAmount("1,50")).toBe(1.5);
    expect(parseAmount("1.5")).toBe(1.5);
  });

  it("treats repeated separators as grouping", () => {
    expect(parseAmount("1.500.000")).toBe(1_500_000);
    expect(parseAmount("1,500,000")).toBe(1_500_000);
  });
});

describe("parseAmount — signs", () => {
  it("reads a leading minus", () => {
    expect(parseAmount("-1 234,56")).toBe(-1234.56);
  });

  it("reads accounting brackets as negative", () => {
    expect(parseAmount("(1 234,56)")).toBe(-1234.56);
  });

  it("reads a trailing minus, as some ledger exports write it", () => {
    expect(parseAmount("1 234,56-")).toBe(-1234.56);
  });

  it("reads a Unicode minus", () => {
    expect(parseAmount("−1234")).toBe(-1234);
  });

  it("reads a leading plus as positive", () => {
    expect(parseAmount("+1234")).toBe(1234);
  });

  it("refuses a sign in the middle", () => {
    expect(parseAmount("12-34")).toBeNull();
  });
});

describe("parseAmount — currency and noise", () => {
  it("ignores a currency suffix", () => {
    expect(parseAmount("1 500 000,75 FCFA")).toBe(1_500_000.75);
  });

  it("ignores a currency prefix", () => {
    expect(parseAmount("XAF 250 000")).toBe(250_000);
    expect(parseAmount("€1.234,50")).toBe(1234.5);
  });
});

describe("parseAmount — non-numbers", () => {
  it("returns null for empty and whitespace", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
  });

  it("returns null for null and undefined", () => {
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });

  it("returns null for a bare sign or separator", () => {
    expect(parseAmount("-")).toBeNull();
    expect(parseAmount(",")).toBeNull();
    expect(parseAmount("()")).toBeNull();
  });

  it("returns null for text with no digits", () => {
    expect(parseAmount("n/a")).toBeNull();
    expect(parseAmount("solde")).toBeNull();
  });

  it("passes finite numbers through and rejects the rest", () => {
    expect(parseAmount(1234.5)).toBe(1234.5);
    expect(parseAmount(0)).toBe(0);
    expect(parseAmount(Number.NaN)).toBeNull();
    expect(parseAmount(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("reads zero and a bare decimal", () => {
    expect(parseAmount("0")).toBe(0);
    expect(parseAmount("0,00")).toBe(0);
    expect(parseAmount(",5")).toBe(0.5);
  });
});

describe("amountOr", () => {
  it("substitutes the fallback so a total is never NaN", () => {
    expect(amountOr("not a number")).toBe(0);
    expect(amountOr("", 0)).toBe(0);
    expect(amountOr("1 234,50")).toBe(1234.5);
    expect(amountOr(undefined, -1)).toBe(-1);
  });

  it("keeps a real zero rather than the fallback", () => {
    expect(amountOr("0", 99)).toBe(0);
  });
});
