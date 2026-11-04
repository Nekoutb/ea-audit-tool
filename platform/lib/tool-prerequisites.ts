// What the sampling and journal-entry tools lean on (F063), read once for both.

import { craBoard } from "@/lib/cra";
import { withTenant } from "@/lib/db";
import { listScots } from "@/lib/scots";
import { requireTenant } from "@/lib/tenant";
import { requireEngagementRead } from "@/lib/engagement-access";

export interface ToolPrerequisite {
  key: "controls" | "cra" | "gl";
  ok: boolean;
  label: string;
  href: string;
}

export async function toolPrerequisites(engagementId: string, locale: "en" | "fr"): Promise<ToolPrerequisite[]> {
  await requireEngagementRead(engagementId);
  const fr = locale === "fr";
  const { tenantId } = await requireTenant();
  const [scots, cra, codes, gl] = await Promise.all([
    listScots(engagementId),
    craBoard(engagementId),
    withTenant(tenantId, (tx) =>
      tx
        .query<{ code: string; id: string }>("SELECT code, id FROM file_item WHERE engagement_id = $1 AND code IN ('S2.1', 'S3.1')", [engagementId])
        .then((r) => new Map(r.rows.map((row) => [row.code, row.id]))),
    ),
    withTenant(tenantId, (tx) =>
      tx
        .query<{ mapped: boolean }>(
          `SELECT (mapping IS NOT NULL) AS mapped FROM sub_ledger_dataset
            WHERE engagement_id = $1 AND kind = 'journal_entries' ORDER BY created_at DESC LIMIT 1`,
          [engagementId],
        )
        .then((r) => r.rows[0]?.mapped ?? false),
    ),
  ]);
  const section = (code: string) =>
    codes.has(code) ? `/engagements/${engagementId}/sections/${codes.get(code)}` : `/engagements/${engagementId}/dashboard`;
  const craComplete = cra.rows.length > 0 && cra.rows.every((row) => row.cells.every((c) => !c.relevant || (c.ir && c.cr)));
  return [
    {
      key: "controls",
      ok: scots.some((s) => s.controls.some((c) => c.selectedForTesting)),
      label: fr ? "S2.1 : contrôles sélectionnés" : "S2.1: controls selected",
      href: section("S2.1"),
    },
    {
      key: "cra",
      ok: craComplete,
      label: fr ? "S3.1 : évaluation combinée complète" : "S3.1: combined assessment complete",
      href: section("S3.1"),
    },
    {
      key: "gl",
      ok: gl,
      label: fr ? "Grand livre importé et mappé" : "General ledger imported and mapped",
      href: `/engagements/${engagementId}/analyzers/journal_entries`,
    },
  ];
}
