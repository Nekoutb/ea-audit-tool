// Tool-fed papers (F004, decision of 2026-10-27): working papers whose content
// is the output of one of the file's tools. Until that output exists there is
// nothing to attest, so every sign-off on them — preparer, reviewer, partner —
// is refused with a "tool-output-missing-…" code naming what is missing
// (signDocument in lib/documents.ts), and the paper screens grey the sign
// buttons out with the same reason. The EQR's own sign-off on C4.2 is not
// concerned: C4.2 is not tool-fed.
//
// One place for the mapping: each entry says what the tool persists and the
// exact condition read from the database.

import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";

export type ToolOutput = "materiality" | "sad" | "tb";

/** The refusal raised on a tool-fed paper: tool-output-missing-materiality, …-tb, … */
export function toolOutputMissingCode(output: ToolOutput): string {
  return `tool-output-missing-${output}`;
}

/** The trial-balance-fed lead-schedule papers: E4.1-E4.34 (E4.35 leases and E4.36 the TFT tie-out carry no lead index). */
const LEAD_SCHEDULE_PAPER = /^E4\.([1-9]|[12][0-9]|3[0-4])$/;

/**
 * What each tool-fed paper needs, in the order it is checked (the first
 * missing output is the one named):
 *
 *  - P6.1 Materiality: an APPROVED version in the materiality tool
 *    (materiality.status = 'approved', approveMateriality in lib/materiality.ts).
 *    A draft is not the paper's figure.
 *  - P6.2 Significant accounts: the significance grid (lib/significant-
 *    accounts.ts) is computed from the current trial balance against the
 *    approved materiality's tolerable error — significantAccounts() returns
 *    nothing without the TB, and without materiality every default reads
 *    "not significant". Both are required.
 *  - C1.1 Summary of Audit Differences: the SAD tool (lib/sad.ts) persists
 *    its overrides and the team's conclusion under form_response code 'sad'
 *    (field concl_text) and evaluates the differences against the approved
 *    materiality and the FS captions of the current TB. A SAD with no
 *    differences is still a SAD: what proves the tool was run is the recorded
 *    conclusion, over an approved materiality and a TB.
 *  - E4.1-E4.34 lead schedules: a VALID current-year trial balance imported —
 *    the engagement's trial_balance has a current version (current_version_no
 *    > 0, only ever set by a valid pre-audit import or a posted adjustment)
 *    whose validation_status is 'valid' (lib/tb.ts).
 */
export function toolOutputsFor(code: string): readonly ToolOutput[] {
  if (code === "P6.1") return ["materiality"];
  if (code === "P6.2") return ["tb", "materiality"];
  if (code === "C1.1") return ["tb", "materiality", "sad"];
  if (LEAD_SCHEDULE_PAPER.test(code)) return ["tb"];
  return [];
}

export function isToolFedPaper(code: string): boolean {
  return toolOutputsFor(code).length > 0;
}

async function present(tx: PoolClient, engagementId: string, output: ToolOutput): Promise<boolean> {
  const exists = async (sql: string): Promise<boolean> => ((await tx.query(sql, [engagementId])).rowCount ?? 0) > 0;
  switch (output) {
    case "materiality":
      return exists("SELECT 1 FROM materiality WHERE engagement_id = $1 AND status = 'approved'");
    case "tb":
      return exists(
        `SELECT 1 FROM trial_balance tb
           JOIN trial_balance_version v ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
          WHERE tb.engagement_id = $1 AND tb.current_version_no > 0 AND v.validation_status = 'valid'`,
      );
    case "sad":
      return exists(
        `SELECT 1 FROM form_response
          WHERE engagement_id = $1 AND code = 'sad' AND field_key = 'concl_text'
            AND btrim(coalesce(value #>> '{}', '')) <> ''`,
      );
  }
}

/** The refusal code for a sign-off on this paper, or null when its tool output exists. */
export async function toolOutputMissingTx(tx: PoolClient, engagementId: string, code: string): Promise<string | null> {
  for (const output of toolOutputsFor(code)) {
    if (!(await present(tx, engagementId, output))) return toolOutputMissingCode(output);
  }
  return null;
}

/**
 * The same, for many papers at once (the phase and group lists): code →
 * refusal code, only for the papers whose output is missing.
 */
export async function toolOutputsMissing(
  tenantId: string,
  engagementId: string,
  codes: readonly string[],
): Promise<Map<string, string>> {
  const fed = codes.filter(isToolFedPaper);
  const missing = new Map<string, string>();
  if (fed.length === 0) return missing;
  await withTenant(tenantId, async (tx) => {
    const known = new Map<ToolOutput, boolean>();
    for (const code of fed) {
      for (const output of toolOutputsFor(code)) {
        if (!known.has(output)) known.set(output, await present(tx, engagementId, output));
        if (!known.get(output)) {
          missing.set(code, toolOutputMissingCode(output));
          break;
        }
      }
    }
  });
  return missing;
}
