import { NextResponse } from "next/server";
import { clearTaskNote } from "@/lib/task-notes";

/** Answer and clear a review note. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  // the note must belong to the engagement in the URL (UAT run 2 B03)
  const { id } = await context.params;
  try {
    const body = (await request.json()) as { noteId?: string; response?: string };
    if (!body.noteId) return NextResponse.json({ error: "invalid-body" }, { status: 400 });
    await clearTaskNote(id, body.noteId, body.response ?? "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    // The refusal's own code travels back so the panel can say why (UAT B19),
    // and a rank refusal is a 403, not a generic 400.
    const code = error instanceof Error && /^[a-z0-9-]+$/.test(error.message) ? error.message : "clear-failed";
    const status =
      code === "not-found" ? 404
      : code === "requires-manager-or-author" || code === "not-preparer-clears" || code === "read-only-role" || code === "not-on-this-engagement" ? 403
      : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
