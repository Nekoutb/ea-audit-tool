// Lead schedules (spec §10.3, steps 3.7/3.8): auto-generated per E-section from
// the engagement's current trial-balance version, grouped through the SYSCOHADA
// grouping rules (+ client overrides), with prior-year comparatives, materiality
// flags, and live Excel totals. Stored as versioned 'leadsheet' documents so the
// existing check-out/check-in round-trip and preview apply. Regeneration
// re-merges user commentary/tickmarks by account number and reports lines it
// could not preserve.

import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { leadRef } from "@/lib/lead-taxonomy";
import { createNotification } from "@/lib/notifications";
import { requireTenant } from "@/lib/tenant";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface GroupedRow {
  accountCode: string;
  accountName: string | null;
  closing: number;
  prior: number | null;
}

export interface SectionBalances {
  sectionCode: string;
  rows: GroupedRow[];
  total: number;
  priorTotal: number;
  unmappedAccounts: string[];
}

interface Rule {
  prefix: string;
  sectionCode: string;
  exact: boolean;
  priority: number;
}

async function loadRules(tx: PoolClient, clientId: string): Promise<{ overrides: Rule[]; global: Rule[] }> {
  const overrides = await tx.query<{ account_prefix: string; section_code: string; match_type: string }>(
    "SELECT account_prefix, section_code, match_type FROM client_grouping_override WHERE client_id = $1 AND active",
    [clientId],
  );
  const global = await tx.query<{ account_prefix: string; section_code: string; priority: number }>(
    "SELECT account_prefix, section_code, priority FROM syscohada_grouping_rule WHERE active",
  );
  return {
    overrides: overrides.rows.map((r) => ({
      prefix: r.account_prefix,
      sectionCode: r.section_code,
      exact: r.match_type === "exact",
      priority: 100,
    })),
    global: global.rows.map((r) => ({
      prefix: r.account_prefix,
      sectionCode: r.section_code,
      exact: false,
      priority: r.priority,
    })),
  };
}

/** Longest-prefix match; client overrides beat global rules (spec §10.2). */
export function resolveSection(
  accountCode: string,
  overrides: Rule[],
  global: Rule[],
): string | null {
  const match = (rules: Rule[]): string | null => {
    let best: Rule | null = null;
    for (const rule of rules) {
      const hit = rule.exact ? accountCode === rule.prefix : accountCode.startsWith(rule.prefix);
      if (!hit) continue;
      if (
        !best ||
        rule.prefix.length > best.prefix.length ||
        (rule.prefix.length === best.prefix.length && rule.priority > best.priority)
      ) {
        best = rule;
      }
    }
    return best?.sectionCode ?? null;
  };
  return match(overrides) ?? match(global);
}

interface TbRow {
  account_code: string;
  account_name: string | null;
  closing: string;
}

async function currentVersionRows(tx: PoolClient, engagementId: string): Promise<TbRow[]> {
  const result = await tx.query<TbRow>(
    `SELECT r.account_code, r.account_name,
            (r.opening_debit - r.opening_credit + r.debit - r.credit)::text AS closing
       FROM trial_balance tb
       JOIN trial_balance_version v
         ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
       JOIN trial_balance_row r ON r.version_id = v.id
      WHERE tb.engagement_id = $1`,
    [engagementId],
  );
  return result.rows;
}

async function priorEngagementId(tx: PoolClient, engagementId: string): Promise<string | null> {
  const result = await tx.query<{ id: string }>(
    `SELECT p.id
       FROM engagement e
       JOIN engagement p ON p.client_id = e.client_id AND p.fiscal_year < e.fiscal_year
      WHERE e.id = $1
      ORDER BY p.fiscal_year DESC
      LIMIT 1`,
    [engagementId],
  );
  return result.rows[0]?.id ?? null;
}

/**
 * Group the engagement's current TB into per-section balances with prior-year
 * comparatives. Accounts with no matching rule are reported (spec §10.2:
 * unmapped accounts block lead-schedule generation for their section).
 */
