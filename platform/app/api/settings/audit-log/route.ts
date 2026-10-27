import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity";
import { cleanFilters, firmActivityCsv, firmActivityForExport } from "@/lib/audit-log";
import { ForbiddenError } from "@/lib/tenant";

/**
 * The firm audit log as a CSV (F027), with the same filters as the page.
 * Firm administrators only (lib/audit-log.ts checks). The export is itself
 * recorded in the log before the bytes go out.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters = cleanFilters(Object.fromEntries(url.searchParams.entries()));
    const rows = await firmActivityForExport(filters);
    const filename = `firm-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    await recordActivity({
      entityType: "export",
      action: "exported",
      summary: `Firm audit log exported (${rows.length} rows)`,
      meta: { kind: "firm-audit-log", filename, rowCount: rows.length, filters },
    });
    return new NextResponse(firmActivityCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof Error && /UNAUTHENTICATED/.test(error.message)) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[audit-log] export failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "export-failed" }, { status: 500 });
  }
}
