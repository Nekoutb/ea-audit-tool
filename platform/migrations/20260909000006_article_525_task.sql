-- The statutory auditor's certification under article 525 of the Uniform Act
-- on commercial companies — the total remuneration paid to the highest-paid
-- persons, certified as exact — becomes a task of its own, C5.10, among the
-- statutory reports. It is a report in its own right, distinct from the report
-- on the financial statements and the special report on regulated agreements,
-- and the file had nowhere to hold it.
--
-- Anchored just after the article 715 board report (C5.4), which is a standard
-- task and so exists wherever the statutory section exists at all; the two
-- extended tasks of the section (C5.5, C5.9) do not. An engagement nobody opens
-- would otherwise pick it up from instantiateGroupTasks at the bottom of the
-- listing.
--
-- Archived engagements are left alone: file_item carries the archive
-- immutability trigger, and an insert against a closed file would raise
-- 'engagement-archived' and take the whole migration down with it.

-- Up Migration

INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
SELECT fi.tenant_id, fi.engagement_id, 'C5.10', 'F',
       'Article 525 Certification — Highest-Paid Persons'' Remuneration',
       'Attestation article 525 — rémunérations des personnes les mieux rémunérées',
       fi.sort_order + 1, false
  FROM file_item fi
  JOIN engagement e ON e.id = fi.engagement_id
 WHERE fi.code = 'C5.4' AND e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM file_item x WHERE x.engagement_id = fi.engagement_id AND x.code = 'C5.10');

-- Down Migration

-- Deliberately a no-op: reversing would delete file_item rows that evidence
-- may already hang off. The task is harmless if unwanted; the evidence is not.
SELECT 1;
