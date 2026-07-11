// Demo fixture for the Atlas dashboard: one execution-phase engagement with the
// real A–F file index, some signed working papers, open findings, misstatements,
// a significant risk, PBC items and statutory deadlines — enough for the
// engagement dashboard to render with authentic data. Idempotent-ish: it creates
// a fresh client/engagement each run. Run: npx tsx scripts/seed-demo.ts
import "dotenv/config";
import pg from "pg";
import { DEFAULT_FILE_INDEX } from "../lib/file-index";

const connectionString = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("APP_DATABASE_URL or DATABASE_URL must be set");

async function main() {
  const c = new pg.Client({ connectionString });
  await c.connect();

  const tenant = (await c.query<{ id: string }>("SELECT id FROM tenant ORDER BY created_at LIMIT 1")).rows[0];
  if (!tenant) throw new Error("No tenant — run npm run seed:dev first.");
  const user = (
    await c.query<{ user_id: string }>(
      "SELECT user_id FROM membership WHERE tenant_id = $1 AND role <> 'client_user' LIMIT 1",
      [tenant.id],
    )
  ).rows[0];
  const createdBy = user?.user_id ?? null;

  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('app.tenant_id', $1, true)", [tenant.id]);

    const client = (
      await c.query<{ id: string }>(
        `INSERT INTO client (tenant_id, name, legal_form, listed) VALUES ($1, $2, 'SA', false) RETURNING id`,
        [tenant.id, "Industrielle du Cameroun SA"],
      )
    ).rows[0];

    const eng = (
      await c.query<{ id: string }>(
        `INSERT INTO engagement (tenant_id, client_id, fiscal_year, period_end, phase)
         VALUES ($1, $2, 2025, '2025-12-31', 'execution') RETURNING id`,
        [tenant.id, client.id],
      )
    ).rows[0];

    // Full A–F file index, exactly as the app instantiates it.
    let sort = 0;
    const itemIdByCode = new Map<string, string>();
    for (const entry of DEFAULT_FILE_INDEX) {
      sort += 10;
      const row = (
        await c.query<{ id: string }>(
          `INSERT INTO file_item
             (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [tenant.id, eng.id, entry.code, entry.section, entry.titleEn, entry.titleFr, sort, entry.conditional ?? false],
        )
      ).rows[0];
      itemIdByCode.set(entry.code, row.id);
    }

    const eCodes = DEFAULT_FILE_INDEX.filter((e) => e.section === "E" && !e.conditional).map((e) => e.code);
    const signedCodes = eCodes.slice(0, 14); // execution progress ~ 14/24
    const draftCodes = eCodes.slice(14, 17); // 3 unsigned working papers

    for (const code of signedCodes) {
      await c.query(
        `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, status, current_version, created_by)
         VALUES ($1,$2,$3,$4,'fr','signed',1,$5)`,
        [tenant.id, eng.id, itemIdByCode.get(code), `${code} working paper`, createdBy],
      );
    }
    for (const code of draftCodes) {
      await c.query(
        `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, status, current_version, created_by)
         VALUES ($1,$2,$3,$4,'fr','draft',0,$5)`,
        [tenant.id, eng.id, itemIdByCode.get(code), `${code} working paper`, createdBy],
      );
    }

    const findings: [string, string, string][] = [
      ["b4", "Going-concern assessment memo awaiting partner review", "E330"],
      ["c1", "Control deficiency: three-way match not operating", "E220"],
      ["b4", "Related-party transactions completeness to resolve", "E320"],
      ["c1", "Payroll approval workflow bypass observed", "E120"],
    ];
    for (const [route, title, code] of findings) {
      await c.query(
        `INSERT INTO finding (tenant_id, engagement_id, file_item_id, route, title, status, created_by)
         VALUES ($1,$2,$3,$4,$5,'open',$6)`,
        [tenant.id, eng.id, itemIdByCode.get(code) ?? null, route, title, createdBy],
      );
    }

    const misstatements: [string, number][] = [
      ["Cut-off error on December revenue invoices", 1240000],
      ["Unrecorded supplier accrual (utilities)", 640000],
    ];
    for (const [description, amount] of misstatements) {
      await c.query(
        `INSERT INTO misstatement (tenant_id, engagement_id, description, amount, mtype, corrected, trivial, created_by)
         VALUES ($1,$2,$3,$4,'factual',false,false,$5)`,
        [tenant.id, eng.id, description, amount, createdBy],
      );
    }

    await c.query(
      `INSERT INTO risk (tenant_id, engagement_id, description, significant, status, created_by)
       VALUES ($1,$2,$3,true,'response_planned',$4)`,
      [tenant.id, eng.id, "Revenue recognition — manual adjustments near year-end", createdBy],
    );

    for (const title of ["Signed lease agreements (E210)", "December bank statements — all accounts"]) {
      await c.query(
        `INSERT INTO pbc_item (tenant_id, engagement_id, title, status) VALUES ($1,$2,$3,'requested')`,
        [tenant.id, eng.id, title],
      );
    }

    const deadlines: [string, string, string][] = [
      ["fs_arrete", "2026-04-30", "AUSCGIE art. 138 — FS arrêtés (≤ 4 months)"],
      ["ago", "2026-06-30", "AUSCGIE art. 348 — AGO (≤ 6 months)"],
      ["docs_to_cac", "2026-05-15", "AUSCGIE — documents to the CAC"],
    ];
    for (const [key, due, basis] of deadlines) {
      await c.query(
        `INSERT INTO statutory_deadline (tenant_id, engagement_id, key, due_date, basis, done)
         VALUES ($1,$2,$3,$4,$5,false) ON CONFLICT (engagement_id, key) DO NOTHING`,
        [tenant.id, eng.id, key, due, basis],
      );
    }

    await c.query("COMMIT");
    console.log("Seeded demo engagement:", eng.id);
    console.log("Dashboard: /engagements/" + eng.id + "/dashboard");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
