-- C3.2 "External Confirmation Letter" is not a task: circularisation lives in
-- the confirmations tool and its record feeds E4.1/E4.8 directly. Remove the
-- task from every engagement. File items that already carry a document are
-- kept (invisible — the group no longer lists the code) so no evidence is lost.

-- Up Migration

DELETE FROM form_response WHERE code = 'wp:C3.2';

DELETE FROM file_item fi
 WHERE fi.code = 'C3.2'
   AND NOT EXISTS (SELECT 1 FROM document d WHERE d.file_item_id = fi.id);

-- Down Migration

SELECT 1;
