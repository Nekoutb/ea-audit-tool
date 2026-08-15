// Letter generation (spec §4.3, §5.4): engagement letter (ISA 210 + OHADA
// mandate wording, co-CAC variant) and the C5.1 planning communication to TCWG.
// Letters are stored as documents (kind='letter') under the relevant file item.

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { type Branding, letterheadFooter, letterheadParagraphs, loadBranding } from "@/lib/branding";
import { withTenant } from "@/lib/db";
import { DOCX_MIME } from "@/lib/documents";
import type { Locale } from "@/lib/i18n";
import { requireTenant } from "@/lib/tenant";
import { createHash } from "node:crypto";

export type LetterKind =
  | "engagement"
  | "planning_tcwg"
  | "rep_affirmation"
  | "rep_complementary"
  | "management_letter";

/** File-index destination per letter kind. */
const LETTER_CODES: Record<LetterKind, string> = {
  engagement: "P1.1",
  planning_tcwg: "C5.1",
  rep_affirmation: "C3.1",
  rep_complementary: "C3.1",
  management_letter: "C5.1",
};

interface LetterFields {
  clientName: string;
  legalForm: string;
  fiscalYear: number;
  periodEnd: string;
  coCac: boolean;
  mandateType: "statutes" | "ago" | null;
  mandateStartYear: number | null;
  /** management_letter only: the C5.1 points to include. */
  c1Points?: string[];
}

function mandateYears(type: "statutes" | "ago"): number {
  // AUSCGIE art. 704: 2 fiscal years if named in the statutes/constitutive
  // meeting, 6 fiscal years if appointed by the ordinary general meeting.
  return type === "statutes" ? 2 : 6;
}

export function mandateExpiryYear(type: "statutes" | "ago", startYear: number): number {
  return startYear + mandateYears(type) - 1;
}

function p(text: string, bold = false): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold })] });
}

