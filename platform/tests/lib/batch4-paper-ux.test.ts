import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Batch 4 (firm decisions of 2026-10-27):
//   F039 — the answerable conclusion sits on the LAST wizard page, page 1
//          shows a read-only status summary;
//   F040 — N/A on every Part B item and every Part A procedure, with a
//          mandatory reason: an N/A without one is unanswered;
//   F041 — a sixth assertion, RO (rights and obligations), across the risk
//          register, the CRA matrix and the procedure design, shown with its
//          full label everywhere.

import { ASSERTIONS, ASSERTION_LABELS, assertionLabel, assertionLabels, cleanAssertions, isAssertion } from "@/lib/assertions";
import { ASSERTIONS as DESIGN_ASSERTIONS } from "@/lib/design-procedures-model";
import { PLATFORM_OF_CANONICAL, PROCEDURE_LIBRARY, toLegacyAssertions } from "@/lib/procedure-library";
import { cellsToAssess } from "@/lib/cra-model";
import {
  NA,
  keyAnswered,
  paperKeys,
  procKey,
  procNaKey,
  procWhyKey,
  requiredKeys,
  unansweredKeys,
  ynKey,
  ynWhyKey,
  type PaperDef,
} from "@/lib/papers/types";

// ------------------------------------------------------------------ F040 --

const PAPER: PaperDef = {
  std: "ISA 230",
  ownsEn: "a test paper",
  ownsFr: "une feuille de test",
  conclEn: ["The objective was achieved."],
  conclFr: ["L'objectif est atteint."],
  sections: [
    {
      kind: "proc",
      titleEn: "Part A — Procedures",
      titleFr: "Partie A — Procédures",
      procs: [
        { key: "walk", en: "Walk the process", fr: "Dérouler le processus", srcEn: "Narrative", srcFr: "Narratif" },
        { key: "recalc", en: "Recompute the schedule", fr: "Recalculer l'état", srcEn: "Schedule", srcFr: "État" },
      ],
    },
    {
      kind: "yn",
      titleEn: "Part B — Factors",
      titleFr: "Partie B — Facteurs",
      items: [
        { key: "f1", en: "Factor one", fr: "Facteur un" },
        // a paper that offered N/A before F040: the flag is kept, harmless
        { key: "f2", en: "Factor two", fr: "Facteur deux", na: true },
      ],
    },
  ],
};

/** every required key answered the plain way */
const answeredPaper = (): Record<string, string> => ({
  [procKey("walk")]: "Done — see A.1",
  [procKey("recalc")]: "Agrees to the GL",
  [ynKey("f1")]: "yes",
  [ynKey("f2")]: "yes",
  c_0: "yes",
});

