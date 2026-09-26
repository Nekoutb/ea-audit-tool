-- Review notes raised through the wrong engagement (UAT run 3 B01), and the
-- C4.2 backfill for quality reviewers appointed from the team page.
-- lib/task-notes.ts addTaskNote did not check that the task belonged to the
-- engagement in the URL, so a note could carry engagement A while pointing at
-- a task of engagement B. signDocument counts open notes by file_item_id, so
-- such a note blocked B's sign-off while B's team could not answer or clear it
-- (respond/clear match on engagement_id). The create path now refuses it; this
-- re-homes the existing rows onto the task's own engagement so that team can
-- deal with them. Nothing is deleted: the note text stays on the trail.
-- Archived engagements are left alone (review_note carries the archive guard).

-- Up Migration

UPDATE review_note rn
   SET engagement_id = fi.engagement_id
  FROM file_item fi
  JOIN engagement e ON e.id = fi.engagement_id
 WHERE rn.file_item_id = fi.id
   AND rn.engagement_id IS NOT NULL
   AND rn.engagement_id <> fi.engagement_id
   AND e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM engagement ea WHERE ea.id = rn.engagement_id AND ea.archived_at IS NOT NULL);

-- C4.2 where a quality reviewer was appointed through the team page after
-- the run-2 backfill: addTeamMemberByEmail did not ensure the task (UAT run 3
-- acpt.team-eqr). Same statement as 20260926000001 step 2.
INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT e.tenant_id, e.id, 'C4.2', 'B',
       'Engagement Quality Review', 'Revue de qualité de la mission',
       coalesce((SELECT fi.sort_order FROM file_item fi WHERE fi.engagement_id = e.id AND fi.code = 'C4.1'),
                (SELECT max(fi.sort_order) FROM file_item fi WHERE fi.engagement_id = e.id), 0) + 1,
       false
  FROM engagement e
 WHERE e.archived_at IS NULL
   AND EXISTS (SELECT 1 FROM file_item x WHERE x.engagement_id = e.id)
   AND (EXISTS (SELECT 1 FROM team_member tm WHERE tm.engagement_id = e.id AND tm.team_role = 'eqr_reviewer')
        OR EXISTS (SELECT 1 FROM form_response fr
                    WHERE fr.engagement_id = e.id AND fr.code = 'wp:P1.5'
                      AND fr.field_key = 'q_eqr' AND btrim(fr.value #>> '{}') = 'yes'))
ON CONFLICT (engagement_id, code) DO NOTHING;

-- Down Migration

-- Not reversible: the wrong engagement id is not kept.
