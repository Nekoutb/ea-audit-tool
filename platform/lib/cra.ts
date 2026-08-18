// The Combined Risk Assessment board (S3.1): one row per significant account
// (lead index), one cell per relevant assertion, each holding the separate
// inherent-risk and control-risk assessments and the level they combine into.
// The board consumes P6.2 (significant accounts and their relevant assertions),
// the risk register (inherent-risk suggestion + significant-risk overlay),
// SCOT Studio (controls selected and their test results → control-risk
// suggestion) and S2.5 (the ITGC conclusion), and feeds the sampling tool,
// S5.5 and the E4 workpapers.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
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
}

export interface CraAccountRow {
  indexCode: string;
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
  /** S2.5 conclusion: support / not_support / mixed — null until concluded */
  itgcState: string | null;
  glAvailable: boolean;
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
  const { riskLinks, saved, taskItems } = await withTenant(tenantId, async (tx) => {
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
    return { riskLinks: riskLinks.rows, saved: saved.rows, taskItems: taskItems.rows };
  });

  const itemByCode = new Map(taskItems.map((t) => [t.code, t.id]));

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
        const failed = c.designEval === "ineffective" || c.operating === "exceptions";
        const effective = c.designEval !== "ineffective" && c.operating === "effective";
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
    const defaultRelevant = new Set([...recorded, ...riskAssertions]);
    if (defaultRelevant.size === 0) ["C", "E", "A", "V"].forEach((a) => defaultRelevant.add(a));
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
      };
    });
    const taskCode = INDEX_SECTION[indexCode] ?? null;
    return {
      indexCode,
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

  return { rows, itgcState, glAvailable: sig?.glAvailable ?? false };
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
export async function saveCraCell(
  engagementId: string,
  indexCode: string,
  assertion: string,
  patch: { relevant?: boolean; ir?: CraIr | ""; irBasis?: string; cr?: CraCr | ""; crBasis?: string },
): Promise<void> {
  if (!(ASSERTIONS as readonly string[]).includes(assertion)) throw new Error("invalid-assertion");
  if (!/^[A-Z][A-Z0-9]{0,2}$/.test(indexCode)) throw new Error("invalid-index");
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
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
  });
}
