import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * What is this instance running? Public and unauthenticated on purpose: it is
 * how the deploy pipeline proves that dev.auditisa.com or www.auditisa.com
 * serves the exact commit it just deployed, and how a person checks the same
 * thing in a browser. The repository is public, so the commit sha gives away
 * nothing; no secret, path or version of a dependency is exposed.
 *
 * `RELEASE` is written by deploy/deploy-ea-audit.sh into every release
 * directory; `.next/BUILD_ID` by `next build`. On a dev server (`next dev`)
 * neither exists and the fields say so.
 */
export async function GET() {
  const release = await readFile("RELEASE", "utf8").catch(() => "");
  const field = (name: string): string | null => {
    const match = new RegExp(`^${name}=(.*)$`, "m").exec(release);
    return match ? match[1].trim() : null;
  };
  const buildId = (await readFile(".next/BUILD_ID", "utf8").catch(() => "")).trim() || null;

  return NextResponse.json(
    {
      sha: field("sha"),
      ref: field("ref"),
      built: field("built"),
      target: field("target"),
      buildId,
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
