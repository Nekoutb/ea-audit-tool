// The tests-of-details sampling workbook: one tab per lead-schedule index of
// the chosen side of the financial statements, each holding the account's
// parameters (CRA from S3.1, key-item threshold, TE, assurance), its key
// items and its representative sample, with the columns the tester fills as
// they go. Pure over TodSideView; lib/tod-export.ts assembles the view.
import ExcelJS from "exceljs";
import type { TodAssurance, TodCra, TodPlan } from "@/lib/tod-plan";

export type FsSide = "bs" | "is";

export interface TodIndexSheet {
  indexCode: string;
  labelEn: string;
  labelFr: string;
  /** the E4 task that owns this index */
  taskCode: string | null;
  cra: TodCra;
  /** whether the CRA came from S3.1 or is the default for an account S3.1 does not assess */
  craFromS31: boolean;
  /** whether the threshold was set on S3.1 or defaulted to TE */
  thresholdFromS31: boolean;
  assurance: TodAssurance;
  plan: TodPlan;
}

export interface TodSideView {
  locale: "en" | "fr";
  side: FsSide;
  clientName: string;
  fiscalYear: number;
  periodEnd: string;
  currency: string;
  preparer: string | null;
  te: number;
  ledgerFilename: string | null;
  sheets: TodIndexSheet[];
  /** indexes of the side that have no ledger line, named so their absence is visible */
  emptyIndexes: { indexCode: string; labelEn: string; labelFr: string }[];
}

const HDR = "FFD9D9D9";
const BAND = "FFC0C0C0";
const ENTRY = "FFFFF2CC";
const KEY = "FFFFEB9C";
const SAMPLE = "FFDDEBF7";

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
const NUM = "#,##0;(#,##0)";

const CRA_LABEL: Record<TodCra, { en: string; fr: string }> = {
  minimal: { en: "Minimal", fr: "Minimal" },
  low: { en: "Low", fr: "Faible" },
  low_sr: { en: "Low + significant risk", fr: "Faible + risque important" },
  moderate: { en: "Moderate", fr: "Modéré" },
  high: { en: "High", fr: "Élevé" },
  high_sr: { en: "High + significant risk", fr: "Élevé + risque important" },
};
const ASSURANCE_LABEL: Record<TodAssurance, { en: string; fr: string }> = {
  little: { en: "Little", fr: "Faible" },
  some: { en: "Some", fr: "Partielle" },
  corroborative: { en: "Corroborative", fr: "Corroborante" },
  persuasive: { en: "Persuasive", fr: "Persuasive" },
};

