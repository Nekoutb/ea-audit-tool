-- The client portal accepted any file a contact uploaded — a Windows
-- executable renamed .pdf was stored, accepted into a working paper and served
-- back to the auditor's disk. lib/pbc.ts now runs the same allowlist and
-- byte-signature check as task attachments on upload AND again when an upload
-- is accepted into the file. This quarantines what already sits in pbc_item:
-- an upload not yet accepted whose extension is outside the allowlist goes
-- back to 'requested' with its bytes dropped, so the client is asked again and
-- nothing outside the allowlist can reach the audit file. Uploads with an
-- allowed extension but the wrong bytes are caught at acceptance (the check
-- cannot run in SQL). Accepted items are left alone: their document is
-- already in the file and is a matter for the file's owner, not a migration.

-- Up Migration

UPDATE pbc_item
   SET status = 'requested', filename = NULL, mime = NULL, content = NULL,
       uploaded_by = NULL, uploaded_at = NULL
 WHERE status = 'uploaded'
   AND filename IS NOT NULL
   AND lower(filename) !~ '\.(xlsx|docx|pptx|xls|doc|pdf|png|jpg|jpeg|gif|webp|csv|txt|xml|json)$';

-- Down Migration

-- Deliberately a no-op: the dropped bytes were outside the allowlist and are
-- not restored.
SELECT 1;
