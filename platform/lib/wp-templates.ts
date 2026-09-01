// The firm's standard working papers — the catalogue behind the Templates
// section, and the source of the paper that arrives already attached to a task.
//
// A template is either a file that ships with the product (the substantive
// account papers under `wp-templates/`) or one the product builds (the E1.2
// test-of-controls paper, generated blank from the same code that generates a
// completed one, so the template can never drift from the real thing).
//
// Assigning a template to a task copies its bytes in as version 1 of an
// attachment. From that moment it is an ordinary task file: the auditor edits
// it locally and each save records the next version. The catalogue is never
// consulted again, so a later change to a template leaves filed papers alone —
// which is what ISA 230 ¶15-16 requires of an assembled file.
//
// Seeding is lazy and per engagement: the first time the task page is opened
// the bytes are inserted. It is idempotent (a row with that name on that
// file_item stops it), silent on failure (a missing template must never break
// the task page) and skipped on archived engagements.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { withTenant } from "@/lib/db";
import { ArchivedError, assertMutable } from "@/lib/mutability";
import { requireTenant } from "@/lib/tenant";
import { blankTocTemplate, buildTocWorkbook } from "@/lib/toc-workbook";

/** The subsections of the methodology a standard paper belongs to. */
export type TemplateCategory = "test-of-controls" | "substantive";

export const TEMPLATE_CATEGORIES: readonly {
  category: TemplateCategory;
  titleEn: string;
  titleFr: string;
}[] = [
  { category: "test-of-controls", titleEn: "Tests of controls", titleFr: "Tests des contrôles" },
  { category: "substantive", titleEn: "Substantive procedures", titleFr: "Procédures de substance" },
] as const;