async function buildLetter(
  kind: LetterKind,
  f: LetterFields,
  locale: Locale,
  branding: Branding,
): Promise<Buffer> {
  const fr = locale === "fr";
  const children: Paragraph[] = [...letterheadParagraphs(branding)];

  if (kind === "engagement") {
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun(fr ? "Lettre de mission" : "Engagement letter")],
      }),
      p(`${f.clientName} (${f.legalForm})`),
      p(
        fr
          ? `Exercice ${f.fiscalYear} — clôture au ${f.periodEnd} — référentiel : SYSCOHADA révisé (AUDCIF).`
          : `Fiscal year ${f.fiscalYear} — period end ${f.periodEnd} — framework: SYSCOHADA révisé (AUDCIF).`,
      ),
      p(
        fr
          ? "Nous effectuerons l'audit selon les Normes internationales d'audit (ISA) et les obligations du commissaire aux comptes prévues par l'AUSCGIE."
          : "We will conduct the audit in accordance with International Standards on Auditing (ISA) and the statutory-auditor obligations of the AUSCGIE.",
      ),
    );
    if (f.mandateType && f.mandateStartYear) {
      const expiry = mandateExpiryYear(f.mandateType, f.mandateStartYear);
      children.push(
        p(
          fr
            ? `Mandat : ${mandateYears(f.mandateType)} exercices (art. 704 AUSCGIE), du ${f.mandateStartYear} à ${expiry}.`
            : `Mandate: ${mandateYears(f.mandateType)} fiscal years (AUSCGIE art. 704), from ${f.mandateStartYear} to ${expiry}.`,
        ),
      );
    }
    if (f.coCac) {
      children.push(
        p(
          fr
            ? "Variante co-commissariat : la mission est exercée conjointement avec l'autre commissaire aux comptes ; la répartition des travaux et la revue croisée seront documentées (art. 719)."
            : "Co-commissariat variant: the engagement is performed jointly with the co-statutory auditor; work split and cross-review will be documented (art. 719).",
          true,
        ),
      );
    }
    children.push(
      p(
        fr
          ? "Les experts et collaborateurs assistant le commissaire aux comptes seront désignés conformément à l'article 718."
          : "Experts and staff assisting the statutory auditor will be named in accordance with article 718.",
      ),
      p(fr ? "Signatures : le cabinet / le client" : "Signatures: the firm / the client"),
    );
  } else if (kind === "planning_tcwg") {
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [
          new TextRun(
            fr
              ? "Communication sur la planification aux organes de gouvernance (ISA 260)"
              : "Planning communication to those charged with governance (ISA 260)",
          ),
        ],
      }),
      p(`${f.clientName} — ${f.fiscalYear}`),
      p(
        fr
          ? "Étendue et calendrier prévus de l'audit : approche par les risques, seuils de signification, calendrier d'intervention et équipe."
          : "Planned scope and timing of the audit: risk-based approach, materiality, fieldwork timetable and team.",
      ),
    );
  } else if (kind === "rep_affirmation") {
    // OHADA layer 1: affirmation letter on the draft FS BEFORE the board
    // meeting — signed by the DG and the head of accounting (spec §7 item 9).
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun(fr ? "Lettre d'affirmation (avant arrêté des comptes)" : "Affirmation letter (before the board's arrêté)")],
      }),
      p(`${f.clientName} — ${f.fiscalYear} (${f.periodEnd})`),
      p(
        fr
          ? "Nous vous confirmons, au mieux de notre connaissance, les déclarations suivantes relatives au projet d'états financiers (ISA 580) : exhaustivité des opérations et des passifs, régularité des enregistrements, absence de fraude connue non communiquée, communication de toutes les parties liées et conventions, événements postérieurs jusqu'à ce jour."
          : "We confirm, to the best of our knowledge, the following representations on the draft financial statements (ISA 580): completeness of transactions and liabilities, propriety of the records, no known undisclosed fraud, disclosure of all related parties and agreements, subsequent events to date.",
      ),
      p(fr ? "Signatures : Directeur Général · Chef comptable" : "Signatures: Managing Director · Head of accounting", true),
    );
  } else if (kind === "rep_complementary") {
    // OHADA layer 2: complementary letter AFTER the board arrête les comptes —
    // signed by the PCA/administrateur général and the DG.
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun(fr ? "Lettre d'affirmation complémentaire (après arrêté des comptes)" : "Complementary representation letter (after the board's arrêté)")],
      }),
      p(`${f.clientName} — ${f.fiscalYear} (${f.periodEnd})`),
      p(
        fr
          ? "À la suite de l'arrêté des comptes par le conseil, nous confirmons que les déclarations de la lettre d'affirmation initiale demeurent valables et qu'aucun événement postérieur significatif n'est intervenu depuis, autre que ceux portés à votre connaissance."
          : "Following the board's approval of the accounts, we confirm the representations in the initial affirmation letter remain valid and that no significant subsequent events have occurred other than those communicated to you.",
      ),
      p(fr ? "Signatures : Président du Conseil d'Administration · Directeur Général" : "Signatures: Chairman of the Board · Managing Director", true),
    );
  } else {
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun(fr ? "Lettre de recommandations (ISA 265)" : "Management letter (ISA 265)")],
      }),
      p(`${f.clientName} — ${f.fiscalYear}`),
      p(
        fr
          ? "Nous portons à votre attention les déficiences du contrôle interne et points d'amélioration relevés au cours de notre audit, détaillés ci-après."
          : "We bring to your attention the internal-control deficiencies and improvement points identified during our audit, detailed below.",
      ),
      ...(f.c1Points ?? []).map((point) => p(`• ${point}`)),
    );
  }

  children.push(...letterheadFooter(branding));
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

/**
 * Generate a letter as a versioned document under its file item (engagement
 * letter → P1.1; planning TCWG letter → C5.1). Regenerating creates a new version.
 */
