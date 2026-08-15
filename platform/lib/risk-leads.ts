// The Sources lane of the Risk Console: everything the file already knows that
// ISA 315 says feeds risk identification, phrased as promotable "leads" —
// acceptance information (¶15), the understanding papers' carry answers,
// analytics outliers (A203's automated techniques), control deficiencies, IT
// risks and fraud factors. Each lead is either promoted into the register or
// dismissed with a rationale; the decision persists in form_response under the
// code "risk-leads" so a dismissed lead stays dismissed.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { financialAnalysis } from "@/lib/financial-analysis";
import { apLeadSchedules } from "@/lib/analytical-procedures";
import { rollForward } from "@/lib/tb-rollforward";
import { approvedMateriality } from "@/lib/materiality";

export interface RiskLead {
  /** stable identity for the decision record, e.g. "fa:dso", "ls:E", "wp:P3.1:carry" */
  key: string;
  /** the task or tool that produced it */
  source: string;
  labelEn: string;
  labelFr: string;
  /** the evidence behind the lead, shown under the label */
  detail: string;
  suggestedCategory: "business" | "fraud" | "error";
  suggestedLevel: "fs" | "assertion";
  /** lead-schedule index the lead points at, when it has one */
  index?: string;
  status: "open" | "dismissed" | "promoted";
  rationale?: string;
}

const LEADS_CODE = "risk-leads";
const n = (x: number) => new Intl.NumberFormat("fr-FR").format(Math.round(x));

/** Paper answers that are, by construction, risk material. */
const PAPER_SOURCES: {
  code: string;
  field: string;
  labelEn: string;
  labelFr: string;
  category: RiskLead["suggestedCategory"];
  level: RiskLead["suggestedLevel"];
}[] = [
  { code: "P3.1", field: "objectives", labelEn: "Business risks from the entity's objectives and strategies", labelFr: "Risques liés aux objectifs et stratégies de l'entité", category: "business", level: "assertion" },
  { code: "P3.1", field: "carry", labelEn: "Matters carried from the understanding of the business", labelFr: "Éléments issus de la connaissance de l'activité", category: "business", level: "assertion" },
  { code: "P3.1", field: "gc_status", labelEn: "Going-concern events or conditions noted at planning", labelFr: "Événements ou circonstances de continuité relevés à la planification", category: "business", level: "fs" },
  { code: "P3.2", field: "carry", labelEn: "Indicators from the preliminary analytical procedures", labelFr: "Indicateurs des procédures analytiques préliminaires", category: "error", level: "assertion" },
  { code: "P4.1", field: "deficiencies", labelEn: "Control deficiencies identified", labelFr: "Déficiences de contrôle relevées", category: "error", level: "fs" },
  { code: "P4.3", field: "risks", labelEn: "Risks arising from the use of IT", labelFr: "Risques liés à l'utilisation de l'informatique", category: "error", level: "assertion" },
  { code: "P5.1", field: "factors", labelEn: "Fraud risk factors identified", labelFr: "Facteurs de risque de fraude identifiés", category: "fraud", level: "assertion" },
];

