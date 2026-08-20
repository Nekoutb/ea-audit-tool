import { NextResponse } from "next/server";
import { logExport } from "@/lib/activity";
import { requireEngagementAccess } from "@/lib/engagement-access";
import { exportFileIndex } from "@/lib/exports";
import { ForbiddenError } from "@/lib/tenant";
import { fileResponseHeaders } from "@/lib/upload-safety";

/**
 * 9.6: regulator export — file index with statuses (.xlsx).
 *
 * Three things this route used to get wrong. It had no access check of its own,
 * so it leaned entirely on the proxy; `catch { 401 }` reported every failure —
 * a missing engagement, a refused role, a broken query — as "unauthenticated",
 * which is both untrue and unhelpful; and taking a copy of an audit file out of
 * the product was not recorded anywhere, which is exactly the event an
 * inspection asks about.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    // Defence in depth: the proxy gates /api/engagements/[id] centrally, but a
    // route that hands out the whole file should not depend on that alone.
    await requireEngagementAccess(id);

    const result = await exportFileIndex(id);
    if (!result) return NextResponse.json({ error: "not-found" }, { status: 404 });

    await logExport(id, "file-index", { filename: result.filename });
    return new NextResponse(new Uint8Array(result.content), {
      headers: fileResponseHeaders(
        result.filename,
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
    // Anything else is a fault on our side and should say so, not masquerade as
    // an authentication problem.
    console.error("[export] file index failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "export-failed" }, { status: 500 });
  }
}
