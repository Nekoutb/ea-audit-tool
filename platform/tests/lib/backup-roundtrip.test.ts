import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The two questions a backup has to answer, asked of the real schema with every
// real trigger armed:
//
//   1. Does one firm's extract contain only that firm's rows?
//   2. Do the Word/PowerPoint/PDF bytes survive the round trip byte-identically?
//
// (2) is the one that cannot be taken on trust. Every uploaded file is a bytea
// column, so an extract that produced every row with an empty blob would pass
// any row-count check and would have lost the entire firm's evidence.
//
// The round trip is done by deleting the firm and loading it back into the same
// database, which exercises the genuine article — the same constraints, the same
// archive-immutability guards — rather than a stripped-down fixture schema.

import { extract, connect } from "@/lib/backup/extract.mjs";
import { load, verify, guardsPresent, checkSchema } from "@/lib/backup/restore.mjs";

const A = "b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b101"; // the firm we back up
const B = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b202"; // the firm that must not appear
const USER_A = "b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b111";
const USER_B = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b222";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let client: pg.Client;
let dir: string;
const bytes = {
  docx: randomBytes(4096),
  attachment: randomBytes(8192),
  evidence: randomBytes(2048),
  pbc: randomBytes(1024),
};
let engagementA: string;

async function seedFirm(tenant: string, user: string, slug: string, content: typeof bytes) {
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, $2, $3)", [
    tenant,
    `Firm ${slug}`,
    slug,
  ]);
  await admin.query(
    "INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $3, 'hash-secret')",
    [user, `${slug}@backup.local`, `User ${slug}`],
  );
  await admin.query(
    "INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')",
    [user, tenant],
  );
  const client_ = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, $2, 'SA') RETURNING id",
    [tenant, `Client ${slug}`],
  );
  const eng = await admin.query<{ id: string }>(
    `INSERT INTO engagement (tenant_id, client_id, fiscal_year, period_end, phase)
     VALUES ($1, $2, 2025, '2025-12-31', 'execution') RETURNING id`,
    [tenant, client_.rows[0].id],
  );
  const engagementId = eng.rows[0].id;
  const item = await admin.query<{ id: string }>(
    `INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order)
     VALUES ($1, $2, 'E1.2', 'E', 'Test of controls', 'Test des contrôles', 1) RETURNING id`,
    [tenant, engagementId],
  );
  const doc = await admin.query<{ id: string }>(
    `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, created_by)
     VALUES ($1, $2, $3, 'Working paper', $4) RETURNING id`,
    [tenant, engagementId, item.rows[0].id, user],
  );
  await admin.query(
    `INSERT INTO document_version (tenant_id, document_id, version_no, mime, byte_size, sha256, content, note, created_by)
     VALUES ($1, $2, 1, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
             $3, encode(sha256($4), 'hex'), $4, '', $5)`,
    [tenant, doc.rows[0].id, content.docx.length, content.docx, user],
  );
  await admin.query(
    `INSERT INTO task_attachment (tenant_id, engagement_id, file_item_id, name, mime, size_bytes, version, content, uploaded_by)
     VALUES ($1, $2, $3, 'evidence.pdf', 'application/pdf', $4, 1, $5, $6)`,
    [tenant, engagementId, item.rows[0].id, content.attachment.length, content.attachment, user],
  );
  const step = await admin.query<{ id: string }>(
    `INSERT INTO program_step (tenant_id, engagement_id, file_item_id, seq, description)
     VALUES ($1, $2, $3, 1, 'Inspect approvals') RETURNING id`,
    [tenant, engagementId, item.rows[0].id],
  );
  await admin.query(
    `INSERT INTO evidence (tenant_id, engagement_id, program_step_id, kind, title, mime, content, created_by)
     VALUES ($1, $2, $3, 'file', 'Deck', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', $4, $5)`,
    [tenant, engagementId, step.rows[0].id, content.evidence, user],
  );
  await admin.query(
    `INSERT INTO pbc_item (tenant_id, engagement_id, title, status, filename, mime, content, uploaded_by, uploaded_at)
     VALUES ($1, $2, 'Bank confirmations', 'uploaded', 'bank.pdf', 'application/pdf', $3, $4, now())`,
    [tenant, engagementId, content.pbc, user],
  );
  return engagementId;
}

async function dropFirms() {
  // By slug and e-mail as well as by id: a run that died mid-seed leaves rows
  // whose ids were generated, and the unique slug would then block the retry.
  // The slugs are this suite's alone — other suites use "firm-a"/"firm-b", and
  // deleting theirs trips the archive-manifest immutability trigger.
  await admin.query("DELETE FROM tenant WHERE id = ANY($1::uuid[]) OR slug = ANY($2::text[])", [
    [A, B],
    ["backup-rt-a", "backup-rt-b"],
  ]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1::uuid[]) OR email = ANY($2::text[])", [
    [USER_A, USER_B],
    ["backup-rt-a@backup.local", "backup-rt-b@backup.local"],
  ]);
}

beforeAll(async () => {
  await dropFirms();
  engagementA = await seedFirm(A, USER_A, "backup-rt-a", bytes);
  await seedFirm(B, USER_B, "backup-rt-b", {
    docx: randomBytes(512),
    attachment: randomBytes(512),
    evidence: randomBytes(512),
    pbc: randomBytes(512),
  });
  client = await connect(process.env.DATABASE_URL);
  dir = await mkdtemp(path.join(tmpdir(), "ea-backup-"));
}, 120_000);

