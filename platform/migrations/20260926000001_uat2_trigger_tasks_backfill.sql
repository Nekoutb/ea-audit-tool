-- Tasks that follow from a fact rather than from the complexity tier (UAT
-- run 2 B13, B19, B20). lib/ensure-task.ts now inserts them when the fact is
-- recorded; this carries the same onto the engagements that already exist:
--
--  1. P1.2 (predecessor auditor) on initial audits — first_year, the
--     "first audit" nature answer, or P1.1 concluding a new engagement. A very
--     simple file had no P1.2 row at all, so activating it was a no-op.
--  2. C4.2 (engagement quality review) wherever an EQR is required — P1.5
--     q_eqr = yes, or a quality reviewer on the team. The completion gate
--     eqr_complete demands a signed C4.2 there, and simple files had none.
--  3. The E4 paper of every account designed in S5.5 (a library selection or
--     a custom procedure). E4.6/E4.7/E4.12/E4.13 are left out of non-complex
--     files, so their designed procedures had nowhere to run.
--
-- Each task is slotted just after its predecessor in the default index where
-- the file holds it, otherwise at the end. Archived engagements are left
-- alone: file_item carries the archive immutability trigger.

-- Up Migration

-- 1. P1.2 — insert where missing, activate where it sits as a conditional.
INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT e.tenant_id, e.id, 'P1.2', 'D',
       'Predecessor Auditor Communication (ISA 300 / IESBA §320)',
       'Communication avec l''auditeur précédent (ISA 300 / IESBA §320)',
       coalesce((SELECT fi.sort_order FROM file_item fi WHERE fi.engagement_id = e.id AND fi.code = 'P1.3'),
                (SELECT max(fi.sort_order) FROM file_item fi WHERE fi.engagement_id = e.id), 0) + 1,
       false
  FROM engagement e
 WHERE e.archived_at IS NULL
   AND EXISTS (SELECT 1 FROM file_item x WHERE x.engagement_id = e.id)
   AND (coalesce(e.first_year, false)
        OR coalesce(e.complexity_answers ->> 'firstAudit', 'false') = 'true'
        OR EXISTS (SELECT 1 FROM form_response fr
                    WHERE fr.engagement_id = e.id AND fr.code = 'P1.1'
                      AND fr.field_key = 'engagement_type' AND fr.value #>> '{}' = 'new'))
ON CONFLICT (engagement_id, code) DO UPDATE SET conditional = false
 WHERE file_item.conditional;

-- 2. C4.2 where an engagement quality review is required.
INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT e.tenant_id, e.id, 'C4.2', 'B',
       'Engagement Quality Review', 'Revue de qualité de la mission',
       coalesce((SELECT fi.sort_order FROM file_item fi WHERE fi.engagement_id = e.id AND fi.code = 'C4.1'),
                (SELECT max(fi.sort_order) FROM file_item fi WHERE fi.engagement_id = e.id), 0) + 1,
       false
  FROM engagement e
 WHERE e.archived_at IS NULL
   AND EXISTS (SELECT 1 FROM file_item x WHERE x.engagement_id = e.id)
   AND (EXISTS (SELECT 1 FROM team_member tm WHERE tm.engagement_id = e.id AND tm.team_role = 'eqr_reviewer')
        OR EXISTS (SELECT 1 FROM form_response fr
                    WHERE fr.engagement_id = e.id AND fr.code = 'wp:P1.5'
                      AND fr.field_key = 'q_eqr' AND btrim(fr.value #>> '{}') = 'yes'))
ON CONFLICT (engagement_id, code) DO NOTHING;

-- 3. The E4 papers of designed accounts that the tier left out.
INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT e.tenant_id, e.id, t.code, 'E', t.en, t.fr,
       coalesce((SELECT fi.sort_order FROM file_item fi WHERE fi.engagement_id = e.id AND fi.code = t.after),
                (SELECT max(fi.sort_order) FROM file_item fi WHERE fi.engagement_id = e.id), 0) + 1,
       false
  FROM engagement e
  CROSS JOIN (VALUES
    ('J',  'E4.6',  'E4.5',  'Financial Assets (J)',                      'Actifs financiers (J)'),
    ('C',  'E4.7',  'E4.6',  'Cash & Cash Equivalents (C)',               'Trésorerie (C)'),
    ('P3', 'E4.12', 'E4.11', 'Suspense & Deferred Income (P3)',           'Comptes d''attente et PCA (P3)'),
    ('P4', 'E4.13', 'E4.12', 'Translation Difference — Liabilities (P4)', 'Écarts de conversion — passif (P4)')
  ) AS t(idx, code, after, en, fr)
 WHERE e.archived_at IS NULL
   AND EXISTS (SELECT 1 FROM file_item x WHERE x.engagement_id = e.id)
   AND EXISTS (SELECT 1 FROM form_response fr
                WHERE fr.engagement_id = e.id AND fr.code = 'dsp'
                  AND ((fr.field_key LIKE t.idx || '\_sel\_%' AND (fr.value #>> '{}') ~ '^\s*\[\s*\d')
                    OR (fr.field_key = t.idx || '_osp_list' AND (fr.value #>> '{}') ~ '^\s*\[\s*\{')))
ON CONFLICT (engagement_id, code) DO NOTHING;

-- Down Migration

-- Deliberately a no-op: by now a document, sign-off or attachment may hang
-- off the inserted tasks.
SELECT 1;
