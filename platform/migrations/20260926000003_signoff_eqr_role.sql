-- The engagement quality reviewer's own sign-off (UAT run 3 B02).
-- C4.2 was completed and signed by the engagement team (manager P, partner R)
-- and that satisfied the eqr_complete gate although the appointed quality
-- reviewer never touched it. The EQR now signs C4.2 with a sign-off of their
-- own, role 'eqr', which lib/documents.ts signDocument accepts only from the
-- appointed reviewer and only on C4.2, and which lib/completion.ts requires.

-- Up Migration

ALTER TABLE signoff DROP CONSTRAINT IF EXISTS signoff_role_check;
ALTER TABLE signoff ADD CONSTRAINT signoff_role_check
  CHECK (role IN ('preparer', 'reviewer', 'partner', 'eqr'));

-- Down Migration

DELETE FROM signoff WHERE role = 'eqr';
ALTER TABLE signoff DROP CONSTRAINT IF EXISTS signoff_role_check;
ALTER TABLE signoff ADD CONSTRAINT signoff_role_check
  CHECK (role IN ('preparer', 'reviewer', 'partner'));
