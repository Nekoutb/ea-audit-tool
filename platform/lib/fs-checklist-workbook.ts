// The OHADA financial statement checklist as a workbook — the E6.10 paper the
// handbook asks for when it says the review of the notes must be formalised in
// a disclosure checklist [questionnaire de contrôle de l'annexe] rather than
// read and remembered.
//
// Two tabs. The Cover carries the engagement details entered once, what the
// paper is for, counts of what the checklist found — by formula, so they follow
// the answers — and the sign-off. The Checklist carries one row per
// requirement of the Act, in both languages with the article beside it, and
// three things the preparer records: whether the requirement applies to this
// entity, whether the statements meet it, and where in the statements the
// reviewer can see that they do. A Status column works the answer out; it is
// never typed.
//
// Same idiom as lib/toc-workbook.ts, and the same three rules that keep Excel
// from declaring the file damaged: formula bodies carry no leading "=", a
// column given an outline level declares it on the sheet, and conditional
// formatting colours with bgColor.

import ExcelJS from "exceljs";
import {
  OHADA_FS_CHECKLIST,
  OHADA_FS_CHECKLIST_STD,
  type FsChecklistSection,
} from "@/lib/ohada-fs-checklist";

/** What the preparer recorded against one requirement. */
export interface FsChecklistAnswer {
  applicable: "yes" | "no" | "";
  presented: "✓" | "✗" | "n/a" | "";
  fsRef: string;
  comment: string;
}

export interface FsChecklistView {
  locale: "en" | "fr";
  clientName: string;
  fiscalYear: number;
  periodEnd: string;
  /** which SYSCOHADA system the entity reports under; blank until known */
  system: "normal" | "smt" | "";
  preparer: string | null;
  reviewer: string | null;
  partner: string | null;
  sections: readonly FsChecklistSection[];
  /** keyed by row ref; a missing ref is an unanswered row */
  answers: Record<string, FsChecklistAnswer>;
}

const PAPER = "C2.1.1 OHADA Financial Statement Checklist";

const HDR = "FFD9D9D9";
const BAND = "FFC0C0C0";
const ENTRY = "FFFFF2CC";
const OK = "FFC6EFCE";
const BAD = "FFFFC7CE";
const OK_TEXT = "FF006100";
const BAD_TEXT = "FF9C0006";

const TICK = "✓";
const CROSS = "✗";
const NA = "n/a";

const fill = (cell: ExcelJS.Cell, argb: string) => {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
};
const box = (cell: ExcelJS.Cell) => {
  cell.border = {
    top: { style: "thin", color: { argb: "FF999999" } },
    left: { style: "thin", color: { argb: "FF999999" } },
    bottom: { style: "thin", color: { argb: "FF999999" } },
    right: { style: "thin", color: { argb: "FF999999" } },
  };
};

/* ===================== the Readme inputs on the Cover =================== */

const INPUT_ROW_START = 4;
const INPUT_FIELDS = [
  "Client / company",
  "Engagement",
  "Fiscal year",
  "Period end",
  "Accounting system",
  "Prepared by",
  "Date prepared",
  "Reviewed by",
  "Date reviewed",
  "Partner",
  "Date approved",
] as const;

/** A reference into the Readme block — the formula body only, no leading "=". */
const inputRef = (field: (typeof INPUT_FIELDS)[number]): string =>
  `Cover!$D$${INPUT_ROW_START + INPUT_FIELDS.indexOf(field)}`;

/* ============================== builder =============================== */

