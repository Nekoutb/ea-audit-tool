import { NextResponse } from "next/server";
import { postSadEntry, saveSad } from "@/lib/sad";

/** SAD mutations: classify a line, flag it corrected, or post it onto the misstatement schedule. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = (await request.json()) as { op?: string } & Record<string, unknown>;
    if (body.op === "save") {
      await saveSad(id, String(body.stepId), String(body.field), String(body.value ?? ""));
    } else if (body.op === "post") {
      await postSadEntry(id, String(body.stepId));
    } else {
      return NextResponse.json({ error: "invalid-op" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error && /^[a-z0-9-]+$/.test(error.message) ? error.message : "save-failed";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
