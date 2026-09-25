import { NextResponse } from "next/server";
import { assignTemplate, listTemplates } from "@/lib/wp-templates";
import { copyAttachment, listAttachments, listEngagementAttachments, saveAttachment } from "@/lib/attachments";
import { atLeast } from "@/lib/rbac";
import { ForbiddenError, requireTenant } from "@/lib/tenant";
import { allowedExtensions, checkUpload, UnsafeFileError } from "@/lib/upload-safety";
import { oversizedBody } from "@/lib/api-errors";

const MAX_BYTES = 25 * 1024 * 1024; // same 25 MB ceiling as working papers

/**
 * Upload a file against a task. Re-uploading a filename stores the next
 * version — the edit-locally watcher posts here on every local save.
 *
 * Defence in depth (assurance finding C2): the proxy matcher covers this tree,
 * but the handler refuses portal and read-only accounts on its own authority
 * rather than trusting that it ran.
 */
/** The engagement's other attachments — the "attach an existing file" picker list. */
export async function GET(_request: Request, context: { params: Promise<{ fileItemId: string }> }) {
  const { fileItemId } = await context.params;
  try {
    const { role } = await requireTenant();
    if (!atLeast(role, "staff")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    // The blank working papers travel with the engagement files, so the picker
    // can offer both without a second request. Metadata only — never the bytes.
    return NextResponse.json({
      files: await listEngagementAttachments(fileItemId),
      templates: listTemplates().map((t) => ({
        key: t.key,
        name: t.name,
        titleEn: t.titleEn,
        titleFr: t.titleFr,
      })),
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ fileItemId: string }> }) {
  const { fileItemId } = await context.params;
  try {
    const { role } = await requireTenant();
    if (!atLeast(role, "staff")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    // JSON body = attach something the engagement already holds: another task's
    // file copied here, or a blank working paper taken from the Tools shelf.
    // Multipart = a fresh upload from the computer.
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as {
        copyFrom?: string;
        template?: string;
      };
      if (body.template) {
        // assignTemplate checks the key, finds the engagement and refuses an
        // archived file before it writes anything.
        const { name } = await assignTemplate(fileItemId, body.template);
        const rows = await listAttachments(fileItemId);
        const saved = rows.find((r) => r.name === name);
        if (!saved) return NextResponse.json({ error: "template-unavailable" }, { status: 400 });
        return NextResponse.json({ attachment: saved });
      }
      if (!body.copyFrom) return NextResponse.json({ error: "file-required" }, { status: 400 });
      const saved = await copyAttachment(fileItemId, body.copyFrom);
      return NextResponse.json({ attachment: saved });
    }
    // Too big is answered at once from Content-Length, and a body the runtime
    // refuses to parse is reported as such rather than as a 500 (UAT B25).
    const tooLarge = oversizedBody(request, MAX_BYTES);
    if (tooLarge) return tooLarge;
    let form: FormData;
    try {
      form = await request.formData();
    } catch (e) {
      return NextResponse.json({ error: "file-too-large", limitMb: MAX_BYTES / (1024 * 1024), detail: e instanceof Error ? e.message : String(e) }, { status: 413 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file-required" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "file-too-large", limitMb: MAX_BYTES / (1024 * 1024) }, { status: 413 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "file-size" }, { status: 400 });
    }
    const content = Buffer.from(await file.arrayBuffer());
    // The extension is checked against an allowlist AND against the bytes, and
    // the stored MIME comes from the result — the uploader's file.type was
    // previously written through verbatim and replayed on download.
    let checked;
    try {
      checked = checkUpload(file.name, content);
    } catch (e) {
      if (e instanceof UnsafeFileError) {
        return NextResponse.json({ error: e.code, allowed: allowedExtensions() }, { status: 400 });
      }
      throw e;
    }
    const saved = await saveAttachment(fileItemId, checked.name, checked.mime, content);
    return NextResponse.json({ attachment: saved });
  } catch (error) {
    if (error instanceof Error && error.message === "task-not-found") {
      return NextResponse.json({ error: "task-not-found" }, { status: 404 });
    }
    if (error instanceof ForbiddenError || (error instanceof Error && error.message === "forbidden")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "engagement-archived") {
      return NextResponse.json({ error: "archived" }, { status: 409 });
    }
    // An unexpected failure must say so, loudly and distinctly — collapsing
    // everything into 401 made a database refusal read as "upload failed".
    console.error("[attachments] upload failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "server-error" }, { status: 500 });
  }
}
