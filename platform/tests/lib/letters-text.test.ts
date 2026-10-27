import { describe, expect, it, vi } from "vitest";

// UAT run 2 B145 (double full stop after a recommendation) and B83 (the
// governance report asserted every member confirmed independence when none
// had been asked).

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

import { endSentence, independenceStatement } from "@/lib/letters";

describe("endSentence", () => {
  it("adds a full stop only when the text has none", () => {
    expect(endSentence("Require approval")).toBe("Require approval.");
    expect(endSentence("Require approval.")).toBe("Require approval.");
    expect(endSentence("Is it approved? ")).toBe("Is it approved?");
  });
});

describe("independenceStatement", () => {
  // F008: declarations are obtained outside the system and filed on P2.1;
  // the letter says where they are and counts nothing (UAT run 2 B83 still
  // holds: it never asserts that every member confirmed).
  it("points to the declarations filed on P2.1, in both languages", () => {
    const en = independenceStatement(false);
    expect(en).toContain("obtained outside the system");
    expect(en).toContain("P2.1");
    expect(en).not.toContain("Every team member confirmed");
    const fr = independenceStatement(true);
    expect(fr).toContain("en dehors du système");
    expect(fr).toContain("P2.1");
    expect(fr).not.toContain("Chaque membre");
  });
});
