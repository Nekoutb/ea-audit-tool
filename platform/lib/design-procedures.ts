// S5.5 — design substantive procedures: one row per significant account,
// consuming the CRA (S3.1) and the primary-substantive-procedure library, and
// recording the designed nature, timing, extent and other substantive
// procedures. The recorded design is what E4 executes and what the sampling
// tool sizes.

import { withTenant } from "@/lib/db";
import { requireTenant, requireWrite } from "@/lib/tenant";
import { craBoard, rowWorstTod, type CraAccountRow } from "@/lib/cra";
import { craOf, toTod, type CraTod } from "@/lib/cra-model";
import { pspFor } from "@/lib/psp";
import { INDEX_SECTION } from "@/lib/lead-classes";
import {
  ASSERTIONS,
  NATURE_VALUES,
  OSP_EXTENT_MAX,
  OSP_ID,
  OSP_MAX,
  OSP_TEXT_MAX,
  TIMING_VALUES,
  craLevelOf,
  timingAllowed,
  type OspProcedure,
} from "@/lib/design-procedures-model";

// Re-exported so the server side of S5.5 still has one module to import from.
export {
  NATURE_OPTIONS,
  TIMING_OPTIONS,
  type OspProcedure,
} from "@/lib/design-procedures-model";

export const DSP_FIELDS = ["nature", "timing", "extent", "osp"] as const;
export type DspField = (typeof DSP_FIELDS)[number];


/**
 * Storage keys: `<index>_<field>` for the account level (osp), and
 * `<index>_<assertion>_<field>` for the per-assertion design — procedures are
 * designed per relevant assertion against that assertion's CRA (ISA 330 ¶6–7).
 * `sel_<assertion>` holds the JSON array of catalog indices the preparer
 * selected for that assertion — only selected procedures reach the E4 paper.
 * `osp_list` holds the JSON array of custom ("other") procedures the preparer
 * wrote for the account, each one carrying the same parameters a library
 * procedure carries.
 */
const FIELD_KEY = /^(?:[CEAVP]_)?(nature|timing|extent|osp)$|^sel_[CEAVP]$|^osp_list$/;


/**
 * Read one custom procedure out of raw JSON, refusing anything the board could
 * not have produced. Everything here reaches the E4 program and the archived
 * file, so the values are pinned to the option sets rather than trusted.
 */
function readOsp(raw: unknown): OspProcedure {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("invalid-osp");
  const o = raw as Record<string, unknown>;
  const str = (v: unknown, max: number): string => {
    if (typeof v !== "string" || v.length > max) throw new Error("invalid-osp");
    return v;
  };
  const id = str(o.id, 40);
  if (!OSP_ID.test(id)) throw new Error("invalid-osp");
  if (!Array.isArray(o.assertions) || o.assertions.length > ASSERTIONS.length) throw new Error("invalid-osp");
  const assertions = o.assertions.map((a) => {
    if (typeof a !== "string" || !ASSERTIONS.includes(a)) throw new Error("invalid-osp");
    return a;
  });
  const nature = str(o.nature ?? "", 40);
  const timing = str(o.timing ?? "", 40);
  if (nature !== "" && !NATURE_VALUES.includes(nature)) throw new Error("invalid-osp");
  if (timing !== "" && !TIMING_VALUES.includes(timing)) throw new Error("invalid-osp");
  return {
    id,
    en: str(o.en ?? "", OSP_TEXT_MAX),
    fr: str(o.fr ?? "", OSP_TEXT_MAX),
    assertions: [...new Set(assertions)],
    nature,
    timing,
    extent: str(o.extent ?? "", OSP_EXTENT_MAX),
  };
}

/** Parse and validate a stored `osp_list` value; throws `invalid-osp` on any violation. */
export function parseOspList(value: string): OspProcedure[] {
  let arr: unknown;
  try {
    arr = JSON.parse(value);
  } catch {
    throw new Error("invalid-osp");
  }
  if (!Array.isArray(arr) || arr.length > OSP_MAX) throw new Error("invalid-osp");
  return arr.map(readOsp);
}

