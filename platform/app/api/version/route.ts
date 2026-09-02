import { NextResponse } from "next/server";
import { releaseInfo } from "@/lib/release-info";

export const dynamic = "force-dynamic";

/**
 * What is this instance running? Public and unauthenticated on purpose: it is
 * how the deploy pipeline proves that dev.auditisa.com or www.auditisa.com
 * serves the exact commit it just deployed. The repository is public, so the
 * commit sha gives away nothing; no secret, path or dependency version is
 * exposed.
 *
 * Machines get JSON. A person who types this URL into a browser gets the
 * readable page at /version instead — the browser says so with its Accept
 * header, which curl and the pipeline do not send.
 */
export async function GET(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html") && !accept.startsWith("application/json")) {
    // A relative Location, not NextResponse.redirect(): behind Apache the
    // request URL Next sees is the loopback address it is bound to
    // (localhost:3201), and an absolute redirect built from it sent browsers
    // there. The browser resolves "/version" against the address it used.
    return new NextResponse(null, { status: 303, headers: { Location: "/version" } });
  }
  return NextResponse.json(await releaseInfo(), { headers: { "Cache-Control": "no-store" } });
}
