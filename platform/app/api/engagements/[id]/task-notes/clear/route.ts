import { NextResponse } from "next/server";
import { clearTaskNote } from "@/lib/task-notes";

/** Answer and clear a review note. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { noteId?: string; response?: string };
    if (!body.noteId) return NextResponse.json({ error: "invalid-body" }, { status: 400 });
    await clearTaskNote(body.noteId, body.response ?? "");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "clear-failed" }, { status: 400 });
  }
}
