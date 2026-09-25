// C1.2 — the summary review memorandum drawn from the file (UAT B151). The
// significant matters ISA 230 ¶8(c) asks the memo to record already exist as
// rows elsewhere in the file: the significant risks of S3.1, the misstatements
// above clearly trivial on C1.1, the consultations recorded on C1.3 and the
// open significant findings (route b4). Read here, listed on the paper, and
// copied into the memo text with one click — never typed twice.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { loadPaper } from "@/lib/working-papers";

export interface SrmMatters {
  risks: { description: string; status: string }[];
  misstatements: { description: string; amount: number; corrected: boolean; mtype: string }[];
  /** the free-text answers recorded on the C1.3 consultation paper */
  consultations: string[];
  findings: { title: string; code: string | null }[];
}

export async function srmMatters(engagementId: string): Promise<SrmMatters> {
  const { tenantId } = await requireTenant();
  // Yes/no answers (q_*) and their flags are not matters; the procedure
  // results (p_*) and the conclusion text are what a consultation record says.
  const c13 = await loadPaper(engagementId, "C1.3").catch((): Record<string, string> => ({}));
  const consultations = Object.entries(c13)
    .filter(([key, value]) => !key.startsWith("q_") && value.trim().length > 2 && !["yes", "no", "na", "on"].includes(value.trim()))
    .map(([, value]) => value.trim());

  return withTenant(tenantId, async (tx) => {
    const risks = await tx.query<{ description: string; status: string }>(
      `SELECT description, status FROM risk
        WHERE engagement_id = $1 AND significant AND rebutted = false
        ORDER BY created_at`,
      [engagementId],
    );
    const misstatements = await tx.query<{ description: string; amount: string; corrected: boolean; mtype: string }>(
      `SELECT description, amount::text, corrected, mtype FROM misstatement
        WHERE engagement_id = $1 AND trivial = false
        ORDER BY abs(amount) DESC`,
      [engagementId],
    );
    const findings = await tx.query<{ title: string; code: string | null }>(
      `SELECT f.title, (SELECT code FROM file_item WHERE id = f.file_item_id) AS code
         FROM finding f
        WHERE f.engagement_id = $1 AND f.route = 'b4' AND f.status = 'open'
        ORDER BY f.created_at`,
      [engagementId],
    );
    return {
      risks: risks.rows,
      misstatements: misstatements.rows.map((m) => ({ ...m, amount: Number(m.amount) })),
      consultations,
      findings: findings.rows,
    };
  });
}
