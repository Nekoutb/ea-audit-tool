// S5.5 — design substantive procedures: one row per significant account,
// consuming the CRA (S3.1) and the primary-substantive-procedure library, and
// recording the designed nature, timing, extent and other substantive
// procedures. The recorded design is what E4 executes and what the sampling
// tool sizes.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { craBoard, rowWorstTod, type CraAccountRow } from "@/lib/cra";
import { craOf, toTod, type CraTod } from "@/lib/cra-model";
import { pspFor } from "@/lib/psp";

export const DSP_FIELDS = ["nature", "timing", "extent", "osp"] as const;
export type DspField = (typeof DSP_FIELDS)[number];

/**
 * Storage keys: `<index>_<field>` for the account level (osp), and
 * `<index>_<assertion>_<field>` for the per-assertion design — procedures are
 * designed per relevant assertion against that assertion's CRA (ISA 330 ¶6–7).
 * `sel_<assertion>` holds the JSON array of catalog indices the preparer
 * selected for that assertion — only selected procedures reach the E4 paper.
 */
const FIELD_KEY = /^(?:[CEAVP]_)?(nature|timing|extent|osp)$|^sel_[CEAVP]$/;

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

/** Whether S5.5 has recorded any procedure selection for the index. */
export async function dspHasSelection(engagementId: string, indexCode: string): Promise<boolean> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query(
      "SELECT 1 FROM form_response WHERE engagement_id = $1 AND code = 'dsp' AND field_key LIKE $2 LIMIT 1",
      [engagementId, `${indexCode}\\_sel\\_%`],
    );
    return r.rows.length > 0;
  });
}

/** Persist one design field — account-level (`osp`) or per-assertion (`E_nature`). */
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
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by, carried_forward)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       ON CONFLICT (engagement_id, code, field_key)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
                     carried_forward = false, updated_at = now()`,
      [tenantId, engagementId, CODE, `${indexCode}_${field}`, JSON.stringify(value), userId],
    );
  });
}

/** Index codes with at least one procedure selected in the S5.5 design. */
export async function dspDesignedIndexes(engagementId: string): Promise<Set<string>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ field_key: string; value: unknown }>(
      `SELECT field_key, value FROM form_response
        WHERE engagement_id = $1 AND code = $2 AND field_key LIKE '%\_sel\_%'`,
      [engagementId, CODE],
    );
    const out = new Set<string>();
    for (const row of r.rows) {
      const idx = row.field_key.split("_sel_")[0];
      try {
        const arr = JSON.parse(typeof row.value === "string" ? row.value : String(row.value ?? "[]"));
        if (Array.isArray(arr) && arr.length > 0) out.add(idx);
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
  return view.rows
    .filter((row) => row.cells.length > 0 && !Object.values(row.selected).some((arr) => arr.length > 0))
    .map((row) => row.indexCode);
}
