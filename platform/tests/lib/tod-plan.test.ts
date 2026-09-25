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
    // remaining (B + S1…S30) 48 500 000 ÷ TE 1 000 000 = 48.5; coverage 9.3% → column 0 → factor 3.0 → 146 computed
    expect(p.factor).toBe(ART_MUS.high_sr.little[0]);
    expect(p.computedSize).toBe(146);
    // a population of 31 remaining lines (B and S1…S30) cannot yield 146: the size is
    // capped at the population and every remaining line is examined (UAT B79)
    expect(p.remainingCount).toBe(31);
    expect(p.sampleSize).toBe(31);
    expect(p.fullPopulation).toBe(true);
    expect(p.itemsDrawn).toBe(31);
    expect(p.sample.length).toBe(31);
    expect(new Set(p.sample.map((l) => l.ref)).size).toBe(p.sample.length);
    expect(p.sample.every((l) => l.amount < 4_000_000)).toBe(true);
  });

  it("reports the distinct items drawn when several hooks fall in one line", () => {
    // one line carries most of the value: hooks land in it repeatedly, it is listed once.
    // 9 300 000 ÷ TE 1 000 000 × 3.0 → 28 hooks over 31 lines: below the population, no cap
    const lines = [line("BIG", 9_000_000), ...Array.from({ length: 30 }, (_, i) => line(`S${i + 1}`, 10_000))];
    const p = planTod({ lines, te: 1_000_000, threshold: 20_000_000, cra: "high_sr", assurance: "little", startFraction: 0.1 });
    expect(p.computedSize).toBe(28);
    expect(p.sampleSize).toBe(28);
    expect(p.fullPopulation).toBe(false);
    expect(p.sample[0].ref).toBe("BIG");
    expect(p.itemsDrawn).toBe(p.sample.length);
    expect(p.itemsDrawn).toBeLessThan(p.sampleSize);
    expect(new Set(p.sample.map((l) => l.ref)).size).toBe(p.sample.length);
  });

  it("places exactly the requested number of hooks inside the population", () => {
    // 11 lines of 1 000 000; TE 1 375 000 → base 8 × 0.5 (minimal/little) = 4 hooks.
    // The interval is floored (2 750 000): a rounded-up 3 000 000 with a late start
    // would push the fourth hook past 11 000 000 and draw only three.
    const lines = Array.from({ length: 11 }, (_, i) => line(`L${i + 1}`, 1_000_000));
    const p = planTod({ lines, te: 1_375_000, threshold: 2_000_000, cra: "minimal", assurance: "little", startFraction: 0.9 });
    expect(p.sampleSize).toBe(4);
    expect(p.fullPopulation).toBe(false);
    expect(p.interval).toBe(2_750_000);
    expect(p.sample.map((l) => l.ref)).toEqual(["L3", "L6", "L8", "L11"]);
    expect(p.itemsDrawn).toBe(4);
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
