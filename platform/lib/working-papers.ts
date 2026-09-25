// The working paper that sits inside every task, mirroring the engagement-console
// design proposal: a standards anchor, the record the paper owns, fields the tool
// layer fills in (read-only, shown as "from a tool"), and the judgement fields the
// preparer completes. Persisted in form_response under a `wp:` code prefix so it
// never collides with the legacy FORM_DEFINITIONS forms.

import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { recordActivity } from "@/lib/activity";
import { withTenant } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { MGMT_OVERRIDE_PROCEDURE } from "@/lib/risks";
import { requireTenant, requireWrite } from "@/lib/tenant";
import { ACCEPTANCE_PAPERS } from "@/lib/papers/acceptance";
import { STRATEGY_PAPERS } from "@/lib/papers/strategy";
import { EXECUTION_PAPERS } from "@/lib/papers/execution";
import { ITGC_PAPERS } from "@/lib/papers/itgc";
import { JOURNAL_ENTRY_PAPERS } from "@/lib/papers/journal-entries";
import { FINANCIAL_STATEMENT_PAPERS } from "@/lib/papers/financial-statements";
import { STATUTORY_525_PAPERS } from "@/lib/papers/statutory-525";
import { CONCLUSION_PAPERS } from "@/lib/papers/conclusion";
import { GAM_PAPERS } from "@/lib/papers/gam";
import { paperKeys, requiredKeys, type PaperDef, type PaperField, conclKey, conclWhyKey, ynKey, ynWhyKey } from "@/lib/papers/types";
import { groupOfTask, type SectionKey } from "@/lib/task-groups";

export type { PaperField, PaperDef, PaperSection, PaperProc, PaperItem } from "@/lib/papers/types";

const PROCEDURES: PaperField = {
  key: "procedures",
  kind: "input",
  labelEn: "Procedures performed",
  labelFr: "Procédures mises en œuvre",
};
const RESULTS: PaperField = {
  key: "results",
  kind: "input",
  labelEn: "Results, with the working-paper reference of the evidence filed",
  labelFr: "Résultats, avec la référence du dossier de travail",
};
const EXCEPTIONS: PaperField = {
  key: "exceptions",
  kind: "input",
  labelEn: "Exceptions identified and how each was resolved",
  labelFr: "Exceptions relevées et leur résolution",
};
const CONCLUSION: PaperField = {
  key: "conclusion",
  kind: "input",
  labelEn: "Conclusion",
  labelFr: "Conclusion",
};

