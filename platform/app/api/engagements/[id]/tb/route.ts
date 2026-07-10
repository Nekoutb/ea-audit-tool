import { NextResponse } from "next/server";
import { SubLedgerError } from "@/lib/subledgers";
import { importTrialBalance, TbError } from "@/lib/tb";

const MAX_BYTES = 25 * 1024 * 1024;

/** Import a trial balance file (step 3.1) — mapping is inferred and returned. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "file-size" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importTrialBalance(id, file.name, buffer);
    return NextResponse.json({
      versionNo: result.versionNo,
      status: result.summary.status,
      summary: result.summary,
    });
  } catch (error) {
    if (error instanceof TbError || error instanceof SubLedgerError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
