-- Re-home PSP steps generated under the old combined E4 tasks: each step's
-- ref prefix (E-1, UA-2 …) names its index, and the step — with its saved
-- working-paper fields — moves to that index's own task.

-- Up Migration

CREATE TEMPORARY TABLE psp_moves AS
SELECT ps.id AS step_id, ps.engagement_id, fi.code AS old_code, m.new_code,
       ni.id AS new_item
  FROM program_step ps
  JOIN file_item fi ON fi.id = ps.file_item_id AND fi.code LIKE 'E4.%'
  CROSS JOIN LATERAL (SELECT (regexp_match(ps.description, '^([A-Z][A-Z0-9]{0,2})-?[0-9]+'))[1] AS pfx) p
  JOIN (VALUES
    ('E','E4.1'),('N','E4.2'),('F','E4.3'),('K','E4.4'),('L','E4.5'),('J','E4.6'),
    ('C','E4.7'),('Q','E4.8'),('T','E4.9'),('P1','E4.10'),('P2','E4.11'),('P3','E4.12'),
    ('P4','E4.13'),('O1','E4.14'),('O2','E4.15'),('I1','E4.16'),('I2','E4.17'),
    ('G2','E4.18'),('G3','E4.19'),('UA','E4.20'),('UB2','E4.21'),('UC','E4.22'),
    ('U1','E4.23'),('VA1','E4.24'),('VA2','E4.25'),('VB','E4.26'),('VO','E4.27'),
    ('VD1','E4.28'),('VD2','E4.29'),('VD3','E4.30'),('VD4','E4.31'),('VD5','E4.32'),
    ('V1','E4.33'),('O4','E4.34')
  ) m(pfx, new_code) ON m.pfx = p.pfx AND m.new_code <> fi.code
  JOIN file_item ni ON ni.engagement_id = ps.engagement_id AND ni.code = m.new_code
 WHERE ps.source = 'psp';

UPDATE program_step ps SET file_item_id = s.new_item
  FROM psp_moves s WHERE ps.id = s.step_id;

UPDATE form_response fr SET code = 'psp:' || s.new_code
  FROM psp_moves s
 WHERE fr.engagement_id = s.engagement_id
   AND fr.code = 'psp:' || s.old_code
   AND fr.field_key LIKE '%' || s.step_id;

DROP TABLE psp_moves;

-- the presumed revenue-fraud risk belongs on Revenue (E4.20), not Receivables
UPDATE risk_section rs SET file_item_id = rev.id
  FROM risk r
  JOIN file_item old ON old.code = 'E4.1'
  JOIN file_item rev ON rev.engagement_id = old.engagement_id AND rev.code = 'E4.20'
 WHERE r.id = rs.risk_id AND r.presumed_type = 'revenue_fraud'
   AND rs.file_item_id = old.id AND r.engagement_id = old.engagement_id;

-- Down Migration

SELECT 1;
