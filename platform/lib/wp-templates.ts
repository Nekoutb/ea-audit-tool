// The firm's Excel working papers ship with the product. Opening the
// substantive-procedure task for Trade Receivables, Trade Payables, Inventory
// or Fixed Assets finds the paper already attached as version 1 — the auditor
// edits it locally and each save records the next version, exactly as if they
// had uploaded it themselves.
//
// Seeding is lazy and per engagement: the first time the task page is opened
// the bytes are read from `wp-templates/` and inserted. It is idempotent (a row
// with that name on that file_item stops it), silent on failure (a missing or
// unreadable template must never break the task page) and skipped on archived
// engagements, which stay exactly as filed (ISA 230 ¶15-16).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { withTenant } from "@/lib/db";
import { ArchivedError, assertMutable } from "@/lib/mutability";
import { requireTenant } from "@/lib/tenant";

export interface WpTemplate {
  /** basename under `wp-templates/` */
  file: string;
  /** the attachment name the auditor sees on the task */
  name: string;
}

/**
 * Task code → its default working paper. The codes come from
 * `INDEX_SECTION` in lib/lead-classes: E → E4.1, N → E4.2, F → E4.3, K → E4.4.
 */
export const WP_TEMPLATES: Record<string, WpTemplate> = {
  "E4.1": { file: "E_Trade Receivables.xlsx", name: "E_Trade Receivables.xlsx" }, // index E
  "E4.2": { file: "N_Trade Payables.xlsx", name: "N_Trade Payables.xlsx" }, // index N
  "E4.3": { file: "F_Inventory.xlsx", name: "F_Inventory.xlsx" }, // index F
  "E4.4": { file: "K_Fixed Assets.xlsx", name: "K_Fixed Assets.xlsx" }, // index K
};

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Template bytes, read once per process — the files are 22-38 KB and never change. */
const CACHE = new Map<string, Buffer>();

async function templateBytes(file: string): Promise<Buffer> {
  const cached = CACHE.get(file);
  if (cached) return cached;
  const content = await readFile(path.join(process.cwd(), "wp-templates", file));
  CACHE.set(file, content);
  return content;
}

/**
 * Attach the task's default working paper if it has one and nothing by that
 * name is on the task yet. Never throws: the caller renders the page either way.
 */
export async function ensureDefaultWorkpaper(
  engagementId: string,
  fileItemId: string,
  taskCode: string,
): Promise<void> {
  const template = WP_TEMPLATES[taskCode];
  if (!template) return;
  try {
    await assertMutable(engagementId);
    const { tenantId, userId } = await requireTenant();
    const content = await templateBytes(template.file);
    await withTenant(tenantId, async (tx) => {
      await tx.query(
        `INSERT INTO task_attachment
           (tenant_id, engagement_id, file_item_id, name, mime, size_bytes, version, content, uploaded_by)
         SELECT $1, $2, $3, $4, $5, $6, 1, $7, $8
          WHERE NOT EXISTS (
                  SELECT 1 FROM task_attachment
                   WHERE file_item_id = $3 AND name = $4)
         ON CONFLICT (file_item_id, name, version) DO NOTHING`,
        [tenantId, engagementId, fileItemId, template.name, XLSX_MIME, content.length, content, userId],
      );
    });
  } catch (err) {
    // archived engagement: nothing to seed, and nothing to report
    if (err instanceof ArchivedError) return;
    console.warn(`[wp-templates] default working paper not seeded for ${taskCode}:`, err);
  }
}
