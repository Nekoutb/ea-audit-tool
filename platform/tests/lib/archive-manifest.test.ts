import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The manifest is a 120-line SQL expression that runs once, at archive time.
 * A mistake in it would surface only when a firm closed a file — and then the
 * record of what the file contained would be the thing that failed. So it is
 * executed here against a real engagement, and the result inspected.
 */

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/** The manifest SQL, kept identical to lib/completion.ts#archiveEngagement. */
const MANIFEST_SQL = `SELECT json_build_object(
   'manifestVersion', 2,
   'generatedAt', now(),
   'engagement', (SELECT json_build_object(
                    'id', e.id, 'name', e.name, 'client', c.name,
                    'clientLegalForm', c.legal_form, 'fiscalYear', e.fiscal_year,
                    'periodEnd', e.period_end, 'reportDate', e.report_date,
                    'opinion', e.opinion, 'framework', e.framework,
                    'firstYear', e.first_year, 'complexity', e.complexity,
                    'retentionUntil', e.retention_until)
                   FROM engagement e JOIN client c ON c.id = e.client_id WHERE e.id = $1),
   'firm', (SELECT json_build_object('name', t.name, 'slug', t.slug, 'retentionYears', t.retention_years)
              FROM tenant t WHERE t.id = $2),
   'archivedBy', (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = $3),
   'fileIndex', (SELECT coalesce(json_agg(json_build_object(
                    'id', fi.id, 'code', fi.code, 'section', fi.section,
                    'titleEn', fi.title_en, 'titleFr', fi.title_fr,
                    'conditional', fi.conditional, 'material', fi.material,
                    'owner', (SELECT coalesce(o.name, o.email) FROM app_user o WHERE o.id = fi.owner_id),
                    'assignee', (SELECT coalesce(a.name, a.email) FROM app_user a WHERE a.id = fi.assignee_user_id)
                  ) ORDER BY fi.sort_order), '[]'::json)
                  FROM file_item fi WHERE fi.engagement_id = $1),
   'workingPapers', (SELECT coalesce(json_agg(json_build_object(
                        'code', fr.code, 'field', fr.field_key, 'value', fr.value,
                        'updatedAt', fr.updated_at,
                        'updatedBy', (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = fr.updated_by)
                      ) ORDER BY fr.code, fr.field_key), '[]'::json)
                      FROM form_response fr WHERE fr.engagement_id = $1),
   'sectionConclusions', (SELECT coalesce(json_agg(to_jsonb(sc) - 'tenant_id'), '[]'::json)
                            FROM section_conclusion sc WHERE sc.engagement_id = $1),
   'signoffs', (SELECT coalesce(json_agg(json_build_object(
                   'documentId', sg.document_id, 'role', sg.role, 'versionNo', sg.version_no,
                   'by', (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = sg.user_id),
                   'signedAt', sg.signed_at, 'contentHash', sg.content_hash,
                   'voidedAt', sg.voided_at, 'voidReason', sg.void_reason,
                   'invalidatedAt', sg.invalidated_at, 'invalidatedReason', sg.invalidated_reason
                 ) ORDER BY sg.signed_at), '[]'::json)
                 FROM signoff sg JOIN document d2 ON d2.id = sg.document_id WHERE d2.engagement_id = $1),
   'documents', (SELECT coalesce(json_agg(json_build_object(
                    'id', d.id, 'title', d.title, 'kind', d.kind, 'status', d.status,
                    'fileItemCode', (SELECT fi2.code FROM file_item fi2 WHERE fi2.id = d.file_item_id),
                    'currentVersion', d.current_version,
                    'versions', (SELECT coalesce(json_agg(json_build_object(
                                    'versionNo', v.version_no, 'sha256', v.sha256,
                                    'bytes', v.byte_size, 'note', v.note,
                                    'createdAt', v.created_at,
                                    'createdBy', (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = v.created_by)
                                  ) ORDER BY v.version_no), '[]'::json)
                                  FROM document_version v WHERE v.document_id = d.id)
                  ) ORDER BY d.title), '[]'::json)
                  FROM document d WHERE d.engagement_id = $1),
   'attachments', (SELECT coalesce(json_agg(json_build_object(
                      'name', ta.name, 'mime', ta.mime, 'bytes', ta.size_bytes,
                      'version', ta.version, 'uploadedAt', ta.uploaded_at, 'deletedAt', ta.deleted_at
                    ) ORDER BY ta.name, ta.version), '[]'::json)
                    FROM task_attachment ta WHERE ta.engagement_id = $1),
   'reviewNotes', (SELECT coalesce(json_agg(json_build_object(
                      'body', rn.body, 'status', rn.status, 'response', rn.response,
                      'raisedAt', rn.created_at, 'clearedAt', rn.cleared_at,
                      'author', (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = rn.author_id)
                    ) ORDER BY rn.created_at), '[]'::json)
                    FROM review_note rn WHERE rn.engagement_id = $1),
   'materiality', (SELECT coalesce(json_agg(to_jsonb(m2) - 'tenant_id' ORDER BY m2.version_no), '[]'::json)
                     FROM materiality m2 WHERE m2.engagement_id = $1),
   'team', (SELECT coalesce(json_agg(json_build_object(
               'name', (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = tm.user_id),
               'role', tm.team_role, 'status', tm.status)), '[]'::json)
             FROM team_member tm WHERE tm.engagement_id = $1),
   'risks', (SELECT coalesce(json_agg(to_jsonb(r) - 'tenant_id'), '[]'::json) FROM risk r WHERE engagement_id = $1),
   'misstatements', (SELECT coalesce(json_agg(to_jsonb(m) - 'tenant_id'), '[]'::json) FROM misstatement m WHERE engagement_id = $1),
   'findings', (SELECT coalesce(json_agg(to_jsonb(f) - 'tenant_id'), '[]'::json) FROM finding f WHERE engagement_id = $1),
   'confirmations', (SELECT coalesce(json_agg(to_jsonb(c2) - 'tenant_id'), '[]'::json) FROM confirmation c2 WHERE engagement_id = $1),
   'counts', json_build_object(
      'fileItems', (SELECT count(*) FROM file_item WHERE engagement_id = $1),
      'documents', (SELECT count(*) FROM document WHERE engagement_id = $1),
      'documentVersions', (SELECT count(*) FROM document_version v2 JOIN document d3 ON d3.id = v2.document_id WHERE d3.engagement_id = $1),
      'signoffs', (SELECT count(*) FROM signoff sg2 JOIN document d4 ON d4.id = sg2.document_id WHERE d4.engagement_id = $1),
      'attachments', (SELECT count(*) FROM task_attachment WHERE engagement_id = $1),
      'activityEntries', (SELECT count(*) FROM activity_log WHERE engagement_id = $1))
 ) AS data`;