export async function generateLetter(
  engagementId: string,
  kind: LetterKind,
  locale: Locale,
): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const info = await tx.query<{
      client_name: string;
      legal_form: string;
      co_cac: boolean;
      mandate_type: "statutes" | "ago" | null;
      mandate_start_year: number | null;
      fiscal_year: number;
      period_end: string;
    }>(
      `SELECT c.name AS client_name, c.legal_form, c.co_cac, c.mandate_type,
              c.mandate_start_year, e.fiscal_year,
              to_char(e.period_end, 'YYYY-MM-DD') AS period_end
         FROM engagement e JOIN client c ON c.id = e.client_id
        WHERE e.id = $1`,
      [engagementId],
    );
    const row = info.rows[0];
    if (!row) throw new Error("not-found");

    const code = LETTER_CODES[kind];
    const item = await tx.query<{ id: string }>(
      "SELECT id FROM file_item WHERE engagement_id = $1 AND code = $2",
      [engagementId, code],
    );
    if (!item.rows[0]) throw new Error("not-found");
    const fileItemId = item.rows[0].id;

    // Management letter pulls the C5.1 control-deficiency points (spec §8.3).
    let c1Points: string[] | undefined;
    if (kind === "management_letter") {
      const findings = await tx.query<{ title: string; detail: string | null }>(
        "SELECT title, detail FROM finding WHERE engagement_id = $1 AND route = 'c1' ORDER BY created_at",
        [engagementId],
      );
      c1Points = findings.rows.map((f) => (f.detail ? `${f.title} — ${f.detail}` : f.title));
    }

    const fr = locale === "fr";
    const TITLES: Record<LetterKind, string> = {
      engagement: fr ? "Lettre de mission" : "Engagement letter",
      planning_tcwg: fr ? "Communication de planification (ISA 260)" : "Planning communication (ISA 260)",
      rep_affirmation: fr ? "Lettre d'affirmation (pré-arrêté)" : "Affirmation letter (pre-arrêté)",
      rep_complementary: fr ? "Lettre d'affirmation complémentaire" : "Complementary representation letter",
      management_letter: fr ? "Lettre de recommandations" : "Management letter",
    };
    const title = TITLES[kind];

    const branding = await loadBranding(tx, tenantId);
    const content = await buildLetter(
      kind,
      {
        clientName: row.client_name,
        legalForm: row.legal_form,
        fiscalYear: row.fiscal_year,
        periodEnd: row.period_end,
        coCac: row.co_cac,
        mandateType: row.mandate_type,
        mandateStartYear: row.mandate_start_year,
        c1Points,
      },
      locale,
      branding,
    );

    let documentId: string;
    const existing = await tx.query<{ id: string }>(
      "SELECT id FROM document WHERE file_item_id = $1 AND kind = 'letter' AND title = $2 LIMIT 1",
      [fileItemId, title],
    );
    if (existing.rows[0]) {
      documentId = existing.rows[0].id;
    } else {
      const created = await tx.query<{ id: string }>(
        `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, kind, created_by)
         VALUES ($1, $2, $3, $4, $5, 'letter', $6) RETURNING id`,
        [tenantId, engagementId, fileItemId, title, locale, userId],
      );
      documentId = created.rows[0].id;
    }

    const next = await tx.query<{ v: number }>(
      "SELECT coalesce(max(version_no), 0) + 1 AS v FROM document_version WHERE document_id = $1",
      [documentId],
    );
    const sha256 = createHash("sha256").update(content).digest("hex");
    await tx.query(
      `INSERT INTO document_version
         (tenant_id, document_id, version_no, mime, byte_size, sha256, content, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [tenantId, documentId, next.rows[0].v, DOCX_MIME, content.length, sha256, content, `letter:${kind}`, userId],
    );
    await tx.query("UPDATE document SET current_version = $2 WHERE id = $1", [
      documentId,
      next.rows[0].v,
    ]);
    return documentId;
  });
}

/** Letters generated for an engagement (for the acceptance/planning hubs). */
export async function listLetters(
  engagementId: string,
): Promise<{ id: string; title: string; currentVersion: number }[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string; title: string; current_version: number }>(
      "SELECT id, title, current_version FROM document WHERE engagement_id = $1 AND kind = 'letter' ORDER BY created_at",
      [engagementId],
    );
    return result.rows.map((r) => ({ id: r.id, title: r.title, currentVersion: r.current_version }));
  });
}
