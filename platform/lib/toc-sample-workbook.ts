// The tests-of-controls sample as a workbook: one tab per control selected
// for testing, with the control's attributes, the population, the minimum
// sample the frequency table gave, and the occurrence numbers the random
// draw selected — each with the columns the tester fills. Pure over
// TocSampleView; lib/toc-sample-export.ts assembles the view.
import ExcelJS from "exceljs";
import { freqLabel, typeShort } from "@/lib/control-labels";
import { normFreq } from "@/lib/toc-sampling";

export interface TocSampleControl {
  controlName: string;
  scotName: string;
  controlType: string;
  frequency: string | null;
  assertions: string[];
  /** occurrences of the control in the period of reliance */
  population: number | null;
  /** the minimum from the frequency table, and the rule it came from */
  sampleSize: number | null;
  rule: string | null;
  /** occurrence numbers drawn at random, ascending */
  items: number[];
  drawnAt: string | null;
}

export interface TocSampleView {
  locale: "en" | "fr";
  clientName: string;
  fiscalYear: number;
  periodEnd: string;
  preparer: string | null;
  controls: TocSampleControl[];
}

const HDR = "FFD9D9D9";
const BAND = "FFC0C0C0";
const ENTRY = "FFFFF2CC";
const PICK = "FFDDEBF7";

const fill = (cell: ExcelJS.Cell, argb: string) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } }; };
const box = (cell: ExcelJS.Cell) => {
  const side = { style: "thin" as const, color: { argb: "FF999999" } };
  cell.border = { top: side, left: side, bottom: side, right: side };
};

/** Excel forbids these in a tab name and caps it at 31 characters; two controls may share a prefix, so the index keeps the names apart. */
export function controlTabName(index: number, name: string): string {
  const clean = name.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim();
  const prefix = `${index + 1}. `;
  return (prefix + clean).slice(0, 31).trim();
}