describe("F040 — N/A with a reason on every item and procedure", () => {
  it("persists the procedure N/A flag and reason without adding to the required count", () => {
    const keys = paperKeys(PAPER);
    expect(keys.has(procNaKey("walk"))).toBe(true);
    expect(keys.has(procWhyKey("walk"))).toBe(true);
    expect(keys.has(ynWhyKey("f1"))).toBe(true);
    // the progress total is unchanged: 2 procedures + 2 factors + 1 conclusion
    expect(requiredKeys(PAPER)).toEqual([procKey("walk"), procKey("recalc"), ynKey("f1"), ynKey("f2"), "c_0"]);
  });

  it("treats a plainly answered paper as complete", () => {
    expect(unansweredKeys(PAPER, answeredPaper())).toEqual([]);
  });

  it("counts an N/A factor as unanswered until its reason is written — on every item, flagged or not", () => {
    for (const item of ["f1", "f2"]) {
      const withoutReason = { ...answeredPaper(), [ynKey(item)]: NA, [ynWhyKey(item)]: "" };
      expect(unansweredKeys(PAPER, withoutReason)).toEqual([ynKey(item)]);
      const withReason = { ...withoutReason, [ynWhyKey(item)]: "No such transactions this year." };
      expect(unansweredKeys(PAPER, withReason)).toEqual([]);
    }
  });

  it("ignores whitespace as a reason", () => {
    const values = { ...answeredPaper(), [ynKey("f1")]: NA, [ynWhyKey("f1")]: "   " };
    expect(keyAnswered(PAPER, ynKey("f1"), values)).toBe(false);
  });

  it("counts an N/A procedure as unanswered until its reason is written, whatever the result box holds", () => {
    const flagged = { ...answeredPaper(), [procKey("walk")]: "", [procNaKey("walk")]: NA };
    expect(unansweredKeys(PAPER, flagged)).toEqual([procKey("walk")]);
    // a stale result left behind does not stand in for the reason
    expect(unansweredKeys(PAPER, { ...flagged, [procKey("walk")]: "old result" })).toEqual([procKey("walk")]);
    const explained = { ...flagged, [procWhyKey("walk")]: "The entity has no such process." };
    expect(unansweredKeys(PAPER, explained)).toEqual([]);
  });

  it("keeps a procedure answered by its result when the flag is cleared", () => {
    const cleared = { ...answeredPaper(), [procNaKey("walk")]: "", [procWhyKey("walk")]: "left over" };
    expect(keyAnswered(PAPER, procKey("walk"), cleared)).toBe(true);
    expect(keyAnswered(PAPER, procKey("walk"), { ...cleared, [procKey("walk")]: "" })).toBe(false);
  });

  it("keeps a stored 'na' from before F040 valid once it carries a reason", () => {
    const legacy = { ...answeredPaper(), [ynKey("f2")]: "na", [ynWhyKey("f2")]: "Recorded last year." };
    expect(unansweredKeys(PAPER, legacy)).toEqual([]);
  });

  it("does not read a plain input field that happens to start with p_ as a procedure", () => {
    const simple: PaperDef = {
      std: "ISA 230",
      ownsEn: "x",
      ownsFr: "x",
      fields: [{ key: "p_notes", kind: "input", labelEn: "Notes", labelFr: "Notes" }],
    };
    expect(keyAnswered(simple, "p_notes", { p_notes: "text", p_notes_na: NA })).toBe(true);
  });
});

// ------------------------------------------------------------------ F041 --

describe("F041 — the sixth assertion, RO", () => {
  it("adds RO to the shared set, the design set and the labels, with full labels in both languages", () => {
    expect([...ASSERTIONS]).toEqual(["C", "E", "A", "V", "P", "RO"]);
    expect(DESIGN_ASSERTIONS).toEqual([...ASSERTIONS]);
    expect(ASSERTION_LABELS.RO).toEqual({ en: "Rights and obligations", fr: "Droits et obligations" });
    expect(assertionLabel("RO", "en")).toBe("RO — Rights and obligations");
    expect(assertionLabel("RO", "fr")).toBe("RO — Droits et obligations");
    expect(assertionLabel("C", "en")).toBe("C — Completeness");
    expect(assertionLabel("C", "fr")).toBe("C — Exhaustivité");
    expect(assertionLabels(["C", "RO"], "fr")).toBe("C — Exhaustivité · RO — Droits et obligations");
    expect(isAssertion("RO")).toBe(true);
    expect(isAssertion("O")).toBe(false);
  });

  it("keeps RO and drops anything else when cleaning a posted list", () => {
    expect(cleanAssertions(["RO", "C", "RO", "X", 3, "AVA"])).toEqual(["RO", "C"]);
    expect(cleanAssertions("RO")).toEqual([]);
  });

  it("maps the nine canonical library codes onto the six platform codes, RO to RO", () => {
    expect(PLATFORM_OF_CANONICAL).toEqual({ O: "E", C: "C", A: "A", CO: "A", CL: "P", E: "E", RO: "RO", AVA: "V", P: "P" });
    expect(toLegacyAssertions(["RO", "O", "E"])).toEqual(["RO", "E"]);
    // every library entry lands inside the platform set
    for (const entry of PROCEDURE_LIBRARY) {
      for (const code of toLegacyAssertions(entry.assertions)) expect(isAssertion(code)).toBe(true);
    }
    // the circularisation procedures that test ownership now carry RO
    expect(toLegacyAssertions(PROCEDURE_LIBRARY.find((e) => e.code === "R.120")!.assertions)).toContain("RO");
  });

  it("reports a relevant cell without IR or CR as still to assess", () => {
    const rows = [
      {
        indexCode: "E",
        cells: [
          { assertion: "C", relevant: true, ir: "lower", cr: "not_rely" },
          { assertion: "RO", relevant: true, ir: null, cr: null },
          { assertion: "P", relevant: false, ir: null, cr: null },
          { assertion: "V", relevant: true, ir: "higher", cr: null },
        ],
      },
    ];
    expect(cellsToAssess(rows)).toEqual([
      { indexCode: "E", assertion: "RO" },
      { indexCode: "E", assertion: "V" },
    ]);
  });
});

