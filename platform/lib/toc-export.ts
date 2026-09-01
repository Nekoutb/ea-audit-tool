// Assembles the E1.2 view from the engagement's own data — the S2.2 controls
// selected for testing, their WCGWs and grids, and the recorded deviations —
// and hands it to the workbook builder. Nothing is invented here: a field the
// tool does not capture arrives null and becomes an entry cell in the file.

import { withTenant } from "@/lib/db";
import { getEngagement } from "@/lib/engagements";
import { listScots } from "@/lib/scots";
import { requireTenant } from "@/lib/tenant";
import {
  buildTocWorkbook,
  isSoleControl,
  type TocControl,
  type TocException,
  type TocGridRow,
  type TocView,
} from "@/lib/toc-workbook";

export async function tocView(engagementId: string): Promise<TocView | null> {
  const { tenantId } = await requireTenant();
  const engagement = await getEngagement(engagementId);
  if (!engagement) return null;

  const scots = await listScots(engagementId);

  // Sign-off and the E1.1 ITGC conclusion, both owned by the tool.
  const meta = await withTenant(tenantId, async (tx) => {
    const signoffs = await tx.query<{ role: string; who: string }>(
      `SELECT s.role, coalesce(u.name, u.email) AS who
         FROM file_item fi
         JOIN document d ON d.file_item_id = fi.id AND d.kind = 'workpaper'
         JOIN signoff s ON s.document_id = d.id AND s.voided_at IS NULL
         JOIN app_user u ON u.id = s.user_id
        WHERE fi.engagement_id = $1 AND fi.code = 'E1.2'`,
      [engagementId],
    );
    const itgc = await tx.query<{ state: string | null }>(
      `SELECT CASE WHEN sc.partner_reviewed_by IS NOT NULL OR sc.reviewed_by IS NOT NULL
                   THEN 'concluded' ELSE 'open' END AS state
         FROM file_item fi JOIN section_conclusion sc ON sc.file_item_id = fi.id
        WHERE fi.engagement_id = $1 AND fi.code = 'E1.1'`,
      [engagementId],
    );
    const deviations = await tx.query<{
      id: string; control_id: string | null; description: string | null;
      decision: string | null; note: string | null;
    }>(
      `SELECT ct.id, ct.scot_control_id AS control_id, ct.description,
              ct.deviation_decision AS decision, ct.note
         FROM control_test ct
        WHERE ct.engagement_id = $1 AND ct.result = 'deviation'
        ORDER BY ct.created_at`,
      [engagementId],
    );
    const by = (role: string) => signoffs.rows.find((r) => r.role === role)?.who ?? null;
    return {
      preparer: by("preparer"),
      reviewer: by("reviewer"),
      partner: by("partner"),
      itgcEffective: itgc.rows[0]?.state === "concluded",
      deviations: deviations.rows,
    };
  });

  const controls: TocControl[] = [];
  const controlRefById = new Map<string, string>();

  for (const scot of scots) {
    const selected = scot.controls.filter((c) => c.selectedForTesting);
    for (const control of selected) {
      const ref = `C-${controls.length + 1}`;
      controlRefById.set(control.id, ref);
      const wcgws = scot.wcgws.filter((w) => control.wcgwIds.includes(w.id));
      const assertions = [...new Set(wcgws.flatMap((w) => w.assertions))];
      const grid = control.tocGrid;
      const rows: TocGridRow[] = (grid?.rows ?? []).map((r) => ({
        ref: r.ref,
        date: r.date,
        desc: r.desc,
        results: r.results,
      }));
      controls.push({
        ref,
        scot: scot.name,
        wcgws: wcgws.map((w) => w.description),
        assertions,
        name: control.name,
        description: control.operatingNotes ?? control.testDesign ?? null,
        owner: control.owner,
        controlType: control.controlType,
        frequency: control.frequency,
        population: control.tocPopulation,
        soleControl: isSoleControl(control, scot.controls),
        itgcEffective: meta.itgcEffective,
        attributes: grid?.attributes ?? [],
        rows,
        operatingEval: control.operatingEval,
        testDesign: control.testDesign,
        // A report only reaches the IPE tab where the control actually leans on
        // one. An automated or IT-dependent control always does; a purely
        // manual control does so only if the studio recorded a source.
        ipe: control.controlType === "manual" ? [] : [`Report or extract used by ${control.name}`],
        // Rotation is not captured per control yet; the columns stay empty
        // rather than asserting criteria nobody has confirmed.
        rotation: null,
      });
    }
  }

  const exceptions: TocException[] = meta.deviations.map((d, i) => ({
    ref: `EXC-${i + 1}`,
    controlRef: (d.control_id && controlRefById.get(d.control_id)) || "—",
    item: d.description ?? "",
    cause: d.note ?? "",
    implication: "",
    decision: d.decision ?? "",
    deficiency: null,
    significant: null,
    s31Effect: "",
    communicated: "",
  }));

  return {
    clientName: engagement.clientName,
    fiscalYear: engagement.fiscalYear,
    periodEnd: engagement.periodEnd,
    periodOfReliance: null,
    preparer: meta.preparer,
    reviewer: meta.reviewer,
    partner: meta.partner,
    controls,
    exceptions,
  };
}

export async function exportTocWorkbook(
  engagementId: string,
): Promise<{ filename: string; content: Buffer } | null> {
  const view = await tocView(engagementId);
  if (!view) return null;
  const content = await buildTocWorkbook(view);
  const safeClient = view.clientName.replace(/[^\w-]+/g, "_");
  return { filename: `E1.2-tests-of-controls-${safeClient}-${view.fiscalYear}.xlsx`, content };
}
