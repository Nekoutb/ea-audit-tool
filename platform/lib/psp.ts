// Primary substantive procedures per lead index. Structure follows the firm's
// substantive-procedures guide (one procedure set per significant account,
// indexed with the SAME letters as the significant accounts); wording is
// original and anchored to the ISAs. Generated steps live in program_step
// (source 'psp'); user-added "other substantive procedures" use source
// 'manual'. Per-step results save under form_response code 'psp:<task code>'.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { INDEX_SECTION } from "@/lib/lead-classes";

interface PspDef {
  en: string;
  fr: string;
  a: string; // assertions, e.g. "E,A,V"
}

const P = (en: string, fr: string, a: string): PspDef => ({ en, fr, a });

export const PSP_CATALOG: Record<string, PspDef[]> = {
  C: [
    P("Obtain bank confirmations for all accounts and agree confirmed balances to the reconciliations.", "Obtenir les confirmations bancaires pour tous les comptes et rapprocher les soldes confirmés des états de rapprochement.", "E,A"),
    P("Test the year-end bank reconciliations: trace to statements, verify arithmetic, and vouch significant reconciling items to clearance after year end.", "Tester les rapprochements bancaires de clôture : pointer aux relevés, vérifier l'arithmétique et justifier l'apurement des éléments significatifs après la clôture.", "E,A,C"),
    P("Review cash cut-off around the period end for transfers recorded in the wrong period.", "Revoir la césure de trésorerie autour de la clôture pour détecter les virements comptabilisés sur la mauvaise période.", "C,A"),
    P("Translate foreign-currency balances at closing rates and recompute the difference.", "Convertir les soldes en devises au cours de clôture et recalculer l'écart.", "V"),
  ],
  E: [
    P("Confirm a sample of customer balances (positive form) and reconcile replies; apply alternative procedures (subsequent cash, invoices, delivery evidence) to non-responses.", "Confirmer un échantillon de soldes clients (forme positive) et rapprocher les réponses ; appliquer des procédures alternatives (encaissements subséquents, factures, preuves de livraison) aux non-réponses.", "E,A"),
    P("Test subsequent cash receipts against the year-end balance for the sample and significant unconfirmed accounts.", "Tester les encaissements subséquents sur le solde de clôture pour l'échantillon et les comptes significatifs non confirmés.", "E,V"),
    P("Test sales cut-off: last shipments/invoices of the period and first of the next against delivery evidence.", "Tester la césure des ventes : dernières livraisons/factures de la période et premières de la suivante contre les preuves de livraison.", "C,A"),
    P("Assess the allowance for doubtful accounts against the aging, subsequent collections and known credit events; recompute the calculation.", "Apprécier la dépréciation des créances au regard de la balance âgée, des encaissements subséquents et des événements de crédit connus ; recalculer la provision.", "V"),
    P("Reconcile the receivables sub-ledger to the general ledger and investigate reconciling items.", "Rapprocher la balance auxiliaire clients du grand livre et analyser les écarts.", "C,A"),
  ],
  F: [
    P("Attend the physical inventory count, perform test counts both ways, and trace counts into the final compilation.", "Assister à l'inventaire physique, effectuer des comptages test dans les deux sens et suivre les comptages jusqu'à la récapitulation finale.", "E,C"),
    P("Test the pricing of inventory items to purchase invoices or production cost records.", "Tester la valorisation des articles par référence aux factures d'achat ou aux coûts de production.", "V,A"),
    P("Test net realisable value: compare carrying amounts to post-year-end selling prices and assess slow-moving or obsolete lines.", "Tester la valeur nette de réalisation : comparer aux prix de vente après clôture et apprécier les articles à rotation lente ou obsolètes.", "V"),
    P("Test inventory cut-off around the count date using receiving and shipping records.", "Tester la césure des stocks autour de la date d'inventaire à partir des bons de réception et d'expédition.", "C,A"),
  ],
  K: [
    P("Vouch significant additions to invoices, contracts and evidence of ownership; inspect major new assets.", "Justifier les acquisitions significatives par factures, contrats et preuves de propriété ; inspecter les immobilisations majeures nouvelles.", "E,A,V"),
    P("Vouch disposals to sales evidence and recompute gains or losses.", "Justifier les cessions et recalculer les plus ou moins-values.", "E,A"),
    P("Recompute depreciation by category against the stated useful lives and check consistency with prior periods.", "Recalculer les amortissements par catégorie selon les durées d'utilité retenues et vérifier la permanence des méthodes.", "V,A"),
    P("Consider indicators of impairment and test any impairment recognised or required.", "Rechercher les indices de perte de valeur et tester toute dépréciation constatée ou requise.", "V"),
    P("Reconcile the fixed asset register to the general ledger.", "Rapprocher le fichier des immobilisations du grand livre.", "C,A"),
  ],
  N: [
    P("Search for unrecorded liabilities: examine post-year-end payments and unmatched receiving reports/invoices.", "Rechercher les passifs non comptabilisés : examiner les paiements après clôture et les réceptions/factures non rapprochées.", "C"),
    P("Reconcile significant supplier statements to recorded balances.", "Rapprocher les relevés fournisseurs significatifs des soldes comptabilisés.", "C,A,E"),
    P("Test purchases cut-off around the period end against receiving records.", "Tester la césure des achats autour de la clôture à partir des bons de réception.", "C,A"),
    P("Reconcile the payables sub-ledger to the general ledger and investigate reconciling items.", "Rapprocher la balance auxiliaire fournisseurs du grand livre et analyser les écarts.", "C,A"),
  ],
  T: [
    P("Agree share capital and movements to statutes, minutes and legal filings.", "Rapprocher le capital et ses mouvements des statuts, procès-verbaux et formalités légales.", "E,A,P"),
    P("Recompute the allocation of prior-year result and verify dividend approvals and payments.", "Recalculer l'affectation du résultat antérieur et vérifier l'approbation et le paiement des dividendes.", "A,P"),
    P("Roll forward each equity component from prior-year closing to current-year closing.", "Reconstituer chaque composante des capitaux propres de la clôture précédente à la clôture actuelle.", "C,A"),
  ],
  Q: [
    P("Confirm loan balances, terms and covenants with lenders; agree to loan agreements.", "Confirmer les emprunts, conditions et covenants auprès des prêteurs ; rapprocher des contrats.", "E,A,C"),
    P("Recompute interest expense and accrued interest from the terms; agree repayments to bank.", "Recalculer les intérêts et intérêts courus à partir des conditions ; rapprocher les remboursements de la banque.", "A,V"),
    P("Test the current/non-current split and covenant compliance at the closing date.", "Tester la ventilation courant/non courant et le respect des covenants à la clôture.", "P,V"),
  ],
  L: [
    P("Vouch additions to contracts and invoices; assess whether capitalisation criteria are met.", "Justifier les entrées par contrats et factures ; apprécier le respect des critères d'immobilisation.", "E,A,V"),
    P("Recompute amortisation and test for impairment indicators.", "Recalculer les amortissements et rechercher les indices de perte de valeur.", "V"),
  ],
  J: [
    P("Confirm or vouch financial assets to supporting documentation and test valuation at closing.", "Confirmer ou justifier les actifs financiers et tester leur évaluation à la clôture.", "E,V"),
    P("Recompute income (interest, dividends) from the underlying terms.", "Recalculer les produits (intérêts, dividendes) à partir des conditions sous-jacentes.", "A,C"),
  ],
  "O1": [
    P("Agree tax receivables to filed returns and assessments; assess recoverability.", "Rapprocher les créances fiscales des déclarations et avis ; apprécier leur recouvrabilité.", "E,V"),
  ],
  "O2": [
    P("Agree tax payables to filed returns; recompute the closing liability and test subsequent payment.", "Rapprocher les dettes fiscales des déclarations ; recalculer le passif de clôture et tester le paiement subséquent.", "C,A,V"),
  ],
  "O4": [
    P("Recompute the income tax charge from the taxable result and reconcile to the returns.", "Recalculer la charge d'impôt à partir du résultat fiscal et la rapprocher des déclarations.", "A,V"),
  ],
  "I1": [
    P("Confirm intercompany balances with counterparties and reconcile differences.", "Confirmer les soldes intragroupe avec les contreparties et rapprocher les écarts.", "E,A,C"),
  ],
  "I2": [
    P("Confirm intercompany balances with counterparties and reconcile differences.", "Confirmer les soldes intragroupe avec les contreparties et rapprocher les écarts.", "E,A,C"),
  ],
  "P1": [
    P("Assess the basis, computation and movement of each provision against the recognition criteria; consider legal confirmations.", "Apprécier le fondement, le calcul et l'évolution de chaque provision au regard des critères de comptabilisation ; considérer les confirmations d'avocats.", "C,V,E"),
  ],
  "P2": [
    P("Recompute payroll liabilities (salaries, social bodies) and agree to declarations and subsequent payment.", "Recalculer les dettes sociales (salaires, organismes) et rapprocher des déclarations et paiements subséquents.", "C,A,V"),
  ],
  "P3": [
    P("Test the nature and support of suspense and deferred income items and their release.", "Tester la nature et la justification des comptes d'attente et produits constatés d'avance et leur reprise.", "C,A,P"),
  ],
  "G2": [
    P("Vouch significant other current assets to support and assess recoverability.", "Justifier les autres actifs courants significatifs et apprécier leur recouvrabilité.", "E,V"),
  ],
};

