-- P&L lead-schedule groupings: classes 6 and 7 leave Purchases & Payables.
-- 60 operating · 61-63 administrative · 64 taxes · 65 other expenses ·
-- 66 personnel · 67 finance cost · 68 PP&E · 69 provisions · 70 revenue ·
-- 75/77 other income (user's grouping, 11 Aug 2026).
UPDATE syscohada_grouping_rule SET section_code = 'E600' WHERE account_prefix = '60';
UPDATE syscohada_grouping_rule SET section_code = 'E610' WHERE account_prefix IN ('61','62','63');
UPDATE syscohada_grouping_rule SET section_code = 'E620' WHERE account_prefix = '65';
UPDATE syscohada_grouping_rule SET section_code = 'E630' WHERE account_prefix IN ('67','697');
UPDATE syscohada_grouping_rule SET section_code = 'E700' WHERE account_prefix IN ('75','77');
