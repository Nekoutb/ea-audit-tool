// The selection engine's criteria, tested against a fixture rather than a
// ledger. lib/je-selection.ts is deliberately split so this is possible: SQL
// narrows the ledger, but reasonsFor and selectFromCandidates decide, so every
// criterion can be put in front of a line whose answer is known.

import { describe, expect, it, vi } from "vitest";

// The module's other half reaches the session and the database. Nothing below
// touches either, but importing the module loads next-auth, so the session is
// stubbed to keep this file a pure unit test.
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

import {
  CLASS_PREFIXES,
  type CriterionKey,
  type EvaluationContext,
  type HolidayLabel,
  type SelectionCandidate,
  isIncompleteDescription,
  isRoundAmount,
  normaliseUserRule,
  reasonsFor,
  resolveSettings,
  selectFromCandidates,
  selectionClassFor,
  type SelectionClass,
  type UserRule,
} from "@/lib/je-selection";

const ALL: CriterionKey[] = [
  "weekend-posting",
  "no-description",
  "public-holiday",
  "round-amount",
  "unusual-pairing",
  "year-end-volume",
  "incomplete-description",
  "preparer-is-reviewer",
  "preparer-is-approver",
];

// 20 May 2025 is Cameroon's National Day and a Tuesday, so the holiday test
// cannot pass by accidentally being a weekend.
const HOLIDAYS = new Map<string, HolidayLabel>([
  ["2025-05-20", { labelEn: "National Day", labelFr: "Fête Nationale", origin: "national" }],
  ["2025-12-24", { labelEn: "Office closure", labelFr: "Fermeture du cabinet", origin: "firm" }],
]);

function line(over: Partial<SelectionCandidate> = {}): SelectionCandidate {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    lineNo: 1,
    jeNumber: "JE-1",
    journalCode: "VT",
    journalDate: "2025-06-11", // a Wednesday
    entryDate: "2025-06-11",
    account: "411000",
    accountName: "Clients",
    jeDescription: "Facture 4471 client ALPHA SARL",
    lineDescription: null,
    debit: 1_234_567,
    credit: 0,
    signed: 1_234_567,
    preparer: "A. Ngono",
    reviewer: "B. Fotso",
    approver: "C. Mballa",
    reference: "FA-4471",
    thirdPartyCode: "C0012",
    thirdPartyName: "ALPHA SARL",
    costCenter: "DLA",
    entry: { lines: 2, grossValue: 2_469_134, classes: [], yearEndRank: null },
    ...over,
  };
}

function context(over: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    locale: "en",
    settings: resolveSettings(),
    criteria: ALL,
    userRules: [],
    holidays: HOLIDAYS,
    ...over,
  };
}

const keysOf = (candidate: SelectionCandidate, ctx = context()): string[] =>
  reasonsFor(candidate, ctx).map((r) => r.criterion);

describe("account groupings, taken from the lead-schedule map", () => {
  it("resolves the five groupings the pairing criterion needs", () => {
    expect(selectionClassFor("701000")).toBe("Revenue");
    expect(selectionClassFor("521000")).toBe("Cash");
    expect(selectionClassFor("231000")).toBe("FixedAssets");
    expect(selectionClassFor("311000")).toBe("Inventory");
    expect(selectionClassFor("601000")).toBe("Expense");
  });

  it("lets the longer SYSCOHADA rule mask the shorter one", () => {
    // 28 is accumulated depreciation of PP&E, but 281 is amortisation of
    // intangibles and is not a fixed-asset account at all
    expect(selectionClassFor("284000")).toBe("FixedAssets");
    expect(selectionClassFor("281000")).toBeNull();
    const masks = CLASS_PREFIXES.filter((c) => c.prefix === "281");
    expect(masks).toEqual([{ prefix: "281", klass: null }]);
  });

  it("keeps a compact cover rather than one row per prefix", () => {
    expect(CLASS_PREFIXES.length).toBeLessThan(60);
  });
});

