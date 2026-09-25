// The firm's branding shape and the letterhead block stamped on generated
// .docx documents. Pure: no database, no session. lib/docx.ts (and the other
// document builders) take a plain Branding object and render it; loading the
// branding from the tenant row lives in lib/branding.ts, which re-exports
// everything here so callers keep one import.

import { ImageRun, Paragraph, TextRun } from "docx";

export interface Branding {
  /** Firm name shown in the nav and on letterheads. Defaults to tenant.name. */
  displayName: string;
  /** Hex accent (#rrggbb) used as the UI primary; null = platform default. */
  accent: string | null;
  /** Small logo as a data URI (png/jpeg), shown in the nav. */
  logo: string | null;
  /** Letterhead address lines + footer for generated documents. */
  letterhead1: string;
  letterhead2: string;
  footer: string;
  /** Engagement naming convention; {CLIENT}, {YEAR}, {PERIOD_END} and {NATURE} are substituted. */
  engagementNaming: string;
}

/** Pixel size of a PNG or JPEG from its header; null when unreadable. */
function imageDimensions(bytes: Buffer, type: "png" | "jpg"): { width: number; height: number } | null {
  if (type === "png") {
    if (bytes.length < 24) return null;
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  // JPEG: walk the markers to the first start-of-frame segment.
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    const length = bytes.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

/**
 * The firm logo as a docx image run, scaled to the letterhead (48 px high,
 * 200 px wide at most, aspect kept). Null when no logo is set or its bytes
 * cannot be measured — the letterhead then stays text-only rather than
 * failing the whole document.
 */
function logoRun(branding: Branding): ImageRun | null {
  if (!branding.logo) return null;
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(branding.logo);
  if (!m) return null;
  const type = m[1] === "png" ? "png" : "jpg";
  const data = Buffer.from(m[2], "base64");
  const dims = imageDimensions(data, type);
  if (!dims || dims.width <= 0 || dims.height <= 0) return null;
  const scale = Math.min(48 / dims.height, 200 / dims.width, 1);
  return new ImageRun({
    type,
    data,
    transformation: { width: Math.round(dims.width * scale), height: Math.round(dims.height * scale) },
  });
}

/**
 * Paragraphs stamped at the top of letters, reports and legal documents. The
 * logo leads when the firm has uploaded one — the settings page promises it on
 * generated documents, and it used to be text only (UAT B146).
 */
export function letterheadParagraphs(branding: Branding): Paragraph[] {
  const logo = logoRun(branding);
  const lines: Paragraph[] = [
    ...(logo ? [new Paragraph({ children: [logo] })] : []),
    new Paragraph({
      children: [new TextRun({ text: branding.displayName, bold: true, size: 26 })],
    }),
  ];
  for (const line of [branding.letterhead1, branding.letterhead2]) {
    if (line) {
      lines.push(new Paragraph({ children: [new TextRun({ text: line, size: 18 })] }));
    }
  }
  lines.push(new Paragraph({ children: [new TextRun({ text: "", size: 8 })] }));
  return lines;
}

/** Footer paragraph (e.g. professional registration) when configured. */
export function letterheadFooter(branding: Branding): Paragraph[] {
  if (!branding.footer) return [];
  return [
    new Paragraph({
      children: [new TextRun({ text: branding.footer, italics: true, size: 16 })],
    }),
  ];
}
