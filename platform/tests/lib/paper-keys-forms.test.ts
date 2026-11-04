import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

import { LEGAL_FORMS } from "@/lib/legal-forms";
import { paperKeys } from "@/lib/papers/types";
import { allPaperKeys, paperFor } from "@/lib/working-papers";

// A key required on one legal form must be savable: the allow-list used to come
// from paperFor(code) with no form, which drops the form-restricted items.
describe("allPaperKeys", () => {
  it.each(["C5.3", "C5.5", "C5.8"])("%s holds every form's keys", (code) => {
    const all = allPaperKeys(code);
    for (const form of LEGAL_FORMS) {
      for (const key of paperKeys(paperFor(code, "current", form))) expect(all.has(key)).toBe(true);
    }
  });

  it("includes keys the formless paper leaves out on C5.3", () => {
    expect(allPaperKeys("C5.3").size).toBeGreaterThan(paperKeys(paperFor("C5.3")).size);
  });
});
