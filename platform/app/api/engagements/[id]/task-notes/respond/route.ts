import { NextResponse } from "next/server";
import { respondToTaskNote } from "@/lib/task-notes";

/**
 * Reply to a review note without clearing it (UAT B19): any member who can
 * write on the file may answer; only the author or a manager who did not
 * prepare the paper clears it (see /clear).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { noteId?: string; response?: string };
    if (!body.noteId || !body.response?.trim()) {
      return NextResponse.json({ error: "invalid-body" }, { status: 400 });
    }
    await respondToTaskNote(body.noteId, body.response);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error && /^[a-z0-9-]+$/.test(error.message) ? error.message : "respond-failed";
    return NextResponse.json({ error: code }, { status: code === "not-found" ? 404 : 400 });
  }
}
