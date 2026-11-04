// The generic substantive working paper (F062): for an E4 index with no paper of
// its own, the same skeleton every substantive test needs. Population, selection,
// the tests, the exceptions, the conclusion, in Excel and attached to the task.

import ExcelJS from "exceljs";

const FONT = "Arial";
const HEAD = "FFD9D9D9";
const BAND = "FFC0C0C0";
const ENTRY = "FFFFF2CC";

export async function buildSubstantiveWorkbook(input: {
  code: string;
  titleEn: string;
  titleFr: string;
  locale: "en" | "fr";
}): Promise<Buffer> {
  const fr = input.locale === "fr";
  const T = (en: string, frText: string) => (fr ? frText : en);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(input.code.replace(/[.]/g, "-"));
  ws.columns = [{ width: 10 }, { width: 38 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 28 }, { width: 14 }];
  const write = (row: (string | null)[], opts?: { bold?: boolean; fill?: string; entryFrom?: number }) => {
    const added = ws.addRow(row);
    added.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { name: FONT, size: 10, bold: opts?.bold ?? false };
      cell.alignment = { vertical: "top", wrapText: true };
      if (opts?.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
      if (opts?.entryFrom !== undefined && col >= opts.entryFrom) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ENTRY } };
      }
    });
    return added;
  };
  const band = (text: string) => {
    const r = write([text, null, null, null, null, null, null, null], { bold: true, fill: BAND });
    ws.mergeCells(r.number, 1, r.number, 8);
  };
  const field = (label: string) => {
    const r = write([label, null, null, null, null, null, null, null], { entryFrom: 3 });
    ws.mergeCells(r.number, 1, r.number, 2);
    ws.mergeCells(r.number, 3, r.number, 8);
  };
  const title = write([`${input.code} ${fr ? input.titleFr : input.titleEn}`, null, null, null, null, null, null, null], { bold: true });
  title.getCell(1).font = { name: FONT, size: 12, bold: true };
  ws.mergeCells(title.number, 1, title.number, 8);
  field(T("Prepared by / date", "Préparé par / date"));
  field(T("Reviewed by / date", "Revu par / date"));

  band(T("1. Population", "1. Population"));
  field(T("Source of the population", "Source de la population"));
  field(T("Total value and number of items", "Valeur totale et nombre d'éléments"));
  field(T("Agreed to the trial balance / lead schedule", "Rapprochée de la balance / de la feuille maîtresse"));

  band(T("2. Selection", "2. Sélection"));
  field(T("Method (key items, sampling, all items)", "Méthode (éléments clés, échantillon, exhaustif)"));
  field(T("Performance materiality and key-item threshold", "Seuil de travail et seuil des éléments clés"));
  field(T("Sample size and how it was reached", "Taille de l'échantillon et sa détermination"));

  band(T("3. Tests", "3. Tests"));
  write(
    [
      T("Ref.", "Réf."),
      T("Item", "Élément"),
      T("Amount (FCFA)", "Montant (FCFA)"),
      T("Test A", "Test A"),
      T("Test B", "Test B"),
      T("Test C", "Test C"),
      T("Evidence obtained", "Justificatif obtenu"),
      T("Exception?", "Anomalie ?"),
    ],
    { bold: true, fill: HEAD },
  );
  for (let i = 1; i <= 25; i += 1) write([String(i), null, null, null, null, null, null, null], { entryFrom: 2 });
  write([T("Key to tests: state what A, B and C test (assertion and procedure).", "Clé des tests : indiquer ce que testent A, B et C (assertion et procédure)."), null, null, null, null, null, null, null]);
  ws.mergeCells(ws.lastRow!.number, 1, ws.lastRow!.number, 8);

  band(T("4. Exceptions", "4. Anomalies"));
  write([T("Ref.", "Réf."), T("Description", "Description"), T("Amount (FCFA)", "Montant (FCFA)"), T("Factual / judgmental / projected", "Factuelle / de jugement / extrapolée"), T("Carried to the SAD (C1.1)", "Reportée au SAD (C1.1)"), null, null, null], { bold: true, fill: HEAD });
  for (let i = 1; i <= 5; i += 1) write([null, null, null, null, null, null, null, null], { entryFrom: 1 });

  band(T("5. Conclusion", "5. Conclusion"));
  field(T("Conclusion on the assertions tested", "Conclusion sur les assertions testées"));

  return Buffer.from(await wb.xlsx.writeBuffer());
}
