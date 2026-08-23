import { NextResponse } from "next/server";
import { SubLedgerError } from "@/lib/subledgers";
import { addOverride, importTrialBalance, saveLeadIndexOverride, TbError, type TbMapping } from "@/lib/tb";
import { getEngagement } from "@/lib/engagements";

const MAX_BYTES = 25 * 1024 * 1024;

/** Import a trial balance file (step 3.1) — mapping is inferred and returned. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "file-size" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const rawMapping = form.get("mapping");
    const mapping = typeof rawMapping === "string" && rawMapping ? (JSON.parse(rawMapping) as TbMapping) : undefined;
    // class-mapping decisions taken on the confirm screen persist as client
    // grouping overrides before the rows are ingested
    const rawOverrides = form.get("overrides");
    if (typeof rawOverrides === "string" && rawOverrides) {
      const overrides = JSON.parse(rawOverrides) as { prefix: string; sectionCode: string }[];
      const engagement = await getEngagement(id);
      if (engagement) {
        for (const o of overrides) {
          await addOverride(engagement.clientId, {
            matchType: "prefix",
            accountPrefix: o.prefix,
            sectionCode: o.sectionCode,
            rationale: "Mapped on the trial-balance confirm screen",
          });
        }
      }
    }
    // lead-index choices from the confirm screen persist per client
    const rawIndexes = form.get("indexOverrides");
    if (typeof rawIndexes === "string" && rawIndexes) {
      const indexOverrides = JSON.parse(rawIndexes) as { prefix: string; indexCode: string }[];
      const engagement2 = await getEngagement(id);
      if (engagement2) {
        for (const o of indexOverrides) await saveLeadIndexOverride(engagement2.clientId, o.prefix, o.indexCode);
      }
    }
    const rawTiming = form.get("timing");
    const timing =
      rawTiming === "post_audit" ? ("post_audit" as const)
      : rawTiming === "prior_year" ? ("prior_year" as const)
      : ("pre_audit" as const);
    const headerRow = form.get("headerRow") !== "0";
    const result = await importTrialBalance(id, file.name, buffer, mapping, timing, headerRow);
    return NextResponse.json({
      versionNo: result.versionNo,
      status: result.summary.status,
      summary: result.summary,
    });
  } catch (error) {
    if (error instanceof TbError || error instanceof SubLedgerError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
