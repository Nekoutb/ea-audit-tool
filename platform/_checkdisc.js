/* eslint-disable @typescript-eslint/no-require-imports -- dev-only */
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const c = await pool.query(
    "SELECT parent_id IS NOT NULL AS is_reply, body FROM comment ORDER BY created_at",
  );
  console.log('comments:');
  c.rows.forEach((r) => console.log('  ' + (r.is_reply ? '[reply] ' : '[root]  ') + r.body.slice(0, 60)));
  const n = await pool.query(
    "SELECT u.email, n.kind, n.title FROM notification n JOIN app_user u ON u.id = n.user_id WHERE n.kind IN ('mention','reply') ORDER BY n.created_at DESC LIMIT 5",
  );
  console.log('mention/reply notifications:');
  n.rows.forEach((r) => console.log('  ' + r.email + ' <- ' + r.kind + ': ' + r.title));
  await pool.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
