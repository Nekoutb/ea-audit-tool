-- E4 "Accounts" becomes one working paper per lead index: existing E4.1–E4.16
-- are retitled to their new index identities (E Receivables, N Payables, …)
-- and E4.17–E4.36 are added to every engagement that has an E4 file. SCOT /
-- cycle descriptions disappear from E4 — the task IS the index.

-- Up Migration

CREATE TEMPORARY TABLE e4_titles (code text PRIMARY KEY, en text NOT NULL, fr text NOT NULL, ord int NOT NULL);
INSERT INTO e4_titles (code, en, fr, ord) VALUES
  ('E4.1',  'Trade Receivables (E)',                    'Créances clients (E)', 1),
  ('E4.2',  'Trade Payables (N)',                       'Dettes fournisseurs (N)', 2),
  ('E4.3',  'Inventories (F)',                          'Stocks (F)', 3),
  ('E4.4',  'Property, Plant & Equipment (K)',          'Immobilisations corporelles (K)', 4),
  ('E4.5',  'Intangible Assets (L)',                    'Immobilisations incorporelles (L)', 5),
  ('E4.6',  'Financial Assets (J)',                     'Actifs financiers (J)', 6),
  ('E4.7',  'Cash & Cash Equivalents (C)',              'Trésorerie (C)', 7),
  ('E4.8',  'Borrowings (Q)',                           'Emprunts (Q)', 8),
  ('E4.9',  'Share Capital & Reserves (T)',             'Capital et réserves (T)', 9),
  ('E4.10', 'Provisions for Risks & Charges (P1)',      'Provisions pour risques et charges (P1)', 10),
  ('E4.11', 'Social & Payroll Liabilities (P2)',        'Dettes sociales (P2)', 11),
  ('E4.12', 'Suspense & Deferred Income (P3)',          'Comptes d''attente et PCA (P3)', 12),
  ('E4.13', 'Translation Difference — Liabilities (P4)','Écarts de conversion — passif (P4)', 13),
  ('E4.14', 'Tax Receivables (O1)',                     'Créances fiscales (O1)', 14),
  ('E4.15', 'Tax Payables (O2)',                        'Dettes fiscales (O2)', 15),
  ('E4.16', 'Group & Associates — Short Term (I1)',     'Groupe et associés — court terme (I1)', 16),
  ('E4.17', 'Group & Associates (I2)',                  'Groupe et associés (I2)', 17),
  ('E4.18', 'Other Current Assets (G2)',                'Autres actifs courants (G2)', 18),
  ('E4.19', 'Translation Difference — Assets (G3)',     'Écarts de conversion — actif (G3)', 19),
  ('E4.20', 'Revenue (UA)',                             'Chiffre d''affaires (UA)', 20),
  ('E4.21', 'Other Income (UB2)',                       'Autres produits (UB2)', 21),
  ('E4.22', 'Finance Income (UC)',                      'Produits financiers (UC)', 22),
  ('E4.23', 'Exceptional Income (U1)',                  'Produits HAO (U1)', 23),
  ('E4.24', 'Purchases (VA1)',                          'Achats (VA1)', 24),
  ('E4.25', 'Change in Inventories (VA2)',              'Variation de stocks (VA2)', 25),
  ('E4.26', 'Personnel Costs (VB)',                     'Charges de personnel (VB)', 26),
  ('E4.27', 'Taxes & Duties (VO)',                      'Impôts et taxes (VO)', 27),
  ('E4.28', 'External Services (VD1)',                  'Services extérieurs (VD1)', 28),
  ('E4.29', 'Depreciation & Provisions (VD2)',          'Dotations amortissements et provisions (VD2)', 29),
  ('E4.30', 'Provision Reversals (VD3)',                'Reprises de provisions (VD3)', 30),
  ('E4.31', 'Other Expenses (VD4)',                     'Autres charges (VD4)', 31),
  ('E4.32', 'Finance Costs (VD5)',                      'Charges financières (VD5)', 32),
  ('E4.33', 'Exceptional Expenses (V1)',                'Charges HAO (V1)', 33),
  ('E4.34', 'Income Tax (O4)',                          'Impôt sur le résultat (O4)', 34),
  ('E4.35', 'Leases',                                   'Contrats de location', 35),
  ('E4.36', 'Cash Flow (TFT) Tie-out',                  'Concordance du TFT', 36);

-- retitle the tasks that already exist
UPDATE file_item fi SET title_en = t.en, title_fr = t.fr
  FROM e4_titles t WHERE fi.code = t.code;

-- add the missing tasks to every engagement that carries an E4 file
INSERT INTO file_item (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional, material)
SELECT anchor.tenant_id, anchor.engagement_id, t.code, 'E', t.en, t.fr, anchor.sort_order + t.ord, false, false
  FROM (SELECT DISTINCT ON (engagement_id) tenant_id, engagement_id, sort_order
          FROM file_item WHERE code = 'E4.1' ORDER BY engagement_id) anchor
  CROSS JOIN e4_titles t
 WHERE NOT EXISTS (
   SELECT 1 FROM file_item x WHERE x.engagement_id = anchor.engagement_id AND x.code = t.code
 );

DROP TABLE e4_titles;

-- Down Migration

-- titles only (structure additions are retained)
SELECT 1;
