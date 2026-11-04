-- F023 (firm decision 2026-10-27): C2.2 owns both the subsequent-events and the
-- going-concern conclusions at completion, and its title now says so. Existing
-- files take the new title; a title someone changed by hand is left alone, and
-- so is an archived file, which is closed and stays as it was signed (ISA 230).

-- Up Migration

UPDATE file_item
   SET title_en = 'Subsequent events and going concern — completion (ISA 560 / ISA 570)',
       title_fr = 'Événements postérieurs et continuité d''exploitation — achèvement (ISA 560 / ISA 570)'
 WHERE code = 'C2.2'
   AND title_en = 'Subsequent Events Review (ISA 560)'
   AND engagement_id IN (SELECT id FROM engagement WHERE archived_at IS NULL);

-- Down Migration

UPDATE file_item
   SET title_en = 'Subsequent Events Review (ISA 560)',
       title_fr = 'Revue des événements postérieurs (ISA 560)'
 WHERE code = 'C2.2'
   AND title_en = 'Subsequent events and going concern — completion (ISA 560 / ISA 570)'
   AND engagement_id IN (SELECT id FROM engagement WHERE archived_at IS NULL);
