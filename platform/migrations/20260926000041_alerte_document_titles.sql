-- Alerte documents were titled with the raw stage code (UAT run 2 B166):
-- "Alerte — board_invited (2025)". lib/alerte.ts now titles them in French;
-- this renames the documents already on file so a regenerated stage lands on
-- the same document. Archived files are left untouched (they are immutable).

-- Up Migration

UPDATE document d
   SET title = 'Alerte — ' || m.fr || substr(d.title, length('Alerte — ' || m.code) + 1)
  FROM (VALUES
          ('court_informed', 'information de la juridiction compétente'),
          ('board_invited', 'invitation du conseil à délibérer'),
          ('rapport_special', 'rapport spécial d''alerte')
       ) AS m(code, fr),
       engagement e
 WHERE d.engagement_id = e.id
   AND e.archived_at IS NULL
   AND d.title LIKE 'Alerte — ' || m.code || ' (%';

-- Down Migration

UPDATE document d
   SET title = 'Alerte — ' || m.code || substr(d.title, length('Alerte — ' || m.fr) + 1)
  FROM (VALUES
          ('court_informed', 'information de la juridiction compétente'),
          ('board_invited', 'invitation du conseil à délibérer'),
          ('rapport_special', 'rapport spécial d''alerte')
       ) AS m(code, fr),
       engagement e
 WHERE d.engagement_id = e.id
   AND e.archived_at IS NULL
   AND d.title LIKE 'Alerte — ' || m.fr || ' (%';
