import { describe, expect, it, vi } from "vitest";

// lib/signoff-matrix reaches next-auth through lib/tenant; nothing here signs in
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

import { CONCLUSION_PAPERS } from "@/lib/papers/conclusion";
import { EXECUTION_PAPERS } from "@/lib/papers/execution";
import { JOURNAL_ENTRY_PAPERS } from "@/lib/papers/journal-entries";
import { STRATEGY_PAPERS } from "@/lib/papers/strategy";
import type { PaperDef, PaperItem, PaperProc } from "@/lib/papers/types";
import { matrixTasks } from "@/lib/signoff-matrix";
import {
  ISA_REF_KEYS,
  REVISED_2026_FROM,
  defaultStandardsEdition,
  editionForPeriod,
  editionLabel,
  editionLine,
  hasUnresolvedToken,
  isaRef,
  periodStartOf,
  resolvePaper,
  resolveText,
} from "@/lib/standards-edition";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

// The firm's decisions of 2026-10-27, batch 5:
//   F042 the materiality justification is the ISA 320 ¶14 one
//   F043 P5.1 carries the ISA 240 ¶40–43 communications, articulated with C5.6
//   F045 the standards edition per engagement: derived from the period start,
//        paper references and the going-concern wording rendered per edition
// and D5 of the DEV run of 2026-11-03 (sign-off rules ordered by code).

const procs = (def: PaperDef): PaperProc[] => (def.sections ?? []).flatMap((s) => (s.kind === "proc" ? s.procs : []));
const items = (def: PaperDef): PaperItem[] => (def.sections ?? []).flatMap((s) => (s.kind === "yn" ? s.items : []));
const allText = (def: PaperDef): string => JSON.stringify(def);

describe("F045 — the edition a period falls under", () => {
  it("computes the first day of the period from the period end and the duration", () => {
    expect(periodStartOf("2026-12-31")).toBe("2026-01-01");
    expect(periodStartOf("2026-12-31", 12)).toBe("2026-01-01");
    expect(periodStartOf("2027-06-30", 6)).toBe("2027-01-01");
    expect(periodStartOf("2027-06-30", 18)).toBe("2026-01-01");
    // a null or absurd duration means twelve months
    expect(periodStartOf("2027-03-31", null)).toBe("2026-04-01");
    expect(periodStartOf("2027-03-31", 0)).toBe("2026-04-01");
    // the day after the end, less the months: 1 April − 1 month = 1 March
    expect(periodStartOf("2027-03-31", 1)).toBe("2027-03-01");
    // month-end clamping, as Postgres does it: 31 May − 3 months = 28 February
    expect(periodStartOf("2027-05-30", 3)).toBe("2027-02-28");
    expect(() => periodStartOf("not a date")).toThrow("invalid-period-end");
  });

  it("switches to the revised standards for periods beginning on or after 15 December 2026", () => {
    expect(REVISED_2026_FROM).toBe("2026-12-15");
    expect(defaultStandardsEdition("2026-12-14")).toBe("current");
    expect(defaultStandardsEdition("2026-12-15")).toBe("revised_2026");
    expect(defaultStandardsEdition("2027-01-01")).toBe("revised_2026");
    expect(defaultStandardsEdition(new Date(Date.UTC(2026, 11, 15)))).toBe("revised_2026");
    expect(defaultStandardsEdition(null)).toBe("current");
    // the creation path: period end + duration
    expect(editionForPeriod("2026-12-31", 12)).toBe("current"); // 2026-01-01 → 2026-12-31
    expect(editionForPeriod("2027-11-30", 12)).toBe("current"); // begins 2026-12-01
    expect(editionForPeriod("2027-12-14", 12)).toBe("revised_2026"); // begins 2026-12-15
    expect(editionForPeriod("2027-12-31", null)).toBe("revised_2026");
    expect(editionForPeriod("2027-06-30", 6)).toBe("revised_2026"); // begins 2027-01-01
  });

  it("labels the edition in both languages as the firm worded it", () => {
    expect(editionLabel("current", "fr")).toBe("ISA en vigueur");
    expect(editionLabel("revised_2026", "fr")).toBe("ISA révisées (périodes ouvertes à partir du 15/12/2026)");
    expect(editionLine("current", "fr")).toBe("Édition des normes : ISA en vigueur");
    expect(editionLine("revised_2026", "en")).toBe("Standards edition: Revised ISAs (periods beginning on or after 15/12/2026)");
    expect(en.standardsEdition.label).toBe("Standards edition");
  });
});

