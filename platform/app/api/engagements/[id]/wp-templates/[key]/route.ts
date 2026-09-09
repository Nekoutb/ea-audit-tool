import { NextResponse } from "next/server";
import { logExport } from "@/lib/activity";
import { requireEngagementAccess } from "@/lib/engagement-access";
import { ForbiddenError } from "@/lib/tenant";
import { fileResponseHeaders } from "@/lib/upload-safety";
import { templateContent } from "@/lib/wp-templates";

/**
 * A blank sample working paper, downloaded from the Sample working papers
 * shelf. These carry no client data — a generated one is built empty and a
 * shipped one is the file as it left the firm — but they leave the product as
 * a file all the same, so the download is recorded like every other export and
 * is only served to somebody who may open the engagement.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; key: string }> },
) {
  const { id, key } = await context.params;
  try {
    await requireEngagementAccess(id);

    const file = await templateContent(key);
    if (!file) return NextResponse.json({ error: "not-found" }, { status: 404 });

    await logExport(id, `sample-working-paper:${key}`, { filename: file.name });
    return new NextResponse(new Uint8Array(file.content), {
      headers: fileResponseHeaders(file.name, file.mime),
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && /UNAUTHENTICATED/.test(error.message)) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[wp-templates] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "download-failed" }, { status: 500 });
  }
}
