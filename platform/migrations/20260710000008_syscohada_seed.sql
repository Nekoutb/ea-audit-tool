-- Corrected, complete SYSCOHADA révisé grouping seed (steps 3.5) — transcribed
-- faithfully from the master prompt's Appendix A (chart of accounts), Appendix B
-- (REF correspondences) and §16.2 (default account→cycle map). Replaces the
-- provisional starter rows entirely. Class-4 debit/credit REF splits (BJ vs
-- DK/DM etc.) are resolved at FS tie-out time (Phase 7), not here; fs_ref holds
-- the primary REF range for the lead-schedule header.

-- Up Migration

DELETE FROM syscohada_grouping_rule;

INSERT INTO syscohada_grouping_rule
  (account_prefix, label_en, label_fr, fs_ref, section_code, priority, source) VALUES
  -- Classe 1 — Ressources durables
  ('10', 'Capital', 'Capital', 'CA-CE', 'E280', 0, 'appendix-a'),
  ('11', 'Reserves', 'Réserves', 'CF-CG', 'E280', 0, 'appendix-a'),
  ('12', 'Retained earnings', 'Report à nouveau', 'CH', 'E280', 0, 'appendix-a'),
  ('13', 'Net income for the year', 'Résultat net de l''exercice', 'CJ', 'E280', 0, 'appendix-a'),
  ('14', 'Investment subsidies', 'Subventions d''investissement', 'CL', 'E280', 0, 'appendix-a'),
  ('15', 'Regulated provisions', 'Provisions réglementées', 'CM', 'E280', 0, 'appendix-a'),
  ('16', 'Borrowings and similar debts', 'Emprunts et dettes assimilées', 'DA', 'E170', 0, 'appendix-a'),
  ('17', 'Finance-lease debts', 'Dettes de location acquisition', 'DB', 'E210', 0, 'appendix-a'),
  ('18', 'Participation-linked debts & liaison', 'Dettes liées à des participations et comptes de liaison', 'DA', 'E170', 0, 'appendix-a'),
  ('19', 'Provisions for risks and charges', 'Provisions pour risques et charges', 'DC', 'E200', 0, 'appendix-a'),
  -- Classe 2 — Actif immobilisé
  ('21', 'Intangible assets', 'Immobilisations incorporelles', 'AE-AH', 'E150', 0, 'appendix-a'),
  ('22', 'Land', 'Terrains', 'AJ', 'E140', 0, 'appendix-a'),
  ('23', 'Buildings, technical installations', 'Bâtiments, installations techniques et agencements', 'AK-AL', 'E140', 0, 'appendix-a'),
  ('24', 'Equipment, furniture and biological assets', 'Matériel, mobilier et actifs biologiques', 'AM-AN', 'E140', 0, 'appendix-a'),
  ('25', 'Advances on non-current assets', 'Avances et acomptes versés sur immobilisations', 'AP', 'E140', 0, 'appendix-a'),
  ('26', 'Equity investments', 'Titres de participation', 'AR', 'E160', 0, 'appendix-a'),
  ('27', 'Other financial assets', 'Autres immobilisations financières', 'AS', 'E160', 0, 'appendix-a'),
  ('28', 'Depreciation of non-current assets', 'Amortissements', 'AJ-AN', 'E140', 0, 'appendix-a'),
  ('281', 'Amortisation of intangibles', 'Amortissements des immobilisations incorporelles', 'AE-AH', 'E150', 10, 'appendix-a'),
  ('29', 'Impairment of non-current assets', 'Dépréciations des immobilisations', 'AJ-AN', 'E140', 0, 'appendix-a'),
  ('291', 'Impairment of intangibles', 'Dépréciations des immobilisations incorporelles', 'AE-AH', 'E150', 10, 'appendix-a'),
  ('296', 'Impairment of equity investments', 'Dépréciations des titres de participation', 'AR', 'E160', 10, 'appendix-a'),
  ('297', 'Impairment of other financial assets', 'Dépréciations des autres immobilisations financières', 'AS', 'E160', 10, 'appendix-a'),
  -- Classe 3 — Stocks
  ('31', 'Merchandise', 'Marchandises', 'BB', 'E130', 0, 'appendix-a'),
  ('32', 'Raw materials and related supplies', 'Matières premières et fournitures liées', 'BB', 'E130', 0, 'appendix-a'),
  ('33', 'Other supplies', 'Autres approvisionnements', 'BB', 'E130', 0, 'appendix-a'),
  ('34', 'Work in progress (goods)', 'Produits en cours', 'BB', 'E130', 0, 'appendix-a'),
  ('35', 'Services in progress', 'Services en cours', 'BB', 'E130', 0, 'appendix-a'),
  ('36', 'Finished goods', 'Produits finis', 'BB', 'E130', 0, 'appendix-a'),
  ('37', 'Intermediate and residual products', 'Produits intermédiaires et résiduels', 'BB', 'E130', 0, 'appendix-a'),
  ('38', 'Goods in transit / on consignment', 'Stocks en cours de route, en consignation ou en dépôt', 'BB', 'E130', 0, 'appendix-a'),
  ('39', 'Impairment of inventories', 'Dépréciations des stocks', 'BB', 'E130', 0, 'appendix-a'),
  -- Classe 4 — Tiers
  ('40', 'Suppliers and related accounts', 'Fournisseurs et comptes rattachés', 'DJ', 'E110', 0, 'appendix-a'),
  ('409', 'Suppliers — debit balances (advances)', 'Fournisseurs débiteurs', 'BH', 'E110', 10, 'appendix-a'),
  ('41', 'Customers and related accounts', 'Clients et comptes rattachés', 'BI', 'E100', 0, 'appendix-a'),
  ('419', 'Customers — credit balances (advances received)', 'Clients créditeurs', 'DI', 'E100', 10, 'appendix-a'),
  ('42', 'Personnel', 'Personnel', 'BJ/DK', 'E120', 0, 'appendix-a'),
  ('43', 'Social security bodies', 'Organismes sociaux', 'BJ/DK', 'E120', 0, 'appendix-a'),
  ('44', 'State and public authorities', 'État et collectivités publiques', 'BJ/DK', 'E180', 0, 'appendix-a'),
  ('443', 'VAT collected/payable', 'État, TVA facturée', 'DK', 'E190', 10, 'appendix-a'),
  ('444', 'VAT due or credit', 'État, TVA due ou crédit de TVA', 'BJ/DK', 'E190', 10, 'appendix-a'),
  ('445', 'Recoverable VAT', 'État, TVA récupérable', 'BJ', 'E190', 10, 'appendix-a'),
  ('45', 'International organisations', 'Organismes internationaux', 'BJ/DM', 'E220', 0, 'appendix-a'),
  ('46', 'Shareholders, associates and group', 'Apporteurs, associés et groupe', 'BJ/DM', 'E320', 0, 'appendix-a'),
  ('47', 'Sundry debtors and creditors', 'Débiteurs et créditeurs divers', 'BJ/DM', 'E220', 0, 'appendix-a'),
  ('478', 'Translation difference — assets', 'Écart de conversion - Actif', 'BU', 'E220', 10, 'appendix-a'),
  ('479', 'Translation difference — liabilities', 'Écart de conversion - Passif', 'DV', 'E220', 10, 'appendix-a'),
  ('48', 'HAO receivables and payables', 'Créances et dettes HAO', 'BA/DH', 'E220', 0, 'appendix-a'),
  ('49', 'Impairment and short-term provisions (third parties)', 'Dépréciations et provisions pour risques à court terme', 'BH-BJ', 'E220', 0, 'appendix-a'),
  ('490', 'Impairment — supplier debit balances', 'Dépréciations des comptes fournisseurs débiteurs', 'BH', 'E110', 10, 'appendix-a'),
  ('491', 'Impairment — customer accounts', 'Dépréciations des comptes clients', 'BI', 'E100', 10, 'appendix-a'),
  ('499', 'Short-term risk provisions', 'Provisions pour risques à court terme', 'DN', 'E200', 10, 'appendix-a'),
  -- Classe 5 — Trésorerie
  ('50', 'Marketable securities', 'Titres de placement', 'BQ', 'E160', 0, 'appendix-a'),
  ('51', 'Items for collection', 'Valeurs à encaisser', 'BR', 'E170', 0, 'appendix-a'),
  ('52', 'Banks', 'Banques', 'BS/DR', 'E170', 0, 'appendix-a'),
  ('53', 'Financial institutions and similar', 'Établissements financiers et assimilés', 'BS/DR', 'E170', 0, 'appendix-a'),
  ('54', 'Treasury instruments', 'Instruments de trésorerie', 'BS', 'E170', 0, 'appendix-a'),
  ('55', 'Electronic money instruments', 'Instruments de monnaie électronique', 'BS', 'E170', 0, 'appendix-a'),
  ('56', 'Bank overdrafts and discount credits', 'Banques, crédits de trésorerie et d''escompte', 'DQ/DR', 'E170', 0, 'appendix-a'),
  ('57', 'Cash', 'Caisse', 'BS', 'E170', 0, 'appendix-a'),
  ('58', 'Imprest accounts and internal transfers', 'Régies d''avances, accréditifs et virements internes', 'BS', 'E170', 0, 'appendix-a'),
  ('59', 'Short-term impairment (treasury)', 'Dépréciations et provisions à court terme', 'BQ-BS', 'E170', 0, 'appendix-a'),
  ('599', 'Short-term treasury risk provisions', 'Provisions pour risques à court terme (trésorerie)', 'DN', 'E200', 10, 'appendix-a'),
  -- Classe 6 — Charges AO
  ('60', 'Purchases and inventory variations', 'Achats et variations de stocks', 'RA-RF', 'E110', 0, 'appendix-a'),
  ('61', 'Transport', 'Transports', 'RG', 'E110', 0, 'appendix-a'),
  ('62', 'External services A', 'Services extérieurs A', 'RH', 'E110', 0, 'appendix-a'),
  ('63', 'External services B', 'Autres services extérieurs B', 'RH', 'E110', 0, 'appendix-a'),
  ('64', 'Taxes and duties', 'Impôts et taxes', 'RI', 'E180', 0, 'appendix-a'),
  ('65', 'Other operating expenses', 'Autres charges', 'RJ', 'E110', 0, 'appendix-a'),
  ('66', 'Personnel costs', 'Charges de personnel', 'RK', 'E120', 0, 'appendix-a'),
  ('67', 'Financial expenses', 'Frais financiers', 'RM', 'E170', 0, 'appendix-a'),
  ('68', 'Depreciation charges', 'Dotations aux amortissements', 'RL', 'E140', 0, 'appendix-a'),
  ('69', 'Provision and impairment charges', 'Dotations aux provisions et dépréciations', 'RL', 'E200', 0, 'appendix-a'),
  ('697', 'Financial provision charges', 'Dotations financières', 'RN', 'E170', 10, 'appendix-a'),
  -- Classe 7 — Produits AO
  ('70', 'Sales', 'Ventes', 'TA-TD', 'E100', 0, 'appendix-a'),
  ('71', 'Operating subsidies', 'Subventions d''exploitation', 'TG', 'E100', 0, 'appendix-a'),
  ('72', 'Capitalised production', 'Production immobilisée', 'TF', 'E100', 0, 'appendix-a'),
  ('73', 'Variations in produced inventories', 'Variations des stocks de biens et services produits', 'TE', 'E100', 0, 'appendix-a'),
  ('75', 'Other income', 'Autres produits', 'TH', 'E100', 0, 'appendix-a'),
  ('77', 'Financial income', 'Revenus financiers', 'TK', 'E170', 0, 'appendix-a'),
  ('78', 'Expense transfers', 'Transferts de charges', 'TI', 'E100', 0, 'appendix-a'),
  ('787', 'Financial expense transfers', 'Transferts de charges financières', 'TM', 'E170', 10, 'appendix-a'),
  ('79', 'Provision and impairment reversals', 'Reprises de provisions et dépréciations', 'TJ', 'E200', 0, 'appendix-a'),
  ('791', 'Operating reversals', 'Reprises de provisions d''exploitation', 'TJ', 'E100', 10, 'appendix-a'),
  ('797', 'Financial reversals', 'Reprises financières', 'TL', 'E170', 10, 'appendix-a'),
  -- Classe 8 — HAO
  ('81', 'Book value of disposed assets', 'Valeurs comptables des cessions d''immobilisations', 'RO', 'E220', 0, 'appendix-a'),
  ('82', 'Proceeds from asset disposals', 'Produits des cessions d''immobilisations', 'TN', 'E220', 0, 'appendix-a'),
  ('83', 'HAO expenses', 'Charges HAO', 'RP', 'E220', 0, 'appendix-a'),
  ('84', 'HAO income', 'Produits HAO', 'TO', 'E220', 0, 'appendix-a'),
  ('85', 'HAO charges (provisions)', 'Dotations HAO', 'RP', 'E220', 0, 'appendix-a'),
  ('86', 'HAO reversals', 'Reprises HAO', 'TO', 'E220', 0, 'appendix-a'),
  ('87', 'Employee profit-sharing', 'Participation des travailleurs', 'RQ', 'E120', 0, 'appendix-a'),
  ('88', 'Balancing subsidies', 'Subventions d''équilibre', 'TO', 'E220', 0, 'appendix-a'),
  ('89', 'Income tax', 'Impôts sur le résultat', 'RS', 'E180', 0, 'appendix-a');

-- Down Migration

DELETE FROM syscohada_grouping_rule WHERE source = 'appendix-a';
