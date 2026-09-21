-- Financial statement procedures — the tie-out of the accounts and notes
-- [pointage des comptes et annexes] — becomes a task of its own, E6.10, the
-- last of the general audit procedures grouped under E5. The handbook treats
-- it as a procedure in its own right: column N to the final lead schedules,
-- column N-1 to the accounts attached to our report, the bridge from audited
-- to final accounts, and the disclosure checklist formalised.
--
-- An engagement nobody opens would otherwise pick the task up from
-- instantiateGroupTasks at max(sort_order) + 10, below the OHADA statutory
-- section in the listing and the XLSX export. Anchoring it just after E6.9
-- keeps it with the other general procedures; E6.9 is core and was itself put
-- on every open engagement by 20260909000001, so the anchor exists everywhere.
--
-- Archived engagements are left alone: file_item carries the archive
-- immutability trigger, and an insert against a closed file would raise
-- 'engagement-archived' and take the whole migration down with it.

-- Up Migration

INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT fi.tenant_id,
       fi.engagement_id,
       'E6.10',
       'E',
       'Financial Statement Procedures (tie-out of accounts and notes)',
       'Procédures sur les états financiers (pointage des comptes et annexes)',
       fi.sort_order + 1,
       false
  FROM file_item fi
  JOIN engagement e ON e.id = fi.engagement_id
 WHERE fi.code = 'E6.9'
   AND e.archived_at IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM file_item x WHERE x.engagement_id = fi.engagement_id AND x.code = 'E6.10'
   );

-- Down Migration

-- Deliberately a no-op. Reversing this would delete file_item rows, and by then
-- a document, a sign-off, a time entry, an attachment or a review note may hang
-- off them; the task is harmless if it is not wanted, the evidence is not.
SELECT 1;
