import { describe, expect, it, vi } from "vitest";

// UAT run 2 B33: the completion gate read a P1.5 field (q_eqr) the paper never
// had, so the recorded determination could not require the quality review.
// Every P1.5 field the gate reads must be one the paper can save.

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

import { eqrDeterminationFields } from "@/lib/completion";
import { EQR_CRITERIA_KEYS } from "@/lib/papers/acceptance";
import { paperKeys } from "@/lib/papers/types";
import { paperFor } from "@/lib/working-papers";

describe("P1.5 EQR determination fields", () => {
  it("reads only fields P1.5 saves (apart from the legacy q_eqr)", () => {
    const keys = paperKeys(paperFor("P1.5"));
    const read = eqrDeterminationFields().filter((k) => k !== "q_eqr");
    expect(read.length).toBe(EQR_CRITERIA_KEYS.length);
    expect(read.length).toBeGreaterThan(0);
    for (const k of read) expect(keys.has(k)).toBe(true);
  });

  it("covers every Part B criterion", () => {
    expect([...EQR_CRITERIA_KEYS].sort()).toEqual(
      ["capital", "complexity", "first_year", "high_risk", "law", "listed", "monitor", "pie", "policy"].sort(),
    );
  });
});
