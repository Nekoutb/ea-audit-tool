// Canonical development/test seed: two firms (tenants), each with a firm_admin
// user and one tenant-scoped rls_probe row. Used by `npm run seed` and by the
// Playwright global setup to prove cross-tenant isolation. Idempotent; runs as
// the owner role (DATABASE_URL).
//
// Fixed UUIDs so the E2E test can reference the "other" tenant by id.

import { config } from "dotenv";
import bcrypt from "bcryptjs";
import pg from "pg";

config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL must be set");
  process.exit(1);
}

export const FIRMS = [
  {
    id: "a0000000-0000-0000-0000-00000000000a",
    name: "Cabinet Alpha",
    slug: "firm-a",
    email: "alice@firm-a.test",
    userName: "Alice Alpha",
    probe: "Alpha confidential",
  },
  {
    id: "b0000000-0000-0000-0000-00000000000b",
    name: "Cabinet Beta",
    slug: "firm-b",
    email: "bob@firm-b.test",
    userName: "Bob Beta",
    probe: "Beta confidential",
  },
];

export const SEED_PASSWORD = "password";

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const firm of FIRMS) {
    await client.query(
      `INSERT INTO tenant (id, name, slug)
         VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug`,
      [firm.id, firm.name, firm.slug],
    );

    const user = await client.query(
      `INSERT INTO app_user (email, name, password_hash)
         VALUES ($1, $2, $3)
       ON CONFLICT (lower(email)) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name
       RETURNING id`,
      [firm.email, firm.userName, passwordHash],
    );
    const userId = user.rows[0].id;

    await client.query(
      `INSERT INTO membership (user_id, tenant_id, role)
         VALUES ($1, $2, 'firm_admin')
       ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = EXCLUDED.role`,
      [userId, firm.id],
    );

    // Reset this firm's probe rows to exactly one known value (idempotent).
    await client.query("DELETE FROM rls_probe WHERE tenant_id = $1", [firm.id]);
    await client.query("INSERT INTO rls_probe (tenant_id, note) VALUES ($1, $2)", [
      firm.id,
      firm.probe,
    ]);

    // Clear notifications so E2E runs start from a known-empty inbox.
    await client.query("DELETE FROM notification WHERE tenant_id = $1", [firm.id]);
  }

  console.log(
    `Seeded ${FIRMS.length} firms: ${FIRMS.map((f) => `${f.email}/${SEED_PASSWORD}`).join(", ")}`,
  );
} catch (error) {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