/** Anchor and framing per group, used where a task has no bespoke paper. */
const GROUP_DEFAULT: Record<string, { std: string; en: string; fr: string }> = {
  p1: { std: "ISQM 1 ¶30 · ISA 220 (Revised) ¶22–28 · ISA 210", en: "the acceptance conclusion", fr: "la conclusion d'acceptation" },
  p2: { std: "IESBA Code · ISA 220 (Revised) ¶16–21", en: "the independence and resourcing record", fr: "le dossier indépendance et moyens" },
  p3: { std: "ISA 315 (Revised 2019) ¶19, ¶A56–A67", en: "the understanding of the business", fr: "la connaissance de l'activité" },
  p4: { std: "ISA 315 (Revised 2019) ¶21–27", en: "the entity-level control and IT conclusion", fr: "la conclusion contrôles de l'entité et informatique" },
  p5: { std: "ISA 240 ¶17–27 · ISA 315 (Revised 2019) ¶17", en: "the fraud risk record and team discussion", fr: "le dossier risques de fraude et discussion d'équipe" },
  p6: { std: "ISA 320 · ISA 315 (Revised 2019) ¶28–29", en: "the materiality and scoping record", fr: "le seuil de signification et le périmètre" },
  p7: { std: "ISA 300 ¶7–12 · ISA 220 (Revised) ¶22–35 · ISQM 1", en: "the planning approval", fr: "l'approbation de la planification" },
  s1: { std: "ISA 315 (Revised 2019) ¶25–26, ¶A136–A150", en: "the transaction-flow understanding", fr: "la compréhension des flux de transactions" },
  s2: { std: "ISA 330 ¶8–11", en: "the controls-reliance strategy", fr: "la stratégie d'appui sur les contrôles" },
  s3: { std: "ISA 315 (Revised 2019) ¶28–34 · ISA 330 ¶5–15", en: "the combined risk assessment and planned responses", fr: "l'évaluation combinée des risques et les réponses" },
  s4: { std: "ISA 402 · ISA 610 (Revised) · ISA 620", en: "the reliance on others' work", fr: "l'utilisation des travaux de tiers" },
  s5: { std: "ISA 300 ¶7–12", en: "the audit strategies memorandum", fr: "le mémorandum de stratégie d'audit" },
  e1: { std: "ISA 330 ¶8–17 · ISA 315 (Revised 2019) ¶26(b)–(c)", en: "the controls testing conclusion", fr: "la conclusion des tests de contrôles" },
  e2: { std: "ISA 330 ¶12–14 · ISA 315 (Revised 2019) ¶26(b)", en: "the controls conclusion carried from the interim to the year end", fr: "la conclusion sur les contrôles reportée de l'intérim à la clôture" },
  // There is no e3 here because there is no e3 group: journal-entry testing was
  // the whole of it, and that work now sits with the other general procedures in
  // e5. What stayed behind in e6 is the records, the opening balances and the
  // reassessment, which is why neither anchor reads as it did before.
  e4: { std: "ISA 330 ¶18–23 · ISA 500 · ISA 520", en: "the evidence obtained on the account", fr: "les éléments probants du compte" },
  e5: { std: "ISA 240 ¶32–33 · ISA 501 · ISA 540 · ISA 550 · ISA 560 · ISA 570 (Revised)", en: "the general audit procedure and what it found", fr: "la procédure générale d'audit et ses constats" },
  e6: { std: "ISA 230 ¶8–11 · ISA 510 · ISA 710 · ISA 315 (Revised 2019) ¶37", en: "the statutory records, the opening balances and the reassessed risks", fr: "les registres légaux, les soldes d'ouverture et les risques réévalués" },
  c1: { std: "ISA 450 ¶10–15 · ISA 701", en: "the evaluation of audit differences", fr: "l'évaluation des écarts d'audit" },
  c2: { std: "ISA 520 ¶6 · ISA 560 · ISA 570 (Revised)", en: "the final review conclusion", fr: "la conclusion de revue finale" },
  c3: { std: "ISA 580 · ISA 505", en: "the representations obtained", fr: "les déclarations obtenues" },
  c4: { std: "ISA 700 ¶12–15 · ISA 220 (Revised) ¶29–35", en: "the review and approval record", fr: "le dossier de revue et d'approbation" },
  c5: { std: "ISA 260 (Revised) · ISA 265 · OHADA — Acte uniforme (sociétés commerciales)", en: "the communications and statutory record", fr: "le dossier communications et obligations légales" },
  c6: { std: "ISA 230 ¶14–16 · ISQM 1 ¶31(f)", en: "the assembly and archive record", fr: "le dossier d'assemblage et d'archivage" },
};

/** Every task's paper, one map per phase, consulted in phase order. */
const ALL_PAPERS: Record<string, PaperDef> = {
  ...ACCEPTANCE_PAPERS,
  ...STRATEGY_PAPERS,
  ...EXECUTION_PAPERS,
  ...ITGC_PAPERS,
  ...JOURNAL_ENTRY_PAPERS,
  ...FINANCIAL_STATEMENT_PAPERS,
  ...STATUTORY_525_PAPERS,
  ...CONCLUSION_PAPERS,
  ...GAM_PAPERS,
};

/** The paper for a task: bespoke where defined, otherwise built from its group. */
export function paperFor(code: string): PaperDef {
  const bespoke = ALL_PAPERS[code];
  if (bespoke) return bespoke;
  const group = groupOfTask(code);
  const d = (group && GROUP_DEFAULT[group.id]) ?? {
    std: "ISA 230 ¶8–11",
    en: "the work performed and the conclusion reached",
    fr: "les travaux effectués et la conclusion",
  };
  return {
    std: d.std,
    ownsEn: d.en,
    ownsFr: d.fr,
    fields: [PROCEDURES, RESULTS, EXCEPTIONS, CONCLUSION],
  };
}

export function paperOwns(def: PaperDef, locale: "en" | "fr"): string {
  return locale === "fr" ? def.ownsFr : def.ownsEn;
}
export function fieldLabelOf(f: PaperField, locale: "en" | "fr"): string {
  return locale === "fr" ? f.labelFr : f.labelEn;
}