export interface DspRow {
  indexCode: string;
  label: string;
  closing: number;
  taskCode: string | null;
  taskItemId: string | null;
  worst: CraTod | null;
  /** relevant assertion → effective CRA (recorded or suggested) */
  cells: { assertion: string; tod: CraTod; significant: boolean; notRely: boolean }[];
  /** the primary-procedure baseline from the library */
  pspCount: number;
  /** the library itself: catalog position, wording, assertions covered */
  catalog: { i: number; en: string; fr: string; a: string[] }[];
  /** assertion → selected catalog positions (what E4 will generate) */
  selected: Record<string, number[]>;
  /** the custom procedures written for this account (also generated into E4) */
  osps: OspProcedure[];
  /** procedures already generated / completed in the E4 workpaper */
  generated: number;
  done: number;
  /** an OSP is required: a significant risk, or no controls reliance on a relevant assertion */
  ospRequired: boolean;
  /** every stored key for this index, without the `<index>_` prefix (e.g. "osp", "E_nature") */
  values: Record<string, string>;
}

export interface DspView {
  rows: DspRow[];
  itgcState: string | null;
}

const CODE = "dsp";

/** The id carried by an answer that predates `osp_list`, so the board can show it. */
const LEGACY_OSP_ID = "legacy";

/**
 * The account's custom procedures as the board should show them. Files answered
 * before `osp_list` existed hold one free-text `osp` field: it is surfaced as a
 * single procedure so no work disappears, and storage is left alone until the
 * preparer edits — the first save from the board writes the whole list, which
 * is where that legacy answer becomes a real record.
 */
function readOspList(values: Record<string, string>): OspProcedure[] {
  const stored = values.osp_list;
  if (stored) {
    try {
      return parseOspList(stored);
    } catch {
      return [];
    }
  }
  const legacy = (values.osp ?? "").trim();
  if (!legacy) return [];
  return [{ id: LEGACY_OSP_ID, en: legacy, fr: legacy, assertions: [], nature: "", timing: "", extent: "" }];
}

export async function dspView(engagementId: string): Promise<DspView> {
  const { tenantId } = await requireTenant();
  const board = await craBoard(engagementId);

  const { saved, steps } = await withTenant(tenantId, async (tx) => {
    const saved = await tx.query<{ field_key: string; value: unknown }>(
      "SELECT field_key, value FROM form_response WHERE engagement_id = $1 AND code = $2",
      [engagementId, CODE],
    );
    const steps = await tx.query<{ code: string; total: number; done: number }>(
      `SELECT fi.code, count(p.id)::int AS total,
              count(p.id) FILTER (WHERE p.status = 'complete')::int AS done
         FROM file_item fi
         JOIN program_step p ON p.file_item_id = fi.id
        WHERE fi.engagement_id = $1 AND fi.code LIKE 'E4.%'
        GROUP BY fi.code`,
      [engagementId],
    );
    return { saved: saved.rows, steps: steps.rows };
  });

  const values = new Map<string, string>();
  for (const row of saved) values.set(row.field_key, typeof row.value === "string" ? row.value : String(row.value ?? ""));
  const stepsByCode = new Map(steps.map((s) => [s.code, s]));

  const rows: DspRow[] = board.rows.map((row: CraAccountRow) => {
    const cells = row.cells
      // Design follows the KEY assertions: a cell whose relevance is only the
      // no-selection fallback asks for no procedures (select key assertions in
      // P6.2 / the risk console first).
      .filter((c) => c.relevant && !c.relevantDefaulted)
      .map((c) => {
        const ir = c.ir ?? c.suggestedIr;
        const cr = c.cr ?? c.suggestedCr;
        return { assertion: c.assertion, tod: toTod(craOf(ir, cr), c.significant), significant: c.significant, notRely: cr === "not_rely" };
      });
    const st = row.taskCode ? stepsByCode.get(row.taskCode) : undefined;
    const prefix = `${row.indexCode}_`;
    const rowValues: Record<string, string> = {};
    for (const [k, val] of values) if (k.startsWith(prefix)) rowValues[k.slice(prefix.length)] = val;
    const catalog = pspFor(row.indexCode).map((p, i) => ({ i, en: p.en, fr: p.fr, a: p.a.split(",") }));
    const selected: Record<string, number[]> = {};
    for (const [k, val] of Object.entries(rowValues)) {
      if (!k.startsWith("sel_")) continue;
      try {
        const arr = JSON.parse(val);
        if (Array.isArray(arr)) selected[k.slice(4)] = arr.filter((n) => Number.isInteger(n) && n >= 0 && n < catalog.length);
      } catch {
        /* unreadable selection — treated as none */
      }
    }
    return {
      indexCode: row.indexCode,
      label: row.label,
      closing: row.closing,
      taskCode: row.taskCode,
      taskItemId: row.taskItemId,
      worst: rowWorstTod(row),
      cells,
      pspCount: catalog.length,
      catalog,
      selected,
      osps: readOspList(rowValues),
      generated: st?.total ?? 0,
      done: st?.done ?? 0,
      ospRequired: cells.some((c) => c.significant || c.notRely),
      values: rowValues,
    };
  });

  return { rows, itgcState: board.itgcState };
}

