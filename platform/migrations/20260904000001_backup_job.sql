-- The queue that gets an archived audit file into off-site immutable storage,
-- and the record that it got there.
--
-- Why a table rather than an in-process call: archiveEngagement() must not wait
-- on Wasabi. That transaction already runs a hundred-line json_build_object
-- under a 30-second statement timeout, and adding a network round trip would
-- mean a storage outage prevents a partner from archiving a file — a compliance
-- failure manufactured by the compliance tooling. The archive commits; a
-- drainer picks the job up within ten minutes.
--
-- It doubles as evidence. "Was this closed file copied off the box, when, and
-- under which object key?" is a question an audit firm will eventually be asked,
-- and the answer is a row here.

CREATE TABLE IF NOT EXISTS backup_job (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id   uuid REFERENCES engagement (id) ON DELETE CASCADE,
  kind            text NOT NULL
                  CHECK (kind IN ('engagement-archive', 'engagement-rolling', 'tenant-full')),
  state           text NOT NULL DEFAULT 'queued'
                  CHECK (state IN ('queued', 'running', 'done', 'failed')),
  attempts        integer NOT NULL DEFAULT 0,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  object_key      text,
  object_bytes    bigint,
  object_sha256   text,
  manifest_sha256 text,
  last_error      text
);

-- One archival copy per engagement. A failed attempt is allowed to be retried;
-- a queued, running or completed one is not duplicated.
CREATE UNIQUE INDEX IF NOT EXISTS backup_job_one_archive_idx
  ON backup_job (engagement_id)
  WHERE kind = 'engagement-archive' AND state <> 'failed';

CREATE INDEX IF NOT EXISTS backup_job_pending_idx
  ON backup_job (state, requested_at) WHERE state IN ('queued', 'running');

-- Deliberately NOT covered by the archive-immutability triggers: these rows are
-- written after archived_at is set, and updated again when the upload finishes,
-- which those guards would refuse. The row records what happened TO the archived
-- file; it is not part of it.
ALTER TABLE backup_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_job FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON backup_job;
CREATE POLICY tenant_isolation ON backup_job
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- The application enqueues and reads; only the drainer, which runs as postgres,
-- moves a job through its states.
GRANT SELECT, INSERT ON backup_job TO ea_app;