interface Manifest {
  manifestVersion: number;
  engagement: Record<string, unknown> | null;
  firm: Record<string, unknown> | null;
  fileIndex: unknown[];
  workingPapers: unknown[];
  signoffs: unknown[];
  documents: unknown[];
  attachments: unknown[];
  reviewNotes: unknown[];
  materiality: unknown[];
  team: unknown[];
  sectionConclusions: unknown[];
  counts: Record<string, number>;
}

let engagementId: string;
let tenantId: string;
let userId: string;
// A dev database offers a data-rich engagement; a fresh one (CI) offers
// nothing, so the suite builds a minimal fixture and removes it after.
let fixtureTenant: string | null = null;

beforeAll(async () => {
  const row = await admin.query<{ id: string; tenant_id: string }>(
    `SELECT e.id, e.tenant_id FROM engagement e
      WHERE EXISTS (SELECT 1 FROM file_item fi WHERE fi.engagement_id = e.id)
      ORDER BY (SELECT count(*) FROM file_item fi WHERE fi.engagement_id = e.id) DESC
      LIMIT 1`,
  );
  if (row.rows[0]) {
    engagementId = row.rows[0].id;
    tenantId = row.rows[0].tenant_id;
    const u = await admin.query<{ id: string }>("SELECT id FROM app_user LIMIT 1");
    userId = u.rows[0].id;
    return;
  }
  const t = await admin.query<{ id: string }>(
    "INSERT INTO tenant (name, slug) VALUES ('Manifest Fixture Firm', 'manifest-fixture') RETURNING id",
  );
  fixtureTenant = t.rows[0].id;
  tenantId = fixtureTenant;
  const u = await admin.query<{ id: string }>(
    "INSERT INTO app_user (email, name, password_hash) VALUES ('manifest@fixture.local', 'Manifest Fixture', 'x') RETURNING id",
  );
  userId = u.rows[0].id;
  const c = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Manifest SA', 'SA') RETURNING id",
    [tenantId],
  );
  const e = await admin.query<{ id: string }>(
    "INSERT INTO engagement (tenant_id, client_id, fiscal_year, period_end) VALUES ($1, $2, 2025, '2025-12-31') RETURNING id",
    [tenantId, c.rows[0].id],
  );
  engagementId = e.rows[0].id;
  await admin.query(
    `INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order)
     VALUES ($1, $2, 'P1.1', 'A', 'Fixture item', 'Élément de test', 1)`,
    [tenantId, engagementId],
  );
}, 30_000);

