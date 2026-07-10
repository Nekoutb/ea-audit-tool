// Letter generation (spec §4.3, §5.4): engagement letter (ISA 210 + OHADA
// mandate wording, co-CAC variant) and the C1 planning communication to TCWG.
// Letters are stored as documents (kind='letter') under the relevant file item.

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { withTenant } from "@/lib/db";
import { DOCX_MIME } from "@/lib/documents";
import type { Locale } from "@/lib/i18n";
import { requireTenant } from "@/lib/tenant";
import { createHash } from "node:crypto";

export type LetterKind = "engagement" | "planning_tcwg";

interface LetterFields {
  clientName: string;
  legalForm: string;
  fiscalYear: number;
  periodEnd: string;
  coCac: boolean;
  mandateType: "statutes" | "ago" | null;
  mandateStartYear: number | null;
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

async function buildLetter(kind: LetterKind, f: LetterFields, locale: Locale): Promise<Buffer> {
  const fr = locale === "fr";
  const children: Paragraph[] = [];

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
  } else {
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
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

/**
 * Generate a letter as a versioned document under its file item (engagement
 * letter → D3.1; planning TCWG letter → C1). Regenerating creates a new version.
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

    const code = kind === "engagement" ? "D3.1" : "C1";
    const item = await tx.query<{ id: string }>(
      "SELECT id FROM file_item WHERE engagement_id = $1 AND code = $2",
      [engagementId, code],
    );
    if (!item.rows[0]) throw new Error("not-found");
    const fileItemId = item.rows[0].id;

    const fr = locale === "fr";
    const title =
      kind === "engagement"
        ? fr
          ? "Lettre de mission"
          : "Engagement letter"
        : fr
          ? "Communication de planification (ISA 260)"
          : "Planning communication (ISA 260)";

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
      },
      locale,
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