/** Generic set for indexes without a bespoke list (incl. income statement). */
const GENERIC: PspDef[] = [
  P("Build an expectation for the balance from underlying drivers and investigate variances beyond the threshold (substantive analytics).", "Construire une attente du solde à partir de ses déterminants et analyser les écarts au-delà du seuil (procédures analytiques de substance).", "C,A"),
  P("Vouch a sample of recorded entries to supporting documents.", "Justifier un échantillon d'écritures par les pièces probantes.", "E,A"),
  P("Test cut-off around the period end.", "Tester la césure autour de la clôture.", "C,A"),
];

export function pspFor(indexCode: string): PspDef[] {
  return PSP_CATALOG[indexCode] ?? GENERIC;
}

/** The lead indexes feeding an E4 task code. */
export function indexesForTask(taskCode: string): string[] {
  return Object.entries(INDEX_SECTION)
    .filter(([, t]) => t === taskCode)
    .map(([i]) => i);
}

export interface PspStep {
  id: string;
  seq: number;
  description: string;
  assertions: string[];
  source: string;
  status: string;
}

/** Generate the PSPs for the task's in-index accounts (idempotent). */
export async function generatePsp(
  engagementId: string,
  fileItemId: string,
  taskCode: string,
  presentIndexes: string[],
): Promise<number> {
  const { tenantId } = await requireTenant();
  const indexes = indexesForTask(taskCode).filter((i) => presentIndexes.includes(i));
  if (indexes.length === 0) return 0;
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.query(
      "SELECT 1 FROM program_step WHERE file_item_id = $1 AND source = 'psp' LIMIT 1",
      [fileItemId],
    );
    if (existing.rows[0]) return 0;
    let seq = 0;
    let n = 0;
    let firstStepId: string | null = null;
    for (const idx of indexes) {
      let i = 0;
      for (const proc of pspFor(idx)) {
        i += 1;
        seq += 10;
        n += 1;
        const inserted = await tx.query<{ id: string }>(
          `INSERT INTO program_step (tenant_id, engagement_id, file_item_id, seq, description, assertions, source)
           VALUES ($1, $2, $3, $4, $5, $6, 'psp') RETURNING id`,
          [tenantId, engagementId, fileItemId, seq, `${idx}${i} — ${proc.en}`, proc.a.split(","), ],
        );
        if (!firstStepId) firstStepId = inserted.rows[0].id;
      }
    }
    // the procedures ARE the response: link the account's live significant
    // risks so the planning stand-back sees them answered
    if (firstStepId) await linkSectionRisks(tx, tenantId, fileItemId, firstStepId);
    return n;
  });
}

