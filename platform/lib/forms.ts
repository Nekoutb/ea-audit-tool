// Structured-field framework (spec §9.4 hybrid split): fields the linkage
// engine depends on are captured here; free-text narrative lives in the Word
// working paper. Form definitions are code — bilingual, versioned with the app.

import { withTenant } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { requireTenant } from "@/lib/tenant";

export type FieldType = "boolean" | "text" | "select" | "number" | "date";

export interface FormField {
  key: string;
  type: FieldType;
  labelEn: string;
  labelFr: string;
  options?: readonly string[]; // for select
  required?: boolean;
}

export interface FormDefinition {
  code: string;
  fields: readonly FormField[];
  /** Carried forward year-to-year in confirm-or-update mode (spec §8.6). */
  rollsForward?: boolean;
}

const YES_NO_RATING = ["low", "moderate", "high"] as const;

export const FORM_DEFINITIONS: Record<string, FormDefinition> = {
  "D3.1": {
    code: "D3.1",
    fields: [
      { key: "engagement_type", type: "select", options: ["new", "continuing"], required: true, labelEn: "Engagement type", labelFr: "Type de mission" },
      { key: "integrity_ok", type: "boolean", required: true, labelEn: "Client integrity assessed satisfactory", labelFr: "Intégrité du client jugée satisfaisante" },
      { key: "competence_ok", type: "boolean", required: true, labelEn: "Firm competence, capabilities and resources confirmed", labelFr: "Compétence, capacités et ressources du cabinet confirmées" },
      { key: "conflicts_ok", type: "boolean", required: true, labelEn: "Conflicts check performed — no unresolved conflict", labelFr: "Vérification des conflits effectuée — aucun conflit non résolu" },
      { key: "aml_ok", type: "boolean", required: true, labelEn: "AML/KYC checklist completed", labelFr: "Liste de contrôle LBC/FT complétée" },
      { key: "predecessor_ok", type: "boolean", labelEn: "Predecessor auditor communication recorded (new engagements)", labelFr: "Communication avec l'auditeur précédent consignée (nouvelles missions)" },
      { key: "independence_ok", type: "boolean", required: true, labelEn: "Independence of firm and team confirmed", labelFr: "Indépendance du cabinet et de l'équipe confirmée" },
      { key: "risk_rating", type: "select", options: YES_NO_RATING, required: true, labelEn: "Engagement risk rating", labelFr: "Cotation du risque de la mission" },
      { key: "conclusion", type: "select", options: ["accept", "decline"], required: true, labelEn: "Partner conclusion", labelFr: "Conclusion de l'associé" },
    ],
  },
  D1: {
    code: "D1",
    fields: [
      { key: "uses_expert", type: "boolean", labelEn: "Expert used (triggers D4.7)", labelFr: "Recours à un expert (déclenche D4.7)" },
      { key: "uses_service_org", type: "boolean", labelEn: "Service organisation used (triggers D4.8)", labelFr: "Recours à une société de services (déclenche D4.8)" },
      { key: "has_internal_audit", type: "boolean", labelEn: "Internal audit function (triggers D4.9)", labelFr: "Fonction d'audit interne (déclenche D4.9)" },
      { key: "assess_control_env", type: "boolean", labelEn: "Detailed control-environment assessment (triggers D4.5)", labelFr: "Évaluation détaillée de l'environnement de contrôle (déclenche D4.5)" },
      { key: "assess_it_env", type: "boolean", labelEn: "IT environment assessment (triggers D4.6)", labelFr: "Évaluation de l'environnement informatique (déclenche D4.6)" },
    ],
  },
  "D4.1": {
    code: "D4.1",
    fields: [
      { key: "key_directives", type: "text", required: true, labelEn: "Partner's key directives for the engagement", labelFr: "Directives clés de l'associé pour la mission" },
    ],
  },
  "D4.2": {
    code: "D4.2",
    rollsForward: true,
    fields: [
      { key: "ownership_governance", type: "text", required: true, labelEn: "Ownership & governance", labelFr: "Actionnariat et gouvernance" },
      { key: "business_model", type: "text", required: true, labelEn: "Business model", labelFr: "Modèle économique" },
      { key: "industry_factors", type: "text", labelEn: "Industry / regulatory factors", labelFr: "Facteurs sectoriels / réglementaires" },
      { key: "performance_measures", type: "text", labelEn: "Performance measures", labelFr: "Indicateurs de performance" },
      { key: "accounting_policies", type: "text", labelEn: "Accounting policies appropriateness", labelFr: "Pertinence des méthodes comptables" },
      { key: "inherent_risk_factors", type: "text", labelEn: "Inherent risk factors", labelFr: "Facteurs de risque inhérent" },
      { key: "it_dependence", type: "text", labelEn: "IT dependence", labelFr: "Dépendance informatique" },
      { key: "significant_changes", type: "text", labelEn: "Significant changes since last year", labelFr: "Changements significatifs depuis l'exercice précédent" },
    ],
  },
  "D4.3": {
    code: "D4.3",
    fields: [
      { key: "variances_reviewed", type: "boolean", required: true, labelEn: "Preliminary analytical variances reviewed", labelFr: "Variations analytiques préliminaires revues" },
      { key: "key_variances", type: "text", labelEn: "Key variances noted (auto-computed from TB in Phase 3)", labelFr: "Principales variations relevées (calcul auto depuis la balance en phase 3)" },
    ],
  },
  "D4.4": {
    code: "D4.4",
    rollsForward: true,
    fields: [
      { key: "control_environment", type: "text", required: true, labelEn: "Control environment", labelFr: "Environnement de contrôle" },
      { key: "entity_risk_assessment", type: "text", labelEn: "Entity's risk assessment process", labelFr: "Processus d'évaluation des risques de l'entité" },
      { key: "monitoring", type: "text", labelEn: "Monitoring of controls", labelFr: "Suivi des contrôles" },
      { key: "information_system", type: "text", labelEn: "Information system", labelFr: "Système d'information" },
      { key: "control_activities", type: "text", labelEn: "Control activities", labelFr: "Activités de contrôle" },
      { key: "di_controls", type: "text", labelEn: "Controls requiring D&I evaluation (significant risks, journal entries, planned reliance)", labelFr: "Contrôles nécessitant une évaluation conception/mise en œuvre" },
      { key: "di_inquiry", type: "boolean", labelEn: "D&I: inquiry performed", labelFr: "C/MŒ : entretien réalisé" },
      { key: "di_inspection", type: "boolean", labelEn: "D&I: inspection performed", labelFr: "C/MŒ : inspection réalisée" },
    ],
  },
  "D4.5": { code: "D4.5", fields: [{ key: "assessment", type: "text", labelEn: "Control environment assessment", labelFr: "Évaluation de l'environnement de contrôle" }] },
  "D4.6": {
    code: "D4.6",
    rollsForward: true,
    fields: [{ key: "it_environment", type: "text", labelEn: "IT environment & computerized-accounting requirements (SYSCOHADA art. 22)", labelFr: "Environnement informatique et exigences de comptabilité informatisée (art. 22)" }],
  },
  "D4.7": { code: "D4.7", fields: [{ key: "expert_details", type: "text", labelEn: "Expert used, competence & objectivity", labelFr: "Expert utilisé, compétence et objectivité" }] },
  "D4.8": { code: "D4.8", fields: [{ key: "service_org_details", type: "text", labelEn: "Service organisations & reports obtained", labelFr: "Sociétés de services et rapports obtenus" }] },
  "D4.9": { code: "D4.9", fields: [{ key: "internal_audit_details", type: "text", labelEn: "Internal audit function & planned use", labelFr: "Fonction d'audit interne et utilisation prévue" }] },
  "D5.2": {
    code: "D5.2",
    fields: [
      { key: "commitments", type: "text", labelEn: "Commitments identified", labelFr: "Engagements identifiés" },
      { key: "litigation_register", type: "text", labelEn: "Litigation / claims register", labelFr: "Registre des litiges" },
    ],
  },
  "D5.4": {
    code: "D5.4",
    fields: [
      { key: "fraud_triangle", type: "text", required: true, labelEn: "Fraud triangle assessment (incentives, opportunity, rationalisation)", labelFr: "Analyse du triangle de la fraude" },
      { key: "mgmt_inquiries", type: "text", required: true, labelEn: "Inquiries of management", labelFr: "Entretiens avec la direction" },
      { key: "tcwg_inquiries", type: "text", labelEn: "Inquiries of those charged with governance", labelFr: "Entretiens avec les organes de gouvernance" },
    ],
  },
  "D5.5": {
    code: "D5.5",
    fields: [
      { key: "gc_indicators", type: "boolean", required: true, labelEn: "Going-concern doubt indicators present", labelFr: "Indicateurs de doute sur la continuité présents" },
      { key: "gc_details", type: "text", labelEn: "Details (flags procédure d'alerte module when indicators exist)", labelFr: "Détails (déclenche le module procédure d'alerte si indicateurs)" },
    ],
  },
  "D5.6": { code: "D5.6", rollsForward: true, fields: [{ key: "rp_notes", type: "text", labelEn: "Related-party notes (register below)", labelFr: "Notes parties liées (registre ci-dessous)" }] },
  "D5.7": { code: "D5.7", fields: [{ key: "estimates_notes", type: "text", labelEn: "Estimates notes (inventory below)", labelFr: "Notes estimations (inventaire ci-dessous)" }] },
  "D7.1": {
    code: "D7.1",
    fields: [
      { key: "attendees", type: "text", required: true, labelEn: "Attendees (one-person engagements: partner self-review)", labelFr: "Participants (mission à une personne : auto-revue de l'associé)" },
      { key: "discussion_date", type: "date", required: true, labelEn: "Discussion date", labelFr: "Date de la discussion" },
      { key: "fraud_discussion", type: "text", required: true, labelEn: "Fraud susceptibility discussion", labelFr: "Discussion sur la susceptibilité à la fraude" },
    ],
  },
};

