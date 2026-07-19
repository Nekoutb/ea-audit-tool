// Per-tenant template overrides (Template management). An override replaces the
// purpose and/or checklist items of the code-defined template for NEW documents;
// existing documents keep their frozen bytes. Firm-admin gated for writes.

import type { PoolClient } from "pg";
import { recordActivity } from "@/lib/activity";
import { withTenant } from "@/lib/db";
import { canManageFirm, type Role } from "@/lib/rbac";
import type { WorkpaperTemplate } from "@/lib/templates";
import { requireTenant } from "@/lib/tenant";

export class TemplateError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "TemplateError";
  }
}

export interface OverrideRow {
  code: string;
  purposeEn: string | null;
  purposeFr: string | null;
  itemsEn: string[] | null;
  itemsFr: string[] | null;
}

/** Merge a tenant override (if any) over the code-defined template. Runs inside
 *  an existing tenant transaction (generateDocument). */
export async function applyOverride(
  tx: PoolClient,
  code: string,
  template: WorkpaperTemplate,
): Promise<WorkpaperTemplate> {
  const r = await tx.query<{
    purpose_en: string | null;
    purpose_fr: string | null;
    items_en: string[] | null;
    items_fr: string[] | null;
  }>(
    "SELECT purpose_en, purpose_fr, items_en, items_fr FROM template_override WHERE code = $1",
    [code],
  );
  const o = r.rows[0];
  if (!o) return template;
  return {
    ...template,
    id: `${template.id}+custom`,
    purpose: {
      en: o.purpose_en?.trim() || template.purpose.en,
      fr: o.purpose_fr?.trim() || template.purpose.fr,
    },
    items: {
      en: o.items_en && o.items_en.length > 0 ? o.items_en : template.items.en,
      fr: o.items_fr && o.items_fr.length > 0 ? o.items_fr : template.items.fr,
    },
  };
}

export async function listOverrides(): Promise<OverrideRow[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{
      code: string;
      purpose_en: string | null;
      purpose_fr: string | null;
      items_en: string[] | null;
      items_fr: string[] | null;
    }>("SELECT code, purpose_en, purpose_fr, items_en, items_fr FROM template_override ORDER BY code");
    return r.rows.map((row) => ({
      code: row.code,
      purposeEn: row.purpose_en,
      purposeFr: row.purpose_fr,
      itemsEn: row.items_en,
      itemsFr: row.items_fr,
    }));
  });
}

async function requireAdmin() {
  const ctx = await requireTenant();
  if (!canManageFirm(ctx.role as Role)) throw new TemplateError("forbidden");
  return ctx;
}

export async function saveOverride(input: {
  code: string;
  purposeEn: string;
  purposeFr: string;
  itemsEn: string[];
  itemsFr: string[];
}): Promise<void> {
  const { tenantId } = await requireAdmin();
  const code = input.code.trim();
  if (!code) throw new TemplateError("invalid-code");
  const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean).slice(0, 40);
  const itemsEn = clean(input.itemsEn);
  const itemsFr = clean(input.itemsFr);
  const empty =
    !input.purposeEn.trim() && !input.purposeFr.trim() && itemsEn.length === 0 && itemsFr.length === 0;
  await withTenant(tenantId, async (tx) => {
    if (empty) {
      await tx.query("DELETE FROM template_override WHERE code = $1", [code]);
      return;
    }
    await tx.query(
      `INSERT INTO template_override (tenant_id, code, purpose_en, purpose_fr, items_en, items_fr)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, code) DO UPDATE SET
         purpose_en = EXCLUDED.purpose_en,
         purpose_fr = EXCLUDED.purpose_fr,
         items_en = EXCLUDED.items_en,
         items_fr = EXCLUDED.items_fr,
         updated_at = now()`,
      [
        tenantId,
        code,
        input.purposeEn.trim() || null,
        input.purposeFr.trim() || null,
        itemsEn.length > 0 ? JSON.stringify(itemsEn) : null,
        itemsFr.length > 0 ? JSON.stringify(itemsFr) : null,
      ],
    );
  });
  await recordActivity({
    entityType: "template",
    action: empty ? "reset" : "customized",
    summary: `Template ${code} ${empty ? "reset to default" : "customized"}`,
  });
}

export async function resetOverride(code: string): Promise<void> {
  const { tenantId } = await requireAdmin();
  await withTenant(tenantId, async (tx) => {
    await tx.query("DELETE FROM template_override WHERE code = $1", [code]);
  });
  await recordActivity({ entityType: "template", action: "reset", summary: `Template ${code} reset to default` });
}
