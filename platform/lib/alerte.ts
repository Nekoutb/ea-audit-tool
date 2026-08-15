// Phase 8 (8.5): procédure d'alerte state machine (spec §12.4) — legal-form
// aware (non-SA arts. 150-152; SA/SAS arts. 153-156), a letter generated and
// a deadline timer set at each transition. E6.3/ISA 570 linkage: activeAlerte
// feeds the going-concern conclusion and the report's material-uncertainty
// paragraph.

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { type Branding, letterheadFooter, letterheadParagraphs, loadBranding } from "@/lib/branding";
import { withTenant } from "@/lib/db";
import { addDaysIso, addMonthsClamped, fileUnderCode, LegalError } from "@/lib/legal";
import { requireTenant } from "@/lib/tenant";

export type AlerteVariant = "sa" | "non_sa";

/** Ordered stages per variant; each entry: next-deadline days from transition. */
const FLOWS: Record<AlerteVariant, { stage: string; deadlineDays: number | null; basis: string }[]> = {
  non_sa: [
    { stage: "request_sent", deadlineDays: 15, basis: "Art. 150 — réponse du gérant sous 15 jours" },
    { stage: "reply_recorded", deadlineDays: null, basis: "Art. 151 — le CAC informe la juridiction compétente" },
    { stage: "court_informed", deadlineDays: null, basis: "Art. 151" },
    { stage: "rapport_special", deadlineDays: 8, basis: "Art. 152 — communication aux associés sous 8 jours (ou à la prochaine AG)" },
    { stage: "ag_communicated", deadlineDays: null, basis: "Art. 152" },
    { stage: "closed", deadlineDays: null, basis: "Résultats communiqués à la juridiction si mesures insuffisantes" },
  ],
  sa: [
    { stage: "request_sent", deadlineDays: 15, basis: "Art. 153 — réponse du PCA/PDG sous 15 jours" },
    { stage: "reply_recorded", deadlineDays: null, basis: "Art. 154" },
    { stage: "board_invited", deadlineDays: 15, basis: "Art. 154 — le président convoque le conseil sous 15 jours" },
    { stage: "board_deliberated", deadlineDays: 30, basis: "Art. 154 — extrait du PV au CAC et à la juridiction sous 1 mois" },
    { stage: "rapport_special", deadlineDays: null, basis: "Art. 155 — rapport spécial à la prochaine AG (le CAC peut convoquer l'AG)" },
    { stage: "ag_communicated", deadlineDays: null, basis: "Art. 156" },
    { stage: "closed", deadlineDays: null, basis: "Art. 156 — juridiction informée des résultats" },
  ],
};

const STAGE_LETTERS: Record<string, { title: string; body: string }> = {
  request_sent: {
    title: "Demande d'explications (procédure d'alerte)",
    body: "Par lettre recommandée avec demande d'avis de réception, nous vous demandons des explications sur les faits de nature à compromettre la continuité de l'exploitation relevés dans le cadre de notre mission. Votre réponse est attendue dans les quinze jours.",
  },
  court_informed: {
    title: "Information de la juridiction compétente (alerte)",
    body: "Nous informons la juridiction compétente de la teneur de la réponse reçue — ou de l'absence de réponse — à notre demande d'explications relative à la continuité de l'exploitation.",
  },
  board_invited: {
    title: "Invitation du conseil à délibérer (alerte)",
    body: "Faute de réponse satisfaisante dans les quinze jours, nous invitons le président du conseil d'administration à faire délibérer le conseil sur les faits relevés. Le conseil doit se réunir dans le mois ; nous assisterons à la séance et un extrait du procès-verbal nous sera adressé ainsi qu'à la juridiction compétente dans le mois qui suit.",
  },
  rapport_special: {
    title: "Rapport spécial d'alerte",
    body: "La continuité de l'exploitation demeurant compromise, nous établissons le présent rapport spécial d'alerte, communiqué dans les conditions légales (copie à la juridiction compétente ; communication aux associés ou présentation à la prochaine assemblée générale, que nous pouvons convoquer en cas d'urgence).",
  },
};

export interface AlerteState {
  id: string;
  variant: AlerteVariant;
  stage: string;
  stageDeadline: string | null;
  discontinued: boolean;
  resumableUntil: string | null;
  nextStages: string[];
  events: { stage: string; note: string; documentId: string | null; createdAt: string }[];
}

function flowOf(variant: AlerteVariant): { stage: string; deadlineDays: number | null; basis: string }[] {
  return FLOWS[variant];
}

