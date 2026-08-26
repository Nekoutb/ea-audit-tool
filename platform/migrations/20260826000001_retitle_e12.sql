-- E1.2 was rebuilt as "Test Controls over Significant Classes of Transactions"
-- (EY GAM CONTROLS 4-7). Existing engagements carry the old stored title, so
-- their pages still announced "Application & IT-Dependent Controls". Retitle
-- the live rows; archived files are immutable and keep their historical title
-- (the trigger would refuse the write, so they are excluded).
UPDATE file_item fi
   SET title_en = 'Test Controls over Significant Classes of Transactions',
       title_fr = 'Tests des contrôles sur les flux significatifs (SCOT)'
 FROM engagement e
 WHERE e.id = fi.engagement_id
   AND e.archived_at IS NULL
   AND fi.code = 'E1.2';
