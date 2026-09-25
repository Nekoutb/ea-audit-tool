-- E3.1 (journal-entry testing, ISA 240 ¶32) and E4.20 (revenue) become core
-- file-index items, so they exist on very simple engagements too.
--
-- The two presumed ISA 240 risks are seeded on every engagement and linked to
-- these two papers (lib/risks.ts seedPresumedRisks). On a very simple file
-- neither paper was instantiated, so the management-override risk — which is
-- significant and cannot be rebutted — had no program step to be linked to,
-- and the planning gate "every significant risk linked" could never pass.
-- lib/file-index.ts now lists both codes as core; this carries the same thing
-- onto the very simple engagements that already exist: the two papers, the
-- risk_section links, the mandatory ISA 240 ¶32 step on E3.1 and the
-- risk_response that answers the override risk with it.
--
-- The step wording must stay identical to MGMT_OVERRIDE_PROCEDURE in
-- lib/risks.ts (and 20260909000004): that is how a re-run knows it is there.
--
-- Archived engagements are left alone: file_item, program_step and
-- risk_response carry the archive immutability trigger and a write against a
-- closed file would raise 'engagement-archived' and take the migration down.

-- Up Migration

-- 1. E3.1, anchored just before E6.4 (core, so present on every file that has
--    any tasks at all), matching its position in DEFAULT_FILE_INDEX.
INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT fi.tenant_id, fi.engagement_id, 'E3.1', 'E',
       'Tests of Journal Entries & Mandatory Fraud Procedures (ISA 240)',
       'Tests des écritures comptables et procédures obligatoires de fraude (ISA 240)',
       fi.sort_order - 1, false
  FROM file_item fi
  JOIN engagement e ON e.id = fi.engagement_id
 WHERE fi.code = 'E6.4'
   AND e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM file_item x WHERE x.engagement_id = fi.engagement_id AND x.code = 'E3.1');

-- 2. E4.20 (revenue), anchored just after E4.9 (core).
INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT fi.tenant_id, fi.engagement_id, 'E4.20', 'E',
       'Revenue (UA)', 'Chiffre d''affaires (UA)',
       fi.sort_order + 1, false
  FROM file_item fi
  JOIN engagement e ON e.id = fi.engagement_id
 WHERE fi.code = 'E4.9'
   AND e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM file_item x WHERE x.engagement_id = fi.engagement_id AND x.code = 'E4.20');

-- 3. The presumed risks point at their papers.
INSERT INTO risk_section (tenant_id, risk_id, file_item_id, assertions)
SELECT r.tenant_id, r.id, fi.id, ARRAY['C', 'E', 'A']
  FROM risk r
  JOIN engagement e ON e.id = r.engagement_id
  JOIN file_item fi ON fi.engagement_id = r.engagement_id AND fi.code = 'E3.1'
 WHERE r.presumed_type = 'mgmt_override'
   AND e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM risk_section rs WHERE rs.risk_id = r.id AND rs.file_item_id = fi.id);

INSERT INTO risk_section (tenant_id, risk_id, file_item_id, assertions)
SELECT r.tenant_id, r.id, fi.id, ARRAY['E', 'A']
  FROM risk r
  JOIN engagement e ON e.id = r.engagement_id
  JOIN file_item fi ON fi.engagement_id = r.engagement_id AND fi.code = 'E4.20'
 WHERE r.presumed_type = 'revenue_fraud'
   AND e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM risk_section rs WHERE rs.risk_id = r.id AND rs.file_item_id = fi.id);

-- 4. The mandatory ISA 240 ¶32 step on E3.1 where the override risk has no
--    response yet (same statement as 20260909000004, re-run for the files that
--    only now have an E3.1).
INSERT INTO program_step (tenant_id, engagement_id, file_item_id, seq, description, assertions, source)
SELECT r.tenant_id, r.engagement_id, fi.id,
       coalesce((SELECT max(ps.seq) FROM program_step ps WHERE ps.file_item_id = fi.id), 0) + 10,
       'Test the appropriateness of journal entries and other adjustments made in the preparation of the financial statements, review accounting estimates for bias, and evaluate the business rationale of significant unusual transactions (ISA 240 ¶32).',
       ARRAY['C', 'E', 'A'],
       'risk_extension'
  FROM risk r
  JOIN engagement e ON e.id = r.engagement_id
  JOIN file_item fi ON fi.engagement_id = r.engagement_id AND fi.code = 'E3.1'
 WHERE r.presumed_type = 'mgmt_override'
   AND e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM risk_response rr WHERE rr.risk_id = r.id)
   AND NOT EXISTS (
     SELECT 1 FROM program_step ps
      WHERE ps.file_item_id = fi.id
        AND ps.source = 'risk_extension'
        AND ps.description LIKE 'Test the appropriateness of journal entries and other adjustments%'
   );

INSERT INTO risk_response (tenant_id, risk_id, program_step_id)
SELECT r.tenant_id, r.id, ps.id
  FROM risk r
  JOIN engagement e ON e.id = r.engagement_id
  JOIN file_item fi ON fi.engagement_id = r.engagement_id AND fi.code = 'E3.1'
  JOIN program_step ps ON ps.file_item_id = fi.id
                      AND ps.source = 'risk_extension'
                      AND ps.description LIKE 'Test the appropriateness of journal entries and other adjustments%'
 WHERE r.presumed_type = 'mgmt_override'
   AND e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM risk_response rr WHERE rr.risk_id = r.id)
ON CONFLICT DO NOTHING;

UPDATE risk r
   SET status = 'response_planned'
  FROM engagement e
 WHERE e.id = r.engagement_id
   AND r.presumed_type = 'mgmt_override'
   AND r.status = 'identified'
   AND e.archived_at IS NULL
   AND EXISTS (SELECT 1 FROM risk_response rr WHERE rr.risk_id = r.id);

-- Down Migration

-- Deliberately a no-op: by now a document, sign-off, attachment or time entry
-- may hang off the two papers, and the step may have been completed.
SELECT 1;