export type FormValues = Record<string, unknown>;

export async function loadForm(engagementId: string, code: string): Promise<{
  values: FormValues;
  carried: Set<string>;
}> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ field_key: string; value: unknown; carried_forward: boolean }>(
      "SELECT field_key, value, carried_forward FROM form_response WHERE engagement_id = $1 AND code = $2",
      [engagementId, code],
    );
    const values: FormValues = {};
    const carried = new Set<string>();
    for (const row of result.rows) {
      values[row.field_key] = row.value;
      if (row.carried_forward) carried.add(row.field_key);
    }
    return { values, carried };
  });
}

/** Save answered fields; saving a field confirms it (clears carried_forward). */
export async function saveForm(
  engagementId: string,
  code: string,
  values: FormValues,
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  const definition = FORM_DEFINITIONS[code];
  if (!definition) throw new Error(`unknown form: ${code}`);

  // D4.4 rule (spec §5.2): documenting D&I controls requires BOTH inquiry and
  // inspection to be recorded.
  if (code === "D4.4") {
    const di = String(values.di_controls ?? "").trim();
    if (di && !(values.di_inquiry === true && values.di_inspection === true)) {
      throw new Error("di-both-required");
    }
  }

  await withTenant(tenantId, async (tx) => {
    for (const field of definition.fields) {
      if (!(field.key in values)) continue;
      await tx.query(
        `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by, carried_forward)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         ON CONFLICT (engagement_id, code, field_key)
         DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
                       carried_forward = false, updated_at = now()`,
        [tenantId, engagementId, code, field.key, JSON.stringify(values[field.key]), userId],
      );
    }
  });
}

