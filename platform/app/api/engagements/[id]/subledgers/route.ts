import { NextResponse } from "next/server";
import { createDataset, isSubLedgerKind, SubLedgerError } from "@/lib/subledgers";

const MAX_BYTES = 25 * 1024 * 1024;

/** Upload a typed sub-ledger dataset (CSV/XLSX) for the engagement (step 3.4). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const form = await request.formData();
    const kind = String(form.get("kind") ?? "");
    const file = form.get("file");
    if (!isSubLedgerKind(kind)) return NextResponse.json({ error: "fields-required" }, { status: 400 });
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "file-size" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const datasetId = await createDataset(id, kind, file.name, buffer);
    return NextResponse.json({ datasetId });
  } catch (error) {
    if (error instanceof SubLedgerError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
