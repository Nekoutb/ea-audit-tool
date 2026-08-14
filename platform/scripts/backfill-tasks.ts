// Maintenance: give every existing engagement the tasks it would receive if it
// were created today. Additive and idempotent — nothing is renamed, moved or
// removed, and each engagement's complexity scoping is respected, so a very
// simple file does not inherit the extended tasks.
//
//   npx tsx scripts/backfill-tasks.ts [--dry]

import { config } from "dotenv";
import { Pool } from "pg";
import { itemsForComplexity } from "../lib/file-index";

config();

async function main(): Promise<void> {
  const dry = process.argv.includes("--dry");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const engagements = await pool.query<{
    id: string;
    tenant_id: string;
    name: string | null;
    complexity: "complex" | "non_complex" | "very_simple" | null;
  }>(
    `SELECT e.id, e.tenant_id, coalesce(e.name, c.name) AS name, e.complexity
       FROM engagement e JOIN client c ON c.id = e.client_id
      WHERE e.phase <> 'archived'
      ORDER BY e.created_at`,
  );

  let touched = 0;
  let added = 0;
  for (const engagement of engagements.rows) {
    // an engagement that never concluded its nature assessment has no tasks at
    // all — leave it to the classification screen rather than guessing a scope
    const existing = await pool.query<{ code: string }>(
      "SELECT code FROM file_item WHERE engagement_id = $1",
      [engagement.id],
    );
    if (existing.rows.length === 0) continue;

    const have = new Set(existing.rows.map((r) => r.code));
    const want = itemsForComplexity(engagement.complexity ?? "non_complex");
    const missing = want.filter((entry) => !have.has(entry.code));
    if (missing.length === 0) continue;

    touched += 1;
    added += missing.length;
    console.log(
      `${engagement.name ?? engagement.id}: +${missing.length} → ${missing.map((m) => m.code).join(", ")}`,
    );
    if (dry) continue;

    const max = await pool.query<{ m: string | null }>(
      "SELECT max(sort_order)::text AS m FROM file_item WHERE engagement_id = $1",
      [engagement.id],
    );
    let sort = Number(max.rows[0]?.m ?? 0);
    for (const entry of missing) {
      sort += 10;
      await pool.query(
        `INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (engagement_id, code) DO NOTHING`,
        [
          engagement.tenant_id,
          engagement.id,
          entry.code,
          entry.section,
          entry.titleEn,
          entry.titleFr,
          sort,
          entry.conditional ?? false,
        ],
      );
    }
  }

  console.log(
    dry
      ? `DRY RUN — ${added} task(s) would be added across ${touched} engagement(s).`
      : `Added ${added} task(s) across ${touched} engagement(s).`,
  );
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