export async function riskLeads(engagementId: string): Promise<RiskLead[]> {
  const { tenantId } = await requireTenant();
  const materiality = await approvedMateriality(engagementId);
  const te = materiality?.performance ?? null;

  const [decisionRows, paperRows] = await withTenant(tenantId, async (tx) => {
    const decisions = await tx.query<{ field_key: string; value: string }>(
      "SELECT field_key, value #>> '{}' AS value FROM form_response WHERE engagement_id = $1 AND code = $2",
      [engagementId, LEADS_CODE],
    );
    const papers = await tx.query<{ code: string; field_key: string; value: string }>(
      `SELECT code, field_key, value #>> '{}' AS value FROM form_response
        WHERE engagement_id = $1 AND code = ANY($2::text[])`,
      [engagementId, [...new Set(PAPER_SOURCES.map((p) => `wp:${p.code}`))]],
    );
    // P1.1's client risk rating rides with the same query set
    const rating = await tx.query<{ value: string }>(
      "SELECT value #>> '{}' AS value FROM form_response WHERE engagement_id = $1 AND code = 'wp:P1.1' AND field_key = 'rating'",
      [engagementId],
    );
    return [decisions.rows, [...papers.rows, ...(rating.rows[0] ? [{ code: "wp:P1.1", field_key: "rating", value: rating.rows[0].value }] : [])]];
  });

  const decisions = new Map<string, { status: "dismissed" | "promoted"; rationale?: string }>();
  for (const row of decisionRows) {
    try {
      const parsed = JSON.parse(row.value) as { status: "dismissed" | "promoted"; rationale?: string };
      if (parsed.status === "dismissed" || parsed.status === "promoted") decisions.set(row.field_key, parsed);
    } catch {
      // an unreadable decision counts as no decision
    }
  }

  const leads: RiskLead[] = [];
  const push = (lead: Omit<RiskLead, "status" | "rationale">) => {
    const decided = decisions.get(lead.key);
    leads.push({ ...lead, status: decided?.status ?? "open", rationale: decided?.rationale });
  };

  // 1 — acceptance information (¶15): a High client risk rating is a lead
  const rating = paperRows.find((r) => r.code === "wp:P1.1" && r.field_key === "rating");
  if (rating && /high|élevé/i.test(rating.value)) {
    push({
      key: "d31:rating",
      source: "P1.1",
      labelEn: "Client risk rating assessed High at acceptance",
      labelFr: "Notation du risque client Élevée à l'acceptation",
      detail: rating.value.slice(0, 300),
      suggestedCategory: "business",
      suggestedLevel: "fs",
    });
  }

  // 2 — the understanding papers' own carry answers
  for (const def of PAPER_SOURCES) {
    const row = paperRows.find((r) => r.code === `wp:${def.code}` && r.field_key === def.field);
    if (!row || row.value.trim().length < 3) continue;
    push({
      key: `wp:${def.code}:${def.field}`,
      source: def.code,
      labelEn: def.labelEn,
      labelFr: def.labelFr,
      detail: row.value.slice(0, 300),
      suggestedCategory: def.category,
      suggestedLevel: def.level,
    });
  }

  // 3 — analytics: ratio outliers from the Financial Analysis battery
  try {
    const fa = await financialAnalysis(engagementId);
    for (const row of fa?.rows ?? []) {
      if (row.current === null || row.prior === null || row.prior === 0) continue;
      const change = (row.current - row.prior) / Math.abs(row.prior);
      if (Math.abs(change) < 0.3) continue;
      push({
        key: `fa:${row.key}`,
        source: "Financial Analysis",
        labelEn: `${row.label} moved ${Math.round(change * 100)}% against prior year`,
        labelFr: `${row.label} a varié de ${Math.round(change * 100)} % par rapport à N-1`,
        detail: `${row.prior} → ${row.current} (${row.unit})`,
        suggestedCategory: "business",
        suggestedLevel: "assertion",
      });
    }
  } catch {
    // no TB yet — no analytics leads
  }

  // 4 — analytics: index movements beyond tolerable error
  try {
    const schedules = await apLeadSchedules(engagementId);
    for (const schedule of schedules) {
      if (te === null || Math.abs(schedule.movement) <= te) continue;
      push({
        key: `ls:${schedule.def.code}`,
        source: "Lead schedules",
        labelEn: `${schedule.def.code} — ${schedule.def.labelEn}: movement of ${n(schedule.movement)} FCFA exceeds TE`,
        labelFr: `${schedule.def.code} — ${schedule.def.labelEn} : mouvement de ${n(schedule.movement)} FCFA au-delà de l'erreur tolérable`,
        detail: `${n(schedule.prior)} → ${n(schedule.closing)}${schedule.variancePct !== null ? ` (${schedule.variancePct}%)` : ""}`,
        suggestedCategory: "error",
        suggestedLevel: "assertion",
        index: schedule.def.code,
      });
    }
  } catch {
    // no TB yet
  }

  // 5 — the TB roll-forward exceptions
  try {
    const rf = await rollForward(engagementId);
    if (rf && rf.exceptions > 0) {
      push({
        key: "rf:exceptions",
        source: "TB reconciliation",
        labelEn: `${rf.exceptions} account(s) where opening + GL movements do not reconcile to closing`,
        labelFr: `${rf.exceptions} compte(s) où ouverture + mouvements GL ne se raccordent pas à la clôture`,
        detail: rf.rows.filter((r) => Math.abs(r.variance) > 0).slice(0, 5).map((r) => `${r.account}: ${n(r.variance)}`).join(" · "),
        suggestedCategory: "error",
        suggestedLevel: "fs",
      });
    }
  } catch {
    // no GL yet
  }

  return leads;
}

/** Record a lead decision. Promotion creates the risk and links its index. */
export async function decideLead(
  engagementId: string,
  key: string,
  decision:
    | { action: "dismiss"; rationale: string }
    | {
        action: "promote";
        description: string;
        category: "business" | "fraud" | "error";
        level: "fs" | "assertion";
        source: string;
        index?: string;
        managementMissed?: string;
      },
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!/^[A-Za-z0-9:. _-]{2,80}$/.test(key)) throw new Error("invalid-lead");
  await withTenant(tenantId, async (tx) => {
    let record: { status: string; rationale?: string; riskId?: string };
    if (decision.action === "dismiss") {
      record = { status: "dismissed", rationale: decision.rationale.trim() };
    } else {
      // ¶23 — a risk management's own process missed carries the why with it
      const description = decision.managementMissed?.trim()
        ? `${decision.description.trim()} [Not identified by management's risk process: ${decision.managementMissed.trim()}]`
        : decision.description.trim();
      const risk = await tx.query<{ id: string }>(
        `INSERT INTO risk (tenant_id, engagement_id, description, source, level, category, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [tenantId, engagementId, description, `Console (${decision.source})`, decision.level, decision.category, userId],
      );
      if (decision.index) {
        await tx.query(
          `INSERT INTO risk_lead_index (tenant_id, risk_id, index_code, assertions)
           VALUES ($1, $2, $3, '{}') ON CONFLICT (risk_id, index_code) DO NOTHING`,
          [tenantId, risk.rows[0].id, decision.index],
        );
      }
      record = { status: "promoted", riskId: risk.rows[0].id };
    }
    await tx.query(
      `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by)
       VALUES ($1, $2, $3, $4, to_jsonb($5::text), $6)
       ON CONFLICT (engagement_id, code, field_key)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [tenantId, engagementId, LEADS_CODE, key, JSON.stringify(record), userId],
    );
  });
}
