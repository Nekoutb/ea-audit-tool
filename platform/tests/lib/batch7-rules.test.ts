import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "fr" }));

import { localizedSummary } from "@/lib/activity-summary";
import { computeLeadChecks } from "@/lib/analytical-procedures";
import { DEFAULT_FRAMEWORK, FRAMEWORKS, canEditClient, frameworkLabel, isGovernanceMode } from "@/lib/clients";
import { NATURE_OPTIONS } from "@/lib/complexity";
import { visibleE4Codes } from "@/lib/design-procedures";
import { conditionalTriggerText } from "@/lib/engagement-dashboard";
import { DEFAULT_FILE_INDEX, itemsForComplexity, natureHasAuditProgramme, shortTitle } from "@/lib/file-index";
import { currencyLabel, formatAmount } from "@/lib/format";
import { agoDeadline, fmtDate, fmtDateTime } from "@/lib/format-date";
import { assetBasisLabel, bilanTotals, incomeFromTb } from "@/lib/fs-captions";
import { relativeVariance } from "@/lib/ratio-formulas";
import { methodologyMatches, normalizeSearchText } from "@/lib/search-methodology";
import { signatureMarks } from "@/lib/signature-marks";
import { signedByNonAssignee } from "@/lib/signoff-matrix";
import { buildSubstantiveWorkbook } from "@/lib/substantive-workbook";
import { GROUP_BY_ID } from "@/lib/task-groups";
import { OHADA_FS_CHECKLIST } from "@/lib/ohada-fs-checklist";
import { paperFor } from "@/lib/working-papers";
import { TEMPLATES, templateContent, templateForCode } from "@/lib/wp-templates";

const row = (account: string, value: number) => ({ account, value });

describe("F013 — one SYSCOHADA balance sheet", () => {
  const tb = [
    row("101000", -500),
    row("211000", 1000),
    row("281000", -200), // amortisation nets the fixed assets
    row("311000", 300),
    row("391000", -50), // depreciation nets the inventory
    row("411000", 400),
    row("491000", -40), // depreciation nets the receivables
    row("401000", -600), // class 4 in credit is a liability
    row("521000", 100),
    row("531000", -30), // a bank in credit is a liability
    row("561000", -70), // 56 is passif whatever its sign
    row("591000", -10), // depreciation nets the cash
    row("601000", 700),
    row("701000", -900),
    row("851000", 20),
    row("891000", 50), // income tax
  ];

  it("states total assets net, with class 4 by sign and 56 as a liability", () => {
    const b = bilanTotals(tb);
    expect(b.fixedAssets).toBe(800);
    expect(b.inventory).toBe(250);
    expect(b.receivables).toBe(360);
    expect(b.cashAssets).toBe(90);
    expect(b.totalAssets).toBe(800 + 250 + 360 + 90);
    expect(b.class4Credit).toBe(600);
    expect(b.cashLiabilities).toBe(100);
  });

  it("names the basis beside the figure, with the TB version", () => {
    expect(assetBasisLabel("fr", 3)).toBe("Total actif net (SYSCOHADA), balance v3");
    expect(assetBasisLabel("en", null)).toBe("Total net assets (SYSCOHADA)");
  });

  it("F019/F064: result before tax is 7 and 8 without 89 less 6; net result takes 89 off", () => {
    const income = incomeFromTb(tb);
    expect(income.beforeTax).toBe(900 - 700 - 20);
    expect(income.incomeTax).toBe(50);
    expect(income.netResult).toBe(130);
  });
});

