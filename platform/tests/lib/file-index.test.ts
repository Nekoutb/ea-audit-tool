import { describe, expect, it } from "vitest";
import { DEFAULT_FILE_INDEX, SECTIONS } from "@/lib/file-index";

const codes = DEFAULT_FILE_INDEX.map((entry) => entry.code);

describe("default audit file index", () => {
  it("preserves the methodology's numbering gaps exactly", () => {
    // Intentional gaps — must NOT exist:
    expect(codes).not.toContain("D2");
    expect(codes).not.toContain("D5.3");
    // Their neighbours — must exist:
    expect(codes).toContain("D1");
    expect(codes).toContain("D3.1");
    expect(codes).toContain("D5.2");
    expect(codes).toContain("D5.4");
  });

  it("ships the complete B, C and F sections", () => {
    for (let i = 1; i <= 10; i += 1) expect(codes).toContain(`B${i}`);
    expect(codes).toContain("C1");
    for (let i = 1; i <= 8; i += 1) expect(codes).toContain(`F${i}`);
    expect(codes).toContain("A1");
  });

  it("ships the standard cross-cutting E-sections", () => {
    for (const code of ["E270", "E280", "E310", "E320", "E330", "E350", "E360", "E370", "E380", "E390"]) {
      expect(codes).toContain(code);
    }
  });

  it("has unique codes, bilingual titles and valid sections", () => {
    expect(new Set(codes).size).toBe(codes.length);
    const validSections = new Set(SECTIONS.map((s) => s.section));
    for (const entry of DEFAULT_FILE_INDEX) {
      expect(validSections.has(entry.section)).toBe(true);
      expect(entry.titleEn.trim().length).toBeGreaterThan(0);
      expect(entry.titleFr.trim().length).toBeGreaterThan(0);
      expect(entry.code.startsWith(entry.section)).toBe(true);
    }
  });

  it("marks exactly the conditional D-forms as conditional", () => {
    const conditional = DEFAULT_FILE_INDEX.filter((e) => e.conditional).map((e) => e.code);
    // D3.4 is the predecessor auditor communication: it applies on a change of
    // auditor, so it is instantiated but kept out of the phase task counts.
    expect(conditional.sort()).toEqual(["D3.4", "D4.5", "D4.6", "D4.7", "D4.8", "D4.9"]);
  });
});
