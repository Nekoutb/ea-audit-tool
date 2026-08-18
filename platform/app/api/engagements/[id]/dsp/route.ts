import { NextResponse } from "next/server";
import { saveDsp } from "@/lib/design-procedures";

/** S5.5 design-board mutations: one field of one account's design at a time. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = (await request.json()) as { op?: string } & Record<string, unknown>;
    if (body.op !== "save") return NextResponse.json({ error: "invalid-op" }, { status: 400 });
    await saveDsp(id, String(body.indexCode), String(body.field), String(body.value ?? ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error && /^[a-z0-9-]+$/.test(error.message) ? error.message : "save-failed";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
