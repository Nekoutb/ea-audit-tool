-- Specific risk areas leave the CRA group (methodology alignment): the CRA
-- (S3.1) stands alone; commitments & contingencies, going concern, related
-- parties and estimates become S4.x "Specific Risk Areas"; using the work of
-- others moves to S5.x; the strategy memorandum to S6.x. Same single-pass
-- mapping applied to source literals by the codemod.
-- Two-phase (via a ~ prefix) because old and new code sets OVERLAP (S4.1 is
-- both a source and a target): a one-step UPDATE could transiently collide
-- with UNIQUE(engagement_id, code).

-- Up Migration

CREATE TEMPORARY TABLE s3_code_map (old_code text PRIMARY KEY, new_code text NOT NULL);
INSERT INTO s3_code_map (old_code, new_code) VALUES
  ('S3.2', 'S4.1'), ('S3.3', 'S4.2'), ('S3.4', 'S4.3'), ('S3.5', 'S4.4'),
  ('S4.1', 'S5.1'), ('S4.2', 'S5.2'), ('S4.3', 'S5.3'),
  ('S5.1', 'S6.1'), ('S5.2', 'S6.2');

UPDATE file_item fi SET code = '~' || m.new_code FROM s3_code_map m WHERE fi.code = m.old_code;
UPDATE file_item SET code = substr(code, 2) WHERE code LIKE '~S%';

UPDATE form_response fr SET code = '~wp:' || m.new_code FROM s3_code_map m WHERE fr.code = 'wp:' || m.old_code;
UPDATE form_response SET code = substr(code, 2) WHERE code LIKE '~wp:S%';

UPDATE form_response fr SET code = '~' || m.new_code FROM s3_code_map m WHERE fr.code = m.old_code;
UPDATE form_response SET code = substr(code, 2) WHERE code LIKE '~S%';

UPDATE potential_risk pr SET source_code = '~' || m.new_code FROM s3_code_map m WHERE pr.source_code = m.old_code;
UPDATE potential_risk SET source_code = substr(source_code, 2) WHERE source_code LIKE '~S%';

DROP TABLE s3_code_map;

-- Down Migration

CREATE TEMPORARY TABLE s3_code_unmap (old_code text PRIMARY KEY, new_code text NOT NULL);
INSERT INTO s3_code_unmap (old_code, new_code) VALUES
  ('S6.2', 'S5.2'), ('S6.1', 'S5.1'),
  ('S5.3', 'S4.3'), ('S5.2', 'S4.2'), ('S5.1', 'S4.1'),
  ('S4.4', 'S3.5'), ('S4.3', 'S3.4'), ('S4.2', 'S3.3'), ('S4.1', 'S3.2');

UPDATE file_item fi SET code = '~' || m.new_code FROM s3_code_unmap m WHERE fi.code = m.old_code;
UPDATE file_item SET code = substr(code, 2) WHERE code LIKE '~S%';
UPDATE form_response fr SET code = '~wp:' || m.new_code FROM s3_code_unmap m WHERE fr.code = 'wp:' || m.old_code;
UPDATE form_response SET code = substr(code, 2) WHERE code LIKE '~wp:S%';
UPDATE form_response fr SET code = '~' || m.new_code FROM s3_code_unmap m WHERE fr.code = m.old_code;
UPDATE form_response SET code = substr(code, 2) WHERE code LIKE '~S%';
UPDATE potential_risk pr SET source_code = '~' || m.new_code FROM s3_code_unmap m WHERE pr.source_code = m.old_code;
UPDATE potential_risk SET source_code = substr(source_code, 2) WHERE source_code LIKE '~S%';

DROP TABLE s3_code_unmap;