function nextStagesOf(variant: AlerteVariant, stage: string, discontinued: boolean): string[] {
  if (discontinued) return ["resumed"];
  const flow = flowOf(variant);
  const index = flow.findIndex((entry) => entry.stage === stage);
  if (index === -1 || index === flow.length - 1) return [];
  return [flow[index + 1].stage];
}

async function buildStageLetter(
  branding: Branding,
  clientName: string,
  fiscalYear: number,
  stage: string,
  note: string,
): Promise<Buffer | null> {
  const template = STAGE_LETTERS[stage];
  if (!template) return null;
  const children = [
    ...letterheadParagraphs(branding),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(template.title)] }),
    new Paragraph({ children: [new TextRun({ text: `${clientName} — Exercice ${fiscalYear}`, bold: true })] }),
    new Paragraph(template.body),
    ...(note.trim() ? [new Paragraph(`Faits relevés / observations : ${note}`)] : []),
    new Paragraph({ children: [new TextRun({ text: "Le commissaire aux comptes.", bold: true })] }),
    ...letterheadFooter(branding),
  ];
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

/** Start the alerte: variant derives from the client's legal form. */
export async function startAlerte(engagementId: string, note: string): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const info = await tx.query<{ legal_form: string; client_name: string; fiscal_year: number }>(
      `SELECT c.legal_form, c.name AS client_name, e.fiscal_year
         FROM engagement e JOIN client c ON c.id = e.client_id WHERE e.id = $1`,
      [engagementId],
    );
    if (!info.rows[0]) throw new LegalError("not-found");
    const open = await tx.query(
      "SELECT 1 FROM alerte WHERE engagement_id = $1 AND stage <> 'closed' AND discontinued_at IS NULL",
      [engagementId],
    );
    if (open.rows[0]) throw new LegalError("alerte-open");

    const variant: AlerteVariant = ["SA", "SAS"].includes(info.rows[0].legal_form) ? "sa" : "non_sa";
    const first = flowOf(variant)[0];
    const today = new Date().toISOString().slice(0, 10);
    const deadline = first.deadlineDays === null ? null : addDaysIso(today, first.deadlineDays);
    const created = await tx.query<{ id: string }>(
      `INSERT INTO alerte (tenant_id, engagement_id, variant, stage, stage_deadline, created_by)
       VALUES ($1, $2, $3, 'request_sent', $4, $5) RETURNING id`,
      [tenantId, engagementId, variant, deadline, userId],
    );
    const alerteId = created.rows[0].id;
    const branding = await loadBranding(tx, tenantId);
    const letter = await buildStageLetter(branding, info.rows[0].client_name, info.rows[0].fiscal_year, "request_sent", note);
    const documentId = letter
      ? await fileUnderCode(tx, {
          tenantId, userId, engagementId, code: "C5.5",
          title: `Alerte — demande d'explications (${info.rows[0].fiscal_year})`,
          kind: "letter", content: letter, note: "alerte:request_sent",
        })
      : null;
    await tx.query(
      `INSERT INTO alerte_event (tenant_id, alerte_id, stage, note, document_id, created_by)
       VALUES ($1, $2, 'request_sent', $3, $4, $5)`,
      [tenantId, alerteId, note, documentId, userId],
    );
    return alerteId;
  });
}

/**
 * Advance the state machine. `reply_recorded` with a satisfactory reply closes
 * the alerte (it may be resumed within 6 months, arts. 156).
 */
