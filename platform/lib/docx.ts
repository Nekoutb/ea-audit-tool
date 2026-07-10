import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { Locale } from "@/lib/i18n";
import type { WorkpaperTemplate } from "@/lib/templates";

export interface WorkpaperMergeFields {
  code: string;
  title: string;
  clientName: string;
  fiscalYear: number;
  periodEnd: string;
  preparedBy: string;
}

const LABELS: Record<Locale, Record<string, string>> = {
  en: {
    client: "Client",
    periodEnd: "Period end",
    fiscalYear: "Fiscal year",
    preparedBy: "Prepared by",
    purpose: "Purpose",
    checklist: "Requirements / actions",
    done: "Done",
    narrative: "Narrative / work performed (complete in this document)",
    signoff: "Sign-off",
    preparer: "Preparer",
    reviewer: "Reviewer",
    partner: "Partner",
    nameDate: "Name / date",
    structuredNote:
      "Structured facts (sign-offs, statuses, figures) are captured in the application; this document carries the narrative and is the presentation/archive artifact.",
  },
  fr: {
    client: "Client",
    periodEnd: "Date de clôture",
    fiscalYear: "Exercice",
    preparedBy: "Préparé par",
    purpose: "Objet",
    checklist: "Diligences / actions",
    done: "Fait",
    narrative: "Narratif / travaux réalisés (à compléter dans ce document)",
    signoff: "Signatures",
    preparer: "Préparateur",
    reviewer: "Réviseur",
    partner: "Associé",
    nameDate: "Nom / date",
    structuredNote:
      "Les données structurées (signatures, statuts, montants) sont saisies dans l'application ; ce document porte le narratif et constitue la pièce de présentation et d'archivage.",
  },
};

function metaRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        children: [new Paragraph(value)],
      }),
    ],
  });
}

/**
 * Render a working-paper .docx from a template + merge fields (master spec §9).
 * Deterministic layout: header block, purpose, checklist table with a Done
 * column, narrative area, and the sign-off block shown on the face of the paper.
 */
export async function generateWorkpaperDocx(
  template: WorkpaperTemplate,
  fields: WorkpaperMergeFields,
  locale: Locale,
): Promise<Buffer> {
  const t = LABELS[locale];

  const checklistRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 88, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: t.checklist, bold: true })] })],
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: t.done, bold: true })] })],
        }),
      ],
    }),
    ...template.items[locale].map(
      (item) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(item)] }),
            new TableCell({ children: [new Paragraph("☐")] }),
          ],
        }),
    ),
  ];

  const signoffRows = [
    new TableRow({
      tableHeader: true,
      children: [t.signoff, t.nameDate].map(
        (text) =>
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
          }),
      ),
    }),
    ...[t.preparer, t.reviewer, t.partner].map(
      (role) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(role)] }),
            new TableCell({ children: [new Paragraph("")] }),
          ],
        }),
    ),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun(`${fields.code} — ${fields.title}`)],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              metaRow(t.client, fields.clientName),
              metaRow(t.fiscalYear, String(fields.fiscalYear)),
              metaRow(t.periodEnd, fields.periodEnd),
              metaRow(t.preparedBy, fields.preparedBy),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t.purpose)] }),
          new Paragraph(template.purpose[locale]),
          new Paragraph({ text: "" }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: checklistRows }),
          new Paragraph({ text: "" }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t.narrative)] }),
          ...Array.from(
            { length: 6 },
            () =>
              new Paragraph({
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB", space: 8 },
                },
                text: "",
              }),
          ),
          new Paragraph({ text: "" }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: signoffRows }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: t.structuredNote, italics: true, size: 18 })],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
