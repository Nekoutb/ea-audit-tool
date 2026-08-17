import { NextResponse } from "next/server";
import {
  addControl,
  addWcgw,
  assignScot,
  createScot,
  deleteControl,
  deleteScot,
  deleteWcgw,
  linkScotIndex,
  musPreview,
  saveFscp,
  saveWalkthrough,
  todPreview,
  type TodAssurance,
  type TodCra,
  toggleWcgwControl,
  unlinkScotIndex,
  updateControl,
  updateScot,
} from "@/lib/scots";

/** SCOT Studio mutations — one route, an op discriminator per mutation. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = (await request.json()) as { op?: string } & Record<string, unknown>;
    switch (body.op) {
      case "createScot": {
        const scotId = await createScot(id, {
          name: String(body.name ?? ""),
          transactionType: String(body.transactionType ?? "routine"),
          strategy: String(body.strategy ?? "substantive"),
          applications: body.applications ? String(body.applications) : undefined,
          description: body.description ? String(body.description) : undefined,
        });
        return NextResponse.json({ ok: true, scotId });
      }
      case "updateScot":
        await updateScot(String(body.scotId), body as never);
        break;
      case "deleteScot":
        await deleteScot(String(body.scotId));
        break;
      case "assignScot":
        await assignScot(String(body.scotId), body.userId ? String(body.userId) : null);
        break;
      case "linkIndex":
        await linkScotIndex(String(body.scotId), String(body.indexCode), body.assertions);
        break;
      case "unlinkIndex":
        await unlinkScotIndex(String(body.scotId), String(body.indexCode));
        break;
      case "addWcgw": {
        const wcgwId = await addWcgw(String(body.scotId), String(body.description ?? ""), body.assertions);
        return NextResponse.json({ ok: true, wcgwId });
      }
      case "deleteWcgw":
        await deleteWcgw(String(body.wcgwId));
        break;
      case "addControl": {
        const controlId = await addControl(String(body.scotId), {
          name: String(body.name ?? ""),
          owner: body.owner ? String(body.owner) : undefined,
          controlType: body.controlType ? String(body.controlType) : undefined,
          frequency: body.frequency ? String(body.frequency) : undefined,
          objective: body.objective ? String(body.objective) : undefined,
          wcgwIds: Array.isArray(body.wcgwIds) ? body.wcgwIds.map(String) : undefined,
        });
        return NextResponse.json({ ok: true, controlId });
      }
      case "updateControl":
        await updateControl(String(body.controlId), body as never);
        break;
      case "toggleLink":
        await toggleWcgwControl(String(body.wcgwId), String(body.controlId), Boolean(body.linked));
        break;
      case "deleteControl":
        await deleteControl(String(body.controlId));
        break;
      case "saveWalkthrough":
        await saveWalkthrough(id, String(body.scotId), String(body.key), String(body.value ?? ""));
        break;
      case "saveFscp":
        await saveFscp(id, String(body.key), String(body.value ?? ""));
        break;
      case "todPreview": {
        const CRAS = ["minimal", "low", "low_sr", "moderate", "high", "high_sr"];
        const ASSUR = ["little", "some", "corroborative", "persuasive"];
        const cra = CRAS.includes(String(body.cra)) ? (String(body.cra) as TodCra) : "low";
        const assurance = ASSUR.includes(String(body.assurance)) ? (String(body.assurance) as TodAssurance) : "little";
        const preview = await todPreview(
          id,
          String(body.prefix ?? ""),
          cra,
          assurance,
          body.threshold ? Number(body.threshold) : undefined,
        );
        return NextResponse.json(preview);
      }
      case "musPreview": {
        const preview = await musPreview(
          id,
          String(body.prefix ?? ""),
          body.interval ? Number(body.interval) : undefined,
        );
        return NextResponse.json(preview);
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
