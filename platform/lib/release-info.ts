import { readFile } from "node:fs/promises";

/**
 * What this instance is running. `RELEASE` is written by
 * deploy/deploy-ea-audit.sh into every release directory; `.next/BUILD_ID` by
 * `next build`. On a dev server (`next dev`) neither exists and the fields are
 * null. Read on every call — the values change only when the process is
 * restarted into a new release, but reading is cheap and never stale.
 */
export interface ReleaseInfo {
  /** Short commit id (7 characters) — what people quote and GitHub shows. */
  commit: string | null;
  /** Full commit sha the release was built from. */
  sha: string | null;
  /** The ref that was asked for (a branch name, or the sha itself). */
  ref: string | null;
  /** When `next build` ran for this release, ISO 8601. */
  built: string | null;
  /** "dev" (staging) or "prod" (production), as the deploy script names them. */
  target: string | null;
  /** Next's build id — changes with every build even of the same commit. */
  buildId: string | null;
  /** When this process started, ISO 8601. */
  startedAt: string;
}

export async function releaseInfo(): Promise<ReleaseInfo> {
  const release = await readFile("RELEASE", "utf8").catch(() => "");
  const field = (name: string): string | null => {
    const match = new RegExp(`^${name}=(.*)$`, "m").exec(release);
    return match ? match[1].trim() : null;
  };
  const buildId = (await readFile(".next/BUILD_ID", "utf8").catch(() => "")).trim() || null;
  const sha = field("sha");
  return {
    commit: sha ? sha.slice(0, 7) : null,
    sha,
    ref: field("ref"),
    built: field("built"),
    target: field("target"),
    buildId,
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
  };
}

/** The GitHub repository releases are built from; commits link there. */
export const SOURCE_REPOSITORY = "https://github.com/Nekoutb/ea-audit-tool";