export async function sectionBalances(engagementId: string): Promise<Map<string, SectionBalances>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const clientRow = await tx.query<{ client_id: string }>(
      "SELECT client_id FROM engagement WHERE id = $1",
      [engagementId],
    );
    if (!clientRow.rows[0]) throw new Error("not-found");
    const { overrides, global } = await loadRules(tx, clientRow.rows[0].client_id);

    const rows = await currentVersionRows(tx, engagementId);
    const priorId = await priorEngagementId(tx, engagementId);
    const priorRows = priorId ? await currentVersionRows(tx, priorId) : [];
    const priorByAccount = new Map(priorRows.map((row) => [row.account_code, Number(row.closing)]));

    const sections = new Map<string, SectionBalances>();
    const unmappedGlobal: string[] = [];
    for (const row of rows) {
      const sectionCode = resolveSection(row.account_code, overrides, global);
      if (!sectionCode) {
        unmappedGlobal.push(row.account_code);
        continue;
      }
      const section = sections.get(sectionCode) ?? {
        sectionCode,
        rows: [],
        total: 0,
        priorTotal: 0,
        unmappedAccounts: [],
      };
      const closing = Number(row.closing);
      const prior = priorByAccount.get(row.account_code) ?? null;
      section.rows.push({ accountCode: row.account_code, accountName: row.account_name, closing, prior });
      section.total += closing;
      section.priorTotal += prior ?? 0;
      sections.set(sectionCode, section);
    }
    for (const section of sections.values()) {
      section.rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
      section.unmappedAccounts = unmappedGlobal;
    }
    if (sections.size === 0 && unmappedGlobal.length > 0) {
      sections.set("__unmapped__", {
        sectionCode: "__unmapped__",
        rows: [],
        total: 0,
        priorTotal: 0,
        unmappedAccounts: unmappedGlobal,
      });
    }
    return sections;
  });
}

interface Preserved {
  tickmark: string;
  commentary: string;
}

const HEADER_ROWS = 6; // meta block before the table header row

async function extractPreserved(content: Buffer): Promise<Map<string, Preserved>> {
  const preserved = new Map<string, Preserved>();
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(content as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return preserved;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= HEADER_ROWS + 1) return; // skip meta + table header
      const account = String(row.getCell(1).value ?? "").trim();
      if (!account) return;
      // Columns: A account … G material, H tickmark, I commentary.
      const tickmark = String(row.getCell(8).value ?? "").trim();
      const commentary = String(row.getCell(9).value ?? "").trim();
      if (tickmark || commentary) preserved.set(account, { tickmark, commentary });
    });
  } catch {
    // Unreadable previous version: nothing preserved (reported as 0 kept).
  }
  return preserved;
}

export interface LeadScheduleResult {
  documentId: string;
  versionNo: number;
  rowCount: number;
  preservedCount: number;
  lostAccounts: string[];
}

/**
 * Generate (or regenerate) the Excel lead schedule for one E-section and check
 * it in as the next version of the section's 'leadsheet' document. Regeneration
 * preserves tickmarks/commentary by account number and reports lost lines.
 */
