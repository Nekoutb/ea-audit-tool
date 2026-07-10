import { describe, expect, it } from "vitest";
import { generateWorkpaperDocx } from "@/lib/docx";
import { templateFor } from "@/lib/templates";

const FIELDS = {
  code: "D3.1",
  title: "Engagement Acceptance / Continuance Procedures",
  clientName: "Demo SA",
  fiscalYear: 2025,
  periodEnd: "2025-12-31",
  preparedBy: "Alice Alpha",
};

describe("working-paper docx generation", () => {
  it("resolves the D3.1 template and falls back to generic elsewhere", () => {
    expect(templateFor("D3.1").id).toBe("D3.1-acceptance");
    expect(templateFor("E100").id).toBe("generic");
  });

  it("renders a valid .docx (ZIP container) in both languages", async () => {
    for (const locale of ["en", "fr"] as const) {
      const buffer = await generateWorkpaperDocx(templateFor("D3.1"), FIELDS, locale);
      // A .docx is a ZIP: starts with the PK local-file-header signature.
      expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
      expect(buffer.length).toBeGreaterThan(2000);
    }
  });
});