export async function advanceAlerte(
  alerteId: string,
  toStage: string,
  note: string,
  options: { satisfactory?: boolean } = {},
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const current = await tx.query<{
      id: string; engagement_id: string; variant: AlerteVariant; stage: string;
      discontinued_at: string | null; client_name: string; fiscal_year: number;
    }>(
      `SELECT a.id, a.engagement_id, a.variant, a.stage, a.discontinued_at::text,
              c.name AS client_name, e.fiscal_year
         FROM alerte a
         JOIN engagement e ON e.id = a.engagement_id
         JOIN client c ON c.id = e.client_id
        WHERE a.id = $1 FOR UPDATE OF a`,
      [alerteId],
    );
    const row = current.rows[0];
    if (!row) throw new LegalError("not-found");
    if (row.discontinued_at) throw new LegalError("alerte-discontinued");
    const allowed = nextStagesOf(row.variant, row.stage, false);
    if (!allowed.includes(toStage)) throw new LegalError("invalid-transition");

    // A satisfactory reply discontinues the procedure (resumable ≤ 6 months).
    if (toStage === "reply_recorded" && options.satisfactory) {
      await tx.query(
        "UPDATE alerte SET stage = 'reply_recorded', stage_deadline = NULL, discontinued_at = now() WHERE id = $1",
        [alerteId],
      );
      await tx.query(
        `INSERT INTO alerte_event (tenant_id, alerte_id, stage, note, created_by)
         VALUES ($1, $2, 'discontinued', $3, $4)`,
        [tenantId, alerteId, note, userId],
      );
      return;
    }

    const entry = flowOf(row.variant).find((flowEntry) => flowEntry.stage === toStage);
    const today = new Date().toISOString().slice(0, 10);
    const deadline = entry?.deadlineDays == null ? null : addDaysIso(today, entry.deadlineDays);
    await tx.query("UPDATE alerte SET stage = $2, stage_deadline = $3 WHERE id = $1", [
      alerteId, toStage, deadline,
    ]);
    const branding = await loadBranding(tx, tenantId);
    const letter = await buildStageLetter(branding, row.client_name, row.fiscal_year, toStage, note);
    const documentId = letter
      ? await fileUnderCode(tx, {
          tenantId, userId, engagementId: row.engagement_id, code: "C5.5",
          title: `Alerte — ${toStage} (${row.fiscal_year})`,
          kind: toStage === "rapport_special" ? "report" : "letter",
          content: letter, note: `alerte:${toStage}`,
        })
      : null;
    await tx.query(
      `INSERT INTO alerte_event (tenant_id, alerte_id, stage, note, document_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, alerteId, toStage, note, documentId, userId],
    );
  });
}

/** Resume a discontinued alerte — allowed within 6 months (art. 156). */
export async function resumeAlerte(alerteId: string, note: string): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const current = await tx.query<{ variant: AlerteVariant; discontinued_at: string | null }>(
      "SELECT variant, to_char(discontinued_at, 'YYYY-MM-DD') AS discontinued_at FROM alerte WHERE id = $1 FOR UPDATE",
      [alerteId],
    );
    const row = current.rows[0];
    if (!row) throw new LegalError("not-found");
    if (!row.discontinued_at) throw new LegalError("not-discontinued");
    const limit = addMonthsClamped(row.discontinued_at, 6);
    if (new Date().toISOString().slice(0, 10) > limit) throw new LegalError("resume-expired");
    const today = new Date().toISOString().slice(0, 10);
    await tx.query(
      "UPDATE alerte SET discontinued_at = NULL, stage = 'request_sent', stage_deadline = $2 WHERE id = $1",
      [alerteId, addDaysIso(today, 15)],
    );
    await tx.query(
      `INSERT INTO alerte_event (tenant_id, alerte_id, stage, note, created_by)
       VALUES ($1, $2, 'resumed', $3, $4)`,
      [tenantId, alerteId, note, userId],
    );
  });
}

export async function getAlerte(engagementId: string): Promise<AlerteState | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string; variant: AlerteVariant; stage: string; stage_deadline: string | null;
      discontinued_at: string | null;
    }>(
      `SELECT id, variant, stage, to_char(stage_deadline, 'YYYY-MM-DD') AS stage_deadline,
              to_char(discontinued_at, 'YYYY-MM-DD') AS discontinued_at
         FROM alerte WHERE engagement_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [engagementId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const events = await tx.query<{ stage: string; note: string; document_id: string | null; created_at: string }>(
      `SELECT stage, note, document_id, to_char(created_at, 'YYYY-MM-DD') AS created_at
         FROM alerte_event WHERE alerte_id = $1 ORDER BY created_at, stage`,
      [row.id],
    );
    return {
      id: row.id,
      variant: row.variant,
      stage: row.stage,
      stageDeadline: row.stage_deadline,
      discontinued: row.discontinued_at !== null,
      resumableUntil: row.discontinued_at ? addMonthsClamped(row.discontinued_at, 6) : null,
      nextStages: nextStagesOf(row.variant, row.stage, row.discontinued_at !== null),
      events: events.rows.map((event) => ({
        stage: event.stage, note: event.note, documentId: event.document_id, createdAt: event.created_at,
      })),
    };
  });
}

/** E6.3/report linkage: an alerte still open means going-concern doubt. */
export async function activeAlerte(engagementId: string): Promise<boolean> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query(
      "SELECT 1 FROM alerte WHERE engagement_id = $1 AND stage <> 'closed' AND discontinued_at IS NULL",
      [engagementId],
    );
    return result.rows.length > 0;
  });
}
