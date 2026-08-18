-- Phase amendments: Controls & IT gains the ITGC tasks (S2.3-S2.5); Design
-- Audit Procedures gains the design tasks (S5.4-S5.6); execution regroups —
-- E1.3 (post-interim updates) becomes E2.1 "Updates to Controls" and the JE
-- testing task E2.1 becomes E3.1. Overlapping map → two-phase (~ prefix).

-- Up Migration

-- 1. recode E1.3→E2.1 and E2.1→E3.1 simultaneously
CREATE TEMPORARY TABLE e_code_map (old_code text PRIMARY KEY, new_code text NOT NULL);
INSERT INTO e_code_map (old_code, new_code) VALUES ('E1.3', 'E2.1'), ('E2.1', 'E3.1');

UPDATE file_item fi SET code = '~' || m.new_code FROM e_code_map m WHERE fi.code = m.old_code;
UPDATE file_item SET code = substr(code, 2) WHERE code LIKE '~E%';

UPDATE form_response fr SET code = '~wp:' || m.new_code FROM e_code_map m WHERE fr.code = 'wp:' || m.old_code;
UPDATE form_response SET code = substr(code, 2) WHERE code LIKE '~wp:E%';

UPDATE potential_risk pr SET source_code = '~' || m.new_code FROM e_code_map m WHERE pr.source_code = m.old_code;
UPDATE potential_risk SET source_code = substr(source_code, 2) WHERE source_code LIKE '~E%';

DROP TABLE e_code_map;

-- 2. the new strategy tasks, for every engagement that has the S2/S5 groups
CREATE TEMPORARY TABLE new_s_tasks (code text PRIMARY KEY, en text NOT NULL, fr text NOT NULL, anchor text NOT NULL, off int NOT NULL);
INSERT INTO new_s_tasks (code, en, fr, anchor, off) VALUES
  ('S2.3', 'Understand ITGCs (IT General Controls)', 'Comprendre les contrôles généraux informatiques (ITGC)', 'S2.2', 1),
  ('S2.4', 'Design & Execute Tests of ITGCs', 'Concevoir et exécuter les tests des ITGC', 'S2.2', 2),
  ('S2.5', 'Evaluate ITGCs', 'Évaluer les ITGC', 'S2.2', 3),
  ('S5.4', 'Design Tests of Journal Entries and Other Mandatory Fraud Procedures', 'Concevoir les tests d''écritures et autres procédures obligatoires de fraude', 'S5.3', 1),
  ('S5.5', 'Design Substantive Procedures', 'Concevoir les procédures substantives', 'S5.3', 2),
  ('S5.6', 'Plan General Audit Procedures', 'Planifier les procédures générales d''audit', 'S5.3', 3);

INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional, material)
SELECT a.tenant_id, a.engagement_id, t.code, 'D', t.en, t.fr, a.sort_order + t.off, false, false
  FROM new_s_tasks t
  JOIN LATERAL (
    SELECT fi.tenant_id, fi.engagement_id, fi.sort_order
      FROM file_item fi WHERE fi.code = t.anchor
  ) a ON true
 WHERE NOT EXISTS (
   SELECT 1 FROM file_item x WHERE x.engagement_id = a.engagement_id AND x.code = t.code
 );

DROP TABLE new_s_tasks;

-- Down Migration

SELECT 1;
