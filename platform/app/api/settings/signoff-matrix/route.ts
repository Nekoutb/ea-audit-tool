import { NextResponse } from "next/server";
import { getLocale } from "@/lib/locale";
import { buildSignoffMatrix } from "@/lib/signoff-matrix";
import { getPolicy } from "@/lib/signoff-policy";
import { ForbiddenError } from "@/lib/tenant";
import { fileResponseHeaders } from "@/lib/upload-safety";

/**
 * The firm's sign-off role matrix as an Excel workbook (F002): every task of
 * the default index with today's rule and the firm's own columns to fill in.
 * Firm administrators and partners only (getPolicy checks).
 */
export async function GET() {
  try {
    const { policy, rules } = await getPolicy();
    const locale = (await getLocale()) === "en" ? "en" : "fr";
    const content = await buildSignoffMatrix(policy, rules, locale);
    const filename = locale === "fr" ? "AuditISA-matrice-roles-signature.xlsx" : "AuditISA-signoff-roles-matrix.xlsx";
    return new NextResponse(new Uint8Array(content), {
      headers: fileResponseHeaders(filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof Error && /UNAUTHENTICATED/.test(error.message)) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[signoff-matrix] export failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "export-failed" }, { status: 500 });
  }
}
