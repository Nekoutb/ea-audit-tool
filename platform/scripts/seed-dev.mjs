// Minimal development seed: one firm + one admin user, enough to log in and
// verify auth (Step 0.4). Step 0.5 replaces this with a full two-tenant seed.
// Idempotent. Runs as the owner role (DATABASE_URL).
//
// Usage: node scripts/seed-dev.mjs

import { config } from "dotenv";
import bcrypt from "bcryptjs";
import pg from "pg";

config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL must be set");
  process.exit(1);
}

const EMAIL = "admin@demo.test";
// Local fixture credential — see scripts/seed.mjs.
const PASSWORD = process.env.SEED_PASSWORD ?? "password";

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const tenant = await client.query(
    `INSERT INTO tenant (name, slug)
       VALUES ('Demo Firm', 'demo')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
  );
  const tenantId = tenant.rows[0].id;

  const user = await client.query(
    `INSERT INTO app_user (email, name, password_hash)
       VALUES ($1, 'Demo Admin', $2)
     ON CONFLICT (lower(email)) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [EMAIL, passwordHash],
  );
  const userId = user.rows[0].id;

  await client.query(
    `INSERT INTO membership (user_id, tenant_id, role)
       VALUES ($1, $2, 'firm_admin')
     ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = EXCLUDED.role`,
    [userId, tenantId],
  );

  // The password is deliberately not echoed — CI logs are retained and readable.
  console.log(`Seeded firm 'Demo Firm' with admin ${EMAIL} (password from SEED_PASSWORD)`);
} catch (error) {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
