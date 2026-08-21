import { NextResponse } from "next/server";
import { logExport } from "@/lib/activity";
import { ExportError, exportEngagementBundle } from "@/lib/export-bundle";
import { ForbiddenError } from "@/lib/tenant";

/**
 * The complete audit file, streamed as a ZIP.
 *
 * Distinct from ../export, which returns the file index as a worksheet — a
 * status list, useful for a quick look, not a file anybody could audit from.
 *
 * The response is streamed rather than assembled: an engagement's evidence can
 * run to hundreds of megabytes and this process is capped at 1200 MB. No
 * Content-Length is sent, because the size is not known until the last byte —
 * which is the trade streaming makes, and browsers handle it.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const { filename, stream } = await exportEngagementBundle(id);

    // Logged BEFORE the bytes go out: a download that fails halfway still means
    // the file was released, and that is the fact an inspection asks about.
    await logExport(id, "audit-file", { filename });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ExportError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && /UNAUTHENTICATED/.test(error.message)) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[export] bundle failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "export-failed" }, { status: 500 });
  }
}
