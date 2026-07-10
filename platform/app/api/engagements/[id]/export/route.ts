import { NextResponse } from "next/server";
import { exportFileIndex } from "@/lib/exports";

/** 9.6: regulator export — file index with statuses (.xlsx). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const result = await exportFileIndex(id);
    if (!result) return NextResponse.json({ error: "not-found" }, { status: 404 });
    return new NextResponse(new Uint8Array(result.content), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(result.filename)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
