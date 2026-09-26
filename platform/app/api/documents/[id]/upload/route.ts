import { NextResponse } from "next/server";
import { checkinDocument, DocumentRuleError } from "@/lib/documents";
import { atLeast } from "@/lib/rbac";
import { ForbiddenError, requireTenant } from "@/lib/tenant";
import { checkUpload, UnsafeFileError } from "@/lib/upload-safety";
import { oversizedBody } from "@/lib/api-errors";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB working-paper ceiling

/**
 * Check in an edited working paper as the next version (requires check-out).
 *
 * Defence in depth (assurance finding C2): refuses portal and read-only
 * accounts here, independently of the proxy matcher.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const { role } = await requireTenant();
    if (!atLeast(role, "staff")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const tooLarge = oversizedBody(request, MAX_BYTES);
    if (tooLarge) return tooLarge;
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "file-too-large", limitMb: MAX_BYTES / (1024 * 1024) }, { status: 413 });
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
    // A check-in replaces the working paper, so it passes the same gate as an
    // attachment: a real .docx by name AND by bytes (UAT B70). The claimed
    // MIME type is never trusted — an executable sent as DOCX was accepted.
    try {
      const checked = checkUpload(file.name, content);
      if (checked.ext !== "docx") return NextResponse.json({ error: "docx-only" }, { status: 400 });
    } catch (e) {
      if (e instanceof UnsafeFileError) return NextResponse.json({ error: "docx-only" }, { status: 400 });
      throw e;
    }
    const versionNo = await checkinDocument(id, content);
    return NextResponse.json({ versionNo });
  } catch (error) {
    if (error instanceof DocumentRuleError) {
      return NextResponse.json({ error: error.code }, { status: 409 });
    }
    if (error instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