export async function generateLeadSchedule(
  fileItemId: string,
  locale: Locale,
): Promise<LeadScheduleResult> {
  const { tenantId, userId } = await requireTenant();
  const fr = locale === "fr";

  return withTenant(tenantId, async (tx) => {
    const item = await tx.query<{
      id: string;
      engagement_id: string;
      code: string;
      title_en: string;
      title_fr: string;
      client_name: string;
      fiscal_year: number;
      period_end: string;
    }>(
      `SELECT fi.id, fi.engagement_id, fi.code, fi.title_en, fi.title_fr,
              c.name AS client_name, e.fiscal_year,
              to_char(e.period_end, 'YYYY-MM-DD') AS period_end
         FROM file_item fi
         JOIN engagement e ON e.id = fi.engagement_id
         JOIN client c ON c.id = e.client_id
        WHERE fi.id = $1 AND fi.section = 'E'`,
      [fileItemId],
    );
    const info = item.rows[0];
    if (!info) throw new Error("not-found");

    // Grouped rows for THIS section (re-resolve inside the same tx).
    const clientRow = await tx.query<{ client_id: string }>(
      "SELECT client_id FROM engagement WHERE id = $1",
      [info.engagement_id],
    );
    const { overrides, global } = await loadRules(tx, clientRow.rows[0].client_id);
    const tbRows = await currentVersionRows(tx, info.engagement_id);
    if (tbRows.length === 0) throw new Error("no-tb");
    const priorId = await priorEngagementId(tx, info.engagement_id);
    const priorRows = priorId ? await currentVersionRows(tx, priorId) : [];
    const priorByAccount = new Map(priorRows.map((row) => [row.account_code, Number(row.closing)]));

    const sectionRows: GroupedRow[] = [];
    for (const row of tbRows) {
      if (resolveSection(row.account_code, overrides, global) !== info.code) continue;
      sectionRows.push({
        accountCode: row.account_code,
        accountName: row.account_name,
        closing: Number(row.closing),
        prior: priorByAccount.get(row.account_code) ?? null,
      });
    }
    if (sectionRows.length === 0) throw new Error("no-mapped-rows");
    sectionRows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    // Approved materiality figures for the header + material flags (spec §8.2).
    const materiality = await tx.query<{ overall: string; performance: string; trivial: string }>(
      `SELECT overall::text, performance::text, trivial::text
         FROM materiality
        WHERE engagement_id = $1 AND status = 'approved'
        ORDER BY version_no DESC LIMIT 1`,
      [info.engagement_id],
    );
    const performance = materiality.rows[0] ? Number(materiality.rows[0].performance) : null;

    // Existing leadsheet document + preserved annotations from its latest version.
    const title = `${info.code}.1 — ${fr ? "Tableau de synthèse" : "Lead schedule"}`;
    const existing = await tx.query<{ id: string; current_version: number }>(
      "SELECT id, current_version FROM document WHERE file_item_id = $1 AND kind = 'leadsheet' LIMIT 1",
      [fileItemId],
    );
    let preserved = new Map<string, Preserved>();
    if (existing.rows[0] && existing.rows[0].current_version > 0) {
      const previous = await tx.query<{ content: Buffer }>(
        "SELECT content FROM document_version WHERE document_id = $1 AND version_no = $2",
        [existing.rows[0].id, existing.rows[0].current_version],
      );
      if (previous.rows[0]) preserved = await extractPreserved(previous.rows[0].content);
    }

    // Build the workbook.
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`${info.code}.1`);
    const L = fr
      ? { client: "Client", period: "Clôture", index: "Index", overall: "Seuil global", pm: "Seuil de planification", trivial: "Négligeable", account: "Compte", label: "Libellé", prior: "N-1", closing: "N", movement: "Mouvement", variance: "Écart %", material: "Significatif", tick: "Tickmark", comment: "Commentaire", total: "TOTAL" }
      : { client: "Client", period: "Period end", index: "Index", overall: "Overall materiality", pm: "Performance materiality", trivial: "Trivial", account: "Account", label: "Label", prior: "Prior year", closing: "Closing", movement: "Movement", variance: "Variance %", material: "Material", tick: "Tickmark", comment: "Commentary", total: "TOTAL" };

    sheet.addRow([L.client, info.client_name]);
    sheet.addRow([L.period, `${info.period_end} (${info.fiscal_year})`]);
    sheet.addRow([L.index, `${leadRef(info.code)} · ${info.code}`]);
    sheet.addRow([L.overall, materiality.rows[0] ? Number(materiality.rows[0].overall) : "—"]);
    sheet.addRow([L.pm, performance ?? "—"]);
    sheet.addRow([L.trivial, materiality.rows[0] ? Number(materiality.rows[0].trivial) : "—"]);

    const header = sheet.addRow([
      L.account, L.label, L.prior, L.closing, L.movement, L.variance, L.material, L.tick, L.comment,
    ]);
    header.font = { bold: true };

    let preservedCount = 0;
    const newAccounts = new Set<string>();
    for (const row of sectionRows) {
      newAccounts.add(row.accountCode);
      const movement = row.prior === null ? null : row.closing - row.prior;
      const variance =
        row.prior === null || row.prior === 0 ? null : ((row.closing - row.prior) / Math.abs(row.prior)) * 100;
      const kept = preserved.get(row.accountCode);
      if (kept) preservedCount += 1;
      sheet.addRow([
        row.accountCode,
        row.accountName ?? "",
        row.prior,
        row.closing,
        movement,
        variance === null ? null : Number(variance.toFixed(1)),
        performance !== null && Math.abs(row.closing) >= performance ? "M" : "",
        kept?.tickmark ?? "",
        kept?.commentary ?? "",
      ]);
    }
    const firstData = HEADER_ROWS + 2;
    const lastData = firstData + sectionRows.length - 1;
    const totalRow = sheet.addRow([
      L.total, "",
      { formula: `SUM(C${firstData}:C${lastData})` },
      { formula: `SUM(D${firstData}:D${lastData})` },
      { formula: `SUM(E${firstData}:E${lastData})` },
      null, null, null, null,
    ]);
    totalRow.font = { bold: true };
    sheet.getColumn(1).width = 12;
    sheet.getColumn(2).width = 40;
    for (const col of [3, 4, 5]) sheet.getColumn(col).width = 16;
    sheet.getColumn(9).width = 40;

    const content = Buffer.from(await workbook.xlsx.writeBuffer());
    const lostAccounts = [...preserved.keys()].filter((account) => !newAccounts.has(account));

    // Store as the next version of the section's leadsheet document.
    let documentId: string;
    if (existing.rows[0]) {
      documentId = existing.rows[0].id;
    } else {
      const created = await tx.query<{ id: string }>(
        `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, kind, created_by)
         VALUES ($1, $2, $3, $4, $5, 'leadsheet', $6) RETURNING id`,
        [tenantId, info.engagement_id, fileItemId, title, locale, userId],
      );
      documentId = created.rows[0].id;
    }
    const next = await tx.query<{ v: number }>(
      "SELECT coalesce(max(version_no), 0) + 1 AS v FROM document_version WHERE document_id = $1",
      [documentId],
    );
    const versionNo = next.rows[0].v;
    const note =
      versionNo === 1
        ? "leadsheet:generated"
        : `leadsheet:regenerated preserved=${preservedCount} lost=${lostAccounts.length}`;
    await tx.query(
      `INSERT INTO document_version
         (tenant_id, document_id, version_no, mime, byte_size, sha256, content, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [tenantId, documentId, versionNo, XLSX_MIME, content.length, createHash("sha256").update(content).digest("hex"), content, note, userId],
    );
    await tx.query("UPDATE document SET current_version = $2 WHERE id = $1", [documentId, versionNo]);

    return { documentId, versionNo, rowCount: sectionRows.length, preservedCount, lostAccounts };
  });
}

/** Step 3.8: assign the section to a team member and deliver the lead schedule. */
export async function assignSection(fileItemId: string, userId: string): Promise<void> {
  const { tenantId } = await requireTenant();
  const target = await withTenant(tenantId, async (tx) => {
    const updated = await tx.query<{ code: string; engagement_id: string }>(
      "UPDATE file_item SET owner_id = $2 WHERE id = $1 AND section = 'E' RETURNING code, engagement_id",
      [fileItemId, userId],
    );
    if (!updated.rows[0]) throw new Error("not-found");
    return updated.rows[0];
  });
  // In-app only: the bell is the single delivery channel for assignments.
  await createNotification({
    tenantId,
    userId,
    kind: "section-assigned",
    title: `Section ${target.code} assigned to you`,
    body: "The lead schedule is ready — open the section to work it.",
    href: `/engagements/${target.engagement_id}/sections/${fileItemId}`,
  });
}