export interface WpTemplate {
  /** stable identifier — what the API and the picker pass around */
  key: string;
  category: TemplateCategory;
  /** the attachment name the auditor sees on the task */
  name: string;
  titleEn: string;
  titleFr: string;
  descriptionEn: string;
  descriptionFr: string;
  /** task codes this paper is the standard one for */
  defaultFor: string[];
  /** a file shipped under `wp-templates/`, or absent when the product builds it */
  file?: string;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The catalogue. Codes come from lib/file-index: E1.2 is the test-of-controls
 * paper; the E4.x account papers are the substantive ones, mapped through
 * INDEX_SECTION (E → E4.1, N → E4.2, F → E4.3, K → E4.4).
 */
export const TEMPLATES: readonly WpTemplate[] = [
  {
    key: "toc-scot",
    category: "test-of-controls",
    name: "E1.2 Tests of Controls.xlsx",
    titleEn: "Tests of controls over significant classes of transactions",
    titleFr: "Tests des contrôles sur les flux significatifs",
    descriptionEn:
      "Cover with the engagement details entered once, an IPE tab for the completeness and accuracy of the data tested, a working paper per control with its attribute grid, and the exception register.",
    descriptionFr:
      "Page de garde saisie une seule fois, onglet IPE pour l'exhaustivité et l'exactitude des données testées, un papier de travail par contrôle avec sa grille d'attributs, et le registre des exceptions.",
    defaultFor: ["E1.2"],
  },
  {
    key: "sub-trade-receivables",
    category: "substantive",
    name: "E_Trade Receivables.xlsx",
    titleEn: "Trade receivables (E)",
    titleFr: "Créances clients (E)",
    descriptionEn: "Lead schedule, ageing and the substantive procedures for trade receivables.",
    descriptionFr: "Feuille maîtresse, balance âgée et procédures de substance sur les créances clients.",
    defaultFor: ["E4.1"],
    file: "E_Trade Receivables.xlsx",
  },
  {
    key: "sub-trade-payables",
    category: "substantive",
    name: "N_Trade Payables.xlsx",
    titleEn: "Trade payables (N)",
    titleFr: "Dettes fournisseurs (N)",
    descriptionEn:
      "Lead schedule, ageing and the substantive procedures for trade payables, including the search for unrecorded liabilities.",
    descriptionFr:
      "Feuille maîtresse, balance âgée et procédures de substance sur les dettes fournisseurs, dont la recherche de passifs non enregistrés.",
    defaultFor: ["E4.2"],
    file: "N_Trade Payables.xlsx",
  },
  {
    key: "sub-inventory",
    category: "substantive",
    name: "F_Inventory.xlsx",
    titleEn: "Inventories (F)",
    titleFr: "Stocks (F)",
    descriptionEn: "Lead schedule, count attendance and the substantive procedures for inventories.",
    descriptionFr: "Feuille maîtresse, assistance à l'inventaire et procédures de substance sur les stocks.",
    defaultFor: ["E4.3"],
    file: "F_Inventory.xlsx",
  },
  {
    key: "sub-fixed-assets",
    category: "substantive",
    name: "K_Fixed Assets.xlsx",
    titleEn: "Property, plant and equipment (K)",
    titleFr: "Immobilisations corporelles (K)",
    descriptionEn:
      "Lead schedule, movement table and the substantive procedures for property, plant and equipment.",
    descriptionFr:
      "Feuille maîtresse, tableau de variation et procédures de substance sur les immobilisations corporelles.",
    defaultFor: ["E4.4"],
    file: "K_Fixed Assets.xlsx",
  },
] as const;

export function findTemplate(key: string): WpTemplate | undefined {
  return TEMPLATES.find((t) => t.key === key);
}

/** The standard paper for a task code, when it has one. */
export function templateForCode(code: string): WpTemplate | undefined {
  return TEMPLATES.find((t) => t.defaultFor.includes(code));
}

/** Catalogue metadata only — never the bytes. Safe to send to the browser. */
export function listTemplates(): WpTemplate[] {
  return [...TEMPLATES];
}

/** Static template bytes, read once per process — the shipped files never change. */
const CACHE = new Map<string, Buffer>();

/**
 * The bytes of a template. A shipped file is read from disk and cached; a
 * generated one is built on demand, because building is cheap and caching it
 * would freeze the template against later improvements to the generator.
 */
export async function templateContent(
  key: string,
): Promise<{ name: string; mime: string; content: Buffer } | null> {
  const template = findTemplate(key);
  if (!template) return null;

  if (!template.file) {
    if (template.key === "toc-scot") {
      return { name: template.name, mime: XLSX_MIME, content: await buildTocWorkbook(blankTocTemplate()) };
    }
    return null;
  }

  const cached = CACHE.get(template.file);
  if (cached) return { name: template.name, mime: XLSX_MIME, content: cached };
  const content = await readFile(path.join(process.cwd(), "wp-templates", template.file));
  CACHE.set(template.file, content);
  return { name: template.name, mime: XLSX_MIME, content };
}

/** Insert a template's bytes as version 1 of an attachment on the task. */
async function attachBytes(
  engagementId: string,
  fileItemId: string,
  name: string,
  content: Buffer,
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO task_attachment
         (tenant_id, engagement_id, file_item_id, name, mime, size_bytes, version, content, uploaded_by)
       SELECT $1, $2, $3, $4, $5, $6, 1, $7, $8
        WHERE NOT EXISTS (
                SELECT 1 FROM task_attachment
                 WHERE file_item_id = $3 AND name = $4)
       ON CONFLICT (file_item_id, name, version) DO NOTHING`,
      [tenantId, engagementId, fileItemId, name, XLSX_MIME, content.length, content, userId],
    );
  });
}

/**
 * Attach the task's standard working paper if it has one and nothing by that
 * name is on the task yet. Never throws: the caller renders the page either way.
 */
export async function ensureDefaultWorkpaper(
  engagementId: string,
  fileItemId: string,
  taskCode: string,
): Promise<void> {
  const template = templateForCode(taskCode);
  if (!template) return;
  try {
    await assertMutable(engagementId);
    const bytes = await templateContent(template.key);
    if (!bytes) return;
    await attachBytes(engagementId, fileItemId, bytes.name, bytes.content);
  } catch (err) {
    // archived engagement: nothing to seed, and nothing to report
    if (err instanceof ArchivedError) return;
    console.warn(`[wp-templates] standard paper not seeded for ${taskCode}:`, err);
  }
}

export class TemplateError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "TemplateError";
  }
}

/**
 * Assign a template to a task on the auditor's instruction — the Templates
 * option in the attachments menu. Unlike seeding, this reports what went wrong:
 * the auditor asked for it and is waiting for an answer.
 */
export async function assignTemplate(fileItemId: string, key: string): Promise<{ name: string }> {
  if (!findTemplate(key)) throw new TemplateError("template-not-found");

  const { tenantId } = await requireTenant();
  const engagementId = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ engagement_id: string }>(
      "SELECT engagement_id FROM file_item WHERE id = $1",
      [fileItemId],
    );
    return r.rows[0]?.engagement_id ?? null;
  });
  if (!engagementId) throw new TemplateError("task-not-found");

  // An archived file is filed as it stood; nothing may be added to it.
  await assertMutable(engagementId);

  const bytes = await templateContent(key);
  if (!bytes) throw new TemplateError("template-unavailable");
  await attachBytes(engagementId, fileItemId, bytes.name, bytes.content);
  return { name: bytes.name };
}
