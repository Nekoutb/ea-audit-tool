import { NextResponse } from "next/server";
import { assertMutable, ArchivedError } from "@/lib/mutability";
import { saveCraCell } from "@/lib/cra";

/** S3.1 CRA matrix mutations: one cell of the assessment at a time. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try { await assertMutable(id); } catch (e) { if (e instanceof ArchivedError) return NextResponse.json({ error: "archived" }, { status: 423 }); throw e; }
  try {
    const body = (await request.json()) as { op?: string } & Record<string, unknown>;
    if (body.op !== "saveCell") return NextResponse.json({ error: "invalid-op" }, { status: 400 });
    await saveCraCell(id, String(body.indexCode), String(body.assertion), {
      relevant: typeof body.relevant === "boolean" ? body.relevant : undefined,
      ir: body.ir === "" || body.ir === "lower" || body.ir === "higher" ? body.ir : undefined,
      irBasis: typeof body.irBasis === "string" ? body.irBasis : undefined,
      cr: body.cr === "" || body.cr === "rely" || body.cr === "not_rely" ? body.cr : undefined,
      crBasis: typeof body.crBasis === "string" ? body.crBasis : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error && /^[a-z0-9-]+$/.test(error.message) ? error.message : "save-failed";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
