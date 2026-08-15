import { NextResponse } from "next/server";
import { saveSignificance } from "@/lib/significant-accounts";

/**
 * Record one lead schedule's significance decision (P6.2 / P6.2): status,
 * justification, relevant assertions, and any specific materiality amount.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = (await request.json()) as {
      index?: string;
      status?: string;
      justification?: string;
      assertions?: string[];
      specificTe?: string;
    };
    if (!body.index || (body.status !== "significant" && body.status !== "not_significant")) {
      return NextResponse.json({ error: "invalid-body" }, { status: 400 });
    }
    if (body.assertions !== undefined && !Array.isArray(body.assertions)) {
      return NextResponse.json({ error: "invalid-body" }, { status: 400 });
    }
    await saveSignificance(
      id,
      body.index,
      body.status,
      body.justification ?? "",
      body.assertions,
      body.specificTe,
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "save-failed" }, { status: 400 });
  }
}
