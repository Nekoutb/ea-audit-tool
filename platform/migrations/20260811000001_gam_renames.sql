-- GAM roadmap alignment: rename the working papers whose roadmap box maps
-- one-to-one, on every existing engagement. New engagements pick the same
-- titles up from DEFAULT_FILE_INDEX. Idempotent: keyed by stable code.

UPDATE file_item SET title_en = 'Final Overall Financial Statement Review (ISA 520)', title_fr = 'Revue finale globale des états financiers (ISA 520)' WHERE code = 'A1';
UPDATE file_item SET title_en = 'Review and Approval Summary', title_fr = 'Récapitulatif de revue et d''approbation' WHERE code = 'B1';
UPDATE file_item SET title_en = 'Summary Review Memorandum', title_fr = 'Mémorandum récapitulatif de revue' WHERE code = 'B4';
UPDATE file_item SET title_en = 'Summary of Audit Differences', title_fr = 'Récapitulatif des écarts d''audit' WHERE code = 'B5';
UPDATE file_item SET title_en = 'Client Communications — Those Charged with Governance and Management (ISA 260/265)', title_fr = 'Communications avec les responsables de la gouvernance et la direction (ISA 260/265)' WHERE code = 'C1';
UPDATE file_item SET title_en = 'Prepare Audit Strategies Memorandum', title_fr = 'Préparer le mémorandum de stratégie d''audit' WHERE code = 'D1';
UPDATE file_item SET title_en = 'Consider Client Acceptance / Continuance Results', title_fr = 'Examiner l''acceptation / le maintien du client' WHERE code = 'D3.1';
UPDATE file_item SET title_en = 'Understand the Business — the Entity, its Environment and the Applicable Framework (ISA 315)', title_fr = 'Connaissance de l''entité, de son environnement et du référentiel comptable applicable (ISA 315)' WHERE code = 'D4.2';
UPDATE file_item SET title_en = 'Assess Internal Control at the Entity Level', title_fr = 'Évaluer le contrôle interne au niveau de l''entité' WHERE code = 'D4.4';
UPDATE file_item SET title_en = 'Understand the IT Environment and Determine IT Involvement', title_fr = 'Comprendre l''environnement informatique et déterminer l''implication IT' WHERE code = 'D4.6';
UPDATE file_item SET title_en = 'Determine Materiality — PM, TE and SAD Nominal Amount (ISA 320)', title_fr = 'Déterminer le seuil de signification — PM, TE et seuil SAD (ISA 320)' WHERE code = 'D5.1';
UPDATE file_item SET title_en = 'Identify Fraud Risks and Determine Responses (ISA 240)', title_fr = 'Identifier les risques de fraude et déterminer les réponses (ISA 240)' WHERE code = 'D5.4';
UPDATE file_item SET title_en = 'Engagement Team Discussion', title_fr = 'Discussion de l''équipe de mission' WHERE code = 'D7.1';
UPDATE file_item SET title_en = 'Make Combined Risk Assessments (Risk Register)', title_fr = 'Établir l''évaluation combinée des risques (registre des risques)' WHERE code = 'D7.2';
UPDATE file_item SET title_en = 'Tests of Journal Entries & Mandatory Fraud Procedures (ISA 240)', title_fr = 'Tests des écritures comptables et procédures obligatoires de fraude (ISA 240)' WHERE code = 'E350';