// The CRA board itself, against a fake transaction: an engagement assessed
// before F041 shows RO on every row, empty and to be assessed, and its
// account roll-up does not move until someone records the cell.
const TENANT = "4b4b4b4b-4b4b-4b4b-8b4b-4b4b4b4b4b01";
const ENGAGEMENT = "4b4b4b4b-4b4b-4b4b-8b4b-4b4b4b4b4b02";
let savedCells: { index_code: string; assertion: string; relevant: boolean; ir: string | null; ir_basis: string | null; cr: string | null; cr_basis: string | null }[] = [];

vi.mock("@/lib/db", () => ({
  withTenant: async <T>(_tenantId: string, fn: (tx: unknown) => Promise<T>): Promise<T> =>
    fn({
      query: async (sql: string) => {
        if (sql.includes("FROM cra_assessment_history")) return { rows: [] };
        if (sql.includes("FROM cra_assessment WHERE")) return { rows: savedCells };
        if (sql.includes("SELECT (e.phase")) return { rows: [{ locked: false }] };
        return { rows: [] };
      },
    }),
}));
// the membership rule has its own tests (engagement-write-guard); these mock the database
vi.mock("@/lib/engagement-access", () => ({
  requireEngagementRead: async () => undefined,
  requireEngagementWrite: async () => undefined,
  requireChildRead: async () => undefined,
  requireChildWrite: async () => undefined,
  visibleToUser: async () => true,
}));

vi.mock("@/lib/tenant", () => ({
  requireTenant: async () => ({ tenantId: TENANT, userId: "u", role: "firm_admin", locale: "en" }),
  requireWrite: async () => ({ tenantId: TENANT, userId: "u", role: "firm_admin", locale: "en" }),
  ForbiddenError: class ForbiddenError extends Error {},
}));
vi.mock("@/lib/activity", () => ({ recordActivity: async () => undefined }));
vi.mock("@/lib/scots", () => ({ listScots: async () => [] }));
vi.mock("@/lib/working-papers", () => ({ loadPaper: async () => ({}) }));
vi.mock("@/lib/significant-accounts", () => ({
  significantAccounts: async () => ({
    tolerableError: 1000,
    glAvailable: true,
    rows: [
      { index: "E", label: "Trade receivables", closing: 500_000, status: "significant", assertions: ["C", "E"], riskAssertions: [] },
    ],
  }),
}));

import { craBoard, rowWorstTod } from "@/lib/cra";

describe("F041 — the CRA board of an engagement assessed before RO existed", () => {
  it("shows RO on the row, empty and to be assessed, without moving the roll-up", async () => {
    savedCells = [
      { index_code: "E", assertion: "C", relevant: true, ir: "lower", ir_basis: null, cr: "rely", cr_basis: null },
      { index_code: "E", assertion: "E", relevant: true, ir: "lower", ir_basis: null, cr: "rely", cr_basis: null },
    ];
    const view = await craBoard(ENGAGEMENT);
    const row = view.rows[0];
    expect(row.cells.map((c) => c.assertion)).toEqual(["C", "E", "A", "V", "P", "RO"]);
    const ro = row.cells.find((c) => c.assertion === "RO")!;
    expect(ro.relevant).toBe(true);
    expect(ro.relevantDefaulted).toBe(true);
    expect(ro.ir).toBeNull();
    expect(ro.cr).toBeNull();
    // the only cells open are RO's: C and E are recorded, A/V/P not relevant
    expect(view.toAssess).toEqual([{ indexCode: "E", assertion: "RO" }]);
    // both recorded cells are minimal; the unassessed RO does not drag the account to moderate
    expect(rowWorstTod(row)).toBe("minimal");
  });

  it("counts RO in the roll-up once it is recorded", async () => {
    savedCells = [
      { index_code: "E", assertion: "C", relevant: true, ir: "lower", ir_basis: null, cr: "rely", cr_basis: null },
      { index_code: "E", assertion: "RO", relevant: true, ir: "higher", ir_basis: null, cr: "not_rely", cr_basis: null },
    ];
    const view = await craBoard(ENGAGEMENT);
    const row = view.rows[0];
    expect(view.toAssess).toEqual([{ indexCode: "E", assertion: "E" }]);
    expect(rowWorstTod(row)).toBe("high");
  });

  it("drops RO from the row when the preparer marks it not relevant", async () => {
    savedCells = [{ index_code: "E", assertion: "RO", relevant: false, ir: null, ir_basis: null, cr: null, cr_basis: null }];
    const view = await craBoard(ENGAGEMENT);
    const ro = view.rows[0].cells.find((c) => c.assertion === "RO")!;
    expect(ro.relevant).toBe(false);
    expect(view.toAssess.map((c) => c.assertion)).toEqual(["C", "E"]);
  });
});

