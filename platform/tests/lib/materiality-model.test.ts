import { describe, expect, it } from "vitest";

import { uncorrectedMisstatementThreshold } from "@/lib/materiality-model";

// The SAD measures accumulated uncorrected misstatements against the margin
// performance materiality leaves below PM — UMT = PM − TE — not against TE
// itself, which would roughly double the tolerance and report "No" on a file
// whose misstatements have in fact breached the threshold.

describe("uncorrectedMisstatementThreshold", () => {
  it("is PM minus TE", () => {
    expect(uncorrectedMisstatementThreshold({ overall: 1_000_000, performance: 750_000 })).toBe(250_000);
    expect(uncorrectedMisstatementThreshold({ overall: 1_000_000, performance: 500_000 })).toBe(500_000);
  });

  it("is never TE itself", () => {
    const mat = { overall: 1_000_000, performance: 750_000 };
    expect(uncorrectedMisstatementThreshold(mat)).not.toBe(mat.performance);
  });

  it("never goes negative when TE exceeds PM", () => {
    expect(uncorrectedMisstatementThreshold({ overall: 400_000, performance: 500_000 })).toBe(0);
  });

  it("is null without a materiality", () => {
    expect(uncorrectedMisstatementThreshold(null)).toBeNull();
    expect(uncorrectedMisstatementThreshold(undefined)).toBeNull();
  });
});
