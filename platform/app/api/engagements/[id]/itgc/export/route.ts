import { NextResponse } from "next/server";
import { logExport } from "@/lib/activity";
import { requireEngagementAccess } from "@/lib/engagement-access";
import { exportItgcWorkbook } from "@/lib/itgc-export";
import { ForbiddenError } from "@/lib/tenant";
import { fileResponseHeaders } from "@/lib/upload-safety";

/**
 * E1.1 ITGC Testing as the firm's own workbook — Cover, Applications, one tab
 * per IT process domain, and the deficiency diagnostic. A copy of the audit
 * file leaving the product, so the download is recorded like every other
 * export, and a failure reports what actually went wrong rather than defaulting
 * to an authentication error.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await requireEngagementAccess(id);

    const file = await exportItgcWorkbook(id);
    if (!file) return NextResponse.json({ error: "not-found" }, { status: 404 });

    await logExport(id, "e1.1-itgc-testing", { filename: file.filename });
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
    console.error("[itgc/export] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "export-failed" }, { status: 500 });
  }
}
