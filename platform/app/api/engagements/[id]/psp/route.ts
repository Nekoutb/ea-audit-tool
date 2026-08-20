import { NextResponse } from "next/server";
import { assertMutable, ArchivedError } from "@/lib/mutability";
import { withTenant } from "@/lib/db";
import { completeStep, uncompleteStep } from "@/lib/execution";
import { requireTenant } from "@/lib/tenant";
import { addOtherPsp, generatePsp, pspResults, savePspResult } from "@/lib/psp";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The file-index code of a step, resolved from the engagement (never trusted from the body). */
async function taskCodeOfStep(engagementId: string, stepId: string): Promise<string | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ code: string }>(
      `SELECT fi.code
         FROM program_step ps JOIN file_item fi ON fi.id = ps.file_item_id
        WHERE ps.id = $1 AND ps.engagement_id = $2`,
      [stepId, engagementId],
    );
    return result.rows[0]?.code ?? null;
  });
}

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
        // A procedure is never "done" on a bare status flip: it goes through
        // completeStep, which records the conclusion, who reached it and when,
        // scoped to this engagement (assurance finding C7). The conclusion is
        // the finding the workpaper already collects for the step.
        const stepId = String(body.stepId ?? "");
        if (!UUID.test(stepId)) return NextResponse.json({ error: "invalid-step" }, { status: 400 });
        const taskCode = await taskCodeOfStep(id, stepId);
        if (!taskCode) return NextResponse.json({ error: "not-found" }, { status: 404 });
        if (!body.done) {
          await uncompleteStep(stepId, id);
          break;
        }
        const results = await pspResults(id, taskCode);
        const conclusion = (results[`finding_${stepId}`] ?? results[`r_${stepId}`] ?? "").trim();
        if (!conclusion) return NextResponse.json({ error: "conclusion-required" }, { status: 400 });
        await completeStep(stepId, conclusion, id);
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