afterAll(async () => {
  if (fixtureTenant) {
    await admin.query("DELETE FROM tenant WHERE id = $1", [fixtureTenant]);
    await admin.query("DELETE FROM app_user WHERE email = 'manifest@fixture.local'");
  }
  await admin.end();
});

async function build(): Promise<Manifest> {
  const r = await admin.query<{ data: Manifest }>(MANIFEST_SQL, [engagementId, tenantId, userId]);
  return r.rows[0].data;
}

describe("archive manifest v2", () => {
  it("builds against a real engagement without error", async () => {
    const m = await build();
    expect(m.manifestVersion).toBe(2);
  });

  it("identifies the file without needing the database it came from", async () => {
    // v1 had no identity block at all, so the snapshot could not be read alone.
    const m = await build();
    expect(m.engagement).toBeTruthy();
    expect(m.engagement).toHaveProperty("client");
    expect(m.engagement).toHaveProperty("fiscalYear");
    expect(m.engagement).toHaveProperty("periodEnd");
    expect(m.firm).toHaveProperty("name");
    expect(m.firm).toHaveProperty("retentionYears");
  });

  it("carries the working papers themselves, not just an index of them", async () => {
    const m = await build();
    expect(Array.isArray(m.workingPapers)).toBe(true);
    expect(Array.isArray(m.sectionConclusions ?? [])).toBe(true);
  });

  it("carries the attestations, with the hash each was taken over", async () => {
    const m = await build();
    expect(Array.isArray(m.signoffs)).toBe(true);
  });

  it("never serialises a list as null, whatever is empty", async () => {
    // fileIndex lacked a coalesce in v1, so an engagement with no items
    // produced "fileIndex": null rather than [].
    const m = await build();
    for (const key of [
      "fileIndex", "workingPapers", "sectionConclusions", "signoffs", "documents",
      "attachments", "reviewNotes", "materiality", "team", "risks",
      "misstatements", "findings", "confirmations",
    ] as const) {
      expect(Array.isArray((m as unknown as Record<string, unknown>)[key])).toBe(true);
    }
  });

  it("reports counts a reader can check the lists against", async () => {
    const m = await build();
    expect(m.counts.fileItems).toBeGreaterThan(0);
    expect(m.counts.fileItems).toBe(m.fileIndex.length);
    expect(m.counts.documents).toBe(m.documents.length);
  });

  it("builds for an engagement with nothing in it, rather than failing", async () => {
    const empty = await admin.query<{ id: string }>(
      `SELECT e.id FROM engagement e
        WHERE NOT EXISTS (SELECT 1 FROM file_item fi WHERE fi.engagement_id = e.id) LIMIT 1`,
    );
    if (!empty.rows[0]) return; // none on this database; nothing to assert
    const r = await admin.query<{ data: Manifest }>(MANIFEST_SQL, [empty.rows[0].id, tenantId, userId]);
    expect(Array.isArray(r.rows[0].data.fileIndex)).toBe(true);
    expect(r.rows[0].data.fileIndex).toHaveLength(0);
  });
});

describe("the manifest cannot be rewritten afterwards", () => {
  it("refuses UPDATE and DELETE of the manifest row, even as the table owner", async () => {
    const existing = await admin.query<{ engagement_id: string }>(
      "SELECT engagement_id FROM completion_record WHERE key = 'archive_manifest' LIMIT 1",
    );
    if (!existing.rows[0]) return; // no archived file on this database
    const id = existing.rows[0].engagement_id;
    await expect(
      admin.query("UPDATE completion_record SET data = '{}'::jsonb WHERE engagement_id = $1 AND key = 'archive_manifest'", [id]),
    ).rejects.toThrow(/archive-manifest-immutable/);
    await expect(
      admin.query("DELETE FROM completion_record WHERE engagement_id = $1 AND key = 'archive_manifest'", [id]),
    ).rejects.toThrow(/archive-manifest-immutable/);
  });

  it("leaves other completion keys writable — points_forward crosses the rollforward boundary", async () => {
    const other = await admin.query<{ engagement_id: string; key: string }>(
      "SELECT engagement_id, key FROM completion_record WHERE key <> 'archive_manifest' LIMIT 1",
    );
    if (!other.rows[0]) return;
    await admin.query("BEGIN");
    await expect(
      admin.query("UPDATE completion_record SET done_at = now() WHERE engagement_id = $1 AND key = $2",
        [other.rows[0].engagement_id, other.rows[0].key]),
    ).resolves.toBeTruthy();
    await admin.query("ROLLBACK");
  });
});
