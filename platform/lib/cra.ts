// The Combined Risk Assessment board (S3.1): one row per significant account
// (lead index), one cell per relevant assertion, each holding the separate
// inherent-risk and control-risk assessments and the level they combine into.
// The board consumes P6.2 (significant accounts and their relevant assertions),
// the risk register (inherent-risk suggestion + significant-risk overlay),
// SCOT Studio (controls selected and their test results → control-risk
// suggestion) and S2.5 (the ITGC conclusion), and feeds the sampling tool,
// S5.5 and the E4 workpapers.

import type { PoolClient } from "pg";
import { recordActivity } from "@/lib/activity";
import { withTenant } from "@/lib/db";
import { requireTenant, requireWrite } from "@/lib/tenant";
import { significantAccounts } from "@/lib/significant-accounts";
import { listScots } from "@/lib/scots";
import { loadPaper } from "@/lib/working-papers";
import { INDEX_SECTION, LEAD_INDEX_BY_CODE } from "@/lib/lead-classes";
import {
  craOf,
  toTod,
  worstTod,
  type CraCr,
  type CraIr,
  type CraTod,
} from "@/lib/cra-model";

const ASSERTIONS = ["C", "E", "A", "V", "P"] as const;

export interface CraCell {
  assertion: string;
  relevant: boolean;
  /** relevance came only from the no-selection C/E/A/V fallback, not from a
   * recorded key assertion (P6.2), a linked risk, or a saved assessment */
  relevantDefaulted: boolean;
  /** recorded assessments — null until the preparer sets them */
  ir: CraIr | null;
  irBasis: string;
  cr: CraCr | null;
  crBasis: string;
  /** what the file suggests, shown until a value is recorded */
  suggestedIr: CraIr;
  suggestedCr: CraCr;
  riskCount: number;
  significant: boolean;
  /** a fraud risk (assessed or presumed under ISA 240) sits on this assertion */
  fraud: boolean;
  controlsCovering: number;
  controlsEffective: number;
  controlsFailed: number;
  /** earlier assessments this cell replaced (E6.8 reassessment), oldest first */
  history: CraRevision[];
}

export interface CraRevision {
  ir: CraIr | null;
  cr: CraCr | null;
  irBasis: string;
  crBasis: string;
  newIr: CraIr | null;
  newCr: CraCr | null;
  reason: string;
  by: string | null;
  at: string;
}

export interface CraAccountRow {
  indexCode: string;
  /** key-item threshold set on S3.1 for this account; null = TE applies */
  keyItemThreshold: number | null;
  taskCode: string | null;
  taskItemId: string | null;
  label: string;
  closing: number;
  scots: number;
  controlsSelected: number;
  cells: CraCell[];
}

export interface CraBoardView {
  rows: CraAccountRow[];
  /** tolerable error, the default key-item threshold; null before materiality is approved */
  te: number | null;
  /** S2.5 conclusion: support / not_support / mixed — null until concluded */
  itgcState: string | null;
  glAvailable: boolean;
  /** planning closed or materiality approved: changing a recorded IR/CR needs a reason */
  reassessmentNeedsReason: boolean;
}

/**
 * Once planning is closed or materiality is approved, the assessment is the
 * basis of the audit strategy: revising it is a documented judgement (ISA 315
 * ¶37), not an edit.
 */
async function assessmentLockedTx(tx: PoolClient, engagementId: string): Promise<boolean> {
  const r = await tx.query<{ locked: boolean }>(
    `SELECT (e.phase NOT IN ('acceptance', 'planning')
             OR EXISTS (SELECT 1 FROM materiality m WHERE m.engagement_id = e.id AND m.status = 'approved')) AS locked
       FROM engagement e WHERE e.id = $1`,
    [engagementId],
  );
  return r.rows[0]?.locked ?? false;
}

