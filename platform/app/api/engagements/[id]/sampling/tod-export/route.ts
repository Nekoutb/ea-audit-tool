import { NextResponse } from "next/server";
import { logExport } from "@/lib/activity";
import { requireEngagementAccess } from "@/lib/engagement-access";
import { ForbiddenError } from "@/lib/tenant";
import { exportTodWorkbook } from "@/lib/tod-export";
import { fileResponseHeaders } from "@/lib/upload-safety";

/**
 * The tests-of-details sampling workbook for one side of the financial
 * statements — a cover and one tab per lead-schedule index, each with its key
 * items and representative sample. A copy of the audit file leaving the
 * product, so the download is recorded like every other export.
 *
 *   ?side=bs|is            which side (required)
 *   ?assurance=little|some|corroborative|persuasive   from other procedures
 *   ?locale=en|fr
 *
 * What stops the export is said plainly: no approved materiality, no ledger,
 * or a ledger whose account and amount columns are not mapped.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await requireEngagementAccess(id);
    const url = new URL(request.url);
    const side = url.searchParams.get("side") === "is" ? "is" : url.searchParams.get("side") === "bs" ? "bs" : null;
    if (!side) return NextResponse.json({ error: "invalid-side" }, { status: 400 });
    const assurance = url.searchParams.get("assurance") ?? undefined;
    const locale = url.searchParams.get("locale") === "fr" ? "fr" : "en";

    const file = await exportTodWorkbook(id, { side, assurance: assurance as never, locale });
    if (!file) return NextResponse.json({ error: "not-found" }, { status: 404 });
    if (typeof file === "string") return NextResponse.json({ error: file }, { status: 409 });

    await logExport(id, `tod-sampling:${side}`, { filename: file.filename });
    return new NextResponse(new Uint8Array(file.content), {
      headers: fileResponseHeaders(file.filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof Error && /UNAUTHENTICATED/.test(error.message)) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    console.error("[sampling/tod-export] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "export-failed" }, { status: 500 });
  }
}
