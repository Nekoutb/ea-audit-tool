import { NextResponse } from "next/server";
import { assertMutable, ArchivedError } from "@/lib/mutability";
import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { addOtherPsp, generatePsp, savePspResult } from "@/lib/psp";

/** E4 account workpaper mutations: generate PSPs, other procedures, results. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try { await assertMutable(id); } catch (e) { if (e instanceof ArchivedError) return NextResponse.json({ error: "archived" }, { status: 423 }); throw e; }
  try {
    const body = (await request.json()) as { op?: string } & Record<string, unknown>;
    switch (body.op) {
      case "generate": {
        const n = await generatePsp(
          id,
          String(body.fileItemId),
          String(body.taskCode),
          Array.isArray(body.presentIndexes) ? body.presentIndexes.map(String) : [],
        );
        return NextResponse.json({ ok: true, generated: n });
      }
      case "addOther":
        await addOtherPsp(
          id,
          String(body.fileItemId),
          String(body.description ?? ""),
          Array.isArray(body.assertions) ? body.assertions.map(String) : [],
        );
        break;
      case "saveResult":
        await savePspResult(id, String(body.taskCode), String(body.stepId), String(body.value ?? ""), String(body.field ?? "r"));
        break;
      case "toggleDone": {
        const { tenantId } = await requireTenant();
        await withTenant(tenantId, async (tx) => {
          await tx.query(
            "UPDATE program_step SET status = $2 WHERE id = $1",
            [String(body.stepId), body.done ? "complete" : "planned"],
          );
        });
        break;
      }
      default:
        return NextResponse.json({ error: "invalid-op" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error && /^[a-z0-9-]+$/.test(error.message) ? error.message : "save-failed";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
