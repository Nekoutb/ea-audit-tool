import type pg from "pg";

// Test fixtures for the tool-fed papers (F004, lib/tool-fed-papers.ts): the
// outputs their sign-offs wait for, written straight into the database with
// the admin connection so a test about something else can sign the paper.

/** A valid, current pre-audit trial balance (one balanced pair of rows). */
export async function seedValidTb(admin: pg.Pool, engagementId: string): Promise<void> {
  const tb = await admin.query<{ id: string; tenant_id: string }>(
    `INSERT INTO trial_balance (tenant_id, client_id, engagement_id, period_end)
     SELECT tenant_id, client_id, id, period_end FROM engagement WHERE id = $1
     ON CONFLICT (engagement_id) DO UPDATE SET updated_at = now()
     RETURNING id, tenant_id`,
    [engagementId],
  );
  const { id, tenant_id } = tb.rows[0];
  const next = await admin.query<{ v: number }>(
    "SELECT coalesce(max(version_no), 0) + 1 AS v FROM trial_balance_version WHERE trial_balance_id = $1",
    [id],
  );
  const versionNo = next.rows[0].v;
  // one live TB per timing, as importTrialBalance keeps it
  await admin.query(
    "UPDATE trial_balance_version SET superseded_at = now() WHERE trial_balance_id = $1 AND timing = 'pre_audit' AND superseded_at IS NULL",
    [id],
  );
  const version = await admin.query<{ id: string }>(
    `INSERT INTO trial_balance_version
       (tenant_id, trial_balance_id, version_no, validation_status, row_count, total_debit, total_credit, timing)
     VALUES ($1, $2, $3, 'valid', 2, 1000, 1000, 'pre_audit') RETURNING id`,
    [tenant_id, id, versionNo],
  );
  await admin.query(
    `INSERT INTO trial_balance_row (tenant_id, version_id, row_no, account_code, account_name, debit, credit)
     VALUES ($1, $2, 1, '411000', 'Clients', 1000, 0), ($1, $2, 2, '701000', 'Ventes', 0, 1000)`,
    [tenant_id, version.rows[0].id],
  );
  await admin.query("UPDATE trial_balance SET current_version_no = $2 WHERE id = $1", [id, versionNo]);
}

/** An approved materiality version. */
export async function seedApprovedMateriality(admin: pg.Pool, engagementId: string): Promise<void> {
  await admin.query(
    `INSERT INTO materiality
       (tenant_id, engagement_id, version_no, benchmark, benchmark_amount, percentage, justification,
        overall, performance, trivial, status, approved_at)
     SELECT tenant_id, id,
            (SELECT coalesce(max(version_no), 0) + 1 FROM materiality WHERE engagement_id = $1),
            'revenue', 1000000, 1, 'test', 10000, 7500, 500, 'approved', now()
       FROM engagement WHERE id = $1`,
    [engagementId],
  );
}

/** The team's conclusion recorded in the SAD tool. */
export async function seedSadConclusion(admin: pg.Pool, engagementId: string): Promise<void> {
  await admin.query(
    `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value)
     SELECT tenant_id, id, 'sad', 'concl_text', to_jsonb('No uncorrected difference above the trivial line.'::text)
       FROM engagement WHERE id = $1
     ON CONFLICT DO NOTHING`,
    [engagementId],
  );
}
