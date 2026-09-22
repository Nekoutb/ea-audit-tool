import { NextResponse } from "next/server";
import { logExport } from "@/lib/activity";
import { requireEngagementAccess } from "@/lib/engagement-access";
import { ForbiddenError } from "@/lib/tenant";
import { exportTocSampleWorkbook } from "@/lib/toc-sample-export";
import { fileResponseHeaders } from "@/lib/upload-safety";

/**
 * The tests-of-controls samples as one workbook, a tab per control selected
 * for testing: the population, the minimum sample and the occurrence numbers
 * the random draw selected, with the tester's columns. Recorded as an export
 * like every file that leaves the product.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await requireEngagementAccess(id);
    const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "en";
    const file = await exportTocSampleWorkbook(id, locale);
    if (!file) return NextResponse.json({ error: "not-found" }, { status: 404 });
    await logExport(id, "toc-samples", { filename: file.filename });
    return new NextResponse(new Uint8Array(file.content), {
      headers: fileResponseHeaders(file.filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof Error && /UNAUTHENTICATED/.test(error.message)) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    console.error("[sampling/toc-export] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "export-failed" }, { status: 500 });
  }
}
