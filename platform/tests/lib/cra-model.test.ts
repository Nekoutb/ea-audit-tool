import { describe, expect, it } from "vitest";
import {
  craOf,
  thresholdSuggestion,
  timingSuggestion,
  toTod,
  todLabel,
  worstTod,
} from "@/lib/cra-model";

describe("the CRA matrix", () => {
  it("combines IR and CR per the four-cell matrix", () => {
    expect(craOf("lower", "rely")).toBe("minimal");
    expect(craOf("lower", "not_rely")).toBe("moderate");
    expect(craOf("higher", "rely")).toBe("low");
    expect(craOf("higher", "not_rely")).toBe("high");
  });

  it("overlays significant risk without creating a fifth level", () => {
    expect(toTod("low", true)).toBe("low_sr");
    expect(toTod("high", true)).toBe("high_sr");
    // a significant risk on a cell recorded lower/moderate stays conservative
    expect(toTod("minimal", true)).toBe("low_sr");
    expect(toTod("moderate", true)).toBe("high_sr");
    expect(toTod("moderate", false)).toBe("moderate");
  });

  it("rolls a set of cells up to the worst", () => {
    expect(worstTod(["minimal", "moderate", "low"])).toBe("moderate");
    expect(worstTod(["low_sr", "high", "minimal"])).toBe("high");
    expect(worstTod(["high", "high_sr"])).toBe("high_sr");
    expect(worstTod([])).toBeNull();
  });

  it("labels the overlay", () => {
    expect(todLabel("high_sr", "en")).toBe("High +SR");
    expect(todLabel("moderate", "fr")).toBe("Modéré");
  });
});

describe("the design guidance that follows the CRA", () => {
  it("tightens key-item thresholds as the CRA rises", () => {
    expect(thresholdSuggestion("minimal", "en")).toContain("75–100%");
    expect(thresholdSuggestion("high", "en")).toContain("10–25%");
    expect(thresholdSuggestion("high", "en")).toContain("5–10%");
  });

  it("shrinks the interim window as the CRA rises", () => {
    expect(timingSuggestion("minimal", "en")).toContain("6 months");
    expect(timingSuggestion("low", "en")).toContain("3 months");
    expect(timingSuggestion("high", "en")).toContain("period end");
  });
});
