import { NextResponse } from "next/server";
import { previewDataset, SubLedgerError } from "@/lib/subledgers";
import { requireTenant } from "@/lib/tenant";

const MAX_BYTES = 25 * 1024 * 1024;

/** Analyze a sub-ledger file without ingesting: headers + example values. */
export async function POST(request: Request) {
  try {
    await requireTenant();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "file-size" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    return NextResponse.json(await previewDataset(file.name, buffer, form.get("headerRow") !== "0"));
  } catch (error) {
    if (error instanceof SubLedgerError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
