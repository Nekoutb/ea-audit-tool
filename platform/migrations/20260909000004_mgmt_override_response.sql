-- The presumed management-override risk gets the response ISA 240 prescribes.
--
-- Planning cannot close while a significant, unrebutted risk has no program
-- step linked to it. Management override is seeded on every engagement,
-- significant, and cannot be rebutted, so it always needs a link — and until
-- now the only screen that could make one was a panel below the working paper
-- that has been removed at the user's request. Engagements created from here on
-- get the link at creation (lib/risks.ts seedPresumedRisks). This carries the
-- same thing onto the engagements that already exist, so none of them is left
-- unable to leave planning.
--
-- The response is the one the standard requires whatever the auditor thinks:
-- ISA 240 ¶32, journal entries, estimates for bias, unusual transactions. It is
-- written as the first program step of E3.1 and the risk is linked to it, on the
-- principle lib/psp.ts already applies to every account — the procedures ARE the
-- response. The wording must stay identical to MGMT_OVERRIDE_PROCEDURE in
-- lib/risks.ts: that is how a re-run knows the step is already there.
--
-- Archived engagements are left alone: program_step and risk_response carry the
-- archive immutability trigger, and a write against a closed file would raise
-- 'engagement-archived' and take the whole migration down with it.

-- Up Migration

-- 1. The step, on every open engagement whose override risk has no response yet
--    and whose E3.1 does not already carry it. A file that already answered the
--    risk with a step of its own is left as its preparer wrote it.
INSERT INTO program_step (tenant_id, engagement_id, file_item_id, seq, description, assertions, source)
SELECT r.tenant_id, r.engagement_id, fi.id,
       coalesce((SELECT max(ps.seq) FROM program_step ps WHERE ps.file_item_id = fi.id), 0) + 10,
       'Test the appropriateness of journal entries and other adjustments made in the preparation of the financial statements, review accounting estimates for bias, and evaluate the business rationale of significant unusual transactions (ISA 240 ¶32).',
       ARRAY['C', 'E', 'A'],
       'risk_extension'
  FROM risk r
  JOIN engagement e ON e.id = r.engagement_id
  JOIN file_item fi ON fi.engagement_id = r.engagement_id AND fi.code = 'E3.1'
 WHERE r.presumed_type = 'mgmt_override'
   AND e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM risk_response rr WHERE rr.risk_id = r.id)
   AND NOT EXISTS (
     SELECT 1 FROM program_step ps
      WHERE ps.file_item_id = fi.id
        AND ps.source = 'risk_extension'
        AND ps.description LIKE 'Test the appropriateness of journal entries and other adjustments%'
   );

-- 2. The link, wherever the risk still has no response at all.
INSERT INTO risk_response (tenant_id, risk_id, program_step_id)
SELECT r.tenant_id, r.id, ps.id
  FROM risk r
  JOIN engagement e ON e.id = r.engagement_id
  JOIN file_item fi ON fi.engagement_id = r.engagement_id AND fi.code = 'E3.1'
  JOIN program_step ps ON ps.file_item_id = fi.id
                      AND ps.source = 'risk_extension'
                      AND ps.description LIKE 'Test the appropriateness of journal entries and other adjustments%'
 WHERE r.presumed_type = 'mgmt_override'
   AND e.archived_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM risk_response rr WHERE rr.risk_id = r.id)
ON CONFLICT DO NOTHING;

-- 3. The register reads "response planned" for a risk that now has one.
UPDATE risk r
   SET status = 'response_planned'
  FROM engagement e
 WHERE e.id = r.engagement_id
   AND r.presumed_type = 'mgmt_override'
   AND r.status = 'identified'
   AND e.archived_at IS NULL
   AND EXISTS (SELECT 1 FROM risk_response rr WHERE rr.risk_id = r.id);

-- Down Migration

-- Deliberately a no-op. Reversing this would delete a program step somebody may
-- since have completed and signed off, and re-open a planning gate on files that
-- have already passed it; the step is harmless if it is not wanted, the work
-- done on it is not.
SELECT 1;
