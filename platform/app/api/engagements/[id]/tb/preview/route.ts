import { NextResponse } from "next/server";
import { SubLedgerError } from "@/lib/subledgers";
import { previewTrialBalance, TbError, type TbMapping } from "@/lib/tb";

const MAX_BYTES = 25 * 1024 * 1024;

/** Analyze a TB file without ingesting: columns, sample rows, class mapping. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "file-size" }, { status: 400 });
    }
    const rawMapping = form.get("mapping");
    const mapping = typeof rawMapping === "string" && rawMapping ? (JSON.parse(rawMapping) as TbMapping) : undefined;
    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = await previewTrialBalance(id, file.name, buffer, mapping);
    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof TbError || error instanceof SubLedgerError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
