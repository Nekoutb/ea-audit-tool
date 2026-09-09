-- The five P&L lead schedules E5.1 to E5.5 — operating expenditures,
-- administrative expenditures, other expenses, finance cost, other income —
-- are retired from the ordinary flow of the file.
--
-- They date from before the audit file was rebuilt on the SYSCOHADA lead codes,
-- and every one of them is now covered by a properly coded P&L account: other
-- income is E4.21 (UB2), other expenses E4.31 (VD4), finance cost E4.32 (VD5),
-- and the two expenditure schedules are split across purchases E4.24 (VA1) and
-- external services E4.28 (VD1). Leaving them in a group listed them a second
-- time under a second name, which is how the same expense came to be signed off
-- twice on the same file.
--
-- They are marked conditional rather than deleted. A conditional task is left
-- out of the phase count and out of the ordinary task list, but the phase screen
-- still offers it, so an engagement that already put a document, a sign-off, a
-- time entry or a review note on one of these schedules keeps the route to it.
-- Deleting the rows would take that evidence with them.
--
-- Archived engagements are left alone: file_item carries the archive
-- immutability trigger from 20260820000002, and an update against a closed file
-- would raise 'engagement-archived' and take the whole migration down with it.

-- Up Migration

UPDATE file_item fi
   SET conditional = true
  FROM engagement e
 WHERE e.id = fi.engagement_id
   AND fi.code IN ('E5.1', 'E5.2', 'E5.3', 'E5.4', 'E5.5')
   AND fi.conditional = false
   AND e.archived_at IS NULL;

-- Down Migration

UPDATE file_item fi
   SET conditional = false
  FROM engagement e
 WHERE e.id = fi.engagement_id
   AND fi.code IN ('E5.1', 'E5.2', 'E5.3', 'E5.4', 'E5.5')
   AND fi.conditional = true
   AND e.archived_at IS NULL;