/** Excel forbids these in a tab name, and caps it at 31 characters. */
export function tabName(indexCode: string, label: string): string {
  const clean = `${indexCode} ${label}`.replace(/[\[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > 31 ? clean.slice(0, 31).trim() : clean;
}

export async function buildTodWorkbook(view: TodSideView): Promise<Buffer> {
  const fr = view.locale === "fr";
  const T = (en: string, frText: string): string => (fr ? frText : en);
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditISA";
  wb.created = new Date();

  const sideLabel = view.side === "bs" ? T("Balance sheet", "Bilan") : T("Income statement", "Compte de résultat");
  const PAPER = T("Tests of details — sampling", "Tests de détail — échantillonnage");

  const page = (ws: ExcelJS.Worksheet, footer: string) => {
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
    ws.headerFooter = { oddFooter: `&L${footer}&R&P / &N` };
  };
  const band = (ws: ExcelJS.Worksheet, label: string, span: number) => {
    const row = ws.addRow([label]);
    ws.mergeCells(row.number, 1, row.number, span);
    for (let c = 1; c <= span; c += 1) { fill(row.getCell(c), BAND); box(row.getCell(c)); }
    row.getCell(1).font = { bold: true };
    return row;
  };
  const header = (ws: ExcelJS.Worksheet, labels: string[]) => {
    const row = ws.addRow(labels);
    row.eachCell((cell) => { fill(cell, HDR); box(cell); cell.font = { bold: true }; cell.alignment = { wrapText: true, vertical: "top" }; });
    return row;
  };
  const kv = (ws: ExcelJS.Worksheet, pairs: [string, string | number, string?][]) => {
    for (const [k, v, note] of pairs) {
      const row = ws.addRow([k, v, note ?? ""]);
      row.getCell(1).font = { bold: true };
      if (typeof v === "number") row.getCell(2).numFmt = NUM;
      box(row.getCell(1)); box(row.getCell(2));
      if (note) row.getCell(3).font = { italic: true, color: { argb: "FF666666" } };
    }
  };

  /* ------------------------------ Cover ------------------------------ */
  const cover = wb.addWorksheet("Cover");
  page(cover, `${PAPER} · ${view.clientName} · ${view.fiscalYear}`);
  cover.columns = [{ width: 34 }, { width: 22 }, { width: 44 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  const title = cover.addRow([`${PAPER} — ${sideLabel}`]);
  title.font = { bold: true, size: 14 };
  cover.addRow([]);
  kv(cover, [
    [T("Client / company", "Client / société"), view.clientName],
    [T("Fiscal year", "Exercice"), String(view.fiscalYear)],
    [T("Period end", "Clôture"), view.periodEnd],
    [T("Currency", "Devise"), view.currency],
    [T("Ledger tested", "Grand livre testé"), view.ledgerFilename ?? T("— none registered —", "— aucun enregistré —")],
    [T("Tolerable error (TE)", "Erreur tolérable (TE)"), view.te],
    [T("Prepared by", "Préparé par"), view.preparer ?? ""],
    [T("Date prepared", "Date de préparation"), ""],
    [T("Reviewed by", "Revu par"), ""],
    [T("Date reviewed", "Date de revue"), ""],
  ]);
  for (const r of [10, 11, 12] as const) fill(cover.getRow(r + 1).getCell(2), ENTRY);
  cover.addRow([]);
  band(cover, T("How each tab was built", "Comment chaque onglet a été construit"), 9);
  for (const line of [
    T("Key items: every line of the account at or above the key-item threshold set on S3.1 (TE when none is set). Examined in full, never sampled.", "Éléments clés : chaque ligne du compte au moins égale au seuil fixé sur S3.1 (TE à défaut). Examinés intégralement, jamais échantillonnés."),
    T("Representative sample: base = (population − key items) ÷ TE, × the audit-risk-table factor for the account's CRA (S3.1), the assurance from other substantive procedures and the key-item coverage; drawn by systematic MUS with a random start.", "Échantillon représentatif : base = (population − éléments clés) ÷ TE, × le facteur de la table de risque d'audit pour la CRA du compte (S3.1), l'assurance des autres procédures substantives et la couverture des éléments clés ; tiré en MUS systématique avec départ aléatoire."),
    T("A factor of '—' means the combination requires no representative sample: the key items and the other procedures carry the assertion.", "Un facteur « — » signifie que la combinaison ne requiert aucun échantillon représentatif : les éléments clés et les autres procédures portent l'assertion."),
    T("Columns in yellow are for the tester: what was inspected, the evidence, the result and any exception, carried to the account's E4 paper.", "Les colonnes en jaune sont pour le testeur : ce qui a été inspecté, la preuve, le résultat et toute exception, reportés sur le papier E4 du compte."),
  ]) {
    const row = cover.addRow([line]);
    cover.mergeCells(row.number, 1, row.number, 9);
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
    row.height = 30;
  }
  cover.addRow([]);
  band(cover, T("Accounts on this side", "Comptes de ce côté"), 9);
  header(cover, [T("Index", "Indice"), T("Account", "Compte"), T("Tab", "Onglet"), "CRA", T("Threshold", "Seuil"), T("Population", "Population"), T("Key items", "Éléments clés"), T("Sample", "Échantillon"), T("Factor", "Facteur")]);
  for (const s of view.sheets) {
    const row = cover.addRow([
      s.indexCode, fr ? s.labelFr : s.labelEn, tabName(s.indexCode, fr ? s.labelFr : s.labelEn),
      fr ? CRA_LABEL[s.cra].fr : CRA_LABEL[s.cra].en, s.plan.threshold, s.plan.populationValue,
      s.plan.keyItems.length, s.plan.sampleSize, s.plan.factor ?? "—",
    ]);
    row.eachCell((cell) => box(cell));
    for (const c of [5, 6]) row.getCell(c).numFmt = NUM;
  }
  for (const e of view.emptyIndexes) {
    const row = cover.addRow([e.indexCode, fr ? e.labelFr : e.labelEn, T("— no ledger line —", "— aucune ligne au grand livre —"), "", "", 0, 0, 0, ""]);
    row.eachCell((cell) => { box(cell); cell.font = { italic: true, color: { argb: "FF666666" } }; });
  }

  /* --------------------------- one tab per index --------------------------- */
  for (const s of view.sheets) {
    const label = fr ? s.labelFr : s.labelEn;
    const ws = wb.addWorksheet(tabName(s.indexCode, label));
    page(ws, `${s.indexCode} ${label} · ${view.clientName} · ${view.fiscalYear}`);
    ws.columns = [{ width: 6 }, { width: 12 }, { width: 22 }, { width: 14 }, { width: 40 }, { width: 12 }, { width: 16 }, { width: 24 }, { width: 24 }, { width: 14 }, { width: 30 }, { width: 18 }];
    const t = ws.addRow([`${s.indexCode} — ${label}${s.taskCode ? ` (${s.taskCode})` : ""}`]);
    t.font = { bold: true, size: 13 };
    ws.addRow([]);

    band(ws, T("Parameters", "Paramètres"), 11);
    const p = s.plan;
    kv(ws, [
      ["CRA (S3.1)", fr ? CRA_LABEL[s.cra].fr : CRA_LABEL[s.cra].en, s.craFromS31 ? T("from the combined risk assessment", "issue de l'évaluation combinée des risques") : T("default — S3.1 does not assess this account; record the assessment there", "par défaut — S3.1 n'évalue pas ce compte ; consigner l'évaluation")],
      [T("Assurance from other substantive procedures", "Assurance des autres procédures substantives"), fr ? ASSURANCE_LABEL[s.assurance].fr : ASSURANCE_LABEL[s.assurance].en],
      [T("Tolerable error (TE)", "Erreur tolérable (TE)"), p.te],
      [T("Key-item threshold", "Seuil des éléments clés"), p.threshold, s.thresholdFromS31 ? T("set on S3.1", "fixé sur S3.1") : T("= TE (no threshold set on S3.1)", "= TE (aucun seuil fixé sur S3.1)")],
      [T("Population (lines · value)", "Population (lignes · valeur)"), p.populationValue, `${p.populationCount} ${T("lines", "lignes")}`],
      [T("Key items (count · value · coverage)", "Éléments clés (nombre · valeur · couverture)"), p.keyItemValue, `${p.keyItems.length} ${T("items", "éléments")} · ${p.coveragePct}% ${T("of the population", "de la population")}`],
      [T("Remaining population", "Population restante"), p.remainingValue, `${p.remainingCount} ${T("lines", "lignes")}`],
      [T("Base sample = remaining ÷ TE", "Base = restant ÷ TE"), p.baseSize],
      [T("Audit-risk-table factor", "Facteur de la table de risque"), p.factor ?? "—", `${T("coverage column", "colonne de couverture")} ${p.coverageColumn}%`],
      [T("Representative sample size", "Taille de l'échantillon représentatif"), p.sampleSize, p.factor === null ? T("no representative sample required at this combination", "aucun échantillon représentatif requis à cette combinaison") : p.fullPopulation ? `${T("computed", "calculée")} ${p.computedSize} — ${T("capped at the remaining population; every remaining line is examined", "plafonnée à la population restante ; chaque ligne restante est examinée")}` : ""],
      [T("Distinct items drawn", "Éléments distincts tirés"), p.itemsDrawn, p.itemsDrawn < p.sampleSize ? T("several hooks fell inside one large line; each line is listed once", "plusieurs points de sélection sont tombés dans une même ligne ; chaque ligne n'est listée qu'une fois") : ""],
      [T("Sampling interval", "Intervalle d'échantillonnage"), p.interval ?? "—"],
    ]);
    ws.addRow([]);

    // Column L records the misstatement found on each line (recorded − audited,
    // signed) so the projection block below can total and extrapolate it
    // (UAT B78) — the tester writes a figure, not a comment, for anything that
    // has to reach C1.1.
    const cols = [
      "#", T("Kind", "Type"), T("Entry", "Écriture"), T("Account", "Compte"), T("Description", "Libellé"), T("Date", "Date"), T("Amount", "Montant"),
      T("What was inspected", "Élément inspecté"), T("Evidence", "Preuve"), T("Result", "Résultat"), T("Exception / comment", "Exception / commentaire"),
      T("Misstatement (recorded − audited)", "Anomalie (comptabilisé − audité)"),
    ];
    const MIS = 12;
    const items = (kind: "key" | "sample", lines: TodPlan["keyItems"], titleEn: string, titleFr: string, tone: string): { first: number; last: number } => {
      band(ws, `${T(titleEn, titleFr)} — ${lines.length}`, MIS);
      header(ws, cols);
      let first = ws.rowCount + 1;
      let last = ws.rowCount;
      if (lines.length === 0) {
        const row = ws.addRow(["", "", T("— none —", "— aucun —")]);
        row.getCell(3).font = { italic: true, color: { argb: "FF666666" } };
        first = row.number;
        last = row.number;
      }
      lines.forEach((l, i) => {
        const row = ws.addRow([i + 1, kind === "key" ? T("Key item", "Élément clé") : T("Sample", "Échantillon"), l.ref, l.account, l.description ?? "", l.date ?? "", l.amount, "", "", "", "", null]);
        row.eachCell({ includeEmpty: true }, (cell, c) => { box(cell); if (c >= 8) fill(cell, ENTRY); });
        fill(row.getCell(2), tone);
        row.getCell(7).numFmt = NUM;
        row.getCell(MIS).numFmt = NUM;
        last = row.number;
      });
      const total = ws.addRow(["", T("Total", "Total"), "", "", "", "", lines.reduce((sum, l) => sum + l.amount, 0)]);
      total.getCell(2).font = { bold: true }; total.getCell(7).font = { bold: true }; total.getCell(7).numFmt = NUM;
      total.getCell(MIS).value = { formula: `SUM(L${first}:L${last})` };
      total.getCell(MIS).font = { bold: true }; total.getCell(MIS).numFmt = NUM;
      ws.addRow([]);
      return { first, last };
    };
    const keyRows = items("key", p.keyItems, "Key items — examined in full", "Éléments clés — examinés intégralement", KEY);
    const sampleRows = items("sample", p.sample, "Representative sample — systematic MUS", "Échantillon représentatif — MUS systématique", SAMPLE);

    // The projection (ISA 530 ¶14–15): misstatement in the sample, extrapolated
    // over the remaining population by the ratio of the sample's value; key
    // items are examined in full so their misstatement is factual, not
    // projected. Live formulas, so the tester's figures flow through.
    band(ws, T("Evaluation — projection to the population", "Évaluation — extrapolation à la population"), MIS);
    const proj = (label: string, formula: string, note?: string) => {
      const row = ws.addRow([label, "", "", "", "", "", { formula }, note ?? ""]);
      row.getCell(1).font = { bold: true };
      row.getCell(7).numFmt = NUM;
      box(row.getCell(1)); box(row.getCell(7));
      if (note) row.getCell(8).font = { italic: true, color: { argb: "FF666666" } };
      return row.number;
    };
    const rKey = proj(T("Factual misstatement in key items", "Anomalie avérée sur les éléments clés"), `SUM(L${keyRows.first}:L${keyRows.last})`);
    const rSample = proj(T("Misstatement found in the sample", "Anomalie relevée dans l'échantillon"), `SUM(L${sampleRows.first}:L${sampleRows.last})`);
    const rSampleValue = proj(T("Value of the sample examined", "Valeur de l'échantillon examiné"), `SUM(G${sampleRows.first}:G${sampleRows.last})`);
    const rRemaining = proj(T("Remaining population (after key items)", "Population restante (hors éléments clés)"), `${p.remainingValue}`);
    const rProjected = proj(
      T("Projected misstatement = sample misstatement ÷ sample value × remaining population", "Anomalie extrapolée = anomalie de l'échantillon ÷ valeur de l'échantillon × population restante"),
      `IF(G${rSampleValue}=0,0,G${rSample}/G${rSampleValue}*G${rRemaining})`,
    );
    const rTotal = proj(T("Total likely misstatement (factual + projected)", "Anomalie probable totale (avérée + extrapolée)"), `G${rKey}+G${rProjected}`);
    const rTe = proj(T("Tolerable error (TE)", "Erreur tolérable (TE)"), `${p.te}`);
    const verdict = ws.addRow([
      T("Conclusion", "Conclusion"), "", "", "", "", "",
      { formula: `IF(ABS(G${rTotal})>G${rTe},"${T("EXCEEDS TE — record on C1.1 and extend the work", "DÉPASSE TE — porter sur C1.1 et étendre les travaux")}","${T("Within TE — record the projected amount on the Sampling tool (Results) so it reaches C1.1", "Sous TE — consigner le montant extrapolé dans l'outil Échantillonnage (Résultats) pour qu'il atteigne C1.1")}")` },
    ]);
    verdict.getCell(1).font = { bold: true }; verdict.getCell(7).font = { bold: true };
    box(verdict.getCell(1)); box(verdict.getCell(7));
    ws.addRow([]);
    ws.views = [{ state: "frozen", ySplit: 2 }];
  }

  // Calibri 10 throughout, as the firm's papers are set
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        cell.font = { ...(cell.font ?? {}), name: "Calibri", size: cell.font?.size ?? 10 };
      });
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
