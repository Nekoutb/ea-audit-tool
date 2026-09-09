import { NextResponse } from "next/server";
import { logExport } from "@/lib/activity";
import { requireEngagementAccess } from "@/lib/engagement-access";
import { exportJeWorkbook } from "@/lib/je-export";
import { ForbiddenError } from "@/lib/tenant";
import { fileResponseHeaders } from "@/lib/upload-safety";

/**
 * E3.1 Journal entries and other adjustments as the firm's own workbook —
 * Cover, Population, Criteria, Selection, Exceptions. A copy of the audit file
 * leaving the product, so the download is recorded like every other export, and
 * a failure reports what actually went wrong rather than defaulting to an
 * authentication error.
 *
 * The locale rides on the query string because the file is bilingual and the
 * browser is the only thing that knows which one the auditor is reading in; the
 * dataset does too, so a paper can be exported against the pre-audit ledger it
 * was actually prepared on rather than against whichever extract arrived last.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await requireEngagementAccess(id);

    const url = new URL(request.url);
    const locale = url.searchParams.get("locale") === "fr" ? "fr" : "en";
    const datasetId = url.searchParams.get("datasetId") ?? undefined;

    const file = await exportJeWorkbook(id, { locale, datasetId });
    if (!file) return NextResponse.json({ error: "not-found" }, { status: 404 });

    await logExport(id, "e3.1-journal-entries", { filename: file.filename });
    return new NextResponse(new Uint8Array(file.content), {
      headers: fileResponseHeaders(
        file.filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && /UNAUTHENTICATED/.test(error.message)) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[je/export] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "export-failed" }, { status: 500 });
  }
}
