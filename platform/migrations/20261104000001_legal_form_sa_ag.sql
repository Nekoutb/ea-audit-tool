-- F052 (firm decision 2026-10-27): the SA with an administrateur général.
--
-- The AUSCGIE lets an SA with few shareholders be run by an administrateur
-- général instead of a board of directors (arts. 494 et s. — à valider). The
-- statutory papers C5.3–C5.10 and the documents lib/legal.ts generates name
-- the organ they address (conseil d'administration, PCA, DG…), so the file
-- must know which SA it is on. lib/legal-forms.ts adds 'SA_AG' to the legal
-- forms; this widens the CHECK on client.legal_form to accept it. No row
-- changes: an existing 'SA' stays an SA with a board until the firm says
-- otherwise on the client record.

-- Up Migration

ALTER TABLE client DROP CONSTRAINT IF EXISTS client_legal_form_check;
ALTER TABLE client
  ADD CONSTRAINT client_legal_form_check
  CHECK (legal_form IN ('SA', 'SA_AG', 'SARL', 'SAS', 'GIE', 'OTHER'));

-- Down Migration

-- An SA_AG returns to the generic SA (the distinction is lost, nothing is
-- deleted), then the original list is restored.
UPDATE client SET legal_form = 'SA' WHERE legal_form = 'SA_AG';
ALTER TABLE client DROP CONSTRAINT IF EXISTS client_legal_form_check;
ALTER TABLE client
  ADD CONSTRAINT client_legal_form_check
  CHECK (legal_form IN ('SA', 'SARL', 'SAS', 'GIE', 'OTHER'));