/** The S5.5 file item of an engagement — the E4 papers link back to the design. */
export async function s55ItemId(engagementId: string): Promise<string | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ id: string }>(
      "SELECT id FROM file_item WHERE engagement_id = $1 AND code = 'S5.5' LIMIT 1",
      [engagementId],
    );
    return r.rows[0]?.id ?? null;
  });
}

/** A stored `osp_list` value that holds at least one procedure. */
function hasOspProcedures(value: unknown): boolean {
  try {
    return parseOspList(typeof value === "string" ? value : String(value ?? "")).length > 0;
  } catch {
    return false;
  }
}

/** Split a dsp field key into its index code and the design it records. */
function keyKind(fieldKey: string): { indexCode: string; kind: "sel" | "osp_list" } | null {
  if (fieldKey.endsWith("_osp_list")) return { indexCode: fieldKey.slice(0, -"_osp_list".length), kind: "osp_list" };
  const cut = fieldKey.indexOf("_sel_");
  if (cut > 0) return { indexCode: fieldKey.slice(0, cut), kind: "sel" };
  return null;
}

/**
 * Whether S5.5 has recorded any procedure selection for the index. Custom
 * procedures are a design in their own right: an account answered only with
 * hand-written procedures counts, or the E4 paper would keep asking for a
 * design that is already there.
 */
export async function dspHasSelection(engagementId: string, indexCode: string): Promise<boolean> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ field_key: string; value: unknown }>(
      "SELECT field_key, value FROM form_response WHERE engagement_id = $1 AND code = $2",
      [engagementId, CODE],
    );
    return r.rows.some((row) => {
      const k = keyKind(row.field_key);
      if (!k || k.indexCode !== indexCode) return false;
      return k.kind === "sel" || hasOspProcedures(row.value);
    });
  });
}

