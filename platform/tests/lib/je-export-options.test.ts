import { describe, expect, it, vi } from "vitest";

// The export reads the run the studio sends. What matters is that nothing the
// auditor chose is lost on the way to the workbook, that a malformed body falls
// back to the paper's defaults instead of failing, and that the page size the
// screen used never limits the file: the paper holds the whole selection.

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

import { exportOptionsFrom } from "@/lib/je-export";
import { SELECTION_CAP } from "@/lib/je-selection";

const DATASET = "0f9a1b2c-3d4e-4f50-8a6b-7c8d9e0f1a2b";

describe("exportOptionsFrom", () => {
  it("carries the dataset, criteria, thresholds and rules of the run", () => {
    const options = exportOptionsFrom(
      {
        datasetId: DATASET,
        criteria: ["weekend-posting", "round-amount"],
        params: { roundMinimum: 500000, dateBasis: "entry" },
        userRules: [{ id: "r1", field: "account", operator: "startsWith", value: "47" }],
        limit: 50,
        offset: 100,
      },
      "fr",
    );
    expect(options.locale).toBe("fr");
    expect(options.datasetId).toBe(DATASET);
    expect(options.criteria).toEqual(["weekend-posting", "round-amount"]);
    expect(options.params).toMatchObject({ roundMinimum: 500000, dateBasis: "entry" });
    expect(options.userRules).toHaveLength(1);
  });

  it("holds the whole selection, whatever page size the screen used", () => {
    expect(exportOptionsFrom({ datasetId: DATASET, limit: 50 }, "en").limit).toBe(SELECTION_CAP);
  });

  it("falls back to the export's defaults on a malformed body", () => {
    for (const body of [null, "x", 42, { datasetId: "not-a-uuid", criteria: "weekend-posting", params: null, userRules: {} }]) {
      const options = exportOptionsFrom(body, "en");
      expect(options.datasetId, JSON.stringify(body)).toBeUndefined();
      expect(options.criteria, JSON.stringify(body)).toBeUndefined();
      expect(options.params, JSON.stringify(body)).toBeUndefined();
      expect(options.userRules, JSON.stringify(body)).toBeUndefined();
      expect(options.limit).toBe(SELECTION_CAP);
    }
  });
});
