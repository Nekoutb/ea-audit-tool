// Assembles the tests-of-controls sample workbook from the SCOT register:
// every control selected for testing on S2.1, with the population and the
// items saved on it by the Sampling tool.
import { withTenant } from "@/lib/db";
import { getEngagement } from "@/lib/engagements";
import { listScots } from "@/lib/scots";
import { requireTenant } from "@/lib/tenant";
import { buildTocSampleWorkbook, type TocSampleView } from "@/lib/toc-sample-workbook";
import { tocSuggested } from "@/lib/toc-sampling";

export async function tocSampleView(engagementId: string, locale: "en" | "fr"): Promise<TocSampleView | null> {
  const engagement = await getEngagement(engagementId);
  if (!engagement) return null;
  const fr = locale === "fr";
  const { tenantId, userId } = await requireTenant();
  const scots = await listScots(engagementId);

  // whether a control is the only selected one covering one of its assertions
  const selected = scots.flatMap((s) =>
    s.controls.filter((c) => c.selectedForTesting).map((c) => {
      const covered = new Set<string>();
      for (const w of s.wcgws) if (c.wcgwIds.includes(w.id)) for (const a of w.assertions) covered.add(a);
      return { scot: s, c, assertions: [...covered] };
    }),
  );
  const counts = new Map<string, number>();
  for (const row of selected) for (const a of row.assertions) counts.set(a, (counts.get(a) ?? 0) + 1);

  const preparer = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ who: string }>("SELECT coalesce(name, email) AS who FROM app_user WHERE id = $1", [userId]);
    return r.rows[0]?.who ?? null;
  });

  return {
    locale,
    clientName: engagement.clientName,
    fiscalYear: engagement.fiscalYear,
    periodEnd: engagement.periodEnd,
    preparer,
    controls: selected.map(({ scot, c, assertions }) => {
      const sole = assertions.some((a) => (counts.get(a) ?? 0) === 1);
      const suggestion = tocSuggested(c.controlType, c.frequency, c.tocPopulation, sole, fr);
      const size = suggestion && !("needPopulation" in suggestion) ? suggestion.size : null;
      return {
        controlName: c.name,
        scotName: scot.name,
        controlType: c.controlType,
        frequency: c.frequency,
        assertions,
        population: c.tocPopulation,
        sampleSize: c.sampleSize ?? size,
        rule: suggestion && !("needPopulation" in suggestion) ? suggestion.rule : null,
        items: c.tocSampleItems ?? [],
        drawnAt: c.tocSampleDrawnAt,
      };
    }),
  };
}

export async function exportTocSampleWorkbook(engagementId: string, locale: "en" | "fr"): Promise<{ filename: string; content: Buffer } | null> {
  const view = await tocSampleView(engagementId, locale);
  if (!view) return null;
  const content = await buildTocSampleWorkbook(view);
  const safeClient = view.clientName.replace(/[^\w-]+/g, "_");
  return { filename: `Tests-of-controls-samples-${safeClient}-${view.fiscalYear}.xlsx`, content };
}