export async function craBoard(engagementId: string): Promise<CraBoardView> {
  const { tenantId } = await requireTenant();

  const [sig, scots, s25] = await Promise.all([
    significantAccounts(engagementId).catch(() => null),
    listScots(engagementId).catch(() => []),
    loadPaper(engagementId, "S2.5").catch(() => ({}) as Record<string, string>),
  ]);
  const itgcState = s25.itgc_state && ["support", "not_support", "mixed"].includes(s25.itgc_state) ? s25.itgc_state : null;

  // risks per index+assertion, and the saved assessments
  const { riskLinks, saved, taskItems, settings, history, locked } = await withTenant(tenantId, async (tx) => {
    const riskLinks = await tx.query<{ index_code: string; assertions: string[]; significant: boolean; fraud: boolean }>(
      `SELECT li.index_code, li.assertions, rk.significant,
              (rk.category = 'fraud' OR rk.presumed_type IS NOT NULL) AS fraud
         FROM risk_lead_index li
         JOIN risk rk ON rk.id = li.risk_id AND rk.rebutted = false
        WHERE rk.engagement_id = $1`,
      [engagementId],
    );
    const saved = await tx.query<{
      index_code: string; assertion: string; relevant: boolean;
      ir: CraIr | null; ir_basis: string | null; cr: CraCr | null; cr_basis: string | null;
    }>(
      "SELECT index_code, assertion, relevant, ir, ir_basis, cr, cr_basis FROM cra_assessment WHERE engagement_id = $1",
      [engagementId],
    );
    const taskItems = await tx.query<{ id: string; code: string }>(
      "SELECT id, code FROM file_item WHERE engagement_id = $1 AND code LIKE 'E4.%'",
      [engagementId],
    );
    const settings = await tx.query<{ index_code: string; key_item_threshold: string | null }>(
      "SELECT index_code, key_item_threshold FROM cra_index_setting WHERE engagement_id = $1",
      [engagementId],
    );
    // the assessments each cell replaced, with who changed them and why
    const history = await tx.query<{
      index_code: string; assertion: string; ir: CraIr | null; ir_basis: string | null; cr: CraCr | null; cr_basis: string | null;
      new_ir: CraIr | null; new_cr: CraCr | null; reason: string | null; by: string | null; at: string;
    }>(
      `SELECT h.index_code, h.assertion, h.ir, h.ir_basis, h.cr, h.cr_basis, h.new_ir, h.new_cr, h.reason,
              (SELECT coalesce(u.name, u.email) FROM app_user u WHERE u.id = h.changed_by) AS by,
              to_char(h.changed_at, 'YYYY-MM-DD HH24:MI') AS at
         FROM cra_assessment_history h
        WHERE h.engagement_id = $1
        ORDER BY h.changed_at`,
      [engagementId],
    );
    const locked = await assessmentLockedTx(tx, engagementId);
    return { riskLinks: riskLinks.rows, saved: saved.rows, taskItems: taskItems.rows, settings: settings.rows, history: history.rows, locked };
  });

  const itemByCode = new Map(taskItems.map((t) => [t.code, t.id]));
  const historyByKey = new Map<string, CraRevision[]>();
  for (const h of history) {
    const key = `${h.index_code}|${h.assertion}`;
    const list = historyByKey.get(key) ?? [];
    list.push({
      ir: h.ir, cr: h.cr, irBasis: h.ir_basis ?? "", crBasis: h.cr_basis ?? "",
      newIr: h.new_ir, newCr: h.new_cr, reason: h.reason ?? "", by: h.by, at: h.at,
    });
    historyByKey.set(key, list);
  }

  // per index: risk assertions, significance and the fraud overlay
  const riskByIndex = new Map<string, Map<string, { count: number; significant: boolean; fraud: boolean }>>();
  for (const link of riskLinks) {
    const bucket = riskByIndex.get(link.index_code) ?? new Map();
    for (const a of link.assertions) {
      const cur = bucket.get(a) ?? { count: 0, significant: false, fraud: false };
      cur.count += 1;
      cur.significant = cur.significant || link.significant;
      cur.fraud = cur.fraud || link.fraud;
      bucket.set(a, cur);
    }
    riskByIndex.set(link.index_code, bucket);
  }

  // per index: SCOT coverage and, per assertion, the selected controls that
  // answer a WCGW carrying that assertion — with their test outcomes
  const scotByIndex = new Map<string, { scots: number; selected: number; perAssertion: Map<string, { covering: number; effective: number; failed: number }> }>();
  for (const scot of scots) {
    const selectedControls = scot.controls.filter((c) => c.selectedForTesting);
    const assertionOf = (controlId: string): Set<string> => {
      const set = new Set<string>();
      for (const w of scot.wcgws) if (w.controlIds.includes(controlId)) w.assertions.forEach((a) => set.add(a));
      return set;
    };
    for (const idx of scot.indexes) {
      const cur = scotByIndex.get(idx.indexCode) ?? { scots: 0, selected: 0, perAssertion: new Map() };
      cur.scots += 1;
      cur.selected += selectedControls.length;
      for (const c of selectedControls) {
        // The E1.2 conclusion (operatingEval) is what the board reads; the raw
        // test outcome (operating) only stands in until E1.2 concludes.
        const concluded = c.operatingEval ?? (c.operating === "effective" ? "effective" : c.operating === "exceptions" ? "not_effective" : null);
        const failed = c.designEval === "ineffective" || concluded === "not_effective";
        const effective = c.designEval !== "ineffective" && concluded === "effective";
        for (const a of assertionOf(c.id)) {
          const cell = cur.perAssertion.get(a) ?? { covering: 0, effective: 0, failed: 0 };
          cell.covering += 1;
          if (effective) cell.effective += 1;
          if (failed) cell.failed += 1;
          cur.perAssertion.set(a, cell);
        }
      }
      scotByIndex.set(idx.indexCode, cur);
    }
  }

  const savedByKey = new Map(saved.map((s) => [`${s.index_code}|${s.assertion}`, s]));

  const sigRows = (sig?.rows ?? []).filter((r) => r.status === "significant");
  const seen = new Set(sigRows.map((r) => r.index));
  // an index that carries saved cells stays on the board even if P6.2 later
  // reclassified it — the record must remain visible
  const extraIndexes = [...new Set(saved.map((s) => s.index_code))].filter((i) => !seen.has(i));

  const buildRow = (indexCode: string, label: string, closing: number, recorded: string[], riskAssertions: string[]): CraAccountRow => {
    const risks = riskByIndex.get(indexCode) ?? new Map();
    const scotInfo = scotByIndex.get(indexCode);
    const explicit = new Set([...recorded, ...riskAssertions]);
    const usedFallback = explicit.size === 0;
    const defaultRelevant = new Set(explicit);
    if (usedFallback) ["C", "E", "A", "V"].forEach((a) => defaultRelevant.add(a));
    const cells: CraCell[] = ASSERTIONS.map((assertion) => {
      const s = savedByKey.get(`${indexCode}|${assertion}`);
      const risk = risks.get(assertion);
      const cov = scotInfo?.perAssertion.get(assertion);
      const suggestedIr: CraIr = risk ? "higher" : "lower";
      const suggestedCr: CraCr =
        cov && cov.covering > 0 && cov.failed === 0 && itgcState !== "not_support" ? "rely" : "not_rely";
      return {
        assertion,
        relevant: s ? s.relevant : defaultRelevant.has(assertion),
        relevantDefaulted: !s && usedFallback && defaultRelevant.has(assertion),
        ir: s?.ir ?? null,
        irBasis: s?.ir_basis ?? "",
        cr: s?.cr ?? null,
        crBasis: s?.cr_basis ?? "",
        suggestedIr,
        suggestedCr,
        riskCount: risk?.count ?? 0,
        significant: risk?.significant ?? false,
        fraud: risk?.fraud ?? false,
        controlsCovering: cov?.covering ?? 0,
        controlsEffective: cov?.effective ?? 0,
        controlsFailed: cov?.failed ?? 0,
        history: historyByKey.get(`${indexCode}|${assertion}`) ?? [],
      };
    });
    const taskCode = INDEX_SECTION[indexCode] ?? null;
    const setting = settings.find((x) => x.index_code === indexCode);
    return {
      indexCode,
      keyItemThreshold: setting?.key_item_threshold ? Number(setting.key_item_threshold) : null,
      taskCode,
      taskItemId: taskCode ? (itemByCode.get(taskCode) ?? null) : null,
      label,
      closing,
      scots: scotInfo?.scots ?? 0,
      controlsSelected: scotInfo?.selected ?? 0,
      cells,
    };
  };

  const rows = [
    ...sigRows.map((r) => buildRow(r.index, r.label, r.closing, r.assertions, r.riskAssertions)),
    ...extraIndexes.map((i) => buildRow(i, LEAD_INDEX_BY_CODE[i]?.labelEn ?? i, 0, [], [])),
  ];

  return { rows, te: sig?.tolerableError ?? null, itgcState, glAvailable: sig?.glAvailable ?? false, reassessmentNeedsReason: locked };
}

