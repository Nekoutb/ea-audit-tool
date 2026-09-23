// Storing what a tester found. The script itself is in lib/uat-scenarios.ts.

import { withTenant } from "@/lib/db";
import { isNonProductionInstance } from "@/lib/instance";
import { requireTenant } from "@/lib/tenant";
import { ALL_SCENARIOS, type UatStatus } from "@/lib/uat-scenarios";

export class UatError extends Error {}

const STATUSES: UatStatus[] = ["not_started", "passed", "failed", "blocked"];

export interface UatResult {
  scenarioKey: string;
  status: UatStatus;
  notes: string;
  updatedAt: string | null;
  /** Who recorded it — several people run the same script at once. */
  who: string;
  mine: boolean;
}

/**
 * The UAT workbook exists only on the dev/staging instance.
 *
 * Acceptance testing means creating rubbish clients, archiving files to see
 * the refusal, and deliberately trying to reach another team's engagement.
 * None of that belongs anywhere near production data, so the page is absent
 * there rather than merely hidden — see lib/instance.ts for why the database
 * name is what decides it.
 */
export function uatAvailable(): boolean {
  return isNonProductionInstance();
}

function assertAvailable(): void {
  if (!uatAvailable()) throw new UatError("not-available-on-production");
}

/** Every tester's answers for this firm, so a disagreement is visible. */
export async function listResults(): Promise<UatResult[]> {
  assertAvailable();
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const { rows } = await tx.query<{
      scenario_key: string;
      status: UatStatus;
      notes: string;
      updated_at: string;
      who: string;
      user_id: string;
    }>(
      `SELECT r.scenario_key, r.status, r.notes, r.updated_at,
              coalesce(u.name, u.email) AS who, r.user_id
         FROM uat_result r JOIN app_user u ON u.id = r.user_id
        ORDER BY r.updated_at DESC`,
    );
    return rows.map((r) => ({
      scenarioKey: r.scenario_key,
      status: r.status,
      notes: r.notes,
      updatedAt: new Date(r.updated_at).toISOString(),
      who: r.who,
      mine: r.user_id === userId,
    }));
  });
}

/**
 * Record one answer. Upserts on (user, scenario) so a tester revising their
 * own verdict replaces it, while a second tester's answer sits alongside.
 */
export async function recordResult(input: {
  scenarioKey: string;
  status: string;
  notes: string;
}): Promise<void> {
  assertAvailable();
  const { tenantId, userId } = await requireTenant();
  if (!ALL_SCENARIOS.some((s) => s.key === input.scenarioKey))
    throw new UatError("unknown-scenario");
  if (!STATUSES.includes(input.status as UatStatus)) throw new UatError("invalid-status");
  // Long enough for a real account of what went wrong, bounded so the column
  // cannot be used as a file store.
  const notes = input.notes.slice(0, 4000);

  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO uat_result (tenant_id, user_id, scenario_key, status, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, scenario_key)
       DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = now()`,
      [tenantId, userId, input.scenarioKey, input.status, notes],
    );
  });
}

export interface UatProgress {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  notStarted: number;
}

/** Counted over THIS tester's answers — the question is "how far am I?". */
export function progressFor(results: UatResult[]): UatProgress {
  const mine = new Map(results.filter((r) => r.mine).map((r) => [r.scenarioKey, r.status]));
  let passed = 0;
  let failed = 0;
  let blocked = 0;
  for (const s of ALL_SCENARIOS) {
    const status = mine.get(s.key) ?? "not_started";
    if (status === "passed") passed++;
    else if (status === "failed") failed++;
    else if (status === "blocked") blocked++;
  }
  return {
    total: ALL_SCENARIOS.length,
    passed,
    failed,
    blocked,
    notStarted: ALL_SCENARIOS.length - passed - failed - blocked,
  };
}
