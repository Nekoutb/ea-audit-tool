import { NextResponse } from "next/server";
import { respondToTaskNote } from "@/lib/task-notes";

/**
 * Reply to a review note without clearing it (UAT B19): any member who can
 * write on the file may answer; only the author or a manager who did not
 * prepare the paper clears it (see /clear).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  // the note must belong to the engagement in the URL (UAT run 2 B03)
  const { id } = await context.params;
  try {
    const body = (await request.json()) as { noteId?: string; response?: string };
    if (!body.noteId || !body.response?.trim()) {
      return NextResponse.json({ error: "invalid-body" }, { status: 400 });
    }
    await respondToTaskNote(id, body.noteId, body.response);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error && /^[a-z0-9-]+$/.test(error.message) ? error.message : "respond-failed";
    const status = code === "not-found" ? 404 : code === "not-on-this-engagement" || code === "read-only-role" ? 403 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