/** The effective (recorded, else suggested) sampling-tool value of one cell. */
function cellTod(cell: CraCell): CraTod {
  const ir = cell.ir ?? cell.suggestedIr;
  const cr = cell.cr ?? cell.suggestedCr;
  return toTod(craOf(ir, cr), cell.significant);
}

export function rowWorstTod(row: CraAccountRow): CraTod | null {
  return worstTod(row.cells.filter((c) => c.relevant).map(cellTod));
}

/**
 * The account-level roll-up the other tools consume: worst relevant-assertion
 * CRA per lead index, in the sampling tool's vocabulary.
 */
export async function craRollupByIndex(engagementId: string): Promise<Record<string, CraTod>> {
  const view = await craBoard(engagementId);
  const out: Record<string, CraTod> = {};
  for (const row of view.rows) {
    const worst = rowWorstTod(row);
    if (worst) out[row.indexCode] = worst;
  }
  return out;
}

/** Persist one cell of the matrix. */
/** The key-item threshold of one account, set on S3.1; null clears it so TE applies again. */
export async function saveIndexThreshold(engagementId: string, indexCode: string, threshold: number | null): Promise<void> {
  if (!/^[A-Z][A-Z0-9]{0,2}$/.test(indexCode)) throw new Error("invalid-index");
  if (threshold !== null && !(Number.isFinite(threshold) && threshold > 0)) throw new Error("invalid-threshold");
  const { tenantId, userId } = await requireWrite();
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO cra_index_setting (tenant_id, engagement_id, index_code, key_item_threshold, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (engagement_id, index_code) DO UPDATE SET
         key_item_threshold = EXCLUDED.key_item_threshold, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [tenantId, engagementId, indexCode, threshold === null ? null : Math.round(threshold), userId],
    );
  });
}

