import { NextResponse } from "next/server";
import { createDataset, isSubLedgerKind, SubLedgerError } from "@/lib/subledgers";
import { oversizedBody } from "@/lib/api-errors";

// Data imports (not documents): a six-figure-line CSV passes 25 MB easily.
// Memory, not disk, is the real ceiling — see docs/capacity-2026-08-23.md.
const MAX_BYTES = 60 * 1024 * 1024;

/** Upload a typed sub-ledger dataset (CSV/XLSX) for the engagement (step 3.4). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    // Over the limit is answered at once and by name, not as a 500 (UAT B25).
    const tooLarge = oversizedBody(request, MAX_BYTES);
    if (tooLarge) return tooLarge;
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "file-too-large", limitMb: MAX_BYTES / (1024 * 1024) }, { status: 413 });
    }
    const kind = String(form.get("kind") ?? "");
    const file = form.get("file");
    if (!isSubLedgerKind(kind)) return NextResponse.json({ error: "fields-required" }, { status: 400 });
    if (file instanceof File && file.size > MAX_BYTES) {
      return NextResponse.json({ error: "file-too-large", limitMb: MAX_BYTES / (1024 * 1024) }, { status: 413 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "file-size" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const rawMapping = form.get("mapping");
    const mapping = typeof rawMapping === "string" && rawMapping ? (JSON.parse(rawMapping) as Record<string, string>) : undefined;
    const rawTiming = String(form.get("timing") ?? "");
    const timing = rawTiming === "post_audit" || rawTiming === "prior_year" ? rawTiming : "pre_audit";
    const headerRow = form.get("headerRow") !== "0";
    const { datasetId, rowCount } = await createDataset(id, kind, file.name, buffer, mapping, timing, headerRow);
    return NextResponse.json({ datasetId, rowCount });
  } catch (error) {
    if (error instanceof SubLedgerError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
