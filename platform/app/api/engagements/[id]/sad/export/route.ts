import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { amountOr } from "@/lib/amount";
import { getEngagement } from "@/lib/engagements";
import { sadView } from "@/lib/sad";
import { SAD_COLUMN_COUNT, captionColumn, type SadCfRow, type SadDiscRow, type SadEntry } from "@/lib/sad-model";

/**
 * The SAD as the firm's own workbook: one TAB per schedule, each laid out
 * like the template it replicates — the entity/PM/TE band, the six-caption
 * Debit/(Credit) grid with its section bands, totals, financial-statement
 * amounts and effect-% rows, the tax/turnaround cascade, the conclusion
 * analysis and the qualitative factors, then the reclassification, cash-flow
 * and disclosure schedules. Colours match the on-screen replica.
 */

const HDR = "FFD9D9D9";
const BAND = "FFC0C0C0";
const YEL = "FFFFFF99";
const MONEY = '#,##0;(#,##0)';
const PCT = '0.00%';
const MAIN_TYPES = ["factual", "judgmental", "projected"];

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

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const fr = new URL(request.url).searchParams.get("locale") === "fr";
  try {
    const engagement = await getEngagement(id);
    if (!engagement) return NextResponse.json({ error: "not-found" }, { status: 404 });
    const view = await sadView(id);
    const mat = view.materiality;
    const meta = view.meta;

    const wb = new ExcelJS.Workbook();
    wb.creator = "AuditISA";

    const COLS = fr
      ? ["Actif courant", "Actif non courant", "Passif courant", "Passif non courant", "Capitaux propres", "Résultat"]
      : ["Assets Current", "Assets Non-current", "Liabilities Current", "Liabilities Non-current", "Equity components", "Income statement"];

    /** The template's identification band, compact: two rows, no empty spread. */
    const band = (ws: ExcelJS.Worksheet, title: string) => {
      ws.pageSetup = {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      };
      ws.headerFooter = { oddFooter: `&L${view.entityName}&C${title}&R&P / &N` };
      const t = ws.addRow([title]);
      t.font = { bold: true, size: 13 };
      const r1 = ws.addRow([
        fr ? "Entité :" : "Entity:", view.entityName, fr ? "Clôture :" : "Period ended:", view.periodEnd,
        fr ? "Devise :" : "Currency:", "XAF",
      ]);
      const r2 = ws.addRow([
        "PM:", mat?.overall ?? "", "TE:", mat?.performance ?? "",
        fr ? "Nominal :" : "Nominal:", mat?.trivial ?? "",
      ]);
      for (const r of [r1, r2]) {
        [1, 3, 5].forEach((c) => { r.getCell(c).font = { bold: true }; fill(r.getCell(c), HDR); });
        [2, 4, 6].forEach((c) => { const cell = r.getCell(c); box(cell); if (typeof cell.value === "number") cell.numFmt = MONEY; });
        [1, 3, 5].forEach((c) => box(r.getCell(c)));
      }
      ws.addRow([]);
    };

    const gridHead = (ws: ExcelJS.Worksheet, rationale: boolean) => {
      const head = ws.addRow([
        "No.", fr ? "Réf. papier" : "W/P ref.", fr ? "Compte / description" : "Account / description",
        ...COLS, ...(rationale ? [fr ? "Justification" : "Rationale"] : []),
      ]);
      head.eachCell((cell) => { fill(cell, HDR); box(cell); cell.font = { bold: true, size: 9 }; cell.alignment = { wrapText: true, vertical: "middle" }; });
      head.height = 30;
      ws.columns = [
        { width: 5 }, { width: 12 }, { width: 42 },
        ...COLS.map(() => ({ width: 15 })),
        ...(rationale ? [{ width: 34 }] : []),
      ] as ExcelJS.Column[];
    };

    const entryRows = (ws: ExcelJS.Worksheet, list: SadEntry[], rationale: boolean, bands: boolean) => {
      const span = 3 + SAD_COLUMN_COUNT + (rationale ? 1 : 0);
      const groups = bands
        ? [
            { label: fr ? "Anomalies avérées :" : "Factual misstatements:", rows: list.filter((e) => e.mtype === "factual") },
            { label: fr ? "Anomalies de jugement :" : "Judgmental misstatements:", rows: list.filter((e) => e.mtype === "judgmental") },
            { label: fr ? "Anomalies extrapolées :" : "Projected misstatements:", rows: list.filter((e) => e.mtype === "projected") },
          ]
        : [{ label: "", rows: list }];
      for (const g of groups) {
        if (g.label) {
          const b = ws.addRow([g.label]);
          for (let c = 1; c <= span; c += 1) { fill(b.getCell(c), BAND); box(b.getCell(c)); }
          b.getCell(1).font = { bold: true };
        }
        g.rows.forEach((e, i) => {
          const no = i + 1;
          const title = ws.addRow([no, e.taskCode, e.finding || e.taskTitle]);
          for (let c = 1; c <= span; c += 1) { fill(title.getCell(c), YEL); box(title.getCell(c)); }
          title.getCell(1).font = { bold: true };
          title.getCell(3).font = { bold: true };
          if (rationale) title.getCell(span).value = e.rationale;
          for (const side of ["dr", "cr"] as const) {
            const col = captionColumn(side === "dr" ? e.drCaption : e.crCaption);
            const amount = side === "dr" ? e.drAmount : -e.crAmount;
            const values: (string | number | null)[] = [no, e.ref || e.taskCode, side === "dr" ? e.drAccount : e.crAccount];
            for (let c = 0; c < SAD_COLUMN_COUNT; c += 1) values.push(c === col ? amount : null);
            if (rationale) values.push(null);
            const row = ws.addRow(values);
            for (let c = 1; c <= span; c += 1) { fill(row.getCell(c), YEL); box(row.getCell(c)); }
            for (let c = 4; c < 4 + SAD_COLUMN_COUNT; c += 1) row.getCell(c).numFmt = MONEY;
          }
        });
      }
      // totals, FS amounts, effect %
      const totals = new Array<number>(SAD_COLUMN_COUNT).fill(0);
      for (const e of list) {
        totals[captionColumn(e.drCaption)] += e.drAmount;
        totals[captionColumn(e.crCaption)] -= e.crAmount;
      }
      const tot = ws.addRow([fr ? "Total" : "Total", "", "", ...totals]);
      tot.font = { bold: true };
      tot.eachCell((cell, c) => { box(cell); if (c >= 4) cell.numFmt = MONEY; cell.border = { ...cell.border, top: { style: "double" } }; });
      const fsc = view.fsCaptions;
      const fsRow = ws.addRow([fr ? "Montants des états financiers" : "Financial statement amounts", "", "", ...(fsc ?? new Array(SAD_COLUMN_COUNT).fill(null))]);
      fsRow.eachCell((cell, c) => { box(cell); if (c >= 4) cell.numFmt = MONEY; });
      const pctRow = ws.addRow([
        fr ? "Effet des anomalies (% des états financiers)" : "Effect of misstatements as a % of FS amounts", "", "",
        ...totals.map((t, i) => (fsc && fsc[i] ? t / fsc[i] : null)),
      ]);
      pctRow.eachCell((cell, c) => { box(cell); if (c >= 4) cell.numFmt = PCT; });
      return totals;
    };

    // ---------------- 1. Uncorrected ----------------
    const wsU = wb.addWorksheet(fr ? "SAD non corrigées" : "SAD uncorrected");
    band(wsU, fr ? "Récapitulatif des anomalies non corrigées" : "Summary of uncorrected misstatements");
    gridHead(wsU, false);
    const uncorrected = view.entries.filter((e) => !e.corrected && MAIN_TYPES.includes(e.mtype));
    const uTotals = entryRows(wsU, uncorrected, false, true);
    const cumIS = uTotals[5];
    const rate = amountOr(meta.tax_rate ?? "33", 33) / 100;
    const taxEffect = -cumIS * rate;
    const afterTax = cumIS + taxEffect;
    const turnF = amountOr(meta.turnaround_factual ?? "", 0);
    const turnJ = amountOr(meta.turnaround_judgmental ?? "", 0);
    const cumulative = afterTax + (turnF + turnJ) * (1 - rate);
    const iat = amountOr(meta.income_after_tax ?? "", 0) || null;
    wsU.addRow([]);
    for (const [label, value, bold] of [
      [fr ? "Anomalies non corrigées avant impôt" : "Uncorrected misstatements before tax", cumIS, true],
      [`${fr ? "Moins : effet d'impôt" : "Less: tax effect of misstatements"} (${(rate * 100).toFixed(0)}%)`, taxEffect, false],
      [fr ? "Anomalies non corrigées en résultat après impôt" : "Uncorrected misstatements in income after tax", afterTax, true],
      [fr ? "Effet de retournement N-1 — avérées et extrapolées" : "Turnaround effect of prior period — factual and projected", turnF, false],
      [fr ? "Effet de retournement N-1 — de jugement (note 2)" : "Turnaround effect of prior period — judgmental (Note 2)", turnJ, false],
      [fr ? "Effet cumulé des anomalies non corrigées (après impôt)" : "Cumulative effect of uncorrected misstatements (after tax)", cumulative, true],
      [fr ? "Résultat de l'exercice avant impôt" : "Current year income before tax", view.incomeBeforeTax, false],
      [fr ? "Résultat de l'exercice après impôt" : "Current year income after tax", iat, false],
    ] as [string, number | null, boolean][]) {
      const r = wsU.addRow([label, "", "", value]);
      r.getCell(4).numFmt = MONEY;
      if (bold) r.font = { bold: true };
      [1, 4].forEach((c) => box(r.getCell(c)));
    }

    // ---------------- 2. Corrected ----------------
    const wsC = wb.addWorksheet(fr ? "SAD corrigées" : "SAD corrected");
    band(wsC, fr ? "Récapitulatif des anomalies corrigées" : "Summary of corrected misstatements");
    gridHead(wsC, true);
    entryRows(wsC, view.entries.filter((e) => e.corrected && MAIN_TYPES.includes(e.mtype)), true, true);

    // ---------------- 3. Conclusion ----------------
    const wsK = wb.addWorksheet(fr ? "Conclusion SAD" : "SAD conclusion");
    band(wsK, fr ? "Conclusion du récapitulatif des anomalies" : "Summary of audit differences conclusion");
    wsK.columns = [{ width: 58 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }] as ExcelJS.Column[];
    const h1 = wsK.addRow(["", fr ? "Avant impôt" : "Before tax", "", fr ? "Après impôt" : "After tax", ""]);
    const h2 = wsK.addRow([
      "", fr ? "Avant retournement" : "Before turnaround", fr ? "Après retournement" : "After turnaround",
      fr ? "Avant retournement" : "Before turnaround", fr ? "Après retournement" : "After turnaround",
    ]);
    for (const r of [h1, h2]) r.eachCell((cell) => { fill(cell, HDR); box(cell); cell.font = { bold: true, size: 9 }; cell.alignment = { wrapText: true }; });
    const threshold = mat ? mat.performance : null;
    const series = [cumIS, cumIS + turnF + turnJ, afterTax, cumulative];
    const cum = wsK.addRow([fr ? "Effet cumulé sur le résultat des anomalies non corrigées" : "Cumulative income effect of uncorrected misstatements", ...series]);
    cum.eachCell((cell, c) => { box(cell); if (c > 1) cell.numFmt = MONEY; });
    const inc = wsK.addRow([fr ? "Résultat de l'exercice (avant / après impôt)" : "Current year income (before / after tax)", view.incomeBeforeTax, view.incomeBeforeTax, iat, iat]);
    inc.eachCell((cell, c) => { box(cell); if (c > 1) cell.numFmt = MONEY; });
    const pctRow = wsK.addRow([
      fr ? "Anomalies en % du résultat" : "Misstatements as a percentage of income",
      view.incomeBeforeTax ? cumIS / view.incomeBeforeTax : null,
      view.incomeBeforeTax ? (cumIS + turnF + turnJ) / view.incomeBeforeTax : null,
      iat ? afterTax / iat : null,
      iat ? cumulative / iat : null,
    ]);
    pctRow.eachCell((cell, c) => { box(cell); if (c > 1) cell.numFmt = PCT; });
    for (const [label, value] of [
      [fr ? "Seuil de signification (PM)" : "Planning materiality", mat?.overall ?? null],
      [fr ? "Seuil des anomalies non corrigées (TE)" : "Uncorrected Misstatements Threshold (TE)", threshold],
    ] as [string, number | null][]) {
      const r = wsK.addRow([label, value]);
      r.getCell(2).numFmt = MONEY;
      [1, 2].forEach((c) => box(r.getCell(c)));
    }
    const verdict = wsK.addRow([
      fr ? "Les anomalies non corrigées dépassent-elles le seuil ?" : "Do uncorrected misstatements exceed the threshold?",
      ...series.map((v) => (threshold === null ? "—" : Math.abs(v) > threshold ? (fr ? "Oui" : "Yes") : fr ? "Non" : "No")),
    ]);
    verdict.eachCell((cell, c) => {
      box(cell);
      cell.font = { bold: true };
      if (c === 1) { fill(cell, HDR); return; }
      const bad = threshold !== null && Math.abs(series[c - 2]) > threshold;
      fill(cell, bad ? "FFFFC0C0" : "FFC6EFCE");
    });
    wsK.addRow([]);
    const qh = wsK.addRow([fr ? "Facteurs qualitatifs" : "Qualitative factors", fr ? "Oui/Non/N-A" : "Yes/No/N/A", fr ? "Commentaires" : "Comments"]);
    qh.eachCell((cell) => { fill(cell, HDR); box(cell); cell.font = { bold: true } ; });
    const QUAL = fr
      ? ["1. Anomalies sensibles au regard des circonstances de l'entité", "2. Anomalies masquant un changement de tendance", "3. Biais possible de la direction", "4. Anomalies intentionnelles (fraude potentielle)", "5. Effet significatif des anomalies des exercices antérieurs"]
      : ["1. Misstatements sensitive in the entity's circumstances", "2. Misstatements masking a change in earnings or other trends", "3. Possible management bias", "4. Intentional misstatements (possible fraud)", "5. Material effect of prior-period uncorrected misstatements"];
    QUAL.forEach((text, i) => {
      const key = `tq_${i + 1}`;
      const answer = meta[key] === "yes" ? (fr ? "Oui" : "Yes") : meta[key] === "no" ? (fr ? "Non" : "No") : meta[key] === "na" ? "N/A" : "";
      const r = wsK.addRow([text, answer, meta[`${key}c`] ?? ""]);
      r.eachCell((cell, c) => { box(cell); if (c > 1) fill(cell, YEL); cell.alignment = { wrapText: true, vertical: "top" }; });
    });
    wsK.addRow([]);
    const conclRow = wsK.addRow([fr ? "Conclusion de l'équipe" : "Team conclusion", meta.concl_text ?? ""]);
    conclRow.getCell(1).font = { bold: true };
    conclRow.getCell(2).alignment = { wrapText: true };
    wsK.mergeCells(conclRow.number, 2, conclRow.number, 5);

    // ---------------- 4. Reclassifications ----------------
    const wsR = wb.addWorksheet(fr ? "Reclassements" : "Reclassification missts");
    band(wsR, fr ? "Récapitulatif des reclassements" : "Reclassification misstatements summary");
    gridHead(wsR, true);
    entryRows(wsR, view.entries.filter((e) => e.mtype === "classification"), true, false);

    // ---------------- 5. Cash flow ----------------
    const wsF = wb.addWorksheet(fr ? "Flux de trésorerie" : "Cash flow missts");
    band(wsF, fr ? "Anomalies du tableau des flux de trésorerie" : "Cash flow misstatements schedule");
    const cfHead = wsF.addRow([
      "No.", fr ? "Réf." : "W/P ref.", fr ? "Ligne du tableau des flux" : "Statement of cash flows line",
      fr ? "Exploitation" : "Operating", fr ? "Investissement" : "Investing", fr ? "Financement" : "Financing",
      fr ? "Évaluation et conclusion" : "Evaluation and conclusion",
    ]);
    cfHead.eachCell((cell) => { fill(cell, HDR); box(cell); cell.font = { bold: true, size: 9 }; cell.alignment = { wrapText: true }; });
    wsF.columns = [{ width: 5 }, { width: 12 }, { width: 40 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 40 }] as ExcelJS.Column[];
    const cfRows: SadCfRow[] = JSON.parse(meta.cf_rows ?? "[]");
    for (const r of cfRows) {
      const row = wsF.addRow([r.no, r.ref, r.line, amountOr(r.operating, 0), amountOr(r.investing, 0), amountOr(r.financing, 0), r.evaluation]);
      row.eachCell((cell, c) => { fill(cell, YEL); box(cell); if (c >= 4 && c <= 6) cell.numFmt = MONEY; if (c === 7) cell.alignment = { wrapText: true }; });
    }
    const cfTot = wsF.addRow([
      fr ? "Total des anomalies non corrigées des flux" : "Total of uncorrected cash flow misstatements", "", "",
      cfRows.reduce((a, r) => a + amountOr(r.operating, 0), 0),
      cfRows.reduce((a, r) => a + amountOr(r.investing, 0), 0),
      cfRows.reduce((a, r) => a + amountOr(r.financing, 0), 0),
    ]);
    cfTot.font = { bold: true };
    cfTot.eachCell((cell, c) => { box(cell); if (c >= 4) cell.numFmt = MONEY; cell.border = { ...cell.border, top: { style: "double" } }; });

    // ---------------- 6. Disclosures ----------------
    const wsD = wb.addWorksheet(fr ? "Informations annexes" : "Missts in disclosures");
    band(wsD, fr ? "Anomalies dans les informations annexes" : "Schedule of misstatements in disclosures");
    wsD.columns = [{ width: 5 }, { width: 14 }, { width: 46 }, { width: 26 }, { width: 40 }] as ExcelJS.Column[];
    const discRows: SadDiscRow[] = JSON.parse(meta.disc_rows ?? "[]");
    for (const corrected of [false, true]) {
      const b = wsD.addRow([
        corrected
          ? fr ? "Anomalies corrigées dans les annexes" : "Corrected misstatements in disclosures"
          : fr ? "Anomalies non corrigées dans les annexes" : "Uncorrected misstatements in disclosures",
      ]);
      for (let c = 1; c <= 5; c += 1) { fill(b.getCell(c), BAND); box(b.getCell(c)); }
      b.getCell(1).font = { bold: true };
      const head = wsD.addRow([
        "No.", fr ? "Réf. note" : "FN reference", fr ? "Description de l'anomalie" : "Description of misstatement",
        fr ? "Référence normative" : "Authoritative guidance", fr ? "Évaluation et conclusion" : "Evaluation and conclusion",
      ]);
      head.eachCell((cell) => { fill(cell, HDR); box(cell); cell.font = { bold: true, size: 9 }; cell.alignment = { wrapText: true }; });
      for (const r of discRows.filter((x) => Boolean(x.corrected) === corrected)) {
        const row = wsD.addRow([r.no, r.fn, r.description, r.guidance, r.evaluation]);
        row.eachCell((cell) => { fill(cell, YEL); box(cell); cell.alignment = { wrapText: true, vertical: "top" }; });
      }
      wsD.addRow([]);
    }

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const filename = `SAD-${view.entityName.replace(/[^\w-]+/g, "_")}-${view.periodEnd}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[sad/export] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "export-failed" }, { status: 500 });
  }
}
