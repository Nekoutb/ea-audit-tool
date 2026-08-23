import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getEngagement } from "@/lib/engagements";
import { sadView } from "@/lib/sad";
import type { SadEntry, SadCfRow, SadDiscRow } from "@/lib/sad-model";

/**
 * The Summary of Audit Differences as a client-shareable Excel workbook:
 * one tab per SAD section (uncorrected, corrected, reclassifications,
 * cash-flow, disclosures, conclusion), each opening with the client header
 * block and closing with totals, print-ready (landscape, fitted, repeated
 * header rows, page footer) so what leaves the firm needs no reformatting.
 */

const MAIN_TYPES = ["factual", "judgmental", "projected"];
const MONEY = "#,##0;[Red](#,##0)";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const fr = new URL(request.url).searchParams.get("locale") === "fr";
  try {
    const engagement = await getEngagement(id);
    if (!engagement) return NextResponse.json({ error: "not-found" }, { status: 404 });
    const view = await sadView(id);

    const wb = new ExcelJS.Workbook();
    wb.creator = "AuditISA";

    const header = (ws: ExcelJS.Worksheet, title: string, columns: number) => {
      ws.pageSetup = {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: "1:7",
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      };
      ws.headerFooter = { oddFooter: `&L${view.entityName}&C${title}&R&P / &N` };
      const t = ws.addRow([fr ? "État des ajustements d'audit (SAD)" : "Summary of Audit Differences (SAD)"]);
      t.font = { bold: true, size: 14 };
      ws.addRow([fr ? "Section" : "Section", title]).font = { bold: true };
      ws.addRow([fr ? "Client" : "Client", view.entityName]);
      ws.addRow([fr ? "Clôture" : "Period end", view.periodEnd]);
      ws.addRow([
        fr ? "Seuils (FCFA)" : "Thresholds (FCFA)",
        view.materiality
          ? `PM ${view.materiality.overall.toLocaleString("fr-FR")} · TE ${view.materiality.performance.toLocaleString("fr-FR")} · ${fr ? "SAD nominal" : "SAD Nominal"} ${view.materiality.trivial.toLocaleString("fr-FR")}`
          : fr
            ? "Matérialité non approuvée"
            : "Materiality not approved",
      ]);
      ws.addRow([fr ? "Édité le" : "Generated", new Date().toISOString().slice(0, 10)]);
      ws.addRow([]);
      for (let r = 1; r <= 6; r += 1) {
        ws.getCell(r, 1).font = { ...(ws.getCell(r, 1).font ?? {}), bold: true };
      }
      ws.mergeCells(1, 1, 1, Math.max(2, columns));
    };

    const styleHead = (row: ExcelJS.Row) => {
      row.font = { bold: true, color: { argb: "FFFFFFFF" } };
      row.alignment = { vertical: "middle", wrapText: true };
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E45" } };
        cell.border = { bottom: { style: "thin" } };
      });
    };

    const entryTab = (name: string, rows: SadEntry[], withRationale: boolean) => {
      const ws = wb.addWorksheet(name.replace(/[\\/*?:[\]]/g, " ").slice(0, 31));
      const cols = withRationale ? 9 : 8;
      header(ws, name, cols);
      const head = ws.addRow(
        fr
          ? ["Réf", "Tâche", "Constat", "Compte débit", "Débit", "Compte crédit", "Crédit", "Type", ...(withRationale ? ["Justification"] : [])]
          : ["Ref", "Task", "Finding", "Dr account", "Dr amount", "Cr account", "Cr amount", "Type", ...(withRationale ? ["Rationale"] : [])],
      );
      styleHead(head);
      ws.columns = [
        { width: 8 }, { width: 10 }, { width: 52 }, { width: 16 }, { width: 15 },
        { width: 16 }, { width: 15 }, { width: 14 }, ...(withRationale ? [{ width: 40 }] : []),
      ] as ExcelJS.Column[];
      for (const e of rows) {
        const r = ws.addRow([
          e.ref, e.taskCode, e.finding, e.drAccount, e.drAmount, e.crAccount, e.crAmount, e.mtype,
          ...(withRationale ? [e.rationale] : []),
        ]);
        r.getCell(5).numFmt = MONEY;
        r.getCell(7).numFmt = MONEY;
        r.getCell(3).alignment = { wrapText: true };
        if (withRationale) r.getCell(9).alignment = { wrapText: true };
      }
      const total = ws.addRow([
        fr ? "Total" : "Total", "", "", "",
        rows.reduce((a, e) => a + e.drAmount, 0), "",
        rows.reduce((a, e) => a + e.crAmount, 0), "",
      ]);
      total.font = { bold: true };
      total.getCell(5).numFmt = MONEY;
      total.getCell(7).numFmt = MONEY;
      total.eachCell((cell) => { cell.border = { top: { style: "double" } }; });
      return ws;
    };

    const entries = view.entries;
    entryTab(fr ? "Non corrigées" : "Uncorrected", entries.filter((e) => !e.corrected && MAIN_TYPES.includes(e.mtype)), false);
    entryTab(fr ? "Corrigées" : "Corrected", entries.filter((e) => e.corrected && MAIN_TYPES.includes(e.mtype)), true);
    entryTab(fr ? "Reclassements" : "Reclassifications", entries.filter((e) => e.mtype === "classification"), true);

    // Cash-flow misstatements (manual rows from meta)
    const cfRows: SadCfRow[] = JSON.parse(view.meta.cf_rows ?? "[]");
    const cf = wb.addWorksheet(fr ? "Flux de trésorerie" : "Cash flow");
    header(cf, fr ? "Anomalies du tableau des flux" : "Cash-flow misstatements", 7);
    styleHead(cf.addRow(fr
      ? ["N°", "Réf", "Ligne du tableau", "Exploitation", "Investissement", "Financement", "Évaluation"]
      : ["No", "Ref", "Statement line", "Operating", "Investing", "Financing", "Evaluation"]));
    cf.columns = [{ width: 6 }, { width: 10 }, { width: 40 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 40 }] as ExcelJS.Column[];
    for (const r of cfRows) {
      const row = cf.addRow([r.no, r.ref, r.line, Number(r.operating) || r.operating, Number(r.investing) || r.investing, Number(r.financing) || r.financing, r.evaluation]);
      [4, 5, 6].forEach((c) => { row.getCell(c).numFmt = MONEY; });
      row.getCell(7).alignment = { wrapText: true };
    }

    // Disclosure misstatements
    const discRows: SadDiscRow[] = JSON.parse(view.meta.disc_rows ?? "[]");
    const disc = wb.addWorksheet(fr ? "Informations annexes" : "Disclosures");
    header(disc, fr ? "Anomalies d'information (annexes)" : "Disclosure misstatements", 6);
    styleHead(disc.addRow(fr
      ? ["N°", "Note", "Description", "Référence normative", "Évaluation", "Corrigée"]
      : ["No", "Note", "Description", "Guidance", "Evaluation", "Corrected"]));
    disc.columns = [{ width: 6 }, { width: 10 }, { width: 48 }, { width: 24 }, { width: 40 }, { width: 10 }] as ExcelJS.Column[];
    for (const r of discRows) {
      const row = disc.addRow([r.no, r.fn, r.description, r.guidance, r.evaluation, r.corrected ? (fr ? "Oui" : "Yes") : fr ? "Non" : "No"]);
      row.getCell(3).alignment = { wrapText: true };
      row.getCell(5).alignment = { wrapText: true };
    }

    // Conclusion
    const concl = wb.addWorksheet(fr ? "Conclusion" : "Conclusion");
    header(concl, fr ? "Conclusion (ISA 450)" : "Conclusion (ISA 450)", 3);
    concl.columns = [{ width: 46 }, { width: 20 }, { width: 46 }] as ExcelJS.Column[];
    const uncorrected = entries.filter((e) => !e.corrected);
    const totalUncorrected = uncorrected.reduce((a, e) => a + Math.max(Math.abs(e.drAmount), Math.abs(e.crAmount)), 0);
    const lines: [string, number | string][] = [
      [fr ? "Total des anomalies non corrigées" : "Total uncorrected misstatements", totalUncorrected],
      [fr ? "Matérialité de planification (PM)" : "Planning materiality (PM)", view.materiality?.overall ?? (fr ? "non approuvée" : "not approved")],
      [fr ? "Seuil de travail (TE)" : "Tolerable error (TE)", view.materiality?.performance ?? "—"],
      [fr ? "SAD nominal" : "SAD Nominal", view.materiality?.trivial ?? "—"],
      [fr ? "Résultat avant impôt (balance)" : "Pre-Tax income (per TB)", view.incomeBeforeTax ?? "—"],
    ];
    for (const [k, v] of lines) {
      const r = concl.addRow([k, v]);
      r.getCell(1).font = { bold: true };
      if (typeof v === "number") r.getCell(2).numFmt = MONEY;
    }
    concl.addRow([]);
    const conclText = concl.addRow([fr ? "Conclusion de l'équipe" : "Team conclusion", view.meta.concl_text ?? ""]);
    conclText.getCell(1).font = { bold: true };
    conclText.getCell(2).alignment = { wrapText: true };
    concl.mergeCells(conclText.number, 2, conclText.number, 3);

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const filename = `SAD-${view.entityName.replace(/[^\w-]+/g, "_")}-${view.periodEnd}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
