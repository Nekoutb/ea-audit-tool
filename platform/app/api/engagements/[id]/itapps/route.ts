import { NextResponse } from "next/server";
import { assertMutable, ArchivedError } from "@/lib/mutability";
import { saveItApp } from "@/lib/itgc";

/** S2.3 IT-applications board mutations: one application row at a time. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try { await assertMutable(id); } catch (e) { if (e instanceof ArchivedError) return NextResponse.json({ error: "archived" }, { status: 423 }); throw e; }
  try {
    const body = (await request.json()) as { op?: string } & Record<string, unknown>;
    if (body.op !== "save") return NextResponse.json({ error: "invalid-op" }, { status: 400 });
    await saveItApp(id, String(body.key), {
      name: typeof body.name === "string" ? body.name : undefined,
      layers: typeof body.layers === "string" ? body.layers : undefined,
      strategy: typeof body.strategy === "string" ? body.strategy : undefined,
      itgcNote: typeof body.itgcNote === "string" ? body.itgcNote : undefined,
      removed: typeof body.removed === "boolean" ? body.removed : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error && /^[a-z0-9-]+$/.test(error.message) ? error.message : "save-failed";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