/** A paper is complete when every input field carries text. */
export function paperComplete(def: PaperDef, values: Record<string, string>): boolean {
  return requiredKeys(def).every((k) => (values[k] ?? "").trim().length > 0);
}

/** Answered fields over required fields, for the progress count. */
export function paperProgress(def: PaperDef, values: Record<string, string>): { done: number; total: number } {
  const keys = requiredKeys(def);
  return { done: keys.filter((k) => (values[k] ?? "").trim().length > 0).length, total: keys.length };
}

/** True when the task carries a bespoke paper definition (not the group-derived default). */
export function hasBespokePaper(code: string): boolean {
  return Boolean(ALL_PAPERS[code]);
}

/**
 * What still stops a paper being signed (UAT B17): every required field, every
 * Yes/No factor and every conclusion statement must carry an answer, and a
 * "No" must carry its explanation. An explicit N/A is an answer.
 */
export function paperMissing(def: PaperDef, values: Record<string, string>): string[] {
  const v = (k: string) => (values[k] ?? "").trim();
  const missing = requiredKeys(def).filter((k) => v(k).length === 0);
  for (const s of def.sections ?? []) {
    if (s.kind !== "yn") continue;
    for (const item of s.items) {
      if (v(ynKey(item.key)) === "no" && v(ynWhyKey(item.key)).length === 0) missing.push(ynWhyKey(item.key));
    }
  }
  (def.conclEn ?? []).forEach((_, i) => {
    if (v(conclKey(i)) === "no" && v(conclWhyKey(i)).length === 0) missing.push(conclWhyKey(i));
  });
  return missing;
}

const WP = (code: string) => `wp:${code}`;

/**
 * The reason carried on a signature voided because the paper changed under it
 * (bilingual: it is read by whoever opens the paper next, in either language).
 */
export const SIGNOFF_INVALIDATED_REASON =
  "Paper content changed after sign-off — contenu de la feuille modifié après la signature";

/**
 * Deterministic serialisation of a paper's content: field keys sorted, so two
 * runs over the same content always produce the same bytes (and therefore the
 * same hash) regardless of row order.
 */
function serialisePaper(
  fields: Record<string, string>,
  sectionConclusion: { conclusion: string; objectivesAchieved: boolean } | null,
): string {
  const sorted = Object.keys(fields)
    .sort()
    .map((key) => [key, fields[key]] as [string, string]);
  return JSON.stringify({ fields: sorted, sectionConclusion });
}

/**
 * The hash of everything a sign-off attests to for one file-index item: the
 * paper's answers (form_response under `wp:<code>`) plus the section conclusion
 * where the item has one. Stored on the signoff row at signing time so a later
 * edit can be detected instead of silently inheriting the signature.
 */
export async function paperContentHashTx(
  tx: PoolClient,
  engagementId: string,
  code: string,
): Promise<string> {
  const answers = await tx.query<{ field_key: string; value: string | null }>(
    `SELECT field_key, value #>> '{}' AS value
       FROM form_response
      WHERE engagement_id = $1 AND code = $2
      ORDER BY field_key`,
    [engagementId, WP(code)],
  );
  const fields: Record<string, string> = {};
  for (const row of answers.rows) fields[row.field_key] = row.value ?? "";

  const conclusion = await tx.query<{ conclusion: string; objectives_achieved: boolean }>(
    `SELECT sc.conclusion, sc.objectives_achieved
       FROM section_conclusion sc
       JOIN file_item fi ON fi.id = sc.file_item_id
      WHERE fi.engagement_id = $1 AND fi.code = $2`,
    [engagementId, code],
  );
  const row = conclusion.rows[0];
  // Content a paper carries outside its own wp: answers — the legacy form,
  // and the structured records some papers are the front of. Folded into the
  // same hash so an edit there voids the signature exactly as an answer does.
  const extra = await structuredContentDigest(tx, engagementId, code);
  return createHash("sha256")
    .update(
      serialisePaper(
        fields,
        row ? { conclusion: row.conclusion, objectivesAchieved: row.objectives_achieved } : null,
      ) + (extra ? `|${extra}` : ""),
      "utf8",
    )
    .digest("hex");
}

