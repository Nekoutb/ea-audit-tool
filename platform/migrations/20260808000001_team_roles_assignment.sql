-- Six-level engagement team ladder + direct task assignment. Expand-only:
-- widen the team_member.team_role CHECK to the audit ladder (adds director and
-- senior_manager between partner and manager) and add file_item.assignee_user_id
-- — "who is doing this task" — distinct from owner_id (the preparer of record).

-- Up Migration

ALTER TABLE team_member DROP CONSTRAINT team_member_team_role_check;
ALTER TABLE team_member
  ADD CONSTRAINT team_member_team_role_check
  CHECK (team_role IN ('partner', 'director', 'senior_manager', 'manager',
                       'senior', 'staff', 'eqr_reviewer'));

ALTER TABLE file_item
  ADD COLUMN assignee_user_id uuid REFERENCES app_user (id) ON DELETE SET NULL;
CREATE INDEX file_item_assignee_idx ON file_item (tenant_id, assignee_user_id);

-- Down Migration

DROP INDEX IF EXISTS file_item_assignee_idx;
ALTER TABLE file_item DROP COLUMN IF EXISTS assignee_user_id;

ALTER TABLE team_member DROP CONSTRAINT IF EXISTS team_member_team_role_check;
ALTER TABLE team_member
  ADD CONSTRAINT team_member_team_role_check
  CHECK (team_role IN ('partner', 'manager', 'senior', 'staff', 'eqr_reviewer'));
