import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  UnsafeFileError,
  allowedExtensions,
  checkUpload,
  extensionOf,
  fileResponseHeaders,
  safeFilename,
} from "@/lib/upload-safety";

const zip = (extra = "") => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(extra)]);
// A hand-made fixture with the marker at the FRONT passed while every real
// workbook failed, because Excel writes [Content_Types].xml into the central
// directory at the end. Keep both: the synthetic one, and the real files.
const ooxml = () => zip("....[Content_Types].xml....");
const realWorkbook = (name: string) => readFileSync(join(process.cwd(), "wp-templates", name));
const pdf = () => Buffer.from("%PDF-1.7\nstuff");
const png = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const csv = () => Buffer.from("Compte;Libelle;Montant\n411;Client;1 500 000,75\n");

function refusal(fn: () => unknown): string {
  try {
    fn();
    return "(accepted)";
  } catch (e) {
    return e instanceof UnsafeFileError ? e.code : `(threw ${String(e)})`;
  }
}

describe("checkUpload — what a working paper may carry", () => {
  it("accepts the formats an audit file actually needs", () => {
    expect(checkUpload("lead.xlsx", ooxml()).mime).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(checkUpload("memo.docx", ooxml()).mime).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(checkUpload("confirmation.pdf", pdf()).mime).toBe("application/pdf");
    expect(checkUpload("scan.png", png()).mime).toBe("image/png");
    expect(checkUpload("ledger.csv", csv()).mime).toBe("text/csv");
  });

  it("names the extension it kept", () => {
    expect(checkUpload("Trade Receivables.xlsx", ooxml()).ext).toBe("xlsx");
  });
});

describe("checkUpload — malware relay is the exposure", () => {
  it("refuses executables and scripts by name", () => {
    for (const name of ["payload.exe", "run.bat", "a.ps1", "x.vbs", "setup.msi", "link.lnk", "page.hta"]) {
      expect(refusal(() => checkUpload(name, pdf()))).toBe("executable-refused");
    }
  });

  it("refuses macro-enabled Office formats — a working paper needs no code", () => {
    for (const name of ["book.xlsm", "doc.docm", "deck.pptm"]) {
      expect(refusal(() => checkUpload(name, ooxml()))).toBe("executable-refused");
    }
  });

  it("refuses SVG and HTML, which are script carriers", () => {
    expect(refusal(() => checkUpload("logo.svg", Buffer.from("<svg onload=alert(1)>")))).toBe("executable-refused");
    expect(refusal(() => checkUpload("evil.html", Buffer.from("<script>x</script>")))).toBe("executable-refused");
  });

  it("refuses anything not on the allowlist", () => {
    expect(refusal(() => checkUpload("archive.7z", pdf()))).toBe("extension-not-allowed");
    expect(refusal(() => checkUpload("db.sqlite", pdf()))).toBe("extension-not-allowed");
  });

  it("refuses a file with no extension at all", () => {
    expect(refusal(() => checkUpload("README", pdf()))).toBe("no-extension");
  });
});

describe("checkUpload — the extension must match the bytes", () => {
  it("refuses an executable renamed to a permitted extension", () => {
    // MZ header — a Windows binary wearing a .pdf name.
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]);
    expect(refusal(() => checkUpload("invoice.pdf", exe))).toBe("content-mismatch");
    expect(refusal(() => checkUpload("sheet.xlsx", exe))).toBe("content-mismatch");
    expect(refusal(() => checkUpload("photo.png", exe))).toBe("content-mismatch");
  });

  it("refuses a plain zip wearing an Office extension", () => {
    expect(refusal(() => checkUpload("book.xlsx", zip("just-some-files")))).toBe("not-an-office-file");
  });

  it("refuses binary content claiming to be a CSV", () => {
    expect(refusal(() => checkUpload("ledger.csv", Buffer.from([0x00, 0x01, 0x02, 0x00])))).toBe("content-mismatch");
  });

  it("refuses an empty file", () => {
    expect(refusal(() => checkUpload("empty.pdf", Buffer.alloc(0)))).toBe("empty-file");
  });

  it("accepts a latin-1 CSV, which a real ledger export may well be", () => {
    const latin1 = Buffer.from("Compte;Libell\xe9;Montant\n411;Client;100\n", "latin1");
    expect(checkUpload("export.csv", latin1).ext).toBe("csv");
  });

  it("finds the OOXML marker even when it is not at a fixed offset", () => {
    const padded = Buffer.concat([zip(), Buffer.alloc(600, 0x41), Buffer.from("[Content_Types].xml")]);
    expect(checkUpload("odd.xlsx", padded).ext).toBe("xlsx");
  });
});

