import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import { formatFCFA } from "@/lib/i18n";

// Collect every leaf key path ("login.email", ...) from a nested dictionary.
function keyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object"
      ? keyPaths(value as Record<string, unknown>, path)
      : [path];
  });
}

describe("i18n dictionaries", () => {
  it("EN and FR have identical key sets (no missing translations)", () => {
    const enKeys = keyPaths(en).sort();
    const frKeys = keyPaths(fr).sort();
    expect(frKeys).toEqual(enKeys);
  });

  it("has no empty string values", () => {
    const allValues = (obj: Record<string, unknown>): string[] =>
      Object.values(obj).flatMap((v) =>
        v !== null && typeof v === "object"
          ? allValues(v as Record<string, unknown>)
          : [String(v)],
      );
    for (const value of [...allValues(en), ...allValues(fr)]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("formatFCFA", () => {
  it("formats with space thousands separator and no decimals", () => {
    expect(formatFCFA(1234567)).toBe("1 234 567 FCFA");
    expect(formatFCFA(500)).toBe("500 FCFA");
    expect(formatFCFA(1000000)).toBe("1 000 000 FCFA");
  });
});
