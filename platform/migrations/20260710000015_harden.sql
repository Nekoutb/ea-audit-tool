-- Build Phase 9 (9.8, security review): the SYSCOHADA grouping library is
-- GLOBAL reference data seeded by migrations (admin role). The app role must
-- never mutate it — per-client deviations live in client_grouping_override.

-- Up Migration

REVOKE INSERT, UPDATE, DELETE ON syscohada_grouping_rule FROM ea_app;

-- Down Migration

GRANT INSERT, UPDATE, DELETE ON syscohada_grouping_rule TO ea_app;
