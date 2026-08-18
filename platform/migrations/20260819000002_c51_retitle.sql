-- C5.1 retitle: drop "Client" and shorten — "Communications — Governance &
-- Management (ISA 260/265)". Display-only change; the code stays C5.1.

-- Up Migration

UPDATE file_item
   SET title_en = 'Communications — Governance & Management (ISA 260/265)',
       title_fr = 'Communications — gouvernance & direction (ISA 260/265)'
 WHERE code = 'C5.1';

-- Down Migration

SELECT 1;
