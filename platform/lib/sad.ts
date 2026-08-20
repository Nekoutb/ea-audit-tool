// The Summary of Audit Differences (ISA 450): every proposed adjustment
// recorded in a substantive-procedure conclusion (the SAP-adjustment entry on
// an E4/E5 workpaper step) flows here, classified by financial-statement
// caption, marked corrected or uncorrected, and posted onto the misstatement
// schedule that C1.1 evaluates against materiality. Each line keeps the link
// back to its working paper. The view also carries what the six workbook tabs
// need: engagement identity, FS caption totals from the current TB, income
// before tax, and the tab meta (qualitative factors, conclusion text, manual
// cash-flow and disclosure rows).

import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import {
  SAD_CAPTIONS,
  SAD_COLUMN_COUNT,
  SAD_QUAL_FACTORS,
  SAD_TYPES,
  captionColumn,
  suggestCaption,
  type SadCaption,
  type SadEntry,
  type SadView,
} from "@/lib/sad-model";

import { amountOr } from "@/lib/amount";
export type { SadCaption, SadEntry, SadView } from "@/lib/sad-model";

/** Shared parser: this stripped the decimal comma and inflated FCFA figures. */
const num = (v: string): number => amountOr(v, 0);

const CODE = "sad";
const RESULT_FIELD = /^(finding|adj_debit_account|adj_debit_amount|adj_credit_account|adj_credit_amount)_(.+)$/;
const OVERRIDE_FIELD = /^(drcap|crcap|mtype|corrected|rationale)_(.+)$/;
const META_KEY = /^(concl_text|cf_rows|disc_rows|q_[a-z_]+|qx_[a-z_]+)$/;

interface FsAmounts {
  /** one total per grid column (credit-positive for liabilities/equity, col 5 = 7 minus 6 net) */
  columns: number[];
  /** classes 7 minus 6 net */
  incomeBeforeTax: number;
}

async function fsCaptionAmountsTx(tx: PoolClient, engagementId: string): Promise<FsAmounts | null> {
  const rows = await tx.query<{ account_code: string; closing: string }>(
    `SELECT r.account_code,
            (r.opening_debit - r.opening_credit + r.debit - r.credit)::text AS closing
       FROM trial_balance tb
       JOIN trial_balance_version v ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
       JOIN trial_balance_row r ON r.version_id = v.id
      WHERE tb.engagement_id = $1`,
    [engagementId],
  );
  if (rows.rows.length === 0) return null;
  const columns = new Array<number>(SAD_COLUMN_COUNT).fill(0);
  let cl6 = 0;
  let cl7 = 0;
  for (const row of rows.rows) {
    const closing = Number(row.closing);
    const col = captionColumn(suggestCaption(row.account_code));
    // assets debit-positive; liabilities, equity and the income statement
    // credit-positive (so column 5 is exactly classes 7 minus 6 net)
    columns[col] += col <= 1 ? closing : -closing;
    const d1 = row.account_code[0];
    if (d1 === "6") cl6 += closing;
    else if (d1 === "7") cl7 += closing;
  }
  return {
    columns: columns.map((x) => Math.round(x)),
    incomeBeforeTax: Math.round(-(cl6 + cl7)),
  };
}

/**
 * FS amounts per caption column from the CURRENT trial-balance version:
 * closing balances grouped by suggestCaption(account) into the six grid
 * columns; the income-statement column is classes 7 minus 6 net. Null = no TB.
 */
export async function fsCaptionAmounts(engagementId: string): Promise<number[] | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const fs = await fsCaptionAmountsTx(tx, engagementId);
    return fs ? fs.columns : null;
  });
}