describe("each criterion against a line whose answer is known", () => {
  it("catches a weekend posting and leaves a weekday alone", () => {
    // 14 June 2025 is a Saturday, 15 June a Sunday
    expect(keysOf(line({ journalDate: "2025-06-14" }))).toContain("weekend-posting");
    expect(keysOf(line({ journalDate: "2025-06-15" }))).toContain("weekend-posting");
    expect(keysOf(line({ journalDate: "2025-06-11" }))).not.toContain("weekend-posting");
  });

  it("reads the entry date instead when the auditor asks it to", () => {
    const candidate = line({ journalDate: "2025-06-11", entryDate: "2025-06-14" });
    expect(keysOf(candidate)).not.toContain("weekend-posting");
    const onEntryDate = context({ settings: resolveSettings({ dateBasis: "entry" }) });
    expect(keysOf(candidate, onEntryDate)).toContain("weekend-posting");
  });

  it("catches a line with no description at all, and does not also call it incomplete", () => {
    const blank = keysOf(line({ jeDescription: null, lineDescription: "   " }));
    expect(blank).toContain("no-description");
    expect(blank).not.toContain("incomplete-description");
  });

  it("catches a posting dated on a public holiday", () => {
    const reasons = reasonsFor(line({ journalDate: "2025-05-20" }), context());
    const holiday = reasons.find((r) => r.criterion === "public-holiday");
    expect(holiday?.detail).toContain("National Day");
    expect(keysOf(line({ journalDate: "2025-05-21" }))).not.toContain("public-holiday");
  });

  it("names the firm's own calendar when the date came from there", () => {
    const reasons = reasonsFor(line({ journalDate: "2025-12-24" }), context());
    expect(reasons.find((r) => r.criterion === "public-holiday")?.detail).toContain("firm calendar");
  });

  it("catches a round amount and respects both thresholds", () => {
    expect(keysOf(line({ signed: 5_000_000 }))).toContain("round-amount");
    expect(keysOf(line({ signed: -5_000_000 }))).toContain("round-amount");
    expect(keysOf(line({ signed: 4_999_999 }))).not.toContain("round-amount");
    // 50 000 is an exact multiple of nothing at the default step and is below
    // the floor in any case
    expect(keysOf(line({ signed: 50_000 }))).not.toContain("round-amount");
  });

  it("moves the round-amount thresholds when the auditor moves them", () => {
    const tight = resolveSettings({ roundMin: 1000, roundStep: 1000 });
    expect(isRoundAmount(25_000, tight)).toBe(true);
    expect(isRoundAmount(25_500, tight)).toBe(false);
    expect(isRoundAmount(500, tight)).toBe(false);
  });

  const pairings: [string, SelectionClass[]][] = [
    ["revenue-cash", ["Revenue", "Cash"]],
    ["expense-cash", ["Expense", "Cash"]],
    ["revenue-expense", ["Revenue", "Expense"]],
    ["fixed-assets-revenue", ["FixedAssets", "Revenue"]],
    ["fixed-assets-cash", ["FixedAssets", "Cash"]],
    ["inventory-cash", ["Inventory", "Cash"]],
  ];

  it.each(pairings)("catches the %s pairing", (key, classes) => {
    const candidate = line({ entry: { lines: 2, grossValue: 10, classes, yearEndRank: null } });
    const reasons = reasonsFor(candidate, context());
    const pairing = reasons.filter((r) => r.criterion === "unusual-pairing");
    expect(pairing).toHaveLength(1);
    expect(pairing[0].detail).toContain("JE-1");
    void key;
  });

  it("leaves an ordinary receivable-and-revenue entry alone", () => {
    // trade receivable against revenue is the normal sales entry: not a pairing
    const candidate = line({ entry: { lines: 2, grossValue: 10, classes: ["Revenue"], yearEndRank: null } });
    expect(keysOf(candidate)).not.toContain("unusual-pairing");
  });

  it("tests only the pairings the auditor kept", () => {
    const candidate = line({
      entry: { lines: 2, grossValue: 10, classes: ["Revenue", "Cash"], yearEndRank: null },
    });
    const narrowed = context({ settings: resolveSettings({ pairings: ["inventory-cash"] }) });
    expect(keysOf(candidate, narrowed)).not.toContain("unusual-pairing");
  });

  it("catches every line of an entry ranked in the closing window", () => {
    const candidate = line({
      entry: { lines: 42, grossValue: 900_000, classes: [], yearEndRank: 2 },
    });
    const reason = reasonsFor(candidate, context()).find((r) => r.criterion === "year-end-volume");
    expect(reason?.detail).toContain("ranks 2");
    expect(reason?.detail).toContain("42 lines");
    expect(keysOf(line())).not.toContain("year-end-volume");
  });

  it("catches an incomplete description on each of its three grounds", () => {
    const settings = resolveSettings();
    expect(isIncompleteDescription("OD", settings)).toBe(true);
    expect(isIncompleteDescription("Régularisation", settings)).toBe(true);
    expect(isIncompleteDescription("Diverses régularisations diverses", settings)).toBe(true);
    expect(isIncompleteDescription("OD 4471 / 12", settings)).toBe(true);
    expect(isIncompleteDescription("2025 / 4471 - 12", settings)).toBe(true);
    expect(isIncompleteDescription("Facture 4471 client ALPHA SARL", settings)).toBe(false);
    expect(isIncompleteDescription("", settings)).toBe(false);
  });

  it("prefers the line's own description over the entry's", () => {
    const candidate = line({ jeDescription: "Facture 4471 client ALPHA SARL", lineDescription: "Divers" });
    expect(keysOf(candidate)).toContain("incomplete-description");
  });

  it("moves the description thresholds when the auditor moves them", () => {
    const lenient = resolveSettings({ minDescriptionChars: 2, minDescriptionWords: 1 });
    expect(isIncompleteDescription("OD", lenient)).toBe(true); // still pure filler
    expect(isIncompleteDescription("Ajust 44", lenient)).toBe(false);
    expect(isIncompleteDescription("Ajust 44", resolveSettings())).toBe(true);
  });

  it("catches a line whose preparer reviewed their own work", () => {
    expect(keysOf(line({ preparer: "A. Ngono", reviewer: " a. ngono " }))).toContain("preparer-is-reviewer");
    expect(keysOf(line({ preparer: "A. Ngono", reviewer: "B. Fotso" }))).not.toContain("preparer-is-reviewer");
    // self-approval (UAT B141): the approver column, not the reviewer one
    expect(keysOf(line({ preparer: "A. Ngono", reviewer: "B. Fotso", approver: " a. ngono " }))).toContain("preparer-is-approver");
    expect(keysOf(line({ preparer: "A. Ngono", approver: "C. Mbarga" }))).not.toContain("preparer-is-approver");
    // two blanks are not the same person, they are two gaps
    expect(keysOf(line({ preparer: "  ", reviewer: null }))).not.toContain("preparer-is-reviewer");
  });
});

