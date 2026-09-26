// C1.2 — the summary review memorandum drawn from the file (UAT B151). The
// significant matters ISA 230 ¶8(c) asks the memo to record already exist as
// rows elsewhere in the file: the significant risks of S3.1, the misstatements
// above clearly trivial on C1.1, the consultations recorded on C1.3 and the
// open significant findings (route b4). Read here, listed on the paper, and
// copied into the memo text with one click — never typed twice.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { riskTitle } from "@/lib/risks";
import { loadPaper } from "@/lib/working-papers";

export interface SrmMatters {
  /** description in the reader's language (presumed ISA 240 risks are translated) */
  risks: { description: string; status: string }[];
  misstatements: { description: string; amount: number; corrected: boolean; mtype: string }[];
  /** the consultation recorded on the C1.3 paper, as one line per record */
  consultations: string[];
  findings: { title: string; code: string | null }[];
}

/** C1.3's procedure answers in the order a consultation record reads. */
const C13_ORDER = ["p_identify", "p_consult", "p_information", "p_conclusion", "p_implement", "p_external"];

export async function srmMatters(engagementId: string, locale: "en" | "fr" = "en"): Promise<SrmMatters> {
  const { tenantId } = await requireTenant();
  // C1.3 holds ONE consultation record across its procedure answers — the
  // matter, who was consulted, the information, the conclusion, its
  // implementation, any external referral. It is one matter, read in that
  // order, not six (UAT run2-B152).
  const c13 = await loadPaper(engagementId, "C1.3").catch((): Record<string, string> => ({}));
  const parts = C13_ORDER.map((key) => (c13[key] ?? "").trim()).filter(
    (value) => value.length > 2 && !["yes", "no", "na", "on"].includes(value),
  );
  const consultations = parts.length > 0 ? [parts.join(" — ")] : [];

  return withTenant(tenantId, async (tx) => {
    const risks = await tx.query<{ description: string; status: string; presumed_type: string | null }>(
      `SELECT description, status, presumed_type FROM risk
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
      risks: risks.rows.map((r) => ({
        description: riskTitle({ description: r.description, presumedType: r.presumed_type }, locale),
        status: r.status,
      })),
      misstatements: misstatements.rows.map((m) => ({ ...m, amount: Number(m.amount) })),
      consultations,
      findings: findings.rows,
    };
  });
}