describe("F045 — the reference catalogue", () => {
  it("renders ISA 240 and ISA 570 references per edition", () => {
    expect(isaRef("current", "ISA240.jeTesting")).toBe("ISA 240 ¶32");
    expect(isaRef("revised_2026", "ISA240.jeTesting")).toMatch(/^ISA 240 \(Revised\) ¶/);
    expect(isaRef("revised_2026", "ISA240.jeTesting", "fr")).toMatch(/^ISA 240 révisée ¶/);
    expect(isaRef("current", "ISA240.commMgmt")).toBe("ISA 240 ¶40");
    expect(isaRef("current", "ISA240.authorities")).toBe("ISA 240 ¶43");
    expect(isaRef("current", "ISA570.conclusions")).toBe("ISA 570 (Revised) ¶21–24");
    expect(isaRef("revised_2026", "ISA570.conclusions")).toBe("ISA 570 (Revised 2024) ¶21–24");
    expect(isaRef("current", "ISA570.horizon")).toMatch(/twelve months from the date of the financial statements/);
    expect(isaRef("revised_2026", "ISA570.horizon")).toMatch(/twelve months from the date of approval of the financial statements/);
    expect(isaRef("revised_2026", "ISA570.horizon", "fr")).toMatch(/douze mois à compter de la date d'approbation/);
    expect(isaRef("current", "ISA570.horizon", "fr")).toMatch(/douze mois à compter de la date de clôture/);
  });

  it("names every edition-dependent standard in both editions and both languages", () => {
    for (const key of ISA_REF_KEYS) {
      for (const edition of ["current", "revised_2026"] as const) {
        for (const locale of ["en", "fr"] as const) {
          const ref = isaRef(edition, key, locale);
          expect(ref.length, `${key} ${edition} ${locale}`).toBeGreaterThan(0);
          expect(hasUnresolvedToken(ref)).toBe(false);
        }
      }
    }
  });

  it("substitutes tokens and leaves an unknown one visible", () => {
    expect(resolveText("see {{ISA240.jeTesting}} and {{ISA570}}", "current", "en")).toBe("see ISA 240 ¶32 and ISA 570 (Revised)");
    expect(resolveText("voir {{ISA570}}", "revised_2026", "fr")).toBe("voir ISA 570 révisée 2024");
    expect(resolveText("{{Nope.key}}", "current", "en")).toBe("{{Nope.key}}");
    expect(resolveText("plain", "current", "en")).toBe("plain");
  });
});

describe("F045 — the papers read per edition", () => {
  const RAW: Record<string, PaperDef> = {
    ...STRATEGY_PAPERS,
    ...EXECUTION_PAPERS,
    ...JOURNAL_ENTRY_PAPERS,
    ...CONCLUSION_PAPERS,
  };

  it("resolves every token of every paper under both editions, and caches the result", () => {
    for (const [code, def] of Object.entries(RAW)) {
      for (const edition of ["current", "revised_2026"] as const) {
        const resolved = resolvePaper(def, edition);
        expect(hasUnresolvedToken(allText(resolved)), `${code} ${edition}`).toBe(false);
        expect(resolvePaper(def, edition)).toBe(resolved);
      }
    }
    // the raw S4.2 does carry tokens: the catalogue, not the paper, holds the wording
    expect(hasUnresolvedToken(allText(RAW["S4.2"]))).toBe(true);
  });

  it("keeps the keys of a paper identical under both editions", () => {
    for (const def of Object.values(RAW)) {
      const a = procs(resolvePaper(def, "current")).map((p) => p.key);
      const b = procs(resolvePaper(def, "revised_2026")).map((p) => p.key);
      expect(a).toEqual(b);
    }
  });

  it("S4.2 and E6.3 measure the twelve months from the FS date under the ISAs in force, from approval under ISA 570 (Revised 2024)", () => {
    for (const code of ["S4.2", "E6.3"]) {
      const current = allText(resolvePaper(RAW[code], "current"));
      const revised = allText(resolvePaper(RAW[code], "revised_2026"));
      expect(current, code).toMatch(/twelve months from the date of the financial statements/);
      expect(current, code).not.toMatch(/twelve months from the date of approval/);
      expect(current, code).toMatch(/ISA 570 \(Revised\) ¶13/);
      expect(current, code).not.toMatch(/Revised 2024\) ¶13/);
      expect(revised, code).toMatch(/twelve months from the date of approval of the financial statements/);
      expect(revised, code).not.toMatch(/twelve months from the date of the financial statements/);
      expect(revised, code).toMatch(/ISA 570 \(Revised 2024\) ¶13/);
      expect(revised, code).toMatch(/sixteen to eighteen months/);
    }
    expect(resolvePaper(RAW["S4.2"], "current").std).toBe("ISA 570 (Revised) ¶10–12");
    expect(resolvePaper(RAW["S4.2"], "revised_2026").std).toBe("ISA 570 (Revised 2024) ¶10–12");
    expect(resolvePaper(RAW["E6.3"], "current").std).toBe("ISA 570 (Revised) ¶12–20, ¶25");
    const s42Item = items(resolvePaper(RAW["S4.2"], "current")).find((i) => i.key === "assessment")!;
    expect(s42Item.fr).toMatch(/date de clôture des états financiers/);
  });

  it("C2.2, C5.1 and E6.3 keep the pre-2024 report paragraphs ¶21–24 under the ISAs in force", () => {
    expect(resolvePaper(RAW["C2.2"], "current").std).toBe("ISA 560 ¶6–17 · ISA 570 (Revised) ¶21–24");
    expect(resolvePaper(RAW["C2.2"], "revised_2026").std).toBe("ISA 560 ¶6–17 · ISA 570 (Revised 2024) ¶21–24");
    const gc = procs(resolvePaper(RAW["C5.1"], "current")).find((p) => p.key === "going_concern")!;
    expect(gc.srcEn).toBe("C2.2 · E6.3 · ISA 570 (Revised) ¶20, ¶22–23");
    expect(gc.en).toMatch(/ISA 570 \(Revised\) ¶22/);
    expect((resolvePaper(RAW["E6.3"], "current").conclEn ?? []).join(" ")).toMatch(/ISA 570 \(Revised\) ¶22/);
  });

  it("E3.1 and P5.1 cite ISA 240 under its current title today and as (Revised) from 2026-12-15", () => {
    const e31c = resolvePaper(RAW["E3.1"], "current");
    const e31r = resolvePaper(RAW["E3.1"], "revised_2026");
    // F032: the paper is anchored on ¶31–33 and cites the sub-paragraphs of ¶32
    expect(e31c.std).toBe("ISA 240 ¶31–33 · ISA 240 ¶29(c) · ISA 315 (Revised 2019) ¶26");
    expect(e31r.std).toMatch(/^ISA 240 \(Revised\) ¶31–33/);
    expect(procs(e31c).find((p) => p.key === "estimates")!.en).toMatch(/because ISA 240 ¶32\(b\) treats it/);
    expect(procs(e31r).find((p) => p.key === "estimates")!.fr).toMatch(/l'ISA 240 révisée ¶32 b\)/);
    expect(procs(e31c).find((p) => p.key === "criteria")!.srcEn).toMatch(/ISA 240 ¶32\(a\)/);
    expect(resolvePaper(RAW["P5.1"], "current").std).toBe("ISA 240 ¶12–27, ¶31–33, ¶40–43");
    expect(resolvePaper(RAW["P5.1"], "revised_2026").std).toMatch(/^ISA 240 \(Revised\)/);
  });
});

describe("F043 — the fraud communications on P5.1, articulated with C5.6", () => {
  const p51 = resolvePaper(STRATEGY_PAPERS["P5.1"], "current");
  const c56 = resolvePaper(CONCLUSION_PAPERS["C5.6"], "current");

  it("adds the four ISA 240 ¶40–43 procedures after the eight risk-assessment ones", () => {
    const keys = procs(p51).map((p) => p.key);
    expect(keys.slice(0, 8)).toEqual(["mgmt", "known", "tcwg", "factors", "analytics", "reliability", "revenue", "override"]);
    expect(keys.slice(8)).toEqual(["comm_mgmt", "comm_tcwg", "comm_other", "authorities"]);
    const by = Object.fromEntries(procs(p51).map((p) => [p.key, p]));
    expect(by.comm_mgmt.en).toMatch(/appropriate level of management on a timely basis/);
    expect(by.comm_mgmt.srcEn).toMatch(/ISA 240 ¶40/);
    expect(by.comm_tcwg.en).toMatch(/those charged with governance/);
    expect(by.comm_tcwg.en).toMatch(/C5\.11/);
    expect(by.comm_tcwg.srcEn).toMatch(/ISA 240 ¶41/);
    expect(by.comm_other.srcEn).toMatch(/ISA 240 ¶42/);
    expect(by.authorities.en).toMatch(/required by law|legal or regulatory duty/);
    expect(by.authorities.en).toMatch(/C5\.6/);
    expect(by.authorities.fr).toMatch(/révélation des faits délictueux/);
    expect(by.authorities.srcEn).toMatch(/ISA 240 ¶43/);
    expect(by.authorities.srcEn).toMatch(/C5\.6/);
    expect(by.authorities.srcEn).toMatch(/C5\.11/);
  });

  it("evaluates the communications in Part B and in a third conclusion", () => {
    const keys = items(p51).map((i) => i.key);
    expect(keys).toContain("comm_mgmt");
    expect(keys).toContain("comm_tcwg");
    expect(keys).toContain("authorities");
    expect(items(p51).find((i) => i.key === "authorities")!.en).toMatch(/C5\.6/);
    expect(p51.conclEn).toHaveLength(3);
    expect(p51.conclEn![2]).toMatch(/authorities/);
    expect(p51.conclFr![2]).toMatch(/C5\.6/);
    expect((p51.reqEn ?? []).join(" ")).toMatch(/ISA 240 ¶40/);
    expect((p51.reqFr ?? []).join(" ")).toMatch(/procureur de la République/);
  });

  it("C5.6 starts from the fraud findings and names P5.1 / E3.1 as its sources", () => {
    const facts = procs(c56).find((p) => p.key === "facts")!;
    expect(facts.srcEn).toMatch(/Findings register filtered on fraud/);
    expect(facts.srcEn).toMatch(/P5\.1 procedures 9–12/);
    expect(facts.srcEn).toMatch(/E3\.1/);
    expect(facts.srcFr).toMatch(/registre des constats filtré sur la fraude/i);
    expect(facts.en).toMatch(/findings register filtered on fraud/);
    expect((c56.reqEn ?? []).join(" ")).toMatch(/P5\.1 \(procedures 9 to 12/);
    expect((c56.reqFr ?? []).join(" ")).toMatch(/P5\.1 \(procédures 9 à 12/);
  });
});

describe("F042 — the materiality justification label", () => {
  it("names the benchmark, the percentage and the qualitative factors (ISA 320 ¶14)", () => {
    expect(en.planning.materiality.justification).toBe("Justification of the benchmark, percentage and qualitative factors (ISA 320 ¶14)");
    expect(fr.planning.materiality.justification).toBe("Justification de la base, du pourcentage et des facteurs qualitatifs (ISA 320 ¶14)");
    // nothing else moved
    expect(en.planning.materiality.performanceJustification).toBe("Justification of the performance materiality percentage"); // F033 vocabulary
  });
});

describe("D5 — the sign-off rules are ordered by code within each phase", () => {
  it("opens the acceptance phase on P1.1, not S6.1, and sorts numerically", () => {
    const tasks = matrixTasks();
    const acceptance = tasks.filter((t) => t.phase === "acceptance").map((t) => t.entry.code);
    expect(acceptance[0]).toBe("P1.1");
    expect(acceptance.indexOf("P1.2")).toBe(acceptance.indexOf("P1.1") + 1);
    expect(acceptance.indexOf("P1.3")).toBe(acceptance.indexOf("P1.2") + 1);
    const s = acceptance.filter((c) => c.startsWith("S"));
    const p = acceptance.filter((c) => c.startsWith("P"));
    if (s.length) expect(acceptance.indexOf(s[0])).toBeGreaterThan(acceptance.indexOf(p[p.length - 1]));
    // phases stay in order, and within a phase the codes are sorted
    const phases = [...new Set(tasks.map((t) => t.phase))];
    expect(phases).toEqual(["acceptance", "planning", "execution", "conclusion"]);
    for (const phase of phases) {
      const codes = tasks.filter((t) => t.phase === phase).map((t) => t.entry.code);
      const sorted = [...codes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      expect(codes).toEqual(sorted);
    }
    expect(tasks).toHaveLength(tasks.length); // every task kept
  });
});
