-- C6.1 becomes the archive checklist: every gate between the file and its
-- archive, green or red, with the items behind each red one linked to where
-- they are put right. It used to be "Points forward". The points themselves
-- live on as the completion record the roll-forward reads, so the next year's
-- file loses nothing; only the task's purpose and title change.
--
-- Archived engagements are left alone: file_item carries the archive
-- immutability trigger, and an update against a closed file would raise
-- 'engagement-archived' and take the whole migration down with it.

-- Up Migration

UPDATE file_item fi
   SET title_en = 'Archive Checklist — Gates and Open Items',
       title_fr = 'Liste de contrôle d''archivage — portes et points ouverts'
  FROM engagement e
 WHERE e.id = fi.engagement_id AND fi.code = 'C6.1' AND e.archived_at IS NULL;

-- Down Migration

UPDATE file_item fi
   SET title_en = 'Points Forward (next year)',
       title_fr = 'Points à reporter (exercice suivant)'
  FROM engagement e
 WHERE e.id = fi.engagement_id AND fi.code = 'C6.1' AND e.archived_at IS NULL;
