import { describe, expect, it } from "vitest";
import { DEFAULT_FILE_INDEX } from "@/lib/file-index";
import { EXECUTION_PAPERS } from "@/lib/papers/execution";
import { ITGC_PAPERS } from "@/lib/papers/itgc";
import { JOURNAL_ENTRY_PAPERS } from "@/lib/papers/journal-entries";
import { paperKeys, requiredKeys, type PaperDef } from "@/lib/papers/types";

// The registry is a plain object spread, so a paper can stop being reached
// without anything failing to compile: a key that no longer matches a task code
// simply resolves to the group's four-field default, and the paper the auditor
// was meant to complete is quietly replaced by a generic form. That is how the
// litigation paper came to open on the tax payables task. These tests hold the
// wiring of the papers that moved.
//
// lib/working-papers.ts cannot be imported here: it pulls in the connection
// pool through lib/db, which needs a database. The maps it spreads are plain
// data, so the assertions below reproduce its precedence instead.
const REGISTERED: Record<string, PaperDef> = {
  ...EXECUTION_PAPERS,
  ...ITGC_PAPERS,
  ...JOURNAL_ENTRY_PAPERS,
};

const codes = new Set(DEFAULT_FILE_INDEX.map((entry) => entry.code));

describe("the execution paper registry", () => {
  it("gives E1.1 the ITGC paper and E3.1 the journal-entry paper", () => {
    expect(REGISTERED["E1.1"]).toBe(ITGC_PAPERS["E1.1"]);
    expect(REGISTERED["E3.1"]).toBe(JOURNAL_ENTRY_PAPERS["E3.1"]);
  });

  it("keys every execution paper to a task that exists in the file index", () => {
    for (const code of Object.keys(REGISTERED)) {
      expect(codes.has(code), `${code} is registered but is not in the file index`).toBe(true);
    }
  });

  it("opens the right standard on the papers that were re-keyed", () => {
    // Each of these opened on the wrong task before the keys were corrected, so
    // the check is on the standard the paper is written to rather than on its
    // one-line summary, which is free prose and may frame the subject more
    // broadly than the task name does.
    const litigation = REGISTERED["E6.9"];
    expect(litigation.std).toMatch(/ISA 501/);
    expect(litigation.reqEn?.join(" ").toLowerCase()).toMatch(/litigation|claim/);

    expect(REGISTERED["E1.1"].std).toMatch(/ISA 315|ISA 330/);
    expect(REGISTERED["E1.1"].reqEn?.join(" ").toLowerCase()).toMatch(/\bit\b|information technology|itgc/);

    expect(REGISTERED["E3.1"].std).toMatch(/ISA 240/);
    expect(REGISTERED["E3.1"].reqEn?.join(" ").toLowerCase()).toMatch(/journal/);
  });

  it("gives both new papers real French and something to answer", () => {
    for (const [code, def] of [
      ["E1.1", REGISTERED["E1.1"]],
      ["E3.1", REGISTERED["E3.1"]],
    ] as const) {
      expect(def.ownsFr.trim().length, `${code} has no French`).toBeGreaterThan(0);
      expect(def.ownsFr).not.toBe(def.ownsEn);
      expect((def.conclEn ?? []).length, `${code} has no conclusion`).toBeGreaterThan(0);
      expect((def.conclEn ?? []).length).toBe((def.conclFr ?? []).length);
      // Every key the paper can persist must also be one the preparer is asked
      // for, or an answer is saved that nothing ever shows again.
      const persisted = paperKeys(def);
      for (const key of requiredKeys(def)) {
        expect(persisted.has(key), `${code}: ${key} is required but not persisted`).toBe(true);
      }
    }
  });
});
