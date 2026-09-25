-- The French titles of P2.2 and P2.3 were typed without their diacritics
-- ("Evaluer l'equipe…", "Perimetre…"). lib/file-index.ts now carries the
-- accented titles for new engagements; this corrects the rows that already
-- exist. Only the exact unaccented strings are touched, so a title a firm
-- edited by hand is left as written. Archived files are skipped: file_item
-- carries the archive immutability trigger.

-- Up Migration

UPDATE file_item fi
   SET title_fr = 'Évaluer l''équipe et déterminer le besoin de compétences spécialisées'
  FROM engagement e
 WHERE e.id = fi.engagement_id
   AND e.archived_at IS NULL
   AND fi.code = 'P2.2'
   AND fi.title_fr = 'Evaluer l''equipe et determiner le besoin de competences specialisees';

UPDATE file_item fi
   SET title_fr = 'Périmètre d''audit et composants (ISA 600)'
  FROM engagement e
 WHERE e.id = fi.engagement_id
   AND e.archived_at IS NULL
   AND fi.code = 'P2.3'
   AND fi.title_fr = 'Perimetre d''audit et composants (ISA 600)';

-- Down Migration

UPDATE file_item fi
   SET title_fr = 'Evaluer l''equipe et determiner le besoin de competences specialisees'
  FROM engagement e
 WHERE e.id = fi.engagement_id
   AND e.archived_at IS NULL
   AND fi.code = 'P2.2'
   AND fi.title_fr = 'Évaluer l''équipe et déterminer le besoin de compétences spécialisées';

UPDATE file_item fi
   SET title_fr = 'Perimetre d''audit et composants (ISA 600)'
  FROM engagement e
 WHERE e.id = fi.engagement_id
   AND e.archived_at IS NULL
   AND fi.code = 'P2.3'
   AND fi.title_fr = 'Périmètre d''audit et composants (ISA 600)';
