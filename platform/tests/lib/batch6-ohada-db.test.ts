import pg from "pg";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Batch 6 on the database (2026-11-04), firm decisions of 2026-10-27:
//   F047 E4.36 is core: a very simple file gets it, and the migration adds it
//        to a file that lacks it with a 'task_added' trail row
//   F052 SA_AG is accepted by the client CHECK; a SARL file does not
//        instantiate C5.7, and the migration marks an existing C5.7 on a SARL
//        conditional with a 'task_made_conditional' trail row; the engagement
//        summary carries the client's legal form for the papers
//   F056 the C5.8 monitor reads the share capital from account 101 when the
//        client record has none, and the record overrides it
//
// Needs migrations 20261104000001 and 20261104000002 applied.

const TENANT = "b6b6b6b6-b6b6-4b6b-8b6b-b6b6b6b6b6b6";
const ADMIN = "b6b6b6b6-b6b6-4b6b-8b6b-b6b6b6b6b601";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: ADMIN, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { createEngagement, getEngagement, listFileItems } from "@/lib/engagements";
import { equityStatus, setShareCapital } from "@/lib/legal";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let saAgEngagement: string;
let sarlEngagement: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [ADMIN]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Batch6 Firm', 'batch6-test')", [TENANT]);
  await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'admin@batch6.local', 'Batch6 Admin', 'x')", [ADMIN]);
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [ADMIN, TENANT]);
  // F052: the widened CHECK accepts the SA with an administrateur général
  const saAg = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Batch6 SA-AG', 'SA_AG') RETURNING id",
    [TENANT],
  );
  const sarl = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Batch6 SARL', 'SARL') RETURNING id",
    [TENANT],
  );
  saAgEngagement = await createEngagement({ clientId: saAg.rows[0].id, fiscalYear: 2026, periodEnd: "2026-12-31", partnerId: ADMIN, complexity: "very_simple" });
  sarlEngagement = await createEngagement({ clientId: sarl.rows[0].id, fiscalYear: 2026, periodEnd: "2026-12-31", partnerId: ADMIN, complexity: "complex" });
}, 30_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

/** The Up section of a migration, run in one transaction against the test rows. */
async function runUp(file: string): Promise<void> {
  const sql = readFileSync(file, "utf8");
  const up = sql.split(/^-- Up Migration\s*$/m)[1].split(/^-- Down Migration\s*$/m)[0];
  const tx = await admin.connect();
  try {
    await tx.query("BEGIN");
    await tx.query(up);
    await tx.query("COMMIT");
  } catch (e) {
    await tx.query("ROLLBACK");
    throw e;
  } finally {
    tx.release();
  }
}

describe("F052 — the legal form on the file", () => {
  it("the engagement summary carries the client's legal form", async () => {
    expect((await getEngagement(saAgEngagement))?.clientLegalForm).toBe("SA_AG");
    expect((await getEngagement(sarlEngagement))?.clientLegalForm).toBe("SARL");
  });

  it("a SARL file is created without C5.7; an SA file keeps it", async () => {
    const sarlCodes = (await listFileItems(sarlEngagement)).map((i) => i.code);
    expect(sarlCodes).not.toContain("C5.7");
    expect(sarlCodes).toContain("C5.3");
    expect(sarlCodes).toContain("C5.8");
    // the complex SA_AG file is not asked for here: very simple files carry no
    // C5.7 whatever the form (standard tier), so the rule is tested on the index
  });
});

