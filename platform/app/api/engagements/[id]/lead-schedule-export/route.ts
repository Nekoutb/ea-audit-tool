import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { apComments, apLeadSchedules } from "@/lib/analytical-procedures";
import { getEngagement } from "@/lib/engagements";

/**
 * The lead schedules as one Excel workbook: an Introduction tab, then one tab
 * per index ("T Share Capital & Reserves" …) carrying exactly the on-screen
 * detail — accounts, class/type, Current Y, Prior Y, movement, variance and
 * the saved commentary, with the TOTAL row.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const engagement = await getEngagement(id);
    if (!engagement) return NextResponse.json({ error: "not-found" }, { status: 404 });
    const [schedules, comments] = await Promise.all([apLeadSchedules(id), apComments(id)]);
    if (schedules.length === 0) return NextResponse.json({ error: "no-tb" }, { status: 400 });

    const wb = new ExcelJS.Workbook();

    const intro = wb.addWorksheet("Introduction");
    intro.columns = [{ width: 28 }, { width: 60 }];
    intro.addRow(["Lead Schedules"]).font = { bold: true, size: 14 };
    intro.addRow([]);
    intro.addRow(["Engagement", engagement.name ?? engagement.clientName]);
    intro.addRow(["Client", engagement.clientName]);
    intro.addRow(["Period end", engagement.periodEnd]);
    intro.addRow(["Generated", new Date().toISOString().slice(0, 16).replace("T", " ")]);
    intro.addRow([]);
    intro.addRow(["Contents", "One tab per lead-schedule index; balances from the pre-audit trial balance; Prior Y is the trial balance's opening balance."]);
    intro.addRow([]);
    for (const schedule of schedules) {
      intro.addRow([schedule.def.code, `${schedule.def.labelEn} — ${schedule.def.accountType} · ${schedule.def.accountClass}`]);
    }

    const HEAD = ["Account", "Description", "Account class", "Account type", "Current Y", "Prior Y", "Movement", "Variance %", "Commentary"];
    for (const schedule of schedules) {
      const name = `${schedule.def.code} ${schedule.def.labelEn}`.replace(/[\\/*?:[\]]/g, " ").slice(0, 31);
      const ws = wb.addWorksheet(name);
      ws.columns = [
        { width: 12 }, { width: 34 }, { width: 22 }, { width: 14 },
        { width: 16 }, { width: 16 }, { width: 16 }, { width: 11 }, { width: 44 },
      ];
      const title = ws.addRow([`${schedule.def.code} — ${schedule.def.labelEn}`, "", `${schedule.def.accountType} · ${schedule.def.accountClass}`]);
      title.font = { bold: true, size: 12 };
      ws.addRow([]);
      const head = ws.addRow(HEAD);
      head.font = { bold: true };
      head.eachCell((cell) => {
        cell.border = { bottom: { style: "thin" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
      });
      for (const row of schedule.accounts) {
        ws.addRow([
          row.account,
          row.name,
          schedule.def.accountClass,
          schedule.def.accountType,
          row.closing,
          row.prior,
          row.movement,
          row.variancePct !== null ? row.variancePct / 100 : null,
          comments[`${schedule.def.code}|${row.account}`] ?? "",
        ]);
      }
      const total = ws.addRow([
        "TOTAL",
        `${schedule.def.code} — ${schedule.def.labelEn}`,
        "",
        "",
        schedule.closing,
        schedule.prior,
        schedule.movement,
        schedule.variancePct !== null ? schedule.variancePct / 100 : null,
        comments[`${schedule.def.code}|total`] ?? "",
      ]);
      total.font = { bold: true };
      total.eachCell((cell) => {
        cell.border = { top: { style: "double" } };
      });
      for (const col of [5, 6, 7]) ws.getColumn(col).numFmt = "#,##0";
      ws.getColumn(8).numFmt = "0.0%";
    }

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `lead-schedules-${(engagement.name ?? engagement.clientName).replace(/[^\w-]+/g, "_").slice(0, 60)}.xlsx`;
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}
