import { NextResponse } from "next/server";
import { listActivity, logExport } from "@/lib/activity";
import { requireEngagementAccess } from "@/lib/engagement-access";
import { ForbiddenError } from "@/lib/tenant";

/**
 * The engagement's audit trail as a CSV (UAT B157): the same rows the
 * /activity page lists, readable outside the product. The export itself is
 * logged before the bytes go out, like the audit-file bundle.
 */
function csvCell(value: string | null): string {
  const text = value ?? "";
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await requireEngagementAccess(id);
    const rows = await listActivity(id, 5000);
    const lines = [
      ["at", "user", "role", "entity_type", "entity_id", "action", "summary", "outcome", "before", "after"].join(","),
      ...rows.map((row) =>
        [row.at, row.userName, row.actingRole, row.entityType, row.entityId, row.action, row.summary, row.outcome, row.beforeValue, row.afterValue]
          .map(csvCell)
          .join(","),
      ),
    ];
    const filename = `audit-trail-${id.slice(0, 8)}.csv`;
    await logExport(id, "audit-trail", { filename, rowCount: rows.length });
    // BOM so Excel opens the accented French text correctly
    return new NextResponse(`﻿${lines.join("\r\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && /UNAUTHENTICATED/.test(error.message)) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[export] audit trail failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "export-failed" }, { status: 500 });
  }
}