// ------------------------------------------------------------------ F039 --

// The wizard is rendered server-side as a string: enough to hold the page
// order and the labels, without a browser.
import { PaperWizard } from "@/components/PaperWizard";

describe("F039 — the conclusion on the last page, the status first", () => {
  const render = (values: Record<string, string>, signoffs?: { preparer: { name: string; at: string } | null; reviewer: { name: string; at: string } | null }) =>
    renderToString(
      createElement(PaperWizard, {
        code: "T1.1",
        def: PAPER,
        values,
        autoValues: {},
        locale: "en",
        action: () => undefined,
        signoffs,
      }),
    );

  it("renders the read-only status before the questionnaire and the answerable conclusion last", () => {
    const html = render({});
    const status = html.indexOf('data-testid="wp-status"');
    const firstProc = html.indexOf(`data-testid="wp-${procKey("walk")}"`);
    const conclusion = html.indexOf('data-testid="wp-conclusion-page"');
    const conclRadio = html.indexOf('data-testid="wp-c_0-yes"');
    expect(status).toBeGreaterThan(-1);
    expect(firstProc).toBeGreaterThan(status);
    expect(conclusion).toBeGreaterThan(firstProc);
    expect(conclRadio).toBeGreaterThan(conclusion);
    // the conclusion radios are not duplicated on page 1
    expect(html.indexOf('data-testid="wp-c_0-yes"', conclRadio + 1)).toBe(-1);
    // the status says what is not yet concluded and who has not signed
    expect(html).toContain("Not yet concluded");
    expect(html).toContain('data-testid="wp-status-preparer" data-signed="false"');
    expect(html).toContain('data-testid="wp-page-title"');
    expect(html).toContain("Status &amp; questionnaire");
  });

  it("reflects a chosen conclusion and the signatures in the status", () => {
    const html = render({ c_0: "no" }, { preparer: { name: "A. Preparer", at: "2026-10-27 09:00" }, reviewer: null });
    expect(html).toContain('data-testid="wp-status-concl-0" data-value="no"');
    expect(html).toContain('data-testid="wp-status-preparer" data-signed="true"');
    expect(html).toContain("A. Preparer");
    expect(html).toContain('data-testid="wp-status-reviewer" data-signed="false"');
  });

  it("offers N/A on every factor and every procedure, with the reason box label in both languages", () => {
    const en = render({ [ynKey("f1")]: NA, [procNaKey("walk")]: NA });
    expect(en).toContain(`data-testid="wp-${ynKey("f1")}-na"`);
    expect(en).toContain(`data-testid="wp-${ynKey("f2")}-na"`);
    expect(en).toContain(`data-testid="wp-${procNaKey("walk")}"`);
    expect(en).toContain("Reason not applicable (required)");
    const fr = renderToString(
      createElement(PaperWizard, { code: "T1.1", def: PAPER, values: { [ynKey("f1")]: NA }, autoValues: {}, locale: "fr", action: () => undefined }),
    );
    expect(fr).toContain("S.O.");
    expect(fr).toContain("Motif de la non-application (obligatoire)");
    expect(fr).toContain("Pas encore conclu");
  });
});
