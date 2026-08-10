import { NextResponse } from "next/server";
import { getAttachment } from "@/lib/attachments";

/** Download one attachment version. RLS scopes the read to the tenant. */
export async function GET(_request: Request, context: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await context.params;
  try {
    const row = await getAttachment(attachmentId);
    if (!row) return NextResponse.json({ error: "not-found" }, { status: 404 });
    return new NextResponse(new Uint8Array(row.content), {
      headers: {
        "Content-Type": row.mime,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(row.name)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