async function linkSectionRisks(
  tx: { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> },
  tenantId: string,
  fileItemId: string,
  stepId: string,
): Promise<void> {
  await tx.query(
    `INSERT INTO risk_response (tenant_id, risk_id, program_step_id)
     SELECT $1, rs.risk_id, $3 FROM risk_section rs
       JOIN risk r ON r.id = rs.risk_id AND r.rebutted = false
      WHERE rs.file_item_id = $2
     ON CONFLICT DO NOTHING`,
    [tenantId, fileItemId, stepId],
  );
}

/** Add one "other substantive procedure" (user-defined). */
export async function addOtherPsp(
  engagementId: string,
  fileItemId: string,
  description: string,
  assertions: string[],
): Promise<void> {
  const { tenantId } = await requireTenant();
  if (!description.trim()) throw new Error("description-required");
  await withTenant(tenantId, async (tx) => {
    const next = await tx.query<{ v: number; n: number }>(
      "SELECT coalesce(max(seq), 0) + 10 AS v, count(*) FILTER (WHERE description LIKE 'OSP-%')::int + 1 AS n FROM program_step WHERE file_item_id = $1",
      [fileItemId],
    );
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO program_step (tenant_id, engagement_id, file_item_id, seq, description, assertions, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'custom') RETURNING id`,
      [tenantId, engagementId, fileItemId, next.rows[0].v, `OSP-${next.rows[0].n} — ${description.trim()}`, assertions.filter((a) => "CEAVP".includes(a))],
    );
    await linkSectionRisks(tx, tenantId, fileItemId, inserted.rows[0].id);
  });
}

/** The working-paper fields each procedure carries (sketch: E1 open row). */
const PSP_FIELDS = new Set([
  "r",
  "finding",
  "adj_debit_account",
  "adj_debit_amount",
  "adj_credit_account",
  "adj_credit_amount",
]);

/** Save one of a step's working-paper fields under the task's psp paper. */
export async function savePspResult(
  engagementId: string,
  taskCode: string,
  stepId: string,
  value: string,
  field = "r",
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!/^[0-9a-f-]{36}$/.test(stepId)) throw new Error("invalid-step");
  if (!PSP_FIELDS.has(field)) throw new Error("invalid-field");
  const key = `${field}_${stepId}`;
  await withTenant(tenantId, async (tx) => {
    if (value.trim() === "") {
      await tx.query(
        "DELETE FROM form_response WHERE engagement_id = $1 AND code = $2 AND field_key = $3",
        [engagementId, `psp:${taskCode}`, key],
      );
      return;
    }
    await tx.query(
      `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by)
       VALUES ($1, $2, $3, $4, to_jsonb($5::text), $6)
       ON CONFLICT (engagement_id, code, field_key)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [tenantId, engagementId, `psp:${taskCode}`, key, value, userId],
    );
  });
}

export async function pspResults(engagementId: string, taskCode: string): Promise<Record<string, string>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ field_key: string; value: string }>(
      "SELECT field_key, value #>> '{}' AS value FROM form_response WHERE engagement_id = $1 AND code = $2",
      [engagementId, `psp:${taskCode}`],
    );
    return Object.fromEntries(r.rows.map((row) => [row.field_key, row.value]));
  });
}
