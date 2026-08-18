-- E4 account workpapers: primary substantive procedures generate as
-- program_step rows with source 'psp' (user-added "other substantive
-- procedures" reuse 'custom').

-- Up Migration

ALTER TABLE program_step DROP CONSTRAINT IF EXISTS program_step_source_check;
ALTER TABLE program_step ADD CONSTRAINT program_step_source_check
  CHECK (source IN ('library', 'custom', 'risk_extension', 'psp'));

-- Down Migration

ALTER TABLE program_step DROP CONSTRAINT IF EXISTS program_step_source_check;
ALTER TABLE program_step ADD CONSTRAINT program_step_source_check
  CHECK (source IN ('library', 'custom', 'risk_extension'));
