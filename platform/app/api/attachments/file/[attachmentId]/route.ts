import { NextResponse } from "next/server";
import { deleteAttachment, getAttachment, renameAttachment } from "@/lib/attachments";

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


/** Rename the document (all versions). Body: { name: string }. */
export async function PATCH(request: Request, context: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await context.params;
  try {
    const body = (await request.json()) as { name?: string };
    const name = await renameAttachment(attachmentId, String(body.name ?? ""));
    return NextResponse.json({ name });
  } catch (error) {
    const code = error instanceof Error ? error.message : "rename-failed";
    return NextResponse.json({ error: code }, { status: code === "not-found" ? 404 : 400 });
  }
}

/** Remove a document and every version of it from the task. */
export async function DELETE(_request: Request, context: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await context.params;
  try {
    await deleteAttachment(attachmentId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "delete-failed" }, { status: 400 });
  }
}