export async function sadView(engagementId: string): Promise<SadView> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const eng = await tx.query<{ client_name: string; period_end: string }>(
      `SELECT c.name AS client_name, to_char(e.period_end, 'YYYY-MM-DD') AS period_end
         FROM engagement e JOIN client c ON c.id = e.client_id
        WHERE e.id = $1`,
      [engagementId],
    );
    const steps = await tx.query<{ id: string; description: string; file_item_id: string; code: string; title_en: string }>(
      `SELECT ps.id, ps.description, fi.id AS file_item_id, fi.code, fi.title_en
         FROM program_step ps
         JOIN file_item fi ON fi.id = ps.file_item_id
        WHERE ps.engagement_id = $1 AND fi.code LIKE 'E%'`,
      [engagementId],
    );
    const results = await tx.query<{ code: string; field_key: string; value: unknown }>(
      "SELECT code, field_key, value FROM form_response WHERE engagement_id = $1 AND (code LIKE 'psp:%' OR code = $2)",
      [engagementId, CODE],
    );
    const posted = await tx.query<{ program_step_id: string | null }>(
      "SELECT program_step_id FROM misstatement WHERE engagement_id = $1 AND program_step_id IS NOT NULL",
      [engagementId],
    );
    const mat = await tx.query<{ overall: string; performance: string; trivial_pct: string }>(
      `SELECT overall::text, performance::text, trivial_pct::text FROM materiality
        WHERE engagement_id = $1 AND status = 'approved'
        ORDER BY version_no DESC LIMIT 1`,
      [engagementId],
    );
    const fs = await fsCaptionAmountsTx(tx, engagementId);

    const stepById = new Map(steps.rows.map((s) => [s.id, s]));
    const postedSet = new Set(posted.rows.map((r) => r.program_step_id));

    // per step: the psp-result fields and the SAD overrides; plus the tab meta
    const byStep = new Map<string, Record<string, string>>();
    const overrides = new Map<string, Record<string, string>>();
    const meta: Record<string, string> = {};
    for (const row of results.rows) {
      const value = typeof row.value === "string" ? row.value : String(row.value ?? "");
      if (row.code === CODE) {
        const m = row.field_key.match(OVERRIDE_FIELD);
        if (m) {
          const cur = overrides.get(m[2]) ?? {};
          cur[m[1]] = value;
          overrides.set(m[2], cur);
        } else if (META_KEY.test(row.field_key)) {
          meta[row.field_key] = value;
        }
      } else {
        const m = row.field_key.match(RESULT_FIELD);
        if (!m) continue;
        const cur = byStep.get(m[2]) ?? {};
        cur[m[1]] = value;
        byStep.set(m[2], cur);
      }
    }

    const entries: SadEntry[] = [];
    for (const [stepId, fields] of byStep) {
      const step = stepById.get(stepId);
      if (!step) continue;
      const drAmount = num(fields.adj_debit_amount ?? "");
      const crAmount = num(fields.adj_credit_amount ?? "");
      const hasAdjustment = drAmount !== 0 || crAmount !== 0 || (fields.adj_debit_account ?? "").trim() !== "" || (fields.adj_credit_account ?? "").trim() !== "";
      if (!hasAdjustment) continue;
      const o = overrides.get(stepId) ?? {};
      const drAccount = (fields.adj_debit_account ?? "").trim();
      const crAccount = (fields.adj_credit_account ?? "").trim();
      const drOverride = (SAD_CAPTIONS as readonly string[]).includes(o.drcap) ? (o.drcap as SadCaption) : null;
      const crOverride = (SAD_CAPTIONS as readonly string[]).includes(o.crcap) ? (o.crcap as SadCaption) : null;
      entries.push({
        stepId,
        taskCode: step.code,
        taskItemId: step.file_item_id,
        taskTitle: step.title_en,
        ref: step.description.split(/\s|—/)[0] ?? step.code,
        finding: (fields.finding ?? "").trim(),
        drAccount,
        drAmount,
        crAccount,
        crAmount,
        drCaption: drOverride ?? suggestCaption(drAccount),
        crCaption: crOverride ?? suggestCaption(crAccount),
        drSuggested: drOverride === null,
        crSuggested: crOverride === null,
        mtype: (SAD_TYPES as readonly string[]).includes(o.mtype) ? o.mtype : "factual",
        corrected: o.corrected === "yes",
        rationale: o.rationale ?? "",
        posted: postedSet.has(stepId),
      });
    }
    entries.sort((a, b) => a.taskCode.localeCompare(b.taskCode, undefined, { numeric: true }) || a.ref.localeCompare(b.ref));

    const m = mat.rows[0];
    return {
      entries,
      materiality: m
        ? {
            overall: Number(m.overall),
            performance: Number(m.performance),
            trivial: Math.round((Number(m.overall) * Number(m.trivial_pct)) / 100),
          }
        : null,
      entityName: eng.rows[0]?.client_name ?? "",
      periodEnd: eng.rows[0]?.period_end ?? "",
      fsCaptions: fs ? fs.columns : null,
      incomeBeforeTax: fs ? fs.incomeBeforeTax : null,
      meta,
    };
  });
}

