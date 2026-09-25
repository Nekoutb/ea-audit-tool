import { beforeEach, describe, expect, it, vi } from "vitest";

const TENANT = "5d5d5d5d-5d5d-4d5d-8d5d-5d5d5d5d5d5d";
const USER = "5d5d5d5d-5d5d-4d5d-8d5d-5d5d5d5d5d01";
const ENGAGEMENT = "5d5d5d5d-5d5d-4d5d-8d5d-5d5d5d5d5d02";

/** The dsp rows the fake form_response holds for the test at hand. */
let formRows: { field_key: string; value: string }[] = [];
/** Every write the module attempted, so a save can be asserted without a database. */
let written: { sql: string; params: unknown[] }[] = [];

// S5.5 keeps no table of its own: every value is a form_response row, so the
// storage rules and the design gates are exercised against a fake transaction
// rather than a live database — the logic under test is the parsing and the
// counting, not the SQL.
vi.mock("@/lib/db", () => ({
  withTenant: async <T>(_tenantId: string, fn: (tx: unknown) => Promise<T>): Promise<T> =>
    fn({
      query: async (sql: string, params: unknown[] = []) => {
        if (sql.includes("INSERT INTO form_response")) {
          written.push({ sql, params });
          return { rows: [] };
        }
        if (sql.includes("FROM form_response")) return { rows: formRows };
        return { rows: [] };
      },
    }),
}));

vi.mock("@/lib/tenant", () => ({
  requireTenant: async () => ({ tenantId: TENANT, userId: USER, role: "firm_admin", locale: "en" }),
  requireWrite: async () => ({ tenantId: TENANT, userId: USER, role: "firm_admin", locale: "en" }),
  ForbiddenError: class ForbiddenError extends Error {},
}));

// The CRA board is S3.1's answer, not this module's: it is stubbed to two
// accounts, E carrying one key assertion and F carrying none.
vi.mock("@/lib/cra", () => ({
  craBoard: async () => ({
    rows: [
      {
        indexCode: "E",
        taskCode: "E4.1",
        taskItemId: null,
        label: "Trade receivables",
        closing: 1_000_000,
        scots: 1,
        controlsSelected: 0,
        cells: [
          {
            assertion: "E",
            relevant: true,
            relevantDefaulted: false,
            ir: "higher",
            irBasis: "",
            cr: "not_rely",
            crBasis: "",
            suggestedIr: "higher",
            suggestedCr: "not_rely",
            riskCount: 1,
            significant: true,
            fraud: false,
            controlsCovering: 0,
            controlsEffective: 0,
            controlsFailed: 0,
          },
        ],
      },
      {
        indexCode: "F",
        taskCode: "E4.2",
        taskItemId: null,
        label: "Inventory",
        closing: 500_000,
        scots: 1,
        controlsSelected: 0,
        cells: [
          {
            assertion: "E",
            relevant: true,
            relevantDefaulted: false,
            ir: "lower",
            irBasis: "",
            cr: "rely",
            crBasis: "",
            suggestedIr: "lower",
            suggestedCr: "rely",
            riskCount: 0,
            significant: false,
            fraud: false,
            controlsCovering: 0,
            controlsEffective: 0,
            controlsFailed: 0,
          },
        ],
      },
    ],
    itgcState: null,
    glAvailable: false,
  }),
  rowWorstTod: () => "high_sr",
}));

import {
  dspDesignGaps,
  dspDesignedIndexes,
  dspHasSelection,
  dspView,
  parseOspList,
  saveDsp,
} from "@/lib/design-procedures";

const osp = (over: Record<string, unknown> = {}) => ({
  id: "a1b2c3d4",
  en: "Vouch every item above the SAD to the signed contract and the delivery evidence.",
  fr: "Justifier chaque élément supérieur au SAD par le contrat signé et la preuve de livraison.",
  assertions: ["E", "A"],
  nature: "tod_led",
  timing: "period_end",
  extent: "100% of items above SAD Nominal.",
  ...over,
});

const save = (field: string, value: unknown) => saveDsp(ENGAGEMENT, "E", field, JSON.stringify(value));

beforeEach(() => {
  formRows = [];
  written = [];
});

describe("the custom substantive procedures stored under osp_list", () => {
  it("accepts a list of well-formed procedures and writes it to the one field", async () => {
    await save("osp_list", [osp(), osp({ id: "e5f6", assertions: [], nature: "", timing: "", extent: "" })]);
    expect(written).toHaveLength(1);
    expect(written[0].params[3]).toBe("E_osp_list");
    expect(parseOspList(JSON.parse(String(written[0].params[4])))).toHaveLength(2);
  });

  it("refuses a list longer than the cap", async () => {
    const many = Array.from({ length: 21 }, (_, i) => osp({ id: `id${i}` }));
    await expect(save("osp_list", many)).rejects.toThrow("invalid-osp");
    expect(written).toHaveLength(0);
  });

  it("refuses an assertion outside C,E,A,V,P", async () => {
    await expect(save("osp_list", [osp({ assertions: ["E", "X"] })])).rejects.toThrow("invalid-osp");
  });

  it("refuses a nature the board never offers", async () => {
    await expect(save("osp_list", [osp({ nature: "professional_scepticism" })])).rejects.toThrow("invalid-osp");
  });

  it("refuses a timing the board never offers", async () => {
    await expect(save("osp_list", [osp({ timing: "whenever" })])).rejects.toThrow("invalid-osp");
  });

  it("refuses a description beyond the length cap", async () => {
    await expect(save("osp_list", [osp({ en: "x".repeat(801) })])).rejects.toThrow("invalid-osp");
  });

  it("refuses anything that is not a list of procedures", async () => {
    await expect(saveDsp(ENGAGEMENT, "E", "osp_list", "not json")).rejects.toThrow("invalid-osp");
    await expect(save("osp_list", { id: "a1" })).rejects.toThrow("invalid-osp");
  });

  it("shows a pre-osp_list answer as one procedure without rewriting storage", async () => {
    formRows = [{ field_key: "E_osp", value: "Circularise the twelve balances the aging flags as disputed." }];
    const view = await dspView(ENGAGEMENT);
    const row = view.rows.find((r) => r.indexCode === "E");
    expect(row?.osps).toHaveLength(1);
    expect(row?.osps[0].en).toContain("Circularise");
    expect(written).toHaveLength(0);
  });
});

describe("the design gates on an account designed only with custom procedures", () => {
  const customOnly = () => [{ field_key: "E_osp_list", value: JSON.stringify([osp()]) }];

  it("counts the account as having a selection", async () => {
    formRows = customOnly();
    expect(await dspHasSelection(ENGAGEMENT, "E")).toBe(true);
    expect(await dspHasSelection(ENGAGEMENT, "F")).toBe(false);
  });

  it("does not count an emptied list as a selection", async () => {
    formRows = [{ field_key: "E_osp_list", value: "[]" }];
    expect(await dspHasSelection(ENGAGEMENT, "E")).toBe(false);
  });

  it("counts the account among the designed indexes", async () => {
    formRows = customOnly();
    const designed = await dspDesignedIndexes(ENGAGEMENT);
    expect([...designed]).toEqual(["E"]);
  });

  it("leaves the account out of the design gaps, and keeps the undesigned one in", async () => {
    formRows = customOnly();
    expect(await dspDesignGaps(ENGAGEMENT)).toEqual(["F"]);
  });

  it("still reports a gap when the account carries neither a selection nor a procedure", async () => {
    formRows = [];
    expect(await dspDesignGaps(ENGAGEMENT)).toEqual(["E", "F"]);
  });
});
