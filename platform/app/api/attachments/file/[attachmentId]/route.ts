import { NextResponse } from "next/server";
import {
  deleteAttachment,
  getAttachment,
  renameAttachment,
  restoreAttachment,
} from "@/lib/attachments";
import { atLeast } from "@/lib/rbac";
import { requireTenant } from "@/lib/tenant";
import { fileResponseHeaders } from "@/lib/upload-safety";

// Defence in depth (assurance finding C2): the proxy matcher walls portal users
// off this tree, but the handlers below never assume it did. Each one resolves
// the session role itself and refuses the request on its own authority.
//
// - read (download):  anyone on the firm side, read_only included; never a portal user
// - write (rename):   staff and above — read_only and portal users refused
// - destroy/restore:  manager and above (enforced again in lib/attachments.ts)

/** Turn a library error into the right status; unknown errors stay 400. */
function errorResponse(error: unknown, fallback: string) {
  const code = error instanceof Error ? error.message : fallback;
  if (code.startsWith("UNAUTHENTICATED")) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const status =
    code === "forbidden" ? 403 : code === "not-found" ? 404 : code === "archived" ? 409 : 400;
  return NextResponse.json({ error: code }, { status });
}

/** Download one attachment version. RLS scopes the read to the tenant. */
export async function GET(_request: Request, context: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await context.params;
  try {
    const { role } = await requireTenant();
    // read_only may read the file; a portal account may not touch it at all.
    if (!atLeast(role, "read_only")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const row = await getAttachment(attachmentId);
    if (!row) return NextResponse.json({ error: "not-found" }, { status: 404 });
    return new NextResponse(new Uint8Array(row.content), {
      headers: fileResponseHeaders(row.name, row.mime),
    });
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}

/**
 * Rename the document (all versions), or restore a soft-deleted one.
 * Body: { name: string } to rename, { restore: true } to undo a delete.
 */
export async function PATCH(request: Request, context: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await context.params;
  try {
    const { role } = await requireTenant();
    const body = (await request.json()) as { name?: string; restore?: boolean };
    if (body.restore) {
      // Restoring evidence is as consequential as removing it.
      if (!atLeast(role, "manager")) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      await restoreAttachment(attachmentId);
      return NextResponse.json({ ok: true });
    }
    if (!atLeast(role, "staff")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const name = await renameAttachment(attachmentId, String(body.name ?? ""));
    return NextResponse.json({ name });
  } catch (error) {
    return errorResponse(error, "rename-failed");
  }
}

/**
 * Soft-delete a document and every version of it: the rows are stamped
 * deleted_at/deleted_by and vanish from the task, restorable for 30 days.
 * Manager and above only.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await context.params;
  try {
    const { role } = await requireTenant();
    if (!atLeast(role, "manager")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    await deleteAttachment(attachmentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "delete-failed");
  }
}
