// Phase 7 (7.9/7.10): opinion decision tree (ISA 700/705/706/570/701) and the
// OHADA statutory report builder — FR wording per AUSCGIE arts. 710–711 and
// the practice guide (descriptive formula, no "certifier"; report titled
// "Rapport du commissaire aux comptes sur les états financiers annuels";
// Vérifications et informations spécifiques section; EoM on going concern;
// KAM ("Points clés de l'audit") for listed entities).

import { createHash } from "node:crypto";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { letterheadFooter, letterheadParagraphs, loadBranding } from "@/lib/branding";
import { withTenant } from "@/lib/db";
import { DOCX_MIME } from "@/lib/documents";
import { requireTenant } from "@/lib/tenant";

export type OpinionType = "unmodified" | "qualified" | "adverse" | "disclaimer";

export interface OpinionInput {
  /** Uncorrected misstatements exceed materiality. */
  materialMisstatement: boolean;
  /** The misstatement/limitation is pervasive to the FS. */
  pervasive: boolean;
  /** Sufficient appropriate evidence could not be obtained. */
  scopeLimitation: boolean;
  /** Material uncertainty on going concern, adequately disclosed. */
  goingConcernUncertainty: boolean;
}

/** ISA 700/705 decision tree. */
export function decideOpinion(input: OpinionInput): {
  opinion: OpinionType;
  goingConcernParagraph: boolean;
} {
  let opinion: OpinionType = "unmodified";
  if (input.scopeLimitation) {
    opinion = input.pervasive ? "disclaimer" : "qualified";
  } else if (input.materialMisstatement) {
    opinion = input.pervasive ? "adverse" : "qualified";
  }
  return { opinion, goingConcernParagraph: input.goingConcernUncertainty };
}

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** "2025-06-30" → "30 juin 2025" — the engagement's own period end, never an assumed 31 December (UAT B58). */
export function periodEndFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const day = Number(m[3]);
  return `${day === 1 ? "1er" : day} ${MONTHS_FR[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

const OPINION_FR: Record<OpinionType, { title: string; body: (client: string, periodEnd: string) => string }> = {
  unmodified: {
    title: "Opinion",
    body: (client, periodEnd) =>
      `À notre avis, les états financiers annuels de ${client} pour l'exercice clos le ${periodEnd} sont réguliers et sincères et donnent une image fidèle du résultat des opérations de l'exercice écoulé ainsi que de la situation financière et du patrimoine de la société à la fin de cet exercice, conformément au référentiel SYSCOHADA révisé.`,
  },
  qualified: {
    title: "Opinion avec réserves",
    body: (client, periodEnd) =>
      `À notre avis, sous réserve des points décrits dans la section « Fondement de l'opinion avec réserves », les états financiers annuels de ${client} pour l'exercice clos le ${periodEnd} sont réguliers et sincères et donnent une image fidèle du résultat des opérations de l'exercice écoulé ainsi que de la situation financière et du patrimoine de la société.`,
  },
  adverse: {
    title: "Opinion défavorable",
    body: (client, periodEnd) =>
      `À notre avis, en raison de l'importance des points décrits dans la section « Fondement de l'opinion défavorable », les états financiers annuels de ${client} pour l'exercice clos le ${periodEnd} ne sont pas réguliers et sincères et ne donnent pas une image fidèle du résultat des opérations, de la situation financière et du patrimoine de la société.`,
  },
  disclaimer: {
    title: "Impossibilité d'exprimer une opinion",
    body: (client, periodEnd) =>
      `En raison de l'importance des points décrits dans la section « Fondement de l'impossibilité d'exprimer une opinion », nous ne sommes pas en mesure d'exprimer une opinion sur les états financiers annuels de ${client} pour l'exercice clos le ${periodEnd}.`,
  },
};