/** Persist one SAD field (caption override, type, corrected flag, rationale) for a step. */
export async function saveSad(engagementId: string, stepId: string, field: string, value: string): Promise<void> {
  if (!["drcap", "crcap", "mtype", "corrected", "rationale"].includes(field)) throw new Error("invalid-field");
  if (!/^[0-9a-f-]{36}$/.test(stepId)) throw new Error("invalid-step");
  if ((field === "drcap" || field === "crcap") && !(SAD_CAPTIONS as readonly string[]).includes(value)) throw new Error("invalid-caption");
  if (field === "mtype" && !(SAD_TYPES as readonly string[]).includes(value)) throw new Error("invalid-type");
  if (field === "rationale" && value.length > 4000) throw new Error("invalid-value");
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by, carried_forward)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       ON CONFLICT (engagement_id, code, field_key)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
                     carried_forward = false, updated_at = now()`,
      [tenantId, engagementId, CODE, `${field}_${stepId}`, JSON.stringify(value), userId],
    );
  });
}

/**
 * Persist one SAD tab meta value: a qualitative-factor answer (q_<key>) or
 * comment (qx_<key>), the overall conclusion text (concl_text), or the manual
 * row arrays of the cash-flow and disclosure tabs (cf_rows / disc_rows, JSON).
 */
export async function saveSadMeta(engagementId: string, key: string, value: string): Promise<void> {
  const factor = key.match(/^(q|qx)_([a-z_]+)$/);
  if (["concl_text", "cf_rows", "disc_rows"].includes(key)) {
    if (key !== "concl_text") {
      try {
        if (!Array.isArray(JSON.parse(value))) throw new Error("invalid-value");
      } catch {
        throw new Error("invalid-value");
      }
    }
  } else if (factor && (SAD_QUAL_FACTORS as readonly string[]).includes(factor[2])) {
    if (factor[1] === "q" && !["yes", "no", "na", ""].includes(value)) throw new Error("invalid-value");
  } else {
    throw new Error("invalid-field");
  }
  if (value.length > 100000) throw new Error("invalid-value");
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by, carried_forward)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       ON CONFLICT (engagement_id, code, field_key)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
                     carried_forward = false, updated_at = now()`,
      [tenantId, engagementId, CODE, key, JSON.stringify(value), userId],
    );
  });
}

/**
 * Post one entry onto the misstatement schedule (upsert by program step), so
 * the C1.1 evaluation and its completion gate see it. The amount posted is the
 * adjustment's magnitude; the caption pair travels in the accounts text.
 */
export async function postSadEntry(engagementId: string, stepId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/.test(stepId)) throw new Error("invalid-step");
  const { tenantId, userId } = await requireTenant();
  const view = await sadView(engagementId);
  const entry = view.entries.find((e) => e.stepId === stepId);
  if (!entry) throw new Error("not-found");
  const amount = Math.max(Math.abs(entry.drAmount), Math.abs(entry.crAmount));
  const accounts = `Dr ${entry.drAccount || "—"} (${entry.drCaption}) / Cr ${entry.crAccount || "—"} (${entry.crCaption})`;
  const trivial = view.materiality ? amount < view.materiality.trivial : false;
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.query<{ id: string }>(
      "SELECT id FROM misstatement WHERE engagement_id = $1 AND program_step_id = $2",
      [engagementId, stepId],
    );
    if (existing.rows[0]) {
      await tx.query(
        `UPDATE misstatement SET description = $2, accounts = $3, amount = $4, mtype = $5, corrected = $6, trivial = $7
          WHERE id = $1`,
        [existing.rows[0].id, entry.finding || `${entry.ref} adjustment`, accounts, amount, entry.mtype, entry.corrected, trivial],
      );
    } else {
      await tx.query(
        `INSERT INTO misstatement (tenant_id, engagement_id, file_item_id, program_step_id, description, accounts, amount, mtype, corrected, trivial, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [tenantId, engagementId, entry.taskItemId, stepId, entry.finding || `${entry.ref} adjustment`, accounts, amount, entry.mtype, entry.corrected, trivial, userId],
      );
    }
  });
}
