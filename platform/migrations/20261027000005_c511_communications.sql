-- F025 (firm decision 2026-10-27): the communications task leaves C5.1.
--
-- C5.1 was titled "Communications — Governance & Management (ISA 260/265)"
-- while its working paper (lib/papers/conclusion.ts) recorded the opinion and
-- the auditor's report. The firm split the two: C5.1 keeps the paper and is
-- retitled "Opinion and auditor's report (ISA 700–706)"; a new core task
-- C5.11 "Communications with those charged with governance and management
-- (ISA 260/265)" takes the ISA 260 letters (planning communication, completion
-- report to governance, management letter) and the ISA 265 findings, and
-- carries the deficiency evaluation grid (20261027000006).
--
-- On every non-archived engagement this
--   1. retitles C5.1 (display only; the code and its paper are unchanged);
--   2. inserts C5.11 just after C5.1, not conditional, with no work on it yet
--      (file_item carries no status column: a task with no paper, answer or
--      sign-off reads as not started);
--   3. moves the letters (document.kind = 'letter') filed under C5.1 to C5.11
--      — the C5.1 working paper itself stays where it is;
--   4. moves the ISA 265 findings (finding.route = 'c1') whose file item is
--      C5.1 to C5.11 — findings raised from an account paper keep that paper
--      as their origin, as before;
--   5. writes one activity_log row per engagement naming the move.
-- Archived files are left as they were signed (the archive guard would refuse
-- the writes anyway); generateLetter falls back to C5.1 on them.

-- Up Migration

CREATE TEMP TABLE c511_move ON COMMIT DROP AS
SELECT e.id AS engagement_id, e.tenant_id, c51.id AS c51_id, c51.sort_order,
       NULL::uuid AS c511_id, 0 AS letters, 0 AS findings
  FROM engagement e
  JOIN file_item c51 ON c51.engagement_id = e.id AND c51.code = 'C5.1'
 WHERE e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM file_item x WHERE x.engagement_id = e.id AND x.code = 'C5.11');

-- 1. C5.1 is the report.
UPDATE file_item fi
   SET title_en = 'Opinion and auditor''s report (ISA 700–706)',
       title_fr = 'Opinion et rapport d''audit (ISA 700 à 706)'
  FROM engagement e
 WHERE e.id = fi.engagement_id AND e.archived_at IS NULL AND fi.code = 'C5.1';

-- 2. C5.11 next to it.
INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT tenant_id, engagement_id, 'C5.11', 'C',
       'Communications with those charged with governance and management (ISA 260/265)',
       'Communications avec la gouvernance et la direction (ISA 260/265)',
       sort_order + 1, false
  FROM c511_move;

UPDATE c511_move m
   SET c511_id = (SELECT id FROM file_item WHERE engagement_id = m.engagement_id AND code = 'C5.11'),
       letters = (SELECT count(*) FROM document d WHERE d.file_item_id = m.c51_id AND d.kind = 'letter'),
       findings = (SELECT count(*) FROM finding f WHERE f.file_item_id = m.c51_id AND f.route = 'c1');

-- 3. The letters follow the task.
UPDATE document d
   SET file_item_id = m.c511_id
  FROM c511_move m
 WHERE d.file_item_id = m.c51_id AND d.kind = 'letter';

-- 4. So do the ISA 265 findings raised on C5.1 itself.
UPDATE finding f
   SET file_item_id = m.c511_id
  FROM c511_move m
 WHERE f.file_item_id = m.c51_id AND f.route = 'c1';

-- 5. The trail names the move on every file touched.
INSERT INTO activity_log (tenant_id, engagement_id, entity_type, entity_id, action, summary, meta)
SELECT tenant_id, engagement_id, 'file_item', c511_id, 'task_recoded',
       format('C5.11 Communications (ISA 260/265) created next to C5.1, retitled Opinion and auditor''s report (ISA 700–706): %s letter(s) and %s finding(s) moved from C5.1 to C5.11',
              letters, findings),
       jsonb_build_object('from', 'C5.1', 'to', 'C5.11', 'letters', letters, 'findings', findings)
  FROM c511_move;

-- Down Migration

-- The letters and findings return to C5.1; a C5.11 row is removed only when
-- nothing hangs off it (a document, an answer, a note, an attachment, a time
-- entry or a sign-off would be deleted with it), and the C5.1 titles return.
UPDATE document d
   SET file_item_id = c51.id
  FROM file_item c511
  JOIN file_item c51 ON c51.engagement_id = c511.engagement_id AND c51.code = 'C5.1'
 WHERE c511.code = 'C5.11' AND d.file_item_id = c511.id AND d.kind = 'letter';

UPDATE finding f
   SET file_item_id = c51.id
  FROM file_item c511
  JOIN file_item c51 ON c51.engagement_id = c511.engagement_id AND c51.code = 'C5.1'
 WHERE c511.code = 'C5.11' AND f.file_item_id = c511.id AND f.route = 'c1';

DELETE FROM file_item fi
 WHERE fi.code = 'C5.11'
   AND NOT EXISTS (SELECT 1 FROM document d WHERE d.file_item_id = fi.id)
   AND NOT EXISTS (SELECT 1 FROM finding f WHERE f.file_item_id = fi.id)
   AND NOT EXISTS (SELECT 1 FROM review_note rn WHERE rn.file_item_id = fi.id)
   AND NOT EXISTS (SELECT 1 FROM task_attachment ta WHERE ta.file_item_id = fi.id)
   AND NOT EXISTS (SELECT 1 FROM form_response fr WHERE fr.engagement_id = fi.engagement_id AND fr.code = 'wp:C5.11');

UPDATE file_item fi
   SET title_en = 'Communications — Governance & Management (ISA 260/265)',
       title_fr = 'Communications — gouvernance & direction (ISA 260/265)'
  FROM engagement e
 WHERE e.id = fi.engagement_id AND e.archived_at IS NULL AND fi.code = 'C5.1';
