// The Summary of Audit Differences (ISA 450): every proposed adjustment
// recorded in a substantive-procedure conclusion (the SAP-adjustment entry on
// an E4/E5 workpaper step) flows here, classified by financial-statement
// caption, marked corrected or uncorrected, and posted onto the misstatement
// schedule that C1.1 evaluates against materiality. Each line keeps the link
// back to its working paper.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { SAD_CAPTIONS, SAD_TYPES, suggestCaption, type SadCaption, type SadEntry, type SadView } from "@/lib/sad-model";

export type { SadCaption, SadEntry, SadView } from "@/lib/sad-model";

const num = (v: string): number => {
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const CODE = "sad";
const RESULT_FIELD = /^(finding|adj_debit_account|adj_debit_amount|adj_credit_account|adj_credit_amount)_(.+)$/;

export async function sadView(engagementId: string): Promise<SadView> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
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

    const stepById = new Map(steps.rows.map((s) => [s.id, s]));
    const postedSet = new Set(posted.rows.map((r) => r.program_step_id));

    // per step: the psp-result fields and the SAD overrides
    const byStep = new Map<string, Record<string, string>>();
    const overrides = new Map<string, Record<string, string>>();
    for (const row of results.rows) {
      const value = typeof row.value === "string" ? row.value : String(row.value ?? "");
      if (row.code === CODE) {
        const m = row.field_key.match(/^(drcap|crcap|mtype|corrected)_(.+)$/);
        if (!m) continue;
        const cur = overrides.get(m[2]) ?? {};
        cur[m[1]] = value;
        overrides.set(m[2], cur);
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
    };
  });
}

/** Persist one SAD field (caption override, type, corrected flag) for a step. */
export async function saveSad(engagementId: string, stepId: string, field: string, value: string): Promise<void> {
  if (!["drcap", "crcap", "mtype", "corrected"].includes(field)) throw new Error("invalid-field");
  if (!/^[0-9a-f-]{36}$/.test(stepId)) throw new Error("invalid-step");
  if ((field === "drcap" || field === "crcap") && !(SAD_CAPTIONS as readonly string[]).includes(value)) throw new Error("invalid-caption");
  if (field === "mtype" && !(SAD_TYPES as readonly string[]).includes(value)) throw new Error("invalid-type");
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
