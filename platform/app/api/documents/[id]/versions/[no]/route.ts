import { NextResponse } from "next/server";
import { getVersionContent } from "@/lib/documents";
import { atLeast } from "@/lib/rbac";
import { requireTenant } from "@/lib/tenant";
import { fileResponseHeaders } from "@/lib/upload-safety";

/**
 * Download a specific version of a working paper (tenant-scoped via session).
 *
 * Defence in depth (assurance finding C2): working-paper bytes are firm-side
 * only. read_only staff may read them; a portal account is refused here even
 * if the proxy matcher were ever to miss this tree.
 */
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
    const { role } = await requireTenant();
    if (!atLeast(role, "read_only")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const version = await getVersionContent(id, versionNo);
    if (!version) return NextResponse.json({ error: "not-found" }, { status: 404 });
    return new NextResponse(new Uint8Array(version.content), {
      headers: fileResponseHeaders(version.filename, version.mime),
    });
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
