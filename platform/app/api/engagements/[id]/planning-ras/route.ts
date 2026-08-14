import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { atLeast, isRole } from "@/lib/rbac";
import { SIGNATURE_ROLES, saveRasAnswer, signRas, type SignatureRole } from "@/lib/planning-ras";

/** Record one confirmation, or sign / withdraw one tier of the summary. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!isRole(role)) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = (await request.json()) as {
      key?: string;
      value?: string;
      sign?: SignatureRole;
      clear?: boolean;
    };

    if (body.sign) {
      const definition = SIGNATURE_ROLES.find((r) => r.role === body.sign);
      if (!definition) return NextResponse.json({ error: "invalid-role" }, { status: 400 });
      // a tier may only be signed by someone senior enough to hold it
      if (!atLeast(role, definition.min)) {
        return NextResponse.json({ error: "insufficient-role" }, { status: 403 });
      }
      await signRas(id, body.sign, body.clear ?? false);
      if (body.clear) return NextResponse.json({ ok: true });
      return NextResponse.json({
        ok: true,
        signature: {
          name: session?.user?.name ?? session?.user?.email ?? "—",
          signedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        },
      });
    }

    if (!body.key) return NextResponse.json({ error: "invalid-body" }, { status: 400 });
    await saveRasAnswer(id, body.key, body.value ?? "");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "save-failed" }, { status: 400 });
  }
}
