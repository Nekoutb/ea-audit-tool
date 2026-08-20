-- Notifications carry the link they refer to, so the bell can take the user
-- straight to the task, paper or register that changed — assignments and
-- review notes are notifications only, never email.
--
-- Each firm also gets its own sending identity (the local part only: the
-- domain stays the one verified with the mail provider, so a firm can never
-- set a From address that would silently fail to deliver).

-- Up Migration

ALTER TABLE notification ADD COLUMN IF NOT EXISTS href text;

ALTER TABLE tenant ADD COLUMN IF NOT EXISTS mail_local text;

-- seed each existing firm with its slug as the sending identity
UPDATE tenant
   SET mail_local = regexp_replace(lower(slug), '[^a-z0-9._-]', '', 'g')
 WHERE mail_local IS NULL;

-- Down Migration

SELECT 1;
