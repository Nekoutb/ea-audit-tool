-- F052: the C5.4 title named the board of directors, which an SA with an
-- administrateur général, a SARL or a SAS does not have, and task titles are not
-- resolved per legal form. The title now names the article; the paper's own text
-- names the organ. A title someone changed by hand is left alone, and so is an
-- archived file, which is closed and stays as it was signed (ISA 230).

-- Up Migration

UPDATE file_item
   SET title_en = 'Article 715 Report',
       title_fr = 'Rapport article 715'
 WHERE code = 'C5.4'
   AND title_en = 'Article 715 Report to the Board'
   AND engagement_id IN (SELECT id FROM engagement WHERE archived_at IS NULL);

-- Down Migration

UPDATE file_item
   SET title_en = 'Article 715 Report to the Board',
       title_fr = 'Rapport article 715 au conseil d''administration'
 WHERE code = 'C5.4'
   AND title_en = 'Article 715 Report'
   AND engagement_id IN (SELECT id FROM engagement WHERE archived_at IS NULL);
