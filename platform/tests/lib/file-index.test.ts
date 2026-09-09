import { describe, expect, it } from "vitest";
import { DEFAULT_FILE_INDEX, SECTIONS, shortTitle, tierOf } from "@/lib/file-index";
import { EXECUTION_PAPERS } from "@/lib/papers/execution";

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
    // The seven general audit procedures grouped under E5, plus the two records
    // tasks that stayed behind in E6. E4.15/E4.16 are account leads (Tax
    // Payables, Group & Associates) and are asserted with the rest of E4.
    for (const code of ["E3.1", "E6.1", "E6.2", "E6.3", "E6.4", "E6.5", "E6.6", "E6.7", "E6.9"]) {
      expect(codes).toContain(code);
    }
  });

  it("gives litigation and claims an index entry of its own", () => {
    const entry = DEFAULT_FILE_INDEX.find((e) => e.code === "E6.9");
    expect(entry).toBeDefined();
    // ISA 501 §9 applies whatever the entity's complexity, so it instantiates
    // on every engagement rather than waiting for a trigger answer.
    expect(tierOf(entry!)).toBe("core");
    expect(entry!.conditional).toBeUndefined();
    // the task column truncates past ~36 characters
    expect(shortTitle("E6.9", "en", "").length).toBeLessThanOrEqual(36);
    expect(shortTitle("E6.9", "fr", "").length).toBeLessThanOrEqual(36);
  });

  it("keys every execution paper to a code the index ships", () => {
    // The account papers once carried the codes of an older sixteen-cycle
    // E-section list, which silently opened the litigation paper on the tax
    // payables task. A key that names nothing in the index is that bug.
    for (const code of Object.keys(EXECUTION_PAPERS)) {
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
      expect(/^[PSEC][0-9]+\.[0-9]+$/.test(entry.code)).toBe(true);
    }
  });

  it("marks exactly the conditional forms as conditional", () => {
    const conditional = DEFAULT_FILE_INDEX.filter((e) => e.conditional).map((e) => e.code);
    // P1.2 is the predecessor auditor communication: it applies on a change of
    // auditor, so it is instantiated but kept out of the phase task counts. The
    // same mechanism retires E5.1–E5.5: those five P&L lead schedules predate
    // the SYSCOHADA lead codes and every one of them is covered by an E4.20–E4.33
    // account paper, so they stay reachable for the files that already used them
    // without being offered again on a new engagement.
    expect(conditional.sort()).toEqual([
      "E5.1", "E5.2", "E5.3", "E5.4", "E5.5",
      "P1.2", "P4.2", "P4.3", "S5.1", "S5.2", "S5.3",
    ]);
  });
});