describe("F018 — the lead schedule's checks", () => {
  const indexes = [
    { code: "E", titleEn: "Receivables", titleFr: "Clients" },
    { code: "C", titleEn: "Cash", titleFr: "Trésorerie" },
  ];
  it("ties when balanced, and lists unmapped accounts and empty indexes", () => {
    const rows = [
      { account: "411", closing: 100 },
      { account: "101", closing: -80 },
      { account: "999", closing: -20 },
    ];
    const checks = computeLeadChecks(rows, (a) => (a === "411" ? "E" : a === "101" ? "T" : null), indexes);
    expect(checks.tbDifference).toBe(0);
    expect(checks.unmapped).toEqual([{ account: "999", closing: -20 }]);
    expect(checks.unmappedTotal).toBe(-20);
    expect(checks.emptyIndexes.map((i) => i.code)).toEqual(["C"]);
  });
  it("shows the difference when the TB does not balance", () => {
    const checks = computeLeadChecks([{ account: "411", closing: 100 }], () => "E", indexes);
    expect(checks.tbDifference).toBe(100);
  });
});

describe("F064 — relative change of a ratio", () => {
  it("drops it for ratios and percentages", () => {
    expect(relativeVariance("%", 50, 0.01)).toBeNull();
    expect(relativeVariance("x", 5, 1)).toBeNull();
  });
  it("caps it for amounts", () => {
    expect(relativeVariance("FCFA", 1_000_000, 1)).toBe(999);
    expect(relativeVariance("FCFA", -1_000_000, 1)).toBe(-999);
    expect(relativeVariance("FCFA", 150, 100)).toBe(50);
    expect(relativeVariance("FCFA", 150, 0)).toBeNull();
  });
});

describe("F029 — one date format", () => {
  it("never shifts a bare date, and reads DD/MM/YYYY", () => {
    expect(fmtDate("2025-12-31")).toBe("31/12/2025");
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate("31/12/2025 10:00 WAT")).toBe("31/12/2025 10:00 WAT");
  });
  it("shows an instant in the firm's time zone with the zone named", () => {
    expect(fmtDateTime("2026-03-01T23:30:00Z")).toBe("02/03/2026 00:30 WAT");
    expect(fmtDateTime("02/03/2026 00:30 WAT")).toBe("02/03/2026 00:30 WAT");
  });
});

describe("F076 — AGO date is period end + 6 months", () => {
  it("keeps a month-end a month-end", () => {
    expect(agoDeadline("2025-12-31")).toBe("2026-06-30");
    expect(agoDeadline("2025-06-30")).toBe("2025-12-31");
    expect(agoDeadline("2025-08-31")).toBe("2026-02-28");
    expect(agoDeadline("2025-03-15")).toBe("2025-09-15");
  });
});

describe("F087 — amounts and currency", () => {
  it("follows the language and never prints -0", () => {
    expect(formatAmount(-0.2, "en")).toBe("0");
    expect(formatAmount(1234567, "en")).toBe("1,234,567");
    expect(formatAmount(1234567, "fr").replace(/\s/g, " ")).toBe("1 234 567");
  });
  it("is FCFA whatever the file calls it", () => {
    for (const stored of ["XAF", "XOF", null, undefined, "F CFA"]) expect(currencyLabel(stored)).toBe("FCFA");
  });
});

