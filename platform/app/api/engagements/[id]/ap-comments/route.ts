import { NextResponse } from "next/server";
import { saveApComments } from "@/lib/analytical-procedures";

/** Auto-save one commentary cell of the analytical-procedures grid. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = (await request.json()) as { index?: string; key?: string; value?: string };
    if (!body.index || !body.key || typeof body.value !== "string") {
      return NextResponse.json({ error: "invalid-body" }, { status: 400 });
    }
    await saveApComments(id, body.index, [{ key: body.key, value: body.value }]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid-index") {
      return NextResponse.json({ error: "invalid-index" }, { status: 400 });
    }
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
