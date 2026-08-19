import { describe, expect, it } from "vitest";
import { DEFAULT_FILE_INDEX, SECTIONS } from "@/lib/file-index";

const codes = DEFAULT_FILE_INDEX.map((entry) => entry.code);

describe("default audit file index", () => {
  it("preserves the methodology's numbering gaps exactly", () => {
    // Intentional gaps — must NOT exist:
    expect(codes).not.toContain("D2");
    expect(codes).not.toContain("D5.3");
    // Their neighbours — must exist:
    expect(codes).toContain("S6.1");
    expect(codes).toContain("P1.1");
    expect(codes).toContain("S4.1");
    expect(codes).toContain("P5.1");
  });

  it("ships the complete conclusion section in the recoded scheme", () => {
    for (const code of ["C1.1", "C1.2", "C1.3", "C2.1", "C2.2", "C3.1", "C4.1", "C4.2", "C4.3", "C5.1", "C6.1", "C6.2"]) {
      expect(codes).toContain(code);
    }
  });

  it("ships the standard cross-cutting E-sections", () => {
    for (const code of ["E4.15", "E4.16", "E6.1", "E6.2", "E6.3", "E3.1", "E6.4", "E6.5", "E6.6", "E6.7"]) {
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
      // codes follow the phase scheme; the section letter remains the filing container
      expect(/^[PSEC][0-9]+.[0-9]+$/.test(entry.code)).toBe(true);
    }
  });

  it("marks exactly the conditional D-forms as conditional", () => {
    const conditional = DEFAULT_FILE_INDEX.filter((e) => e.conditional).map((e) => e.code);
    // P1.2 is the predecessor auditor communication: it applies on a change of
    // auditor, so it is instantiated but kept out of the phase task counts.
    expect(conditional.sort()).toEqual(["P1.2", "P4.2", "P4.3", "S5.1", "S5.2", "S5.3"]);
  });
});