describe("F073–F075 — framework, client record, natures", () => {
  it("offers SYSCOHADA révisé système normal only", () => {
    expect(FRAMEWORKS).toEqual(["SYSCOHADA"]);
    expect(DEFAULT_FRAMEWORK).toBe("SYSCOHADA");
    expect(frameworkLabel("SYSCOHADA", "fr")).toBe("SYSCOHADA révisé — système normal");
    expect(frameworkLabel("IFRS", "fr")).toBe("IFRS"); // an older value still reads
  });
  it("lets firm admins and partners edit the client record, nobody else", () => {
    expect(canEditClient("firm_admin")).toBe(true);
    expect(canEditClient("partner")).toBe(true);
    for (const role of ["manager", "senior", "staff", "read_only", "client_user"]) expect(canEditClient(role)).toBe(false);
  });
  it("knows the four governance modes", () => {
    for (const mode of ["ca_pdg", "ca_dg", "administrateur_general", "gerance"]) expect(isGovernanceMode(mode)).toBe(true);
    expect(isGovernanceMode("other")).toBe(false);
  });
  it("adds limited review and contribution audit, not fusion or transformation", () => {
    const values: string[] = NATURE_OPTIONS.map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(["statutory_audit", "contractual_audit", "limited_review", "commissariat_apports"]));
    expect(values.some((v) => /fusion|transformation/.test(v))).toBe(false);
  });
  it("gives each its own file index, whatever the complexity", () => {
    const review = itemsForComplexity("complex", "SA", "limited_review").map((e) => e.code);
    expect(review).toContain("C5.1");
    expect(review.some((c) => /^E4\./.test(c) || /^S2\./.test(c) || c === "E3.1")).toBe(false);
    expect(itemsForComplexity("very_simple", "SA", "limited_review").map((e) => e.code)).toEqual(review);
    const apports = itemsForComplexity("complex", "SA", "commissariat_apports").map((e) => e.code);
    expect(apports.length).toBeLessThan(review.length);
    expect(apports).toContain("S5.1");
    // every code in a scope exists in the index
    const known = new Set(DEFAULT_FILE_INDEX.map((e) => e.code));
    for (const code of [...review, ...apports]) expect(known.has(code)).toBe(true);
    expect(natureHasAuditProgramme("limited_review")).toBe(false);
    expect(natureHasAuditProgramme("statutory_audit")).toBe(true);
  });
  it("drops the statutory papers from a contractual audit, keeps them on a statutory one", () => {
    const contractual = itemsForComplexity("complex", "SA", "contractual_audit").map((e) => e.code);
    expect(contractual).toContain("C5.1");
    expect(contractual).not.toContain("C5.3");
    expect(itemsForComplexity("complex", "SA", "statutory_audit").map((e) => e.code)).toContain("C5.3");
    expect(itemsForComplexity("complex", "SA").map((e) => e.code)).toContain("C5.3");
  });
});

describe("F007 — signature marks", () => {
  it("marks partner-gated papers with A and C4.2 with EQR", () => {
    expect(signatureMarks("P1.1").partner).toBe(true);
    expect(signatureMarks("C5.3").partner).toBe(true);
    expect(signatureMarks("E4.1").partner).toBe(false);
    expect(signatureMarks("C4.2").eqr).toBe(true);
    expect(signatureMarks("C4.1").eqr).toBe(false);
  });
});

describe("F010 — E4 lists one population", () => {
  it("shows what was designed, what has no index, and what already holds work", () => {
    const designed = new Set(["E"]); // E4.1 is index E
    const status = (code: string) => (code === "E4.2" ? "in_progress" : "not_started");
    const shown = visibleE4Codes(["E4.1", "E4.2", "E4.3"], status, designed);
    expect(shown).toContain("E4.1");
    expect(shown).toContain("E4.2");
    expect(shown).not.toContain("E4.3");
  });
});

describe("F021 — a signature by someone else is flagged", () => {
  it("only when someone was assigned", () => {
    expect(signedByNonAssignee("Anne", ["Bob"])).toBe(true);
    expect(signedByNonAssignee("Anne", ["Anne", "Bob"])).toBe(false);
    expect(signedByNonAssignee("Anne", [null, undefined])).toBe(false);
    expect(signedByNonAssignee(null, ["Bob"])).toBe(false);
  });
});

describe("F022, F023 — codification", () => {
  it("renames group E5, keeps its codes", () => {
    expect(GROUP_BY_ID.e5.titleEn).toBe("Specific procedures (E3, E6)");
    expect(GROUP_BY_ID.e5.members).toContain("E3.1");
    expect(GROUP_BY_ID.e5.members).toContain("E6.10");
  });
  it("retitles C2.2 for both conclusions it owns", () => {
    const c22 = DEFAULT_FILE_INDEX.find((e) => e.code === "C2.2");
    expect(c22?.titleEn).toContain("going concern");
    expect(c22?.titleFr).toContain("continuité");
    expect(shortTitle("C2.2", "fr", "")).toContain("continuité");
  });
});

