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
  it("says no confirmation was requested when the campaign is empty", () => {
    const fr = independenceStatement({ total: 0, completed: 0, exceptions: 0, undisposed: 0 }, true);
    expect(fr).toContain("Aucune confirmation d'indépendance n'a été demandée");
    expect(fr).not.toContain("Chaque membre");
  });

  it("states the outstanding confirmations instead of asserting all were given", () => {
    const en = independenceStatement({ total: 4, completed: 2, exceptions: 1, undisposed: 1 }, false);
    expect(en).toContain("1 not yet received");
    expect(en).not.toContain("Every team member");
    expect(en).toContain("await the partner's disposition");
  });

  it("asserts every member confirmed only when all are returned", () => {
    const fr = independenceStatement({ total: 3, completed: 3, exceptions: 0, undisposed: 0 }, true);
    expect(fr).toContain("Chaque membre de l'équipe a confirmé");
  });
});