afterAll(async () => {
  await dropFirms();
  await client?.end();
  await admin.end();
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe("tenant extract", () => {
  let result: Awaited<ReturnType<typeof extract>>;

  it("extracts one firm", async () => {
    result = await extract(client, dir, { tenantId: A, credentials: "include" });
    expect(result.tables.length).toBeGreaterThan(30);
    expect(result.census.engagements).toBe(1);
    expect(result.census.document_versions).toBe(1);
    expect(result.census.attachments).toBe(1);
    expect(result.census.evidence).toBe(1);
    expect(result.census.pbc_items).toBe(1);
  }, 120_000);

  it("contains no trace of the other firm", async () => {
    for (const t of result.tables) {
      const csv = await readFile(path.join(dir, "data", `${t.table}.csv`), "utf8");
      expect(csv, `${t.table}.csv leaked firm B's tenant id`).not.toContain(B);
      expect(csv, `${t.table}.csv leaked firm B's user id`).not.toContain(USER_B);
    }
  });

  it("carries the schema version it was taken at", () => {
    expect(result.schema.count).toBeGreaterThan(0);
    expect(result.schema.last).toBeTruthy();
    expect(result.schema.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("redacts credentials when asked, and only then", async () => {
    const withCreds = await readFile(path.join(dir, "data", "app_user.csv"), "utf8");
    expect(withCreds).toContain("hash-secret");

    const redactedDir = await mkdtemp(path.join(tmpdir(), "ea-backup-red-"));
    try {
      const red = await extract(client, redactedDir, { tenantId: A, credentials: "redact" });
      const csv = await readFile(path.join(redactedDir, "data", "app_user.csv"), "utf8");
      expect(csv).not.toContain("hash-secret");
      expect(csv).toContain("backup-rt-a@backup.local");
      expect(red.tables.map((t) => t.table)).not.toContain("mfa_recovery_code");
    } finally {
      await rm(redactedDir, { recursive: true, force: true });
    }
  }, 120_000);

  it("refuses to run without an explicit credentials decision", async () => {
    // No default: a caller who has not thought about whose password hashes are
    // in the object should not get one.
    await expect(
      // @ts-expect-error deliberately omitted
      extract(client, dir, { tenantId: A }),
    ).rejects.toThrow(/credentials must be/);
  });
});

describe("round trip", () => {
  it("puts every byte back exactly as it was", async () => {
    const result = await extract(client, dir, { tenantId: A, credentials: "include" });
    const manifest = { schema: result.schema, kind: "tenant-full" };

    // Delete the firm outright — the cascade reaches every row the extract holds.
    await admin.query("DELETE FROM tenant WHERE id = $1", [A]);
    await admin.query("DELETE FROM app_user WHERE id = $1", [USER_A]);
    const gone = await admin.query("SELECT 1 FROM engagement WHERE tenant_id = $1", [A]);
    expect(gone.rowCount).toBe(0);

    await checkSchema(client, manifest);
    // "merge": the global reference table is in every extract and the target
    // database still holds it — a real restore into a live cluster has the
    // same shape.
    await load(client, dir, { mode: "merge" });

    const report = await verify(client, dir, manifest, {
      tableCounts: result.tables.filter((t) => t.rows > 0),
    });
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);

    // And the bytes themselves, compared against what the test generated.
    const doc = await admin.query<{ content: Buffer }>(
      "SELECT content FROM document_version WHERE tenant_id = $1",
      [A],
    );
    expect(Buffer.compare(doc.rows[0].content, bytes.docx)).toBe(0);
    const att = await admin.query<{ content: Buffer }>(
      "SELECT content FROM task_attachment WHERE tenant_id = $1",
      [A],
    );
    expect(Buffer.compare(att.rows[0].content, bytes.attachment)).toBe(0);
    const ev = await admin.query<{ content: Buffer }>(
      "SELECT content FROM evidence WHERE tenant_id = $1",
      [A],
    );
    expect(Buffer.compare(ev.rows[0].content, bytes.evidence)).toBe(0);
    const pbc = await admin.query<{ content: Buffer }>(
      "SELECT content FROM pbc_item WHERE tenant_id = $1",
      [A],
    );
    expect(Buffer.compare(pbc.rows[0].content, bytes.pbc)).toBe(0);
  }, 180_000);

  it("refuses to load into a database at a different schema version", async () => {
    await expect(
      checkSchema(client, {
        schema: { count: 1, last: "20200101000000_nope", digest: "0".repeat(64) },
      }),
    ).rejects.toThrow(/schema mismatch/);
  });

  it("leaves the compliance guards armed after a restore", async () => {
    const guards = await guardsPresent(client);
    expect(guards.reject_archived_write).toBeGreaterThan(20);
    expect(guards.reject_archived_child_write).toBeGreaterThan(5);
    expect(guards.reject_delete_under_hold).toBeGreaterThanOrEqual(1);

    // Not just present — still enforcing. Archive the restored file and confirm
    // a child write is refused, which is what proves session_replication_role
    // was put back.
    await admin.query(
      "UPDATE engagement SET archived_at = now(), phase = 'archived' WHERE id = $1",
      [engagementA],
    );
    await expect(
      admin.query(
        `INSERT INTO task_attachment (tenant_id, engagement_id, file_item_id, name, mime, size_bytes, version, content, uploaded_by)
         SELECT $1, $2, file_item_id, 'sneaked-in.pdf', 'application/pdf', 3, 9, '\\x00'::bytea, uploaded_by
           FROM task_attachment WHERE tenant_id = $1 LIMIT 1`,
        [A, engagementA],
      ),
    ).rejects.toThrow(/engagement-archived/);
  }, 60_000);
});