describe("F026 — no reference to a document outside the file", () => {
  it("leaves none in the papers", () => {
    for (const entry of DEFAULT_FILE_INDEX) {
      const text = JSON.stringify(paperFor(entry.code));
      expect(text, entry.code).not.toMatch(/\bIAM\b|Handbook|form 280|formulaire 280|OST\/OSP|Form D4/);
    }
  });
});

describe("F031 — why a conditional paper is out", () => {
  it("states the exact trigger", () => {
    expect(conditionalTriggerText("S5.1", "fr")).toContain("S6.1");
    expect(conditionalTriggerText("P1.2", "en")).toContain("First-year");
    expect(conditionalTriggerText("E5.1", "en")).toContain("E4");
    expect(conditionalTriggerText("E4.1", "en")).toBeNull();
  });
});

describe("F062 — every substantive index has a paper; the checklist is in the app", () => {
  it("gives every E4 index a template, generated for those without one", () => {
    for (const entry of DEFAULT_FILE_INDEX.filter((e) => /^E4\./.test(e.code))) {
      expect(templateForCode(entry.code), entry.code).toBeTruthy();
    }
    expect(templateForCode("E4.1")?.key).not.toContain("generic");
    expect(new Set(TEMPLATES.map((t) => t.key)).size).toBe(TEMPLATES.length);
  });
  it("generates the sheet with population, selection, tests, exceptions and conclusion", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const buffer = await buildSubstantiveWorkbook({ code: "E4.5", titleEn: "Title", titleFr: "Titre", locale: "fr" });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const text = JSON.stringify(wb.worksheets[0].getSheetValues());
    for (const part of ["Population", "Sélection", "Tests", "Anomalies", "Conclusion"]) expect(text).toContain(part);
    const generic = TEMPLATES.find((t) => t.key.startsWith("substantive-generic-"));
    expect(generic).toBeTruthy();
    expect((await templateContent(generic!.key, "en"))?.content.length).toBeGreaterThan(1000);
  });
  it("puts each OHADA checklist row on E6.10 as a yes/no answer with its article", () => {
    const def = paperFor("E6.10");
    const items = (def.sections ?? []).flatMap((s) => (s.kind === "yn" ? s.items : []));
    for (const section of OHADA_FS_CHECKLIST) {
      for (const r of section.rows) {
        const item = items.find((i) => i.en.startsWith(`${r.ref} — `));
        expect(item, r.ref).toBeTruthy();
        expect(item?.fr).toContain(r.article);
      }
    }
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });
});

describe("F079 — the methodology is searchable", () => {
  it("normalises references", () => {
    expect(normalizeSearchText("ISA 260/265 Évaluation")).toBe("isa 260 265 evaluation");
  });
  it("finds what the database cannot see", () => {
    expect(methodologyMatches("ISA 700", "en").has("C5.1")).toBe(true);
    expect(methodologyMatches("DSF", "fr").has("E6.10")).toBe(true);
    expect(methodologyMatches("265", "fr").size).toBeGreaterThan(0);
    expect(methodologyMatches("zzzqqq", "en").size).toBe(0);
    expect(methodologyMatches("a", "en").size).toBe(0);
  });
});

describe("F086 — the trail reads in French", () => {
  it("translates what it recognises and leaves the rest as stored", () => {
    expect(localizedSummary("Password changed", "fr")).toBe("Mot de passe modifié");
    expect(localizedSummary("E4.1 signed off as preparer (signed by non-assignee)", "fr")).toBe(
      "E4.1 signé comme préparateur (signé par un non-assigné)",
    );
    expect(localizedSummary("Firm retention period set to 10 years", "fr")).toBe("Durée de conservation du cabinet fixée à 10 ans");
    expect(localizedSummary("Password changed", "en")).toBe("Password changed");
    expect(localizedSummary("Something unknown", "fr")).toBe("Something unknown");
  });
});