describe("safeFilename", () => {
  it("keeps only the basename", () => {
    expect(safeFilename("C:\\Users\\x\\lead.xlsx")).toBe("lead.xlsx");
    expect(safeFilename("../../etc/passwd.txt")).toBe("passwd.txt");
  });

  it("strips the right-to-left override used to disguise an extension", () => {
    // "invoice\u202Excod.exe" renders as "invoice.docx" in a file listing.
    const disguised = "invoice\u202Excod.exe";
    expect(safeFilename(disguised)).toBe("invoicexcod.exe");
  });

  it("strips control characters and leading dots", () => {
    expect(safeFilename("...hidden.pdf")).toBe("hidden.pdf");
    expect(safeFilename("bad\u0000name.pdf")).toBe("badname.pdf");
  });

  it("never returns empty", () => {
    expect(safeFilename("")).toBe("attachment");
    expect(safeFilename("...")).toBe("attachment");
  });
});

describe("fileResponseHeaders", () => {
  it("forces a download rather than rendering in the tab", () => {
    const h = fileResponseHeaders("lead.xlsx", "application/pdf");
    expect(h["Content-Disposition"]).toMatch(/^attachment;/);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Cache-Control"]).toBe("private, no-store");
  });

  it("sends a non-ASCII name both ways so it survives", () => {
    const h = fileResponseHeaders("Créances clients.xlsx", "text/csv");
    expect(h["Content-Disposition"]).toContain('filename="Cr_ances clients.xlsx"');
    expect(h["Content-Disposition"]).toContain("filename*=UTF-8''");
  });

  it("cannot be broken out of with a quote in the filename", () => {
    const h = fileResponseHeaders('a".pdf', "application/pdf");
    expect(h["Content-Disposition"]).not.toMatch(/filename="a";/);
  });

  it("does not set Content-Length — the runtime derives it", () => {
    expect(fileResponseHeaders("a.pdf", "application/pdf")["Content-Length"]).toBeUndefined();
  });
});

describe("extensionOf / allowedExtensions", () => {
  it("reads the last extension, lowercased", () => {
    expect(extensionOf("Report.FINAL.PDF")).toBe("pdf");
    expect(extensionOf("noext")).toBe("");
    expect(extensionOf(".gitignore")).toBe("");
  });

  it("offers the allowlist for a message or an accept attribute", () => {
    const allowed = allowedExtensions();
    expect(allowed).toContain("xlsx");
    expect(allowed).toContain("pdf");
    expect(allowed).not.toContain("exe");
    expect(allowed).not.toContain("xlsm");
  });
});

describe("the working papers this product actually ships", () => {
  // Regression guard: a prefix-only scan accepted the synthetic fixture above
  // and rejected all four of these, which is the worst possible failure — the
  // check-in path is where an auditor hands back a paper they just edited.
  const templates = readdirSync(join(process.cwd(), "wp-templates")).filter((f) => f.endsWith(".xlsx"));

  it("finds four bundled templates to check", () => {
    expect(templates.length).toBe(4);
  });

  it.each(templates)("accepts %s", (name) => {
    const checked = checkUpload(name, realWorkbook(name));
    expect(checked.ext).toBe("xlsx");
    expect(checked.mime).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("still refuses one of them renamed to a macro-enabled extension", () => {
    const buf = realWorkbook(templates[0]);
    expect(refusal(() => checkUpload("book.xlsm", buf))).toBe("executable-refused");
  });
});
