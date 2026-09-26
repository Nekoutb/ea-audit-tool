-- E4.28 was titled "External Services (VD1)" although lead index VD1 also
-- carries non-stored purchases (604/605/608) and transport (61) — UAT
-- run2-B150. lib/file-index.ts now carries the full caption for new
-- engagements; this retitles the rows that already exist. Only the exact old
-- strings are touched, so a title a firm edited by hand is left as written.
-- Archived files are skipped: file_item carries the archive immutability
-- trigger.

-- Up Migration

UPDATE file_item fi
   SET title_en = 'Non-Stored Purchases, Transport & External Services (VD1)'
  FROM engagement e
 WHERE e.id = fi.engagement_id
   AND e.archived_at IS NULL
   AND fi.code = 'E4.28'
   AND fi.title_en = 'External Services (VD1)';

UPDATE file_item fi
   SET title_fr = 'Achats non stockés, transports & services extérieurs (VD1)'
  FROM engagement e
 WHERE e.id = fi.engagement_id
   AND e.archived_at IS NULL
   AND fi.code = 'E4.28'
   AND fi.title_fr = 'Services extérieurs (VD1)';

-- Down Migration

UPDATE file_item fi
   SET title_en = 'External Services (VD1)'
  FROM engagement e
 WHERE e.id = fi.engagement_id
   AND e.archived_at IS NULL
   AND fi.code = 'E4.28'
   AND fi.title_en = 'Non-Stored Purchases, Transport & External Services (VD1)';

UPDATE file_item fi
   SET title_fr = 'Services extérieurs (VD1)'
  FROM engagement e
 WHERE e.id = fi.engagement_id
   AND e.archived_at IS NULL
   AND fi.code = 'E4.28'
   AND fi.title_fr = 'Achats non stockés, transports & services extérieurs (VD1)';
