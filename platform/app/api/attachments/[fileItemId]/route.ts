import { NextResponse } from "next/server";
import { saveAttachment } from "@/lib/attachments";
import { atLeast } from "@/lib/rbac";
import { requireTenant } from "@/lib/tenant";

const MAX_BYTES = 25 * 1024 * 1024; // same 25 MB ceiling as working papers

/**
 * Upload a file against a task. Re-uploading a filename stores the next
 * version — the edit-locally watcher posts here on every local save.
 *
 * Defence in depth (assurance finding C2): the proxy matcher covers this tree,
 * but the handler refuses portal and read-only accounts on its own authority
 * rather than trusting that it ran.
 */
export async function POST(request: Request, context: { params: Promise<{ fileItemId: string }> }) {
  const { fileItemId } = await context.params;
  try {
    const { role } = await requireTenant();
    if (!atLeast(role, "staff")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file-required" }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "file-size" }, { status: 400 });
    }
    // keep the basename only; the name keys the version chain
    const name = file.name.replace(/[/\\]/g, "").slice(0, 160) || "attachment";
    const content = Buffer.from(await file.arrayBuffer());
    const saved = await saveAttachment(
      fileItemId,
      name,
      file.type || "application/octet-stream",
      content,
    );
    return NextResponse.json({ attachment: saved });
  } catch (error) {
    if (error instanceof Error && error.message === "task-not-found") {
      return NextResponse.json({ error: "task-not-found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