export async function buildTocSampleWorkbook(view: TocSampleView): Promise<Buffer> {
  const fr = view.locale === "fr";
  const T = (en: string, frText: string): string => (fr ? frText : en);
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditISA";
  wb.created = new Date();
  const PAPER = T("Tests of controls — samples", "Tests de contrôles — échantillons");

  const page = (ws: ExcelJS.Worksheet, footer: string) => {
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
    ws.headerFooter = { oddFooter: `&L${footer}&R&P / &N` };
  };
  const band = (ws: ExcelJS.Worksheet, label: string, span: number) => {
    const row = ws.addRow([label]);
    ws.mergeCells(row.number, 1, row.number, span);
    for (let c = 1; c <= span; c += 1) { fill(row.getCell(c), BAND); box(row.getCell(c)); }
    row.getCell(1).font = { bold: true };
  };
  const header = (ws: ExcelJS.Worksheet, labels: string[]) => {
    const row = ws.addRow(labels);
    row.eachCell((cell) => { fill(cell, HDR); box(cell); cell.font = { bold: true }; cell.alignment = { wrapText: true, vertical: "top" }; });
  };
  const kv = (ws: ExcelJS.Worksheet, pairs: [string, string | number][]) => {
    for (const [k, v] of pairs) {
      const row = ws.addRow([k, v]);
      row.getCell(1).font = { bold: true };
      box(row.getCell(1)); box(row.getCell(2));
    }
  };

  /* ------------------------------ Cover ------------------------------ */
  const cover = wb.addWorksheet("Cover");
  page(cover, `${PAPER} · ${view.clientName} · ${view.fiscalYear}`);
  cover.columns = [{ width: 44 }, { width: 30 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 22 }, { width: 30 }];
  const title = cover.addRow([PAPER]);
  title.font = { bold: true, size: 14 };
  cover.addRow([]);
  kv(cover, [
    [T("Client / company", "Client / société"), view.clientName],
    [T("Fiscal year", "Exercice"), String(view.fiscalYear)],
    [T("Period end", "Clôture"), view.periodEnd],
    [T("Prepared by", "Préparé par"), view.preparer ?? ""],
    [T("Date prepared", "Date de préparation"), ""],
    [T("Reviewed by", "Revu par"), ""],
    [T("Date reviewed", "Date de revue"), ""],
  ]);
  for (const r of [7, 8, 9] as const) fill(cover.getRow(r + 1).getCell(2), ENTRY);
  cover.addRow([]);
  band(cover, T("How each tab was built", "Comment chaque onglet a été construit"), 7);
  for (const line of [
    T("Minimum sample: the frequency table of the methodology (SAMPLE 3.3) — daily over 250 occurrences 25 (60 when the control is the only one covering an assertion), 50–250 occurrences 10%, under 50 5, under 5 all; weekly 5, monthly/quarterly/semi-annual 2, annual 1; automated control a test of one.", "Taille minimale : la table des fréquences de la méthodologie (SAMPLE 3.3) — quotidien au-delà de 250 occurrences 25 (60 lorsque le contrôle est le seul à couvrir une assertion), 50–250 occurrences 10 %, moins de 50 : 5, moins de 5 : toutes ; hebdomadaire 5, mensuel/trimestriel/semestriel 2, annuel 1 ; contrôle automatisé : test unique."),
    T("Selection: the occurrence numbers were drawn at random, without replacement, from 1 to the population. Every generation draws afresh; the numbers here are the ones generated on the date shown.", "Sélection : les numéros d'occurrence ont été tirés au hasard, sans remise, de 1 à la population. Chaque génération tire à nouveau ; les numéros ici sont ceux générés à la date indiquée."),
    T("Occurrence n of N means the n-th performance of the control in the period, counted in the order the population is kept (the register, the log, the file). The tester identifies it there and records what was inspected.", "L'occurrence n sur N désigne la n-ième exécution du contrôle dans la période, comptée dans l'ordre où la population est tenue (registre, journal, dossier). Le testeur l'y identifie et consigne ce qui a été inspecté."),
    T("Columns in yellow are for the tester: the date and reference of the occurrence, the attributes inspected, the result and any deviation, carried to E1.2.", "Les colonnes en jaune sont pour le testeur : date et référence de l'occurrence, attributs inspectés, résultat et toute déviation, reportés sur E1.2."),
  ]) {
    const row = cover.addRow([line]);
    cover.mergeCells(row.number, 1, row.number, 7);
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
    row.height = 42;
  }
  cover.addRow([]);
  band(cover, T("Controls selected for testing", "Contrôles sélectionnés pour test"), 7);
  header(cover, [T("Control", "Contrôle"), "SCOT", T("Frequency", "Fréquence"), T("Population", "Population"), T("Sample", "Échantillon"), T("Drawn on", "Tiré le"), T("Tab", "Onglet")]);
  view.controls.forEach((c, i) => {
    const row = cover.addRow([c.controlName, c.scotName, c.frequency ? freqLabel(normFreq(c.frequency), fr) : "—", c.population ?? "—", c.items.length > 0 ? c.items.length : (c.sampleSize ?? "—"), c.drawnAt ? c.drawnAt.slice(0, 16).replace("T", " ") : T("not drawn", "non tiré"), controlTabName(i, c.controlName)]);
    row.eachCell((cell) => box(cell));
  });

  /* --------------------------- one tab per control --------------------------- */
  view.controls.forEach((c, i) => {
    const ws = wb.addWorksheet(controlTabName(i, c.controlName));
    page(ws, `${c.controlName} · ${view.clientName} · ${view.fiscalYear}`);
    ws.columns = [{ width: 6 }, { width: 18 }, { width: 14 }, { width: 22 }, { width: 34 }, { width: 14 }, { width: 34 }];
    const t = ws.addRow([c.controlName]);
    t.font = { bold: true, size: 13 };
    ws.addRow([]);
    band(ws, T("Control and sample", "Contrôle et échantillon"), 7);
    kv(ws, [
      ["SCOT", c.scotName],
      [T("Control type", "Type de contrôle"), typeShort(c.controlType, fr)],
      [T("Frequency", "Fréquence"), c.frequency ? freqLabel(normFreq(c.frequency), fr) : "—"],
      [T("Assertions covered", "Assertions couvertes"), c.assertions.join(", ") || "—"],
      [T("Population (occurrences in the period)", "Population (occurrences dans la période)"), c.population ?? "—"],
      [T("Minimum sample (frequency table)", "Taille minimale (table des fréquences)"), c.sampleSize ?? "—"],
      [T("Rule applied", "Règle appliquée"), c.rule ?? "—"],
      [T("Items drawn", "Éléments tirés"), c.items.length],
      [T("Drawn on", "Tiré le"), c.drawnAt ? c.drawnAt.slice(0, 16).replace("T", " ") : T("not drawn yet — generate the sample on the Sampling tool", "non tiré — générer l'échantillon dans l'outil Échantillonnage")],
    ]);
    ws.addRow([]);
    band(ws, T("Items selected at random", "Éléments tirés au hasard"), 7);
    header(ws, ["#", T("Occurrence n° (of population)", "Occurrence n° (sur la population)"), T("Date", "Date"), T("Reference / document", "Référence / document"), T("Attributes inspected", "Attributs inspectés"), T("Result", "Résultat"), T("Deviation / comment", "Déviation / commentaire")]);
    if (c.items.length === 0) {
      const row = ws.addRow(["", T("— no item drawn —", "— aucun élément tiré —")]);
      row.getCell(2).font = { italic: true, color: { argb: "FF666666" } };
    }
    c.items.forEach((item, k) => {
      const row = ws.addRow([k + 1, c.population ? `${item} / ${c.population}` : String(item), "", "", "", "", ""]);
      row.eachCell({ includeEmpty: true }, (cell, col) => { box(cell); if (col >= 3) fill(cell, ENTRY); });
      fill(row.getCell(2), PICK);
      row.getCell(2).font = { bold: true };
    });
    ws.views = [{ state: "frozen", ySplit: 2 }];
  });

  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => { cell.font = { ...(cell.font ?? {}), name: "Calibri", size: cell.font?.size ?? 10 }; });
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
