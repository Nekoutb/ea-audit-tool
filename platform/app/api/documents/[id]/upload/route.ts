import { NextResponse } from "next/server";
import { checkinDocument, DocumentRuleError, DOCX_MIME } from "@/lib/documents";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB working-paper ceiling

/** Check in an edited working paper as the next version (requires check-out). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file-required" }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "file-size" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".docx") && file.type !== DOCX_MIME) {
      return NextResponse.json({ error: "docx-only" }, { status: 400 });
    }
    const content = Buffer.from(await file.arrayBuffer());
    const versionNo = await checkinDocument(id, content);
    return NextResponse.json({ versionNo });
  } catch (error) {
    if (error instanceof DocumentRuleError) {
      return NextResponse.json({ error: error.code }, { status: 409 });
    }
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
