import { describe, expect, it } from "vitest";
import { ACCEPTANCE_PAPERS } from "@/lib/papers/acceptance";
import { CONCLUSION_PAPERS } from "@/lib/papers/conclusion";
import { EXECUTION_PAPERS } from "@/lib/papers/execution";
import { FINANCIAL_STATEMENT_PAPERS } from "@/lib/papers/financial-statements";
import { GAM_PAPERS } from "@/lib/papers/gam";
import { ITGC_PAPERS } from "@/lib/papers/itgc";
import { JOURNAL_ENTRY_PAPERS } from "@/lib/papers/journal-entries";
import { STATUTORY_525_PAPERS } from "@/lib/papers/statutory-525";
import { STRATEGY_PAPERS } from "@/lib/papers/strategy";
import type { PaperDef, PaperProc } from "@/lib/papers/types";
import { hasUnresolvedToken, resolvePaper } from "@/lib/standards-edition";

// F046 (firm decision 2026-10-27): the practical tips, French first, written as
// drafts the firm will review — every procedure of these ten papers carries a
// tipFr prefixed "[Projet] " and a tipEn prefixed "[Draft] ". The first test
// lists what is still untipped across the whole set without failing, so the
// backlog is visible on every run; the second holds the ten.

const ALL: Record<string, PaperDef> = {
  ...ACCEPTANCE_PAPERS,
  ...STRATEGY_PAPERS,
  ...EXECUTION_PAPERS,
  ...ITGC_PAPERS,
  ...JOURNAL_ENTRY_PAPERS,
  ...FINANCIAL_STATEMENT_PAPERS,
  ...STATUTORY_525_PAPERS,
  ...CONCLUSION_PAPERS,
  ...GAM_PAPERS,
};

const TIPPED = ["E6.3", "C2.2", "C3.1", "C4.2", "C5.1", "C5.5", "C5.6", "C5.8", "E3.1", "P5.1"];

const procs = (def: PaperDef): PaperProc[] => (def.sections ?? []).flatMap((s) => (s.kind === "proc" ? s.procs : []));

describe("F046 — practical tips", () => {
  it("reports the papers and procedures still without a French tip (does not fail)", () => {
    const missing: string[] = [];
    let total = 0;
    for (const [code, def] of Object.entries(ALL)) {
      for (const p of procs(def)) {
        total += 1;
        if (!p.tipFr?.trim()) missing.push(`${code}/${p.key}`);
      }
    }
    const byPaper = new Map<string, number>();
    for (const m of missing) {
      const code = m.split("/")[0];
      byPaper.set(code, (byPaper.get(code) ?? 0) + 1);
    }
    console.info(
      `[paper-tips] ${total - missing.length}/${total} procedures carry a tipFr; ${byPaper.size} paper(s) still untipped: ` +
        [...byPaper.entries()].map(([c, n]) => `${c} (${n})`).join(", "),
    );
    expect(total).toBeGreaterThan(0);
  });

  it("gives every procedure of the ten papers a French draft tip and an English one", () => {
    for (const code of TIPPED) {
      const def = ALL[code];
      expect(def, `${code} is registered`).toBeDefined();
      const list = procs(def);
      expect(list.length, `${code} has procedures`).toBeGreaterThan(0);
      for (const p of list) {
        expect(p.tipFr, `${code}/${p.key} tipFr`).toMatch(/^\[Projet\] \S/);
        expect(p.tipEn, `${code}/${p.key} tipEn`).toMatch(/^\[Draft\] \S/);
        // two to four sentences of guidance, not a one-liner
        expect((p.tipFr ?? "").length, `${code}/${p.key} tipFr length`).toBeGreaterThan(120);
        expect((p.tipFr ?? "").split(/[.!?](\s|$)/).filter((s) => s.trim().length > 20).length, `${code}/${p.key} tipFr sentences`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("writes the ten papers' tips with no unresolved edition token once rendered", () => {
    for (const code of TIPPED) {
      for (const edition of ["current", "revised_2026"] as const) {
        for (const p of procs(resolvePaper(ALL[code], edition))) {
          expect(hasUnresolvedToken(`${p.tipEn} ${p.tipFr} ${p.srcEn} ${p.srcFr} ${p.en} ${p.fr}`), `${code}/${p.key} ${edition}`).toBe(false);
        }
      }
    }
  });

  it("counts the drafts written for the batch", () => {
    const n = TIPPED.reduce((acc, code) => acc + procs(ALL[code]).length, 0);
    // 10 + 7 + 10 + 8 + 12 + 8 + 7 + 6 + 12 + 12 — C5.1 gained the art. 710
    // certification and the specific verifications (F049), C5.5 the court step (F051)
    expect(n).toBe(92);
  });
});
