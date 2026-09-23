import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// The acceptance workbook. Two properties worth pinning:
//   - it does not exist on production, because acceptance testing means making
//     rubbish clients and archiving files to watch the refusal;
//   - two testers answering the same question do not overwrite each other, so a
//     disagreement about whether something works stays visible.

const TENANT = "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a701";
const ALICE = "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a702";
const BOB = "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a703";
let current = ALICE;

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: current, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { UatError, listResults, progressFor, recordResult, uatAvailable } from "@/lib/uat";
import { ALL_SCENARIOS, duplicateKeys } from "@/lib/uat-scenarios";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const saved = process.env.APP_DATABASE_URL;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1 OR slug = 'uat-test'", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1::uuid[])", [[ALICE, BOB]]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'UAT Firm', 'uat-test')", [
    TENANT,
  ]);
  await admin.query(
    `INSERT INTO app_user (id, email, name, password_hash) VALUES
       ($1, 'alice@uat.local', 'Alice', 'x'), ($2, 'bob@uat.local', 'Bob', 'x')`,
    [ALICE, BOB],
  );
  await admin.query(
    "INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $3, 'firm_admin'), ($2, $3, 'firm_admin')",
    [ALICE, BOB, TENANT],
  );
}, 60_000);

afterEach(() => {
  current = ALICE;
  if (saved === undefined) delete process.env.APP_DATABASE_URL;
  else process.env.APP_DATABASE_URL = saved;
});

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("the script itself", () => {
  it("has no duplicate keys — a stored answer must point at one question", () => {
    expect(duplicateKeys()).toEqual([]);
  });

  it("gives every scenario steps and an expected result", () => {
    expect(ALL_SCENARIOS.length).toBeGreaterThan(20);
    for (const s of ALL_SCENARIOS) {
      expect(s.steps.length, s.key).toBeGreaterThan(0);
      expect(s.expect.length, s.key).toBeGreaterThan(20);
      expect(s.why.length, s.key).toBeGreaterThan(20);
    }
  });
});

describe("availability", () => {
  it("is present on the dev database", () => {
    process.env.APP_DATABASE_URL = "postgresql://ea_app:x@localhost:5432/ea_audit_dev";
    expect(uatAvailable()).toBe(true);
  });

  it("is absent on production, and refuses to record there", async () => {
    process.env.APP_DATABASE_URL = "postgresql://ea_app:x@localhost:5432/ea_audit";
    expect(uatAvailable()).toBe(false);
    await expect(
      recordResult({ scenarioKey: ALL_SCENARIOS[0].key, status: "passed", notes: "" }),
    ).rejects.toThrow(UatError);
  });

  it("fails closed when the database cannot be identified", () => {
    delete process.env.APP_DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(uatAvailable()).toBe(false);
    process.env.DATABASE_URL = saved;
  });
});

describe("recording answers", () => {
  it("keeps two testers' verdicts side by side", async () => {
    process.env.APP_DATABASE_URL = "postgresql://ea_app:x@localhost:5432/ea_audit_dev";
    const key = ALL_SCENARIOS[0].key;

    current = ALICE;
    await recordResult({ scenarioKey: key, status: "passed", notes: "fine for me" });
    current = BOB;
    await recordResult({ scenarioKey: key, status: "failed", notes: "the link did nothing" });

    const asBob = await listResults();
    const bobs = asBob.find((r) => r.scenarioKey === key && r.mine);
    const alices = asBob.find((r) => r.scenarioKey === key && !r.mine);
    expect(bobs?.status).toBe("failed");
    expect(alices?.status).toBe("passed");
    expect(alices?.who).toBe("Alice");
  }, 30_000);

  it("revising your own answer replaces it rather than adding another", async () => {
    process.env.APP_DATABASE_URL = "postgresql://ea_app:x@localhost:5432/ea_audit_dev";
    const key = ALL_SCENARIOS[1].key;
    current = ALICE;
    await recordResult({ scenarioKey: key, status: "blocked", notes: "no test data" });
    await recordResult({ scenarioKey: key, status: "passed", notes: "retested, fine" });
    const results = (await listResults()).filter((r) => r.scenarioKey === key && r.mine);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("passed");
  }, 30_000);

  it("refuses a status or a scenario it does not know", async () => {
    process.env.APP_DATABASE_URL = "postgresql://ea_app:x@localhost:5432/ea_audit_dev";
    await expect(
      recordResult({ scenarioKey: "made.up", status: "passed", notes: "" }),
    ).rejects.toThrow(/unknown-scenario/);
    await expect(
      recordResult({ scenarioKey: ALL_SCENARIOS[0].key, status: "probably-fine", notes: "" }),
    ).rejects.toThrow(/invalid-status/);
  });

  it("counts progress over my own answers only", () => {
    const progress = progressFor([
      {
        scenarioKey: ALL_SCENARIOS[0].key,
        status: "passed",
        notes: "",
        updatedAt: null,
        who: "Alice",
        mine: true,
      },
      {
        scenarioKey: ALL_SCENARIOS[1].key,
        status: "failed",
        notes: "",
        updatedAt: null,
        who: "Bob",
        mine: false,
      },
    ]);
    expect(progress.total).toBe(ALL_SCENARIOS.length);
    expect(progress.passed).toBe(1);
    expect(progress.failed).toBe(0);
    expect(progress.notStarted).toBe(ALL_SCENARIOS.length - 1);
  });
});
