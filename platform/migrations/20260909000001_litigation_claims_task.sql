-- Litigation and claims (ISA 501 para 9-12) becomes a task of its own, E6.9,
-- and joins the general audit procedures now grouped under E5. The paper for it
-- already existed; it had been reached through the tax payables task because its
-- registry key was never moved when the file index was renumbered.
--
-- An engagement that nobody opens would otherwise pick the task up from
-- instantiateGroupTasks at max(sort_order) + 10, which files litigation and
-- claims below the OHADA statutory section in the audit file listing and in the
-- XLSX export. Anchoring it to subsequent events instead puts it where a reader
-- expects it, among the other general procedures. E6.6 is the anchor rather
-- than E6.7 because E6.6 is core and so exists on every engagement that has any
-- tasks at all, including the very simple ones.
--
-- Archived engagements are left alone: file_item carries the archive
-- immutability trigger from 20260820000002 and an insert against a closed file
-- would raise 'engagement-archived' and take the whole migration down with it.

-- Up Migration

INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT fi.tenant_id,
       fi.engagement_id,
       'E6.9',
       'E',
       'Litigation & Claims (ISA 501)',
       'Litiges et réclamations (ISA 501)',
       fi.sort_order + 1,
       false
  FROM file_item fi
  JOIN engagement e ON e.id = fi.engagement_id
 WHERE fi.code = 'E6.6'
   AND e.archived_at IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM file_item x WHERE x.engagement_id = fi.engagement_id AND x.code = 'E6.9'
   );

-- Down Migration

-- Deliberately a no-op. Reversing this would delete file_item rows, and by then
-- a document, a sign-off, a time entry, an attachment or a review note may hang
-- off them; the task is harmless if it is not wanted, the evidence is not.
SELECT 1;
