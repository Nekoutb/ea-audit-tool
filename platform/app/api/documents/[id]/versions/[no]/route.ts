import { NextResponse } from "next/server";
import { getVersionContent } from "@/lib/documents";

/** Download a specific version of a working paper (tenant-scoped via session). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; no: string }> },
) {
  const { id, no } = await context.params;
  const versionNo = Number(no);
  if (!Number.isInteger(versionNo) || versionNo < 1) {
    return NextResponse.json({ error: "invalid-version" }, { status: 400 });
  }
  try {
    const version = await getVersionContent(id, versionNo);
    if (!version) return NextResponse.json({ error: "not-found" }, { status: 404 });
    return new NextResponse(new Uint8Array(version.content), {
      headers: {
        "Content-Type": version.mime,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(version.filename)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
