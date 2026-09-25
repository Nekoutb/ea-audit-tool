-- The generated engagement letter is the P1.4 task (Engagement Letter, ISA
-- 210); lib/letters.ts filed it under P1.1 (client acceptance). New letters
-- now land on P1.4; this moves the ones already generated so a file does not
-- end up with the same letter under two tasks. Only the letters themselves
-- move — the independence confirmations archived under P1.1 (also kind
-- 'letter', note 'independence:archived') stay where they are. Archived
-- engagements are skipped: document carries the archive immutability trigger.

-- Up Migration

UPDATE document d
   SET file_item_id = p14.id
  FROM file_item p11
  JOIN engagement e ON e.id = p11.engagement_id
  JOIN file_item p14 ON p14.engagement_id = p11.engagement_id AND p14.code = 'P1.4'
 WHERE d.file_item_id = p11.id
   AND p11.code = 'P1.1'
   AND d.kind = 'letter'
   AND e.archived_at IS NULL
   AND EXISTS (
     SELECT 1 FROM document_version dv
      WHERE dv.document_id = d.id AND dv.note = 'letter:engagement'
   );

-- Down Migration

UPDATE document d
   SET file_item_id = p11.id
  FROM file_item p14
  JOIN engagement e ON e.id = p14.engagement_id
  JOIN file_item p11 ON p11.engagement_id = p14.engagement_id AND p11.code = 'P1.1'
 WHERE d.file_item_id = p14.id
   AND p14.code = 'P1.4'
   AND d.kind = 'letter'
   AND e.archived_at IS NULL
   AND EXISTS (
     SELECT 1 FROM document_version dv
      WHERE dv.document_id = d.id AND dv.note = 'letter:engagement'
   );