describe("the auditor's own rules", () => {
  const withRules = (rules: UserRule[]): EvaluationContext =>
    context({ criteria: [], userRules: rules.map((r, i) => normaliseUserRule(r, i)) });

  it("runs a text rule case-insensitively", () => {
    const ctx = withRules([{ id: "od", field: "journalCode", operator: "equals", value: "OD" }]);
    expect(keysOf(line({ journalCode: "od" }), ctx)).toEqual(["user:od"]);
    expect(keysOf(line({ journalCode: "VT" }), ctx)).toEqual([]);
  });

  it("runs a numeric rule", () => {
    const ctx = withRules([{ id: "big", field: "absAmount", operator: "greaterThan", value: 1_000_000 }]);
    expect(keysOf(line({ signed: -2_000_000 }), ctx)).toEqual(["user:big"]);
    expect(keysOf(line({ signed: 900_000 }), ctx)).toEqual([]);
  });

  it("runs a date range and an emptiness rule", () => {
    const ctx = withRules([
      { id: "q4", field: "journalDate", operator: "between", value: "2025-10-01", value2: "2025-12-31" },
      { id: "noref", field: "reference", operator: "isEmpty" },
    ]);
    expect(keysOf(line({ journalDate: "2025-11-03" }), ctx)).toEqual(["user:q4"]);
    expect(keysOf(line({ reference: "  " }), ctx)).toEqual(["user:noref"]);
  });

  it("labels a rule the auditor did not name", () => {
    const rule = normaliseUserRule({ field: "preparer", operator: "contains", value: "Ngono" }, 0);
    expect(rule.key).toBe("user:r1");
    expect(rule.labelEn).toBe("Preparer contains ngono");
    expect(rule.labelFr).toBe("Préparateur contient ngono");
  });

  it("refuses a rule that cannot mean anything", () => {
    expect(() => normaliseUserRule({ field: "nonsense", operator: "equals", value: "x" }, 0)).toThrow("invalid-rule-field");
    expect(() => normaliseUserRule({ field: "debit", operator: "contains", value: "x" }, 0)).toThrow("invalid-rule-operator");
    expect(() => normaliseUserRule({ field: "journalDate", operator: "equals", value: "11/03/2025" }, 0)).toThrow("invalid-rule-value");
  });
});

