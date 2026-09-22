import { NextResponse } from "next/server";
import { logExport } from "@/lib/activity";
import { requireEngagementAccess } from "@/lib/engagement-access";
import { exportJeWorkbook, exportOptionsFrom, type JeExportOptions } from "@/lib/je-export";
import { ForbiddenError } from "@/lib/tenant";
import { fileResponseHeaders } from "@/lib/upload-safety";

/**
 * E3.1 Journal entries and other adjustments as the firm's own workbook —
 * Cover, Population, Criteria, Selection, Exceptions. A copy of the audit file
 * leaving the product, so the download is recorded like every other export, and
 * a failure reports what actually went wrong rather than defaulting to an
 * authentication error.
 *
 * Two ways in. GET is the paper as a whole — every built-in criterion at its
 * default thresholds over the current ledger — with the locale on the query
 * string because the file is bilingual and the browser is the only thing that
 * knows which one the auditor is reading in, and the dataset there too, so a
 * paper can be exported against the pre-audit ledger it was actually prepared
 * on. POST is the selection the studio just ran: the same body it sends to
 * /je-selection, so the workbook carries the criteria, thresholds and rules the
 * auditor chose, and every line those selected rather than one page of them.
 *
 * The codes lib/je-selection throws for the auditor's own mistakes come back as
 * 400 with the code intact, as they do from the selection endpoint.
 */
const REQUEST_ERRORS = new Set(["no-criteria", "invalid-rule-field", "invalid-rule-operator", "invalid-rule-value"]);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "fr" ? "fr" : "en";
  return respond(id, { locale, datasetId: url.searchParams.get("datasetId") ?? undefined });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { locale?: unknown };
  const locale = body.locale === "fr" ? "fr" : "en";
  return respond(id, exportOptionsFrom(body, locale));
}

async function respond(id: string, options: JeExportOptions) {
  try {
    await requireEngagementAccess(id);

    const file = await exportJeWorkbook(id, options);
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
    if (error instanceof Error && REQUEST_ERRORS.has(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[je/export] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "export-failed" }, { status: 500 });
  }
}