describe("F047 — E4.36 core", () => {
  it("a very simple file instantiates E4.36", async () => {
    expect((await listFileItems(saAgEngagement)).map((i) => i.code)).toContain("E4.36");
  });

  it("migration 20261104000002 adds E4.36 to a file that lacks it and logs the addition, and marks a SARL's C5.7 conditional", async () => {
    // a pre-F047 file: no E4.36
    await admin.query("DELETE FROM file_item WHERE engagement_id = $1 AND code = 'E4.36'", [saAgEngagement]);
    // a pre-F052 SARL file: an ordinary C5.7
    const sarlTenant = TENANT;
    await admin.query(
      `INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
       VALUES ($1, $2, 'C5.7', 'F', 'Registered Securities Register Attestation', 'Attestation sur les registres de titres nominatifs', 9999, false)`,
      [sarlTenant, sarlEngagement],
    );

    await runUp("migrations/20261104000002_e436_core_c57_conditional.sql");

    const e436 = await admin.query<{ sort_order: number; conditional: boolean }>(
      "SELECT sort_order, conditional FROM file_item WHERE engagement_id = $1 AND code = 'E4.36'",
      [saAgEngagement],
    );
    expect(e436.rows).toHaveLength(1);
    expect(e436.rows[0].conditional).toBe(false);
    // anchored just before E6.8 on a very simple file (no E4.35 there)
    const e68 = await admin.query<{ sort_order: number }>(
      "SELECT sort_order FROM file_item WHERE engagement_id = $1 AND code = 'E6.8'",
      [saAgEngagement],
    );
    expect(e436.rows[0].sort_order).toBe(e68.rows[0].sort_order - 1);
    const added = await admin.query<{ summary: string; meta: { code: string; reason: string } }>(
      "SELECT summary, meta FROM activity_log WHERE engagement_id = $1 AND action = 'task_added'",
      [saAgEngagement],
    );
    expect(added.rows).toHaveLength(1);
    expect(added.rows[0].meta.code).toBe("E4.36");
    expect(added.rows[0].summary).toContain("F047");

    const c57 = await admin.query<{ conditional: boolean }>(
      "SELECT conditional FROM file_item WHERE engagement_id = $1 AND code = 'C5.7'",
      [sarlEngagement],
    );
    expect(c57.rows[0].conditional).toBe(true);
    const made = await admin.query<{ meta: { legalForm: string } }>(
      "SELECT meta FROM activity_log WHERE engagement_id = $1 AND action = 'task_made_conditional'",
      [sarlEngagement],
    );
    expect(made.rows).toHaveLength(1);
    expect(made.rows[0].meta.legalForm).toBe("SARL");

    // idempotent: a second run adds and logs nothing more
    await runUp("migrations/20261104000002_e436_core_c57_conditional.sql");
    expect((await admin.query("SELECT 1 FROM file_item WHERE engagement_id = $1 AND code = 'E4.36'", [saAgEngagement])).rowCount).toBe(1);
    expect((await admin.query("SELECT 1 FROM activity_log WHERE engagement_id = $1 AND action = 'task_added'", [saAgEngagement])).rowCount).toBe(1);
    expect((await admin.query("SELECT 1 FROM activity_log WHERE engagement_id = $1 AND action = 'task_made_conditional'", [sarlEngagement])).rowCount).toBe(1);
  });
});

describe("F056 — the share capital of the C5.8 monitor", () => {
  it("reads account 101 when the client record has no capital, and the record overrides it", async () => {
    // a small TB: capital 101 of 10 000 000 credit, bank 521 debit, a loss on 6
    const tb = await admin.query<{ id: string }>(
      `INSERT INTO trial_balance (tenant_id, client_id, engagement_id, period_end, current_version_no)
       SELECT $1, client_id, id, period_end, 1 FROM engagement WHERE id = $2 RETURNING id`,
      [TENANT, sarlEngagement],
    );
    const v = await admin.query<{ id: string }>(
      `INSERT INTO trial_balance_version (tenant_id, trial_balance_id, version_no, validation_status, created_by)
       VALUES ($1, $2, 1, 'valid', $3) RETURNING id`,
      [TENANT, tb.rows[0].id, ADMIN],
    );
    let rowNo = 0;
    for (const [code, name, od, oc, d, c] of [
      ["1010000", "Capital social", 0, 10_000_000, 0, 0],
      ["5210000", "Banque", 4_000_000, 0, 0, 0],
      ["6010000", "Achats", 0, 0, 6_000_000, 0],
    ] as [string, string, number, number, number, number][]) {
      await admin.query(
        `INSERT INTO trial_balance_row (tenant_id, version_id, row_no, account_code, account_name, opening_debit, opening_credit, debit, credit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [TENANT, v.rows[0].id, ++rowNo, code, name, od, oc, d, c],
      );
    }
    const byTb = await equityStatus(sarlEngagement);
    expect(byTb.hasTb).toBe(true);
    expect(byTb.shareCapitalSource).toBe("tb_101");
    expect(byTb.shareCapital).toBe(10_000_000);
    expect(byTb.halfCapital).toBe(5_000_000);
    // equity = capital 10M − loss 6M = 4M < 5M
    expect(byTb.equity).toBe(4_000_000);
    expect(byTb.breach).toBe(true);

    await setShareCapital(sarlEngagement, 6_000_000);
    const byRecord = await equityStatus(sarlEngagement);
    expect(byRecord.shareCapitalSource).toBe("client");
    expect(byRecord.shareCapital).toBe(6_000_000);
    expect(byRecord.breach).toBe(false);
  });
});
