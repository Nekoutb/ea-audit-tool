import { NextResponse } from "next/server";
import { addEvidenceFile, ExecutionError } from "@/lib/execution";
import { allowedExtensions, checkUpload, UnsafeFileError } from "@/lib/upload-safety";

const MAX_BYTES = 25 * 1024 * 1024;

/** Attach an uploaded file as evidence to a program step (step 4.3). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "file-size" }, { status: 400 });
    }
    const content = Buffer.from(await file.arrayBuffer());
    let checked;
    try {
      checked = checkUpload(file.name, content);
    } catch (e) {
      if (e instanceof UnsafeFileError) {
        return NextResponse.json({ error: e.code, allowed: allowedExtensions() }, { status: 400 });
      }
      throw e;
    }
    await addEvidenceFile(id, checked.name, checked.mime, content);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ExecutionError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
