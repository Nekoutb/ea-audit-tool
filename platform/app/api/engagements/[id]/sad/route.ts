import { NextResponse } from "next/server";
import { assertMutable, ArchivedError } from "@/lib/mutability";
import { postSadEntry, saveSad, saveSadMeta } from "@/lib/sad";

/**
 * SAD mutations: classify a line, flag it corrected, record its rationale,
 * post it onto the misstatement schedule, or save tab meta (qualitative
 * factors, conclusion text, manual cash-flow / disclosure rows).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try { await assertMutable(id); } catch (e) { if (e instanceof ArchivedError) return NextResponse.json({ error: "archived" }, { status: 423 }); throw e; }
  try {
    const body = (await request.json()) as { op?: string } & Record<string, unknown>;
    if (body.op === "save") {
      await saveSad(id, String(body.stepId), String(body.field), String(body.value ?? ""));
    } else if (body.op === "post") {
      await postSadEntry(id, String(body.stepId));
    } else if (body.op === "saveMeta") {
      await saveSadMeta(id, String(body.key), String(body.value ?? ""));
    } else {
      return NextResponse.json({ error: "invalid-op" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error && /^[a-z0-9-]+$/.test(error.message) ? error.message : "save-failed";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