export async function saveCraCell(
  engagementId: string,
  indexCode: string,
  assertion: string,
  patch: { relevant?: boolean; ir?: CraIr | ""; irBasis?: string; cr?: CraCr | ""; crBasis?: string; reason?: string },
): Promise<void> {
  if (!(ASSERTIONS as readonly string[]).includes(assertion)) throw new Error("invalid-assertion");
  if (!/^[A-Z][A-Z0-9]{0,2}$/.test(indexCode)) throw new Error("invalid-index");
  const { tenantId, userId } = await requireWrite();
  // Relying on controls with none selected for this assertion, or with ITGCs
  // concluded not to support reliance (S2.5), is not a control-risk assessment
  // ISA 330 ¶8 allows — unless the preparer states the basis in writing.
  let coverage: { controlsCovering: number; itgcState: string | null } | null = null;
  if (patch.cr === "rely") {
    const board = await craBoard(engagementId);
    const cell = board.rows.find((r) => r.indexCode === indexCode)?.cells.find((c) => c.assertion === assertion);
    coverage = { controlsCovering: cell?.controlsCovering ?? 0, itgcState: board.itgcState };
  }
  const change = await withTenant(tenantId, async (tx) => {
    const existing = await tx.query<{ ir: CraIr | null; ir_basis: string | null; cr: CraCr | null; cr_basis: string | null }>(
      `SELECT ir, ir_basis, cr, cr_basis FROM cra_assessment
        WHERE engagement_id = $1 AND index_code = $2 AND assertion = $3 FOR UPDATE`,
      [engagementId, indexCode, assertion],
    );
    const before = existing.rows[0] ?? null;
    if (coverage && (coverage.controlsCovering === 0 || coverage.itgcState === "not_support")) {
      const basis = (patch.crBasis ?? before?.cr_basis ?? "").trim();
      if (!basis) throw new Error("rely-without-controls");
    }
    const nextIr = patch.ir === undefined ? (before?.ir ?? null) : patch.ir === "" ? null : patch.ir;
    const nextCr = patch.cr === undefined ? (before?.cr ?? null) : patch.cr === "" ? null : patch.cr;
    const reassessed = before !== null && (before.ir !== null || before.cr !== null) && (nextIr !== before.ir || nextCr !== before.cr);
    const reason = (patch.reason ?? "").trim();
    if (reassessed && before) {
      // Past planning (or once materiality is approved) a revision must say why.
      if (!reason && (await assessmentLockedTx(tx, engagementId))) throw new Error("reassessment-reason-required");
      // the assessment being replaced stays on the file, with the revision's reason
      await tx.query(
        `INSERT INTO cra_assessment_history
           (tenant_id, engagement_id, index_code, assertion, ir, ir_basis, cr, cr_basis, new_ir, new_cr, reason, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [tenantId, engagementId, indexCode, assertion, before.ir, before.ir_basis, before.cr, before.cr_basis, nextIr, nextCr, reason || null, userId],
      );
    }
    await tx.query(
      `INSERT INTO cra_assessment (tenant_id, engagement_id, index_code, assertion, relevant, ir, ir_basis, cr, cr_basis, updated_by)
       VALUES ($1, $2, $3, $4, coalesce($5, true), NULLIF($6, ''), $7, NULLIF($8, ''), $9, $10)
       ON CONFLICT (engagement_id, index_code, assertion) DO UPDATE SET
         relevant = coalesce($5, cra_assessment.relevant),
         ir = CASE WHEN $6 IS NULL THEN cra_assessment.ir ELSE NULLIF($6, '') END,
         ir_basis = coalesce($7, cra_assessment.ir_basis),
         cr = CASE WHEN $8 IS NULL THEN cra_assessment.cr ELSE NULLIF($8, '') END,
         cr_basis = coalesce($9, cra_assessment.cr_basis),
         updated_by = $10, updated_at = now()`,
      [
        tenantId,
        engagementId,
        indexCode,
        assertion,
        patch.relevant ?? null,
        patch.ir !== undefined ? patch.ir : null,
        patch.irBasis ?? null,
        patch.cr !== undefined ? patch.cr : null,
        patch.crBasis ?? null,
        userId,
      ],
    );
    return reassessed ? { before, nextIr, nextCr, reason } : null;
  });
  if (change) {
    await recordActivity({
      engagementId,
      entityType: "cra_assessment",
      entityId: `${indexCode}|${assertion}`,
      action: "reassessed",
      summary: `CRA ${indexCode}/${assertion} reassessed: IR ${change.before?.ir ?? "—"}→${change.nextIr ?? "—"}, CR ${change.before?.cr ?? "—"}→${change.nextCr ?? "—"}${change.reason ? ` (${change.reason})` : ""}`,
      before: { ir: change.before?.ir ?? null, cr: change.before?.cr ?? null, irBasis: change.before?.ir_basis ?? "", crBasis: change.before?.cr_basis ?? "" },
      after: { ir: change.nextIr, cr: change.nextCr, reason: change.reason },
    });
  }
}
