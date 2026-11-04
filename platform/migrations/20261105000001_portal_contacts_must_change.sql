-- F069 (firm decision 2026-10-27): the auditor no longer sets a portal password.
--
-- Existing portal contacts were given a password typed by the auditor. Flag
-- those accounts so their next sign-in lands on /change-password (proxy.ts);
-- their current password still signs them in and still counts as the "current
-- password" there, so nobody is locked out. Accounts that also hold a firm role
-- are left alone: their password is their own.

-- Up Migration

UPDATE app_user u
   SET must_change_password = true
 WHERE EXISTS (SELECT 1 FROM membership m WHERE m.user_id = u.id AND m.role = 'client_user')
   AND NOT EXISTS (SELECT 1 FROM membership m WHERE m.user_id = u.id AND m.role <> 'client_user');

-- Down Migration

-- Before this migration no portal account carried the flag.
UPDATE app_user u
   SET must_change_password = false
 WHERE EXISTS (SELECT 1 FROM membership m WHERE m.user_id = u.id AND m.role = 'client_user')
   AND NOT EXISTS (SELECT 1 FROM membership m WHERE m.user_id = u.id AND m.role <> 'client_user');