export async function buildFsChecklistWorkbook(view: FsChecklistView): Promise<Buffer> {
  const fr = view.locale === "fr";
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditISA";
  wb.created = new Date();

  const page = (ws: ExcelJS.Worksheet, footer: string) => {
    ws.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
    ws.headerFooter = { oddFooter: `&L${footer}&R&P / &N` };
  };

  const systemLabel =
    view.system === "normal"
      ? fr ? "Système normal" : "Normal system [système normal]"
      : view.system === "smt"
        ? fr ? "Système minimal de trésorerie" : "Minimal cash-basis system [système minimal de trésorerie]"
        : "";

  const cached: Record<(typeof INPUT_FIELDS)[number], string> = {
    "Client / company": view.clientName,
    Engagement: fr ? `Audit légal — exercice ${view.fiscalYear}` : `Statutory audit — FY ${view.fiscalYear}`,
    "Fiscal year": String(view.fiscalYear),
    "Period end": view.periodEnd,
    "Accounting system": systemLabel,
    "Prepared by": view.preparer ?? "",
    "Date prepared": "",
    "Reviewed by": view.reviewer ?? "",
    "Date reviewed": "",
    Partner: view.partner ?? "",
    "Date approved": "",
  };

  const identityBand = (ws: ExcelJS.Worksheet, title: string) => {
    const t = ws.addRow([`${PAPER} — ${title}`]);
    t.font = { bold: true, size: 13 };
    const fields: (typeof INPUT_FIELDS)[number][] = [
      "Client / company", "Engagement", "Period end", "Prepared by", "Reviewed by",
    ];
    const keyRow = ws.addRow([...fields, "Index"]);
    keyRow.eachCell((cell) => { fill(cell, HDR); box(cell); cell.font = { bold: true }; });
    const valRow = ws.addRow([]);
    fields.forEach((field, i) => {
      valRow.getCell(i + 1).value = { formula: inputRef(field), result: cached[field] } as ExcelJS.CellFormulaValue;
    });
    valRow.getCell(fields.length + 1).value = "E6.10";
    valRow.eachCell((cell) => { box(cell); cell.alignment = { wrapText: true, vertical: "top" }; });
    ws.addRow([]);
  };

  const sectionBand = (ws: ExcelJS.Worksheet, label: string, span: number) => {
    const row = ws.addRow([label]);
    ws.mergeCells(row.number, 1, row.number, span);
    for (let c = 1; c <= span; c += 1) { fill(row.getCell(c), BAND); box(row.getCell(c)); }
    row.getCell(1).font = { bold: true };
    return row;
  };

  /* ------------------------------ Cover ------------------------------ */
  // Created first so it is the first tab; its counts are filled in once the
  // Checklist exists and its row addresses are known.
  const cover = wb.addWorksheet("Cover");
  page(cover, "Cover");
  cover.columns = [{ width: 6 }, { width: 20 }, { width: 26 }, { width: 50 }, { width: 30 }, { width: 18 }] as ExcelJS.Column[];

  const heading = cover.addRow([PAPER]);
  heading.font = { bold: true, size: 15 };
  cover.addRow([]);
  const readme = cover.addRow([
    fr ? "Readme — saisir ici une seule fois ; chaque onglet lit ces cellules" : "Readme — enter these once; every tab in this file reads them",
  ]);
  cover.mergeCells(readme.number, 1, readme.number, 6);
  readme.getCell(1).font = { italic: true };
  fill(readme.getCell(1), HDR);

  INPUT_FIELDS.forEach((field, i) => {
    const row = cover.addRow(["", field, "", cached[field]]);
    // The whole file addresses these cells; if the block ever moves, fail
    // loudly here rather than let every formula quietly read the wrong row.
    if (row.number !== INPUT_ROW_START + i) throw new Error("readme-layout-moved");
    cover.mergeCells(row.number, 2, row.number, 3);
    cover.mergeCells(row.number, 4, row.number, 6);
    row.getCell(2).font = { bold: true };
    fill(row.getCell(2), HDR);
    box(row.getCell(2));
    box(row.getCell(4));
    if (!cached[field]) fill(row.getCell(4), ENTRY);
  });
  cover.addRow([]);

  sectionBand(cover, fr ? "Objet et référentiel" : "Scope and framework", 6);
  const scope: [string, string][] = [
    [
      fr ? "Ce papier tient" : "This paper owns",
      fr
        ? "Le contrôle, exigence par exigence, du contenu et de la présentation des états financiers annuels — bilan, compte de résultat, tableau des flux de trésorerie et notes annexes, qui forment un tout indissociable — au regard de l'Acte uniforme et du SYSCOHADA révisé, avec la référence de chaque constat dans les états."
        : "The requirement-by-requirement check of the content and presentation of the annual financial statements — balance sheet, income statement, cash-flow statement and notes, which form an indivisible whole [tout indissociable] — against the Uniform Act and the SYSCOHADA révisé, with the reference of every finding in the statements.",
    ],
    [fr ? "Référentiel" : "Framework", OHADA_FS_CHECKLIST_STD],
    [
      fr ? "Comment l'utiliser" : "How to use it",
      fr
        ? "Pour chaque ligne : Applicable (Oui / Non pour cette entité), puis Présenté (✓ conforme, ✗ non conforme — un écart, n/a sans objet), puis la référence dans les états où le réviseur le vérifie. Le Statut se calcule seul. Un ✗ est un écart de présentation ou une omission : il se remonte au senior et se traite dans le papier E6.10, jamais en changeant la réponse."
        : "For each row: Applicable (Yes / No for this entity), then Presented (✓ met, ✗ not met — a gap, n/a not relevant), then the reference in the statements where the reviewer can see it. Status works itself out. A ✗ is a presentation gap or an omission: it goes to the senior and is dealt with on the E6.10 paper, never by changing the answer.",
    ],
    [
      fr ? "Alimente · alimenté par" : "Feeds from · into",
      "E6.10 · C2.1 · C1.1 (SAD)   →   C2.1 revue finale · C5.1 communication · opinion (ISA 700 / 705)",
    ],
  ];
  for (const [k, v] of scope) {
    const row = cover.addRow(["", k, v]);
    cover.mergeCells(row.number, 3, row.number, 6);
    row.getCell(2).font = { bold: true };
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
    box(row.getCell(2)); box(row.getCell(3));
    row.height = v.length > 260 ? 72 : v.length > 130 ? 44 : 18;
  }
  cover.addRow([]);

  sectionBand(cover, fr ? "Ce que le contrôle a relevé" : "What the checklist found", 6);
  const summaryHead = cover.addRow(["", fr ? "Exigences" : "Requirements", fr ? "Applicables" : "Applicable", fr ? "Conformes" : "Met", fr ? "Écarts" : "Gaps", fr ? "Non répondues" : "Unanswered"]);
  for (let c = 2; c <= 6; c += 1) { fill(summaryHead.getCell(c), HDR); box(summaryHead.getCell(c)); summaryHead.getCell(c).font = { bold: true }; }
  const summaryRow = cover.addRow([]); // filled once the Checklist rows exist
  cover.addRow([]);

  /* ---------------------------- Checklist ---------------------------- */
  const sheet = wb.addWorksheet("Checklist");
  page(sheet, "Checklist");
  const SPAN = 9;
  sheet.columns = [
    { width: 9 }, { width: 46 }, { width: 46 }, { width: 16 },
    { width: 11 }, { width: 11 }, { width: 18 }, { width: 9 }, { width: 40 },
  ] as ExcelJS.Column[];
  identityBand(sheet, fr ? "Contrôle" : "Checklist");

  const legend = sheet.addRow([
    fr
      ? `Légende :  Applicable = Oui / Non pour cette entité.   Présenté : ${TICK} conforme   ${CROSS} non conforme — un écart   ${NA} sans objet.   Statut est une formule : Écart si ${CROSS}, n/a si non applicable, vide tant que la ligne n'est pas répondue.`
      : `Legend:  Applicable = Yes / No for this entity.   Presented: ${TICK} met   ${CROSS} not met — a gap   ${NA} not relevant.   Status is a formula: Gap if ${CROSS}, n/a if not applicable, blank until the row is answered.`,
  ]);
  sheet.mergeCells(legend.number, 1, legend.number, SPAN);
  legend.getCell(1).alignment = { wrapText: true, vertical: "top" };
  legend.getCell(1).font = { italic: true };
  legend.height = 32;
  fill(legend.getCell(1), HDR);
  sheet.views = [{ state: "frozen", ySplit: legend.number }];

  const header = () => {
    const h = sheet.addRow([
      "Ref",
      fr ? "Exigence (EN)" : "Requirement (EN)",
      fr ? "Exigence (FR)" : "Requirement (FR)",
      fr ? "Article" : "Article",
      fr ? "Applicable" : "Applicable",
      fr ? "Présenté" : "Presented",
      fr ? "Réf. états financiers" : "FS reference",
      fr ? "Statut" : "Status",
      fr ? "Commentaire" : "Comment",
    ]);
    h.eachCell((cell) => { fill(cell, HDR); box(cell); cell.font = { bold: true }; cell.alignment = { wrapText: true, vertical: "middle" }; });
    h.height = 28;
  };

  let firstDataRow = 0;
  let lastDataRow = 0;
  for (const section of view.sections) {
    sheet.addRow([]);
    sectionBand(sheet, fr ? section.titleFr : section.titleEn, SPAN);
    const intro = fr ? section.introFr : section.introEn;
    if (intro) {
      const row = sheet.addRow([intro]);
      sheet.mergeCells(row.number, 1, row.number, SPAN);
      row.getCell(1).alignment = { wrapText: true, vertical: "top" };
      row.getCell(1).font = { italic: true };
      row.height = intro.length > 200 ? 44 : 30;
    }
    header();
    for (const r of section.rows) {
      const a = view.answers[r.ref] ?? { applicable: "", presented: "", fsRef: "", comment: "" };
      const row = sheet.addRow([r.ref, r.en, r.fr, r.article, a.applicable === "yes" ? (fr ? "Oui" : "Yes") : a.applicable === "no" ? (fr ? "Non" : "No") : "", a.presented, a.fsRef, "", a.comment]);
      if (!firstDataRow) firstDataRow = row.number;
      lastDataRow = row.number;
      const n = row.number;
      // Status: n/a when not applicable, blank until answered, Gap on a ✗.
      row.getCell(8).value = {
        formula: `IF(OR(E${n}="No",E${n}="Non"),"${NA}",IF(F${n}="","",IF(F${n}="${CROSS}","Gap",IF(F${n}="${NA}","${NA}","OK"))))`,
        result: a.applicable === "no" ? NA : a.presented === "" ? "" : a.presented === CROSS ? "Gap" : a.presented === NA ? NA : "OK",
      } as ExcelJS.CellFormulaValue;
      row.getCell(5).dataValidation = { type: "list", allowBlank: true, formulae: [fr ? '"Oui,Non"' : '"Yes,No"'] };
      row.getCell(6).dataValidation = { type: "list", allowBlank: true, formulae: [`"${TICK},${CROSS},${NA}"`] };
      for (let c = 1; c <= SPAN; c += 1) {
        box(row.getCell(c));
        row.getCell(c).alignment = { wrapText: true, vertical: "top" };
      }
      row.getCell(1).font = { bold: true };
      row.getCell(4).font = { size: 9 };
      row.getCell(8).alignment = { horizontal: "center", vertical: "top" };
      row.getCell(8).font = { bold: true };
      for (const c of [5, 6, 7, 9]) if (!row.getCell(c).value) fill(row.getCell(c), ENTRY);
      row.height = Math.max(r.en.length, r.fr.length) > 180 ? 58 : Math.max(r.en.length, r.fr.length) > 90 ? 40 : 22;
    }
  }

  if (firstDataRow) {
    // Formatting covers the whole answered range, so an answer entered later
    // colours the same way without the file being regenerated.
    sheet.addConditionalFormatting({
      ref: `F${firstDataRow}:F${lastDataRow}`,
      rules: [
        { type: "cellIs", operator: "equal", priority: 1, formulae: [`"${TICK}"`],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: OK } }, font: { color: { argb: OK_TEXT }, bold: true } } },
        { type: "cellIs", operator: "equal", priority: 2, formulae: [`"${CROSS}"`],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: BAD } }, font: { color: { argb: BAD_TEXT }, bold: true } } },
      ],
    });
    sheet.addConditionalFormatting({
      ref: `H${firstDataRow}:H${lastDataRow}`,
      rules: [
        { type: "cellIs", operator: "equal", priority: 1, formulae: ['"OK"'],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: OK } }, font: { color: { argb: OK_TEXT }, bold: true } } },
        { type: "cellIs", operator: "equal", priority: 2, formulae: ['"Gap"'],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: BAD } }, font: { color: { argb: BAD_TEXT }, bold: true } } },
      ],
    });
  }

  /* ------------------- the Cover counts, now addressable ------------------- */
  const total = view.sections.reduce((n, s) => n + s.rows.length, 0);
  const statusRange = firstDataRow ? `Checklist!$H$${firstDataRow}:$H$${lastDataRow}` : null;
  const applicableRange = firstDataRow ? `Checklist!$E$${firstDataRow}:$E$${lastDataRow}` : null;
  const counts: (string | ExcelJS.CellFormulaValue)[] = statusRange && applicableRange
    ? [
        { formula: `COUNTA(Checklist!$A$${firstDataRow}:$A$${lastDataRow})`, result: total },
        { formula: `COUNTIF(${applicableRange},"Yes")+COUNTIF(${applicableRange},"Oui")`, result: Object.values(view.answers).filter((a) => a.applicable === "yes").length },
        { formula: `COUNTIF(${statusRange},"OK")`, result: Object.values(view.answers).filter((a) => a.applicable !== "no" && a.presented === TICK).length },
        { formula: `COUNTIF(${statusRange},"Gap")`, result: Object.values(view.answers).filter((a) => a.applicable !== "no" && a.presented === CROSS).length },
        { formula: `COUNTBLANK(${statusRange})`, result: total - Object.values(view.answers).filter((a) => a.applicable === "no" || a.presented !== "").length },
      ]
    : ["0", "0", "0", "0", "0"];
  counts.forEach((v, i) => {
    const cell = summaryRow.getCell(i + 2);
    cell.value = v as ExcelJS.CellValue;
    cell.alignment = { horizontal: "center" };
    cell.font = { bold: true };
    box(cell);
  });
  fill(summaryRow.getCell(5), BAD);
  fill(summaryRow.getCell(4), OK);
  const note = cover.addRow([
    "",
    fr
      ? "Un écart est une anomalie de présentation, une erreur ou une omission : il est signalé au senior / manager et son incidence sur l'opinion est appréciée sur E6.10. Le contrôle ne se conclut pas avec des lignes non répondues."
      : "A gap is a presentation anomaly, an error or an omission: it is reported to the senior / manager and its effect on the opinion is weighed on E6.10. The checklist is not concluded with unanswered rows.",
  ]);
  cover.mergeCells(note.number, 2, note.number, 6);
  note.getCell(2).alignment = { wrapText: true, vertical: "top" };
  note.getCell(2).font = { italic: true };
  note.height = 40;
  cover.addRow([]);

  /* ------------------------------ Sign-off ------------------------------ */
  sectionBand(cover, fr ? "Visas" : "Sign-off", 6);
  const signHead = cover.addRow(["", fr ? "Rôle" : "Role", fr ? "Nom" : "Name", "Date"]);
  [2, 3, 4].forEach((c) => { fill(signHead.getCell(c), HDR); box(signHead.getCell(c)); signHead.getCell(c).font = { bold: true }; });
  ([
    [fr ? "Préparé par" : "Prepared by", "Prepared by", "Date prepared"],
    [fr ? "Revu par" : "Reviewed by", "Reviewed by", "Date reviewed"],
    [fr ? "Associé" : "Partner", "Partner", "Date approved"],
  ] as [string, (typeof INPUT_FIELDS)[number], (typeof INPUT_FIELDS)[number]][]).forEach(([label, nameField, dateField]) => {
    const row = cover.addRow(["", label]);
    row.getCell(3).value = { formula: inputRef(nameField), result: cached[nameField] } as ExcelJS.CellFormulaValue;
    row.getCell(4).value = { formula: inputRef(dateField), result: cached[dateField] } as ExcelJS.CellFormulaValue;
    for (const c of [2, 3, 4]) box(row.getCell(c));
  });
  const signNote = cover.addRow([
    "",
    fr
      ? "Les visas sont tenus par l'outil. Ces cellules lisent le bloc Readme et ne se saisissent pas."
      : "Sign-off is held by the tool. These cells read the Readme block and are not typed over.",
  ]);
  cover.mergeCells(signNote.number, 2, signNote.number, 6);
  signNote.getCell(2).font = { italic: true };
  cover.views = [{ state: "frozen", ySplit: 3 }];

  // One face for the whole file: Calibri 10, except headings that chose bigger.
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const current = cell.font ?? {};
        cell.font = { ...current, name: current.name ?? "Calibri", size: (current.size ?? 0) >= 12 ? current.size : 10 };
      });
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** The paper empty of client answers — what the Sample working papers shelf hands out. */
export function blankFsChecklistTemplate(locale: "en" | "fr" = "en"): FsChecklistView {
  return {
    locale,
    clientName: "",
    fiscalYear: new Date().getFullYear(),
    periodEnd: "",
    system: "",
    preparer: null,
    reviewer: null,
    partner: null,
    sections: OHADA_FS_CHECKLIST,
    answers: {},
  };
}