/**
 * The structured records a paper attests to besides its wp: answers, keyed by
 * task code: the legacy FORM_DEFINITIONS rows (P1.1, S6.1 …), the close
 * process (S1.4), the walkthroughs (S1.3), the IT applications (S2.3/S2.5),
 * the SCOT register (S1.1), the WCGWs and controls (S1.2), the selection
 * (S2.1), the test design (S2.2) and the test results (E1.2). Each source is
 * reduced to one md5 in SQL over a deterministic ordering; the digests are
 * joined in a fixed order. Empty when the paper has no such source.
 */
async function structuredContentDigest(tx: PoolClient, engagementId: string, code: string): Promise<string> {
  const parts: string[] = [];
  const digest = async (sql: string, params: unknown[]) => {
    const r = await tx.query<{ d: string | null }>(sql, params);
    parts.push(r.rows[0]?.d ?? "");
  };
  const responses = (codeExpr: string) =>
    `SELECT md5(coalesce(string_agg(field_key || '=' || coalesce(value::text, ''), '|' ORDER BY code, field_key), '')) AS d
       FROM form_response WHERE engagement_id = $1 AND ${codeExpr}`;
  // the legacy structured form of the same code (every code; cheap when absent)
  await digest(responses("code = $2"), [engagementId, code]);
  if (code === "S1.4") await digest(responses("code = 'fscp'"), [engagementId]);
  if (code === "S1.3") await digest(responses("code LIKE 'wt:%'"), [engagementId]);
  if (code === "S2.3" || code === "S2.5") await digest(responses("code = 'itapps'"), [engagementId]);
  if (code === "S1.1") {
    await digest(
      `SELECT md5(coalesce(string_agg(s.id || ':' || s.name || ':' || coalesce(s.description, '') || ':' || s.transaction_type
                  || ':' || s.strategy || ':' || coalesce(s.applications, '')
                  || ':' || coalesce((SELECT string_agg(si.index_code || array_to_string(si.assertions, ''), ',' ORDER BY si.index_code)
                                        FROM scot_index si WHERE si.scot_id = s.id), ''), '|' ORDER BY s.id), '')) AS d
         FROM scot s WHERE s.engagement_id = $1`,
      [engagementId],
    );
  }
  if (code === "S1.2") {
    await digest(
      `SELECT md5(coalesce(string_agg(x, '|' ORDER BY x), '')) AS d FROM (
         SELECT w.id || ':' || w.description || ':' || array_to_string(w.assertions, '') AS x
           FROM wcgw w JOIN scot s ON s.id = w.scot_id WHERE s.engagement_id = $1
         UNION ALL
         SELECT c.id || ':' || c.name || ':' || coalesce(c.owner, '') || ':' || c.control_type || ':' || coalesce(c.frequency, '') || ':' || c.objective
           FROM scot_control c JOIN scot s ON s.id = c.scot_id WHERE s.engagement_id = $1
         UNION ALL
         SELECT wc.wcgw_id || '>' || wc.control_id
           FROM wcgw_control wc JOIN wcgw w ON w.id = wc.wcgw_id JOIN scot s ON s.id = w.scot_id WHERE s.engagement_id = $1
       ) t`,
      [engagementId],
    );
  }
  if (code === "S2.1") {
    await digest(
      `SELECT md5(coalesce(string_agg(c.id || ':' || c.selected_for_testing::text, '|' ORDER BY c.id), '')) AS d
         FROM scot_control c JOIN scot s ON s.id = c.scot_id WHERE s.engagement_id = $1`,
      [engagementId],
    );
  }
  if (code === "S2.2") {
    await digest(
      `SELECT md5(coalesce(string_agg(c.id || ':' || coalesce(c.test_design, '') || ':' || coalesce(c.design_eval, '')
                  || ':' || coalesce(c.implemented::text, '') || ':' || coalesce(c.sample_size::text, '') || ':' || coalesce(c.sample_note, ''),
                  '|' ORDER BY c.id), '')) AS d
         FROM scot_control c JOIN scot s ON s.id = c.scot_id WHERE s.engagement_id = $1`,
      [engagementId],
    );
  }
  if (code === "E1.2") {
    await digest(
      `SELECT md5(coalesce(string_agg(c.id || ':' || coalesce(c.operating_notes, '') || ':' || coalesce(c.operating_eval, '')
                  || ':' || coalesce(c.toc_population::text, '') || ':' || coalesce(c.toc_grid::text, '')
                  || ':' || coalesce(array_to_string(c.toc_sample_items, ','), ''), '|' ORDER BY c.id), '')) AS d
         FROM scot_control c JOIN scot s ON s.id = c.scot_id WHERE s.engagement_id = $1`,
      [engagementId],
    );
  }
  return parts.join("/");
}

