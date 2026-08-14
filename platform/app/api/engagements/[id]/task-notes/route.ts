import { NextResponse } from "next/server";
import { addTaskNote } from "@/lib/task-notes";

/** Raise a review note on a task; it reaches the assignee's dashboard. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = (await request.json()) as { fileItemId?: string; body?: string };
    if (!body.fileItemId || !body.body?.trim()) {
      return NextResponse.json({ error: "invalid-body" }, { status: 400 });
    }
    await addTaskNote(id, body.fileItemId, body.body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "save-failed" }, { status: 400 });
  }
}