/** Build and file the statutory report (FR) under C2.1 as kind='report'. */
export async function generateAuditReport(input: {
  engagementId: string;
  opinion: OpinionType;
  basisText?: string;
  goingConcernParagraph: boolean;
  kamText?: string;
  /** listed entity with no key audit matter: the reason, printed as the ISA 701 ¶16 statement */
  kamNoneReason?: string;
  reportDate: string;
}): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const info = await tx.query<{
      client_name: string;
      listed: boolean;
      co_cac: boolean;
      fiscal_year: number;
      period_end: string;
      a1_id: string;
    }>(
      `SELECT c.name AS client_name, c.listed, c.co_cac, e.fiscal_year,
              to_char(e.period_end, 'YYYY-MM-DD') AS period_end,
              (SELECT id FROM file_item WHERE engagement_id = e.id AND code = 'C2.1') AS a1_id
         FROM engagement e JOIN client c ON c.id = e.client_id
        WHERE e.id = $1`,
      [input.engagementId],
    );
    const row = info.rows[0];
    if (!row) throw new Error("not-found");

    const branding = await loadBranding(tx, tenantId);
    const opinion = OPINION_FR[input.opinion];
    const closing = periodEndFr(row.period_end ?? `${row.fiscal_year}-12-31`);
    const children: Paragraph[] = [
      ...letterheadParagraphs(branding),
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun("Rapport du commissaire aux comptes sur les états financiers annuels")],
      }),
      new Paragraph({ children: [new TextRun({ text: `${row.client_name} — Exercice clos le ${closing}`, bold: true })] }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(opinion.title)] }),
      new Paragraph(opinion.body(row.client_name, closing)),
    ];
    if (input.opinion !== "unmodified" && input.basisText) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`Fondement de l'${opinion.title.toLowerCase()}`)] }),
        new Paragraph(input.basisText),
      );
    }
    if (input.goingConcernParagraph) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Incertitude significative liée à la continuité d'exploitation")] }),
        new Paragraph(
          "Nous attirons l'attention sur la note des états financiers décrivant les événements et conditions indiquant l'existence d'une incertitude significative susceptible de jeter un doute important sur la capacité de la société à poursuivre son exploitation. Notre opinion n'est pas modifiée à l'égard de ce point.",
        ),
      );
    }
    if (row.listed && input.kamText) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Points clés de l'audit")] }),
        new Paragraph(input.kamText),
      );
    } else if (row.listed && input.kamNoneReason) {
      // ISA 701 ¶16: when there is no key audit matter to report, the report says so.
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Points clés de l'audit")] }),
        new Paragraph(
          `Nous avons déterminé qu'il n'y a pas de points clés de l'audit à communiquer dans notre rapport. ${input.kamNoneReason}`,
        ),
      );
    }
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Vérifications et informations spécifiques")] }),
      new Paragraph(
        "Nous avons procédé aux vérifications spécifiques prévues par les textes : concordance et sincérité des informations du rapport de gestion (art. 713), respect de l'égalité entre actionnaires (art. 714), détention d'actions par les administrateurs (art. 417). Les irrégularités et inexactitudes relevées, le cas échéant, sont signalées à la plus proche assemblée générale (art. 716).",
      ),
    );
    // C5.9 (spec §12.5.10): joint report by the co-CACs; any documented
    // divergence between them is disclosed in the report (art. 719).
    if (row.co_cac) {
      const disagreement = await tx.query<{ data: { text?: string } }>(
        "SELECT data FROM completion_record WHERE engagement_id = $1 AND key = 'f8_disagreement'",
        [input.engagementId],
      );
      const text = disagreement.rows[0]?.data?.text;
      if (text && text.trim()) {
        children.push(
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Divergence entre commissaires aux comptes (art. 719)")] }),
          new Paragraph(text),
        );
      }
    }
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: row.co_cac
              ? `Fait le ${input.reportDate}. Les commissaires aux comptes (rapport commun, art. 719).`
              : `Fait le ${input.reportDate}. Le commissaire aux comptes.`,
            italics: true,
          }),
        ],
      }),
    );

    children.push(...letterheadFooter(branding));
    const content = await Packer.toBuffer(new Document({ sections: [{ children }] }));
    const doc = await tx.query<{ id: string }>(
      `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, kind, created_by, current_version)
       VALUES ($1, $2, $3, $4, 'fr', 'report', $5, 1) RETURNING id`,
      [tenantId, input.engagementId, row.a1_id, `Rapport CAC — ${row.fiscal_year}`, userId],
    );
    await tx.query(
      `INSERT INTO document_version
         (tenant_id, document_id, version_no, mime, byte_size, sha256, content, note, created_by)
       VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8)`,
      [tenantId, doc.rows[0].id, DOCX_MIME, content.length, createHash("sha256").update(content).digest("hex"), content, `report:${input.opinion}`, userId],
    );
    return doc.rows[0].id;
  });
}
