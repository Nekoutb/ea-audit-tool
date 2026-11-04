-- Firm decisions of 2026-10-27, OHADA batch:
--
-- F047  E4.36 (cash flow statement — TFT — tie-out) is a core paper: the TFT is
--       one of the four SYSCOHADA statements and its concordance is required
--       whatever the entity's size. lib/file-index.ts now tiers it core; this
--       adds it to every non-archived engagement that lacks it, anchored after
--       E4.35 where that paper exists, else just before E6.8 (core), else at
--       the end of the index, and writes one activity_log 'task_added' row
--       per file so the trail says where the task came from.
--
-- F052  C5.7 (register of registered securities) exists only for the forms
--       that issue titres nominatifs. New SARL and GIE files no longer
--       instantiate it (lib/legal-forms.ts taskAppliesToForm); on existing
--       files the row is marked conditional rather than deleted — a document,
--       an answer or a sign-off may hang off it — and the trail records the
--       change. Archived files are left as they were signed.

-- Up Migration

-- F047: E4.36 on every open file that lacks it.
CREATE TEMP TABLE e436_add ON COMMIT DROP AS
SELECT e.id AS engagement_id, e.tenant_id,
       coalesce(
         (SELECT fi.sort_order + 1 FROM file_item fi WHERE fi.engagement_id = e.id AND fi.code = 'E4.35'),
         (SELECT fi.sort_order - 1 FROM file_item fi WHERE fi.engagement_id = e.id AND fi.code = 'E6.8'),
         (SELECT coalesce(max(fi.sort_order), 0) + 10 FROM file_item fi WHERE fi.engagement_id = e.id)
       ) AS sort_order
  FROM engagement e
 WHERE e.archived_at IS NULL
   -- a file not yet scoped (nature-of-entity screen pending) has no index to join
   AND EXISTS (SELECT 1 FROM file_item fi WHERE fi.engagement_id = e.id)
   AND NOT EXISTS (SELECT 1 FROM file_item x WHERE x.engagement_id = e.id AND x.code = 'E4.36');

INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT tenant_id, engagement_id, 'E4.36', 'E', 'Cash Flow (TFT) Tie-out', 'Concordance du TFT', sort_order, false
  FROM e436_add a;

INSERT INTO activity_log (tenant_id, engagement_id, entity_type, entity_id, action, summary, meta)
SELECT a.tenant_id, a.engagement_id, 'file_item',
       (SELECT id FROM file_item WHERE engagement_id = a.engagement_id AND code = 'E4.36'),
       'task_added',
       'E4.36 Cash Flow (TFT) Tie-out added: core paper on every file (F047, firm decision 2026-10-27)',
       jsonb_build_object('code', 'E4.36', 'migration', '20261104000002', 'reason', 'F047')
  FROM e436_add a;

-- F052: C5.7 conditional on the forms without titres nominatifs.
CREATE TEMP TABLE c57_cond ON COMMIT DROP AS
SELECT fi.id AS file_item_id, fi.tenant_id, fi.engagement_id, c.legal_form
  FROM file_item fi
  JOIN engagement e ON e.id = fi.engagement_id
  JOIN client c ON c.id = e.client_id
 WHERE fi.code = 'C5.7'
   AND fi.conditional = false
   AND e.archived_at IS NULL
   AND c.legal_form IN ('SARL', 'GIE');

UPDATE file_item fi SET conditional = true
  FROM c57_cond m WHERE fi.id = m.file_item_id;

INSERT INTO activity_log (tenant_id, engagement_id, entity_type, entity_id, action, summary, meta)
SELECT tenant_id, engagement_id, 'file_item', file_item_id, 'task_made_conditional',
       format('C5.7 Registered Securities Register Attestation marked conditional: a %s issues no titres nominatifs (F052, firm decision 2026-10-27)', legal_form),
       jsonb_build_object('code', 'C5.7', 'migration', '20261104000002', 'reason', 'F052', 'legalForm', legal_form)
  FROM c57_cond;

-- Down Migration

-- C5.7 returns to an ordinary task on the files this migration touched.
UPDATE file_item fi SET conditional = false
  FROM activity_log al
 WHERE al.entity_id = fi.id AND al.action = 'task_made_conditional'
   AND al.meta->>'migration' = '20261104000002';

-- An E4.36 row this migration added is removed only when nothing hangs off it
-- (a document, an answer, a note, an attachment or a time entry would go with it).
DELETE FROM file_item fi
 WHERE fi.code = 'E4.36'
   AND EXISTS (SELECT 1 FROM activity_log al
                WHERE al.entity_id = fi.id AND al.action = 'task_added' AND al.meta->>'migration' = '20261104000002')
   AND NOT EXISTS (SELECT 1 FROM document d WHERE d.file_item_id = fi.id)
   AND NOT EXISTS (SELECT 1 FROM review_note rn WHERE rn.file_item_id = fi.id)
   AND NOT EXISTS (SELECT 1 FROM task_attachment ta WHERE ta.file_item_id = fi.id)
   AND NOT EXISTS (SELECT 1 FROM time_entry te WHERE te.file_item_id = fi.id)
   AND NOT EXISTS (SELECT 1 FROM section_conclusion sc WHERE sc.file_item_id = fi.id)
   AND NOT EXISTS (SELECT 1 FROM form_response fr WHERE fr.engagement_id = fi.engagement_id AND fr.code = 'wp:E4.36');
