-- Papers required on every audit become core (UAT run 2 B40).
--
-- lib/file-index.ts now lists E4.7 (cash and bank), E6.1 (laws and
-- regulations, ISA 250), E6.2 and S4.3 (related parties, ISA 550) and E6.7 and
-- S4.4 (accounting estimates, ISA 540) as core, and E4.7 is no longer an
-- extended (complex-only) paper. New engagements get them from the index; this
-- carries the same thing onto the open engagements that already exist:
--   * very simple files get all six papers;
--   * non-complex files get E4.7 (they already had the other five).
-- Only files still in acceptance, planning or execution are touched — a file
-- in conclusion or archived is left as it was signed (archived rows also carry
-- the immutability trigger). Each paper is anchored next to a core neighbour
-- so it sits where DEFAULT_FILE_INDEX places it.

-- Up Migration

-- E4.7 just before E4.8 (core), on very simple and non-complex files.
INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT fi.tenant_id, fi.engagement_id, 'E4.7', 'E',
       'Cash & Cash Equivalents (C)', 'Trésorerie (C)',
       fi.sort_order - 1, false
  FROM file_item fi
  JOIN engagement e ON e.id = fi.engagement_id
 WHERE fi.code = 'E4.8'
   AND e.complexity IN ('very_simple', 'non_complex')
   AND e.phase IN ('acceptance', 'planning', 'execution')
   AND e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM file_item x WHERE x.engagement_id = fi.engagement_id AND x.code = 'E4.7');

-- S4.3 and S4.4 just after S4.2 (core), very simple files only.
INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT fi.tenant_id, fi.engagement_id, v.code, 'D', v.title_en, v.title_fr, fi.sort_order + v.off, false
  FROM file_item fi
  JOIN engagement e ON e.id = fi.engagement_id
 CROSS JOIN (VALUES
   ('S4.3', 'Related Parties (ISA 550)', 'Parties liées (ISA 550)', 1),
   ('S4.4', 'Accounting Estimates — Planning (ISA 540)', 'Estimations comptables — planification (ISA 540)', 2)
 ) AS v(code, title_en, title_fr, off)
 WHERE fi.code = 'S4.2'
   AND e.complexity = 'very_simple'
   AND e.phase IN ('acceptance', 'planning', 'execution')
   AND e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM file_item x WHERE x.engagement_id = fi.engagement_id AND x.code = v.code);

-- E6.1 and E6.2 just before E6.3 (core), very simple files only.
INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT fi.tenant_id, fi.engagement_id, v.code, 'E', v.title_en, v.title_fr, fi.sort_order - v.off, false
  FROM file_item fi
  JOIN engagement e ON e.id = fi.engagement_id
 CROSS JOIN (VALUES
   ('E6.1', 'Laws & Regulations / NOCLAR (ISA 250)', 'Textes légaux et réglementaires / NOCLAR (ISA 250)', 2),
   ('E6.2', 'Related Parties (ISA 550)', 'Parties liées (ISA 550)', 1)
 ) AS v(code, title_en, title_fr, off)
 WHERE fi.code = 'E6.3'
   AND e.complexity = 'very_simple'
   AND e.phase IN ('acceptance', 'planning', 'execution')
   AND e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM file_item x WHERE x.engagement_id = fi.engagement_id AND x.code = v.code);

-- E6.7 just after E6.6 (core), very simple files only.
INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT fi.tenant_id, fi.engagement_id, 'E6.7', 'E',
       'Accounting Estimates (ISA 540)', 'Estimations comptables (ISA 540)',
       fi.sort_order + 1, false
  FROM file_item fi
  JOIN engagement e ON e.id = fi.engagement_id
 WHERE fi.code = 'E6.6'
   AND e.complexity = 'very_simple'
   AND e.phase IN ('acceptance', 'planning', 'execution')
   AND e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM file_item x WHERE x.engagement_id = fi.engagement_id AND x.code = 'E6.7');

-- Down Migration

-- Deliberately a no-op: by now a document, sign-off, attachment or time entry
-- may hang off the added papers.
SELECT 1;
