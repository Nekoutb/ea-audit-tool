import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { correlationMatrix } from "@/lib/gl-insights";

/** GL insight computations that need client input: the account correlation study. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await context.params;
  try {
    const body = (await request.json()) as { op?: string; accounts?: unknown };
    if (body.op === "correlate") {
      const accounts = Array.isArray(body.accounts) ? body.accounts.map((a) => String(a)) : [];
      const result = await correlationMatrix(id, accounts);
      if (!result) return NextResponse.json({ error: "no-dataset" }, { status: 400 });
      return NextResponse.json({ result });
    }
    return NextResponse.json({ error: "invalid-op" }, { status: 400 });
  } catch (error) {
    const code = error instanceof Error && /^[a-z0-9-]+$/.test(error.message) ? error.message : "save-failed";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