/** Same hash, on its own connection (for callers outside a transaction). */
export async function paperContentHash(engagementId: string, code: string): Promise<string> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, (tx) => paperContentHashTx(tx, engagementId, code));
}

export interface InvalidatedSignoff {
  id: string;
  role: string;
  document_id: string;
  user_id: string;
  title: string;
}

/**
 * Void every active signature on this item whose content_hash no longer matches
 * the paper. The row stays (history is never rewritten) and records WHY it was
 * voided; voided_at is set alongside invalidated_at so gates, dashboards and
 * exports — which all read `voided_at IS NULL` — stop treating it as an
 * attestation. A paper left without a valid reviewer signature returns to draft
 * so it can be re-signed over the content that now exists.
 */
export async function invalidateStaleSignoffs(
  tx: PoolClient,
  engagementId: string,
  code: string,
): Promise<InvalidatedSignoff[]> {
  const hash = await paperContentHashTx(tx, engagementId, code);
  const stale = await tx.query<InvalidatedSignoff>(
    `UPDATE signoff s
        SET invalidated_at = now(), invalidated_reason = $3,
            voided_at = now(), void_reason = $3
       FROM document d
       JOIN file_item fi ON fi.id = d.file_item_id
      WHERE s.document_id = d.id
        AND fi.engagement_id = $1 AND fi.code = $2
        AND s.voided_at IS NULL AND s.invalidated_at IS NULL
        AND s.content_hash IS NOT NULL AND s.content_hash <> $4
      RETURNING s.id, s.role, s.document_id, s.user_id, d.title`,
    [engagementId, code, SIGNOFF_INVALIDATED_REASON, hash],
  );
  if (stale.rows.length === 0) return [];
  const documentIds = [...new Set(stale.rows.map((row) => row.document_id))];
  await tx.query(
    `UPDATE document d SET status = 'draft'
      WHERE d.id = ANY($1::uuid[]) AND d.status = 'signed'
        AND NOT EXISTS (
          SELECT 1 FROM signoff s
           WHERE s.document_id = d.id AND s.role IN ('reviewer', 'partner')
             AND s.voided_at IS NULL AND s.invalidated_at IS NULL)`,
    [documentIds],
  );
  return stale.rows;
}

export async function loadPaper(
  engagementId: string,
  code: string,
): Promise<Record<string, string>> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ field_key: string; value: unknown }>(
      "SELECT field_key, value FROM form_response WHERE engagement_id = $1 AND code = $2",
      [engagementId, WP(code)],
    );
    const out: Record<string, string> = {};
    for (const row of r.rows) out[row.field_key] = typeof row.value === "string" ? row.value : String(row.value ?? "");
    return out;
  });
}

/**
 * The presumed management-override risk arrives with a program step already
 * linked to it — the ISA 240 ¶32 procedures, seeded with the risk because the
 * standard prescribes them and the risk cannot be rebutted. That step has no
 * screen of its own: the work it stands for is E3.1's paper. So the paper's
 * conclusion is what completes it, and clearing the conclusion reopens it.
 * Without this the completion gate, which refuses to issue while any step is
 * still planned, would wait on a step nothing could ever complete.
 *
 * Only the seeded step is touched, found by its exact wording. The
 * risk-extension steps an account's program generates live on the E4 screen
 * and are completed there by hand.
 */
async function syncSeededResponseStep(
  tx: PoolClient,
  tenantId: string,
  engagementId: string,
  code: string,
  userId: string,
): Promise<void> {
  void tenantId; // the pool client is already scoped; kept for symmetry with its neighbours
  const total = paperFor(code).conclEn?.length ?? 0;
  if (total === 0) return;
  const keys = Array.from({ length: total }, (_, i) => conclKey(i));
  // `value` is jsonb, so the driver hands it back already decoded — the same
  // reading loadPaper makes. A Yes or a No is an answer; anything else is not.
  const rows = await tx.query<{ value: unknown }>(
    "SELECT value FROM form_response WHERE engagement_id = $1 AND code = $2 AND field_key = ANY($3)",
    [engagementId, WP(code), keys],
  );
  const answered = rows.rows.filter((r) => r.value === "yes" || r.value === "no").length;
  const where = `engagement_id = $1
       AND file_item_id IN (SELECT id FROM file_item WHERE engagement_id = $1 AND code = $2)
       AND source = 'risk_extension' AND description = $3`;
  if (answered === total) {
    await tx.query(
      `UPDATE program_step
          SET status = 'complete', conclusion = $4, completed_by = $5, completed_at = now()
        WHERE ${where} AND status = 'planned'`,
      [engagementId, code, MGMT_OVERRIDE_PROCEDURE, `Concluded on the ${code} working paper.`, userId],
    );
  } else {
    await tx.query(
      `UPDATE program_step
          SET status = 'planned', conclusion = NULL, completed_by = NULL, completed_at = NULL
        WHERE ${where} AND status = 'complete'`,
      [engagementId, code, MGMT_OVERRIDE_PROCEDURE],
    );
  }
}

