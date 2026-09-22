import { describe, expect, it } from "vitest";
import { ART_MUS, planTod, type GlLine } from "@/lib/tod-plan";

// The plan behind every test-of-details sample: key items above the
// threshold are taken in full, the remainder is sized from TE and the
// audit-risk table, and the draw is systematic. The numbers below are
// checked by hand against the methodology's own formula.

const line = (ref: string, amount: number, account = "411100"): GlLine => ({ ref, account, amount });

const LINES: GlLine[] = [
  line("A", 5_000_000), line("B", 2_000_000), // key items at a 1 000 000 threshold
  ...Array.from({ length: 30 }, (_, i) => line(`S${i + 1}`, 100_000 * (i + 1))), // 100k … 3 000k: S10+ are ≥ 1 000 000
];

describe("planTod", () => {
  it("splits key items from the rest at the threshold and sizes the sample from TE", () => {
    const p = planTod({ lines: LINES, te: 1_500_000, threshold: 1_000_000, cra: "moderate", assurance: "little", startFraction: 0.5 });
    expect(p.threshold).toBe(1_000_000);
    // A, B and S10…S30 (21 lines) are at or above 1 000 000
    expect(p.keyItems.map((l) => l.ref)).toEqual(["A", "B", ...Array.from({ length: 21 }, (_, i) => `S${i + 10}`)]);
    expect(p.remainingCount).toBe(9);
    expect(p.remainingValue).toBe(4_500_000); // 100k+…+900k
    expect(p.baseSize).toBe(3); // 4 500 000 ÷ 1 500 000
    // coverage: (7 000 000 + 42 000 000) / 53 500 000 = 91.6% → column 90 → moderate/little = null
    expect(p.coverageColumn).toBe(90);
    expect(p.factor).toBeNull();
    expect(p.sampleSize).toBe(0);
    expect(p.sample).toEqual([]);
  });

  it("draws a systematic sample of the computed size when the table asks for one", () => {
    const p = planTod({ lines: LINES, te: 1_000_000, threshold: 4_000_000, cra: "high_sr", assurance: "little", startFraction: 0.25 });
    expect(p.keyItems.map((l) => l.ref)).toEqual(["A"]);
    // remaining 48 500 000 ÷ TE 1 000 000 = 48.5; coverage 9.3% → column 0 → factor 3.0 → 146
    expect(p.factor).toBe(ART_MUS.high_sr.little[0]);
    expect(p.sampleSize).toBe(146);
    expect(p.interval).toBe(Math.round(48_500_000 / 146));
    // a population of 31 lines cannot yield 146 distinct lines: a line is drawn at most once, and a
    // line smaller than the interval may hold no hook at all
    expect(p.sample.length).toBeGreaterThan(20);
    expect(p.sample.length).toBeLessThanOrEqual(31);
    expect(new Set(p.sample.map((l) => l.ref)).size).toBe(p.sample.length);
    expect(p.sample.every((l) => l.amount < 4_000_000)).toBe(true);
  });

  it("defaults the threshold to TE and ignores zero or negative lines", () => {
    const p = planTod({ lines: [...LINES, line("Z", 0), line("N", -5)], te: 2_500_000, cra: "low", assurance: "some", startFraction: 0 });
    expect(p.threshold).toBe(2_500_000);
    expect(p.populationCount).toBe(32);
    expect(p.keyItems.map((l) => l.ref)).toEqual(["A", "S25", "S26", "S27", "S28", "S29", "S30"]);
  });

  it("is reproducible for a given start fraction", () => {
    const a = planTod({ lines: LINES, te: 500_000, threshold: 10_000_000, cra: "moderate", assurance: "some", startFraction: 0.4 });
    const b = planTod({ lines: LINES, te: 500_000, threshold: 10_000_000, cra: "moderate", assurance: "some", startFraction: 0.4 });
    expect(a.sample.map((l) => l.ref)).toEqual(b.sample.map((l) => l.ref));
    expect(a.sample.length).toBeGreaterThan(0);
  });
});