export function isFormComplete(definition: FormDefinition, values: FormValues): boolean {
  return definition.fields
    .filter((field) => field.required)
    .every((field) => {
      const value = values[field.key];
      if (value === undefined || value === null) return false;
      if (field.type === "text" || field.type === "select" || field.type === "date")
        return String(value).trim().length > 0;
      return true; // booleans/numbers: answered is enough
    });
}

export function fieldLabel(field: FormField, locale: Locale): string {
  return locale === "fr" ? field.labelFr : field.labelEn;
}

/**
 * Carry prior-year understanding forward in confirm-or-update mode (spec §8.6):
 * copies rollsForward form responses and the related-party register from the
 * client's most recent other engagement, flagged carried_forward until edited.
 */
export async function carryForwardFromPriorYear(engagementId: string): Promise<number> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const prior = await tx.query<{ id: string }>(
      `SELECT p.id
         FROM engagement e
         JOIN engagement p ON p.client_id = e.client_id AND p.id <> e.id
              AND p.fiscal_year < e.fiscal_year
        WHERE e.id = $1
        ORDER BY p.fiscal_year DESC
        LIMIT 1`,
      [engagementId],
    );
    const priorId = prior.rows[0]?.id;
    if (!priorId) return 0;

    const codes = Object.values(FORM_DEFINITIONS)
      .filter((d) => d.rollsForward)
      .map((d) => d.code);

    const copied = await tx.query<{ n: string }>(
      `WITH ins AS (
         INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by, carried_forward)
         SELECT $1, $2, code, field_key, value, $4, true
           FROM form_response
          WHERE engagement_id = $3 AND code = ANY($5)
         ON CONFLICT (engagement_id, code, field_key) DO NOTHING
         RETURNING 1
       ) SELECT count(*)::text AS n FROM ins`,
      [tenantId, engagementId, priorId, userId, codes],
    );

    await tx.query(
      `INSERT INTO related_party (tenant_id, engagement_id, name, relationship, notes, carried_forward)
       SELECT $1, $2, name, relationship, notes, true
         FROM related_party rp
        WHERE rp.engagement_id = $3
          AND NOT EXISTS (
            SELECT 1 FROM related_party x
             WHERE x.engagement_id = $2 AND x.name = rp.name
          )`,
      [tenantId, engagementId, priorId],
    );

    return Number(copied.rows[0].n);
  });
}