export async function savePaper(
  engagementId: string,
  code: string,
  values: Record<string, string>,
): Promise<void> {
  const { assertMutable } = await import("@/lib/mutability");
  await assertMutable(engagementId);
  const { tenantId, userId } = await requireWrite();
  const allowed = paperKeys(paperFor(code));
  // E6.10 (UAT B114): "column N agrees" cannot be answered Yes while the
  // tie-out of the trial balance shows differences nobody has explained.
  if (code === "E6.10" && values.q_n_agrees === "yes") {
    const { runFsTieout } = await import("@/lib/fs-tieout");
    const tie = await runFsTieout(engagementId).catch(() => null);
    const explained = (values.p_tie_n ?? (await loadPaper(engagementId, code)).p_tie_n ?? "").trim();
    if (tie && !tie.pass && !explained) throw new Error("tieout-unexplained");
  }
  const invalidated = await withTenant(tenantId, async (tx) => {
    for (const [key, value] of Object.entries(values)) {
      if (!allowed.has(key)) continue;
      await tx.query(
        `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by, carried_forward)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         ON CONFLICT (engagement_id, code, field_key)
         DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
                       carried_forward = false, updated_at = now()`,
        [tenantId, engagementId, WP(code), key, JSON.stringify(value), userId],
      );
    }
    await syncSeededResponseStep(tx, tenantId, engagementId, code, userId);
    // A signature attests to the content it was given over: an edit that moves
    // the content out from under it voids it rather than inheriting it.
    return invalidateStaleSignoffs(tx, engagementId, code);
  });

  // Outside the transaction: the trail and the notice must not roll back the save.
  await reportInvalidatedSignoffs(tenantId, engagementId, code, invalidated, userId);
}

/**
 * Record the trail entry and warn each signer whose signature a later edit
 * voided. Call OUTSIDE the writing transaction: neither the activity row nor
 * the notification may roll the edit back.
 */
export async function reportInvalidatedSignoffs(
  tenantId: string,
  engagementId: string,
  code: string,
  rows: InvalidatedSignoff[],
  actorUserId: string,
): Promise<void> {
  for (const row of rows) {
    await recordActivity({
      engagementId,
      entityType: "signoff",
      entityId: row.id,
      action: "signoff_invalidated",
      summary: `${row.role} sign-off on ${code} voided — the paper was edited after signing`,
      meta: { documentId: row.document_id, code, role: row.role },
    });
    if (row.user_id === actorUserId) continue;
    await createNotification({
      tenantId,
      userId: row.user_id,
      kind: "signoff-voided",
      title: `Sign-off voided: ${row.title}`,
      body: SIGNOFF_INVALIDATED_REASON,
      href: `/documents/${row.document_id}`,
    });
  }
}

/** Phase intro shown at the head of each phase page. */
export const PHASE_INTRO: Record<SectionKey, { en: string; fr: string }> = {
  acceptance: {
    en: "Performed before any commitment is given to the client.",
    fr: "Réalisé avant tout engagement vis-à-vis du client.",
  },
  strategy: {
    en: "Establishes what the audit covers, at what threshold, against which risks, and by which strategy.",
    fr: "Définit le périmètre, le seuil, les risques et la stratégie de la mission.",
  },
  execution: {
    en: "Performs the programme the previous phase derived.",
    fr: "Met en œuvre le programme issu de la phase précédente.",
  },
  conclusion: {
    en: "Draws the file together, evaluates what was found, and forms the opinion.",
    fr: "Rassemble le dossier, évalue les constats et forme l'opinion.",
  },
};
