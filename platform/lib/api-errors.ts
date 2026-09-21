import { NextResponse } from "next/server";

/**
 * The reply to a mutation that did not happen.
 *
 * Two kinds of failure arrive here and they are not the same thing. A thrown
 * Error whose message is a bare code — `invalid-field`, `invalid-selection`,
 * `firm-protected` — is a refusal this codebase wrote deliberately, and the code
 * is meant to travel to the browser so the board can say which rule was broken.
 * Anything else is a fault: a query that would not run, a column that moved, a
 * connection that dropped.
 *
 * Both used to come out as `{ error: "save-failed" }` with nothing written
 * anywhere, across ten routes. When a save failed on the E1.2 board there was
 * no way to learn why: the journal held only restarts, and the cause had been
 * caught, flattened to four words and thrown away. The export routes had logged
 * their failures all along; the mutation routes never did.
 *
 * So a real fault is logged with its stack, and a deliberate refusal is not —
 * it is an answer, not an incident, and logging it would bury the faults.
 */
export function saveFailed(scope: string, error: unknown): NextResponse {
  const deliberate = error instanceof Error && /^[a-z0-9-]+$/.test(error.message);
  if (!deliberate) {
    console.error(
      `[${scope}] save failed:`,
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
  }
  return NextResponse.json(
    { error: deliberate ? (error as Error).message : "save-failed" },
    { status: 400 },
  );
}
