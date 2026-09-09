// Assembles the E1.1 view from the engagement's own data — the S2.3 IT
// applications board, the answers already recorded on the paper, and the
// section conclusion — and hands it to the workbook builder.
//
// Nothing is invented here. The tool does not yet hold ITGC controls, their
// attribute grids or a deficiency register, so those arrive empty and the
// builder writes them as entry cells: a blank block on each domain tab and
// blank deficiency rows. That is the house rule for this file — an empty cell
// the auditor fills is honest, a row the export made up is not.
//
// The domain conclusions and the IT-process conclusion come from the paper's
// own Part C answers rather than being derived from anything, because the
// handbook is explicit that an ineffective ITGC does not necessarily make the
// IT process ineffective: only the preparer can say which way the diagnostic
// went.

import { withTenant } from "@/lib/db";
import { getEngagement } from "@/lib/engagements";
import { itAppsView } from "@/lib/itgc";
import type { ItStrategy } from "@/lib/itgc-model";
import {
  buildItgcWorkbook,
  ITGC_DOMAINS,
  type DomainState,
  type ItgcApplication,
  type ItgcDomainConclusion,
  type ItgcView,
  type ProcessState,
} from "@/lib/itgc-workbook";
import { requireTenant } from "@/lib/tenant";
import { loadPaper } from "@/lib/working-papers";

/** The S2.3 strategy in the words the workbook prints. */
const STRATEGY_LABEL: Record<ItStrategy, string> = {
  rely_itgc: "Rely on the IT processes — test the ITGCs",
  test_direct: "Test the automated controls directly, each period",
  substantive_only: "Fully substantive — no reliance on the IT controls",
};

/** The Part C field holding each domain's conclusion, keyed by domain. */
const DOMAIN_FIELD: Record<(typeof ITGC_DOMAINS)[number]["key"], string> = {
  changes: "domain_changes",
  access: "domain_access",
  operations: "domain_operations",
  support: "domain_support",
};

const DOMAIN_STATES: readonly DomainState[] = ["effective", "reliable", "ineffective"];
const PROCESS_STATES: readonly ProcessState[] = ["support", "not_support"];

export async function itgcView(engagementId: string): Promise<ItgcView | null> {
  const { tenantId } = await requireTenant();
  const engagement = await getEngagement(engagementId);
  if (!engagement) return null;

  const [apps, answers] = await Promise.all([
    itAppsView(engagementId),
    loadPaper(engagementId, "E1.1").catch(() => ({}) as Record<string, string>),
  ]);

  // Sign-off and the recorded section conclusion, both owned by the tool.
  const meta = await withTenant(tenantId, async (tx) => {
    const signoffs = await tx.query<{ role: string; who: string }>(
      `SELECT s.role, coalesce(u.name, u.email) AS who
         FROM file_item fi
         JOIN document d ON d.file_item_id = fi.id AND d.kind = 'workpaper'
         JOIN signoff s ON s.document_id = d.id AND s.voided_at IS NULL
         JOIN app_user u ON u.id = s.user_id
        WHERE fi.engagement_id = $1 AND fi.code = 'E1.1'`,
      [engagementId],
    );
    const conclusion = await tx.query<{ conclusion: string }>(
      `SELECT sc.conclusion
         FROM file_item fi JOIN section_conclusion sc ON sc.file_item_id = fi.id
        WHERE fi.engagement_id = $1 AND fi.code = 'E1.1'`,
      [engagementId],
    );
    const by = (role: string) => signoffs.rows.find((r) => r.role === role)?.who ?? null;
    return {
      preparer: by("preparer"),
      reviewer: by("reviewer"),
      partner: by("partner"),
      conclusion: conclusion.rows[0]?.conclusion ?? null,
    };
  });

  const applications: ItgcApplication[] = apps.rows.map((row, i) => ({
    ref: `APP-${i + 1}`,
    name: row.name,
    layers: row.layers,
    scots: row.scots,
    // What the audit takes from the application is decided control by control;
    // nothing on S2.3 records it, so the column stays open for the preparer.
    dependency: "",
    criticality: "",
    strategy: row.strategy === "" ? "" : STRATEGY_LABEL[row.strategy],
    serviceOrg: "",
    note: row.itgcNote,
  }));

  const domains: ItgcDomainConclusion[] = ITGC_DOMAINS.map((domain) => {
    const recorded = answers[DOMAIN_FIELD[domain.key]] ?? "";
    return {
      domain: domain.key,
      state: (DOMAIN_STATES as readonly string[]).includes(recorded)
        ? (recorded as DomainState)
        : null,
      // The paper holds one basis, written about the IT process as a whole. It
      // goes to the Cover with the conclusion; repeating it under each of the
      // four domains would read as four findings where the preparer made one.
      basis: "",
    };
  });

  const process = answers.it_process ?? "";
  // The recorded section conclusion and the paper's own reasoning are two
  // halves of the same answer, so the Cover carries both.
  const conclusion = [meta.conclusion, answers.process_basis]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n\n");

  return {
    clientName: engagement.clientName,
    fiscalYear: engagement.fiscalYear,
    periodEnd: engagement.periodEnd,
    periodOfReliance: null,
    preparer: meta.preparer,
    reviewer: meta.reviewer,
    partner: meta.partner,
    conclusion: conclusion === "" ? null : conclusion,
    itProcess: (PROCESS_STATES as readonly string[]).includes(process)
      ? (process as ProcessState)
      : null,
    applications,
    // The ITGC controls tested, their grids and the deficiency register are not
    // held anywhere yet. Empty lists give the auditor the blank paper.
    controls: [],
    domains,
    deficiencies: [],
  };
}

export async function exportItgcWorkbook(
  engagementId: string,
): Promise<{ filename: string; content: Buffer } | null> {
  const view = await itgcView(engagementId);
  if (!view) return null;
  const content = await buildItgcWorkbook(view);
  const safeClient = view.clientName.replace(/[^\w-]+/g, "_");
  return { filename: `E1.1-itgc-testing-${safeClient}-${view.fiscalYear}.xlsx`, content };
}