describe("assembling the selection", () => {
  it("returns a line once, carrying every reason it was selected", () => {
    // Saturday, round, self-reviewed, and the auditor's own rule as well
    const busy = line({
      id: "00000000-0000-0000-0000-0000000000ff",
      jeNumber: "JE-9",
      journalDate: "2025-06-14",
      signed: 5_000_000,
      debit: 5_000_000,
      preparer: "A. Ngono",
      reviewer: "A. NGONO",
      journalCode: "OD",
    });
    const quiet = line({ id: "00000000-0000-0000-0000-00000000000a", jeNumber: "JE-2", lineNo: 2 });
    const ctx = context({
      userRules: [normaliseUserRule({ id: "od", field: "journalCode", operator: "equals", value: "OD" }, 0)],
    });

    const core = selectFromCandidates([busy, quiet], ctx);

    expect(core.selectedLines).toBe(1);
    expect(core.selectedEntries).toBe(1);
    expect(core.lines).toHaveLength(1);
    expect(core.lines[0].id).toBe(busy.id);
    expect(core.lines[0].reasons.map((r) => r.criterion).sort()).toEqual([
      "preparer-is-reviewer",
      "round-amount",
      "user:od",
      "weekend-posting",
    ]);
  });

  it("counts a line once per criterion even when two pairings caught it", () => {
    const candidate = line({
      entry: { lines: 3, grossValue: 30, classes: ["Revenue", "Cash", "Expense"], yearEndRank: null },
    });
    const core = selectFromCandidates([candidate], context());
    const pairing = core.lines[0].reasons.filter((r) => r.criterion === "unusual-pairing");
    expect(pairing).toHaveLength(3);
    expect(core.coverage.get("unusual-pairing")).toEqual({ lines: 1, entries: 1 });
  });

  it("counts coverage per criterion across the whole candidate set", () => {
    const saturday = line({ id: "a", jeNumber: "JE-1", journalDate: "2025-06-14" });
    const sunday = line({ id: "b", jeNumber: "JE-2", journalDate: "2025-06-15" });
    const alsoJe2 = line({ id: "c", jeNumber: "JE-2", lineNo: 2, journalDate: "2025-06-15", jeDescription: null });
    const core = selectFromCandidates([saturday, sunday, alsoJe2], context());

    expect(core.coverage.get("weekend-posting")).toEqual({ lines: 3, entries: 2 });
    expect(core.coverage.get("no-description")).toEqual({ lines: 1, entries: 1 });
    expect(core.selectedLines).toBe(3);
    expect(core.selectedEntries).toBe(2);
  });

  it("puts the line the most criteria caught at the top", () => {
    const one = line({ id: "a", jeNumber: "JE-1", journalDate: "2025-06-14", signed: 100 });
    const three = line({
      id: "b", jeNumber: "JE-2", journalDate: "2025-06-14", signed: 5_000_000,
      preparer: "X", reviewer: "x",
    });
    const core = selectFromCandidates([one, three], context());
    expect(core.lines.map((l) => l.id)).toEqual(["b", "a"]);
  });

  it("drops a candidate no criterion actually claims", () => {
    // the narrowing SQL is allowed to be generous; this is where that is settled
    const core = selectFromCandidates([line()], context());
    expect(core.lines).toEqual([]);
    expect(core.selectedLines).toBe(0);
  });

  it("answers in French when the auditor is working in French", () => {
    const core = selectFromCandidates(
      [line({ journalDate: "2025-06-14" })],
      context({ locale: "fr" }),
    );
    expect(core.lines[0].reasons[0].label).toBe("Comptabilisée un week-end");
    expect(core.lines[0].reasons[0].detail).toContain("samedi");
  });
});