/** Persist one design field — account-level (`osp_list`) or per-assertion (`E_nature`). */
export async function saveDsp(engagementId: string, indexCode: string, field: string, value: string): Promise<void> {
  if (!FIELD_KEY.test(field)) throw new Error("invalid-field");
  if (!/^[A-Z][A-Z0-9]{0,2}$/.test(indexCode)) throw new Error("invalid-index");
  if (field.startsWith("sel_")) {
    let arr: unknown;
    try {
      arr = JSON.parse(value);
    } catch {
      throw new Error("invalid-selection");
    }
    if (!Array.isArray(arr) || arr.length > 40 || arr.some((n) => !Number.isInteger(n) || (n as number) < 0 || (n as number) > 40)) {
      throw new Error("invalid-selection");
    }
  }
  if (field === "osp_list") parseOspList(value);
  // The nature and timing are pinned to their option sets, and the timing to
  // what the assertion's CRA permits — a drop-down the browser constrains is
  // not a control until the server refuses what it barred (UAT B75). Blank
  // clears the design and is always allowed.
  const design = /^(?:([CEAVP])_)?(nature|timing)$/.exec(field);
  if (design && value !== "") {
    const [, assertion, kind] = design;
    if (kind === "nature" && !NATURE_VALUES.includes(value)) throw new Error("invalid-value");
    // ISA 330 ¶21: a significant risk needs tests of details, so an
    // analytics-led nature is barred on its assertion (UAT B52) — and on the
    // account-level nature when any of its assertions carries one.
    if (kind === "nature" && value === "sap_led") {
      const row = (await dspView(engagementId)).rows.find((r) => r.indexCode === indexCode);
      const significant = assertion
        ? Boolean(row?.cells.find((c) => c.assertion === assertion)?.significant)
        : Boolean(row?.cells.some((c) => c.significant));
      if (significant) throw new Error("nature-not-permitted");
    }
    if (kind === "timing") {
      if (!TIMING_VALUES.includes(value)) throw new Error("invalid-value");
      if (assertion) {
        const row = (await dspView(engagementId)).rows.find((r) => r.indexCode === indexCode);
        const cell = row?.cells.find((c) => c.assertion === assertion);
        if (!timingAllowed(cell ? craLevelOf(cell.tod) : null).includes(value)) {
          throw new Error("timing-not-permitted");
        }
      }
    }
  }
  const { tenantId, userId } = await requireWrite();
  const { invalidateStaleSignoffs, reportInvalidatedSignoffs } = await import("@/lib/working-papers");
  const { before, stale } = await withTenant(tenantId, async (tx) => {
    const prior = await tx.query<{ value: string | null }>(
      "SELECT value #>> '{}' AS value FROM form_response WHERE engagement_id = $1 AND code = $2 AND field_key = $3",
      [engagementId, CODE, `${indexCode}_${field}`],
    );
    await tx.query(
      `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by, carried_forward)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       ON CONFLICT (engagement_id, code, field_key)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
                     carried_forward = false, updated_at = now()`,
      [tenantId, engagementId, CODE, `${indexCode}_${field}`, JSON.stringify(value), userId],
    );
    // A designed account needs the E4 paper that executes the design. The
    // complexity tier leaves some out (E4.6/E4.7/E4.12/E4.13 on a non-complex
    // file) and the procedures then had nowhere to run (UAT run 2 B20):
    // designing them puts the paper on the file.
    const designed =
      (field.startsWith("sel_") && (JSON.parse(value) as unknown[]).length > 0) ||
      (field === "osp_list" && hasOspProcedures(value));
    const taskCode = INDEX_SECTION[indexCode];
    if (designed && taskCode) {
      const { ensureTaskTx } = await import("@/lib/ensure-task");
      await ensureTaskTx(tx, engagementId, taskCode);
    }
    // The design is the S5.5 paper's content: a change after sign-off voids
    // the signatures it moved (UAT B53), as an answer on the paper does.
    return {
      before: prior.rows[0]?.value ?? null,
      stale: await invalidateStaleSignoffs(tx, engagementId, "S5.5"),
    };
  });
  await reportInvalidatedSignoffs(tenantId, engagementId, "S5.5", stale, userId);
  if ((before ?? "") !== value) {
    const { recordActivity } = await import("@/lib/activity");
    await recordActivity({
      engagementId,
      entityType: "file_item",
      action: "dsp_changed",
      summary: `S5.5 ${indexCode} ${field} changed`,
      meta: { code: "S5.5", indexCode, field },
      before: before ?? "",
      after: value,
    });
  }
}

/** Index codes with at least one procedure — library or custom — in the S5.5 design. */
export async function dspDesignedIndexes(engagementId: string): Promise<Set<string>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ field_key: string; value: unknown }>(
      "SELECT field_key, value FROM form_response WHERE engagement_id = $1 AND code = $2",
      [engagementId, CODE],
    );
    const out = new Set<string>();
    for (const row of r.rows) {
      const k = keyKind(row.field_key);
      if (!k) continue;
      if (k.kind === "osp_list") {
        if (hasOspProcedures(row.value)) out.add(k.indexCode);
        continue;
      }
      try {
        const arr = JSON.parse(typeof row.value === "string" ? row.value : String(row.value ?? "[]"));
        if (Array.isArray(arr) && arr.length > 0) out.add(k.indexCode);
      } catch { /* unreadable — not designed */ }
    }
    return out;
  });
}

/**
 * The design gap the standards care about: significant accounts carrying
 * explicitly relevant (key) assertions with NO procedure selected yet.
 * Shown on the S5.5 board and the E4 group page alike.
 */
export async function dspDesignGaps(engagementId: string): Promise<string[]> {
  const view = await dspView(engagementId);
  return view.rows.filter((row) => row.cells.length > 0 && !rowIsDesigned(row)).map((row) => row.indexCode);
}

/** A row is designed once it carries a library selection or a custom procedure. */
export function rowIsDesigned(row: Pick<DspRow, "selected" | "osps">): boolean {
  return Object.values(row.selected).some((arr) => arr.length > 0) || row.osps.length > 0;
}
