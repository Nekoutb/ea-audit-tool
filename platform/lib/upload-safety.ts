/**
 * What may enter an audit file, and what it is called on the way back out.
 *
 * The exposure here is not stored XSS — the serve routes already send
 * `Content-Disposition: attachment` and the proxy adds `nosniff` and a CSP with
 * no inline script. It is malware relay: every extension was accepted, the
 * uploader's own `file.type` was stored verbatim and replayed on download, and
 * the browser writes the result to an auditor's disk under a name the uploader
 * chose. A `.hta` or `.lnk` sitting in a working paper is a delivery mechanism
 * wearing an audit firm's name.
 *
 * So: an allowlist of what a working paper actually needs, a signature check so
 * the extension is not merely asserted, and a canonical MIME derived from what
 * the bytes are rather than from what the uploader claimed.
 */

export class UnsafeFileError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "UnsafeFileError";
    this.code = code;
  }
}

interface FileKind {
  ext: string[];
  mime: string;
  /** Byte signatures, any of which identifies the type. Empty = text-like. */
  magic?: number[][];
  /** Text formats have no signature; validated by decoding instead. */
  text?: boolean;
}

const ZIP: number[][] = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06], // empty archive
  [0x50, 0x4b, 0x07, 0x08], // spanned
];
const OLE: number[][] = [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]];

/** The part every OOXML document carries, wherever the writer placed it. */
const OOXML_MARKER = Buffer.from("[Content_Types].xml", "latin1");

/**
 * The audit set. Deliberately excludes macro-enabled Office formats (.xlsm,
 * .docm) — a working paper does not need to carry executable code, and the four
 * bundled templates are .xlsx.
 */
const KINDS: FileKind[] = [
  { ext: ["xlsx"], mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", magic: ZIP },
  { ext: ["docx"], mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: ZIP },
  { ext: ["pptx"], mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", magic: ZIP },
  { ext: ["xls"], mime: "application/vnd.ms-excel", magic: OLE },
  { ext: ["doc"], mime: "application/msword", magic: OLE },
  { ext: ["pdf"], mime: "application/pdf", magic: [[0x25, 0x50, 0x44, 0x46]] },
  { ext: ["png"], mime: "image/png", magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  { ext: ["jpg", "jpeg"], mime: "image/jpeg", magic: [[0xff, 0xd8, 0xff]] },
  { ext: ["gif"], mime: "image/gif", magic: [[0x47, 0x49, 0x46, 0x38]] },
  { ext: ["webp"], mime: "image/webp", magic: [[0x52, 0x49, 0x46, 0x46]] },
  { ext: ["csv"], mime: "text/csv", text: true },
  { ext: ["txt"], mime: "text/plain", text: true },
  { ext: ["xml"], mime: "text/plain", text: true },
  { ext: ["json"], mime: "application/json", text: true },
];

const BY_EXT = new Map<string, FileKind>();
for (const kind of KINDS) for (const ext of kind.ext) BY_EXT.set(ext, kind);

/** Extensions worth naming in the refusal, because someone will try. */
const NOTABLY_REFUSED = new Set([
  "exe", "com", "scr", "bat", "cmd", "ps1", "vbs", "js", "jse", "wsf", "wsh",
  "hta", "lnk", "msi", "dll", "cpl", "jar", "app", "sh", "svg", "html", "htm",
  "xlsm", "docm", "pptm", "xlsb", "iso", "img", "reg",
]);

export function extensionOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot + 1).toLowerCase();
}

/**
 * Strip anything that lets a filename escape its cell: path separators, control
 * characters, leading dots, and the right-to-left override used to disguise an
 * extension (`invoice\u202Excod.exe` displays as `invoice.docx`).
 */
export function safeFilename(filename: string): string {
  const base = (filename.split(/[/\\]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 160);
  return base || "attachment";
}

function startsWith(buf: Buffer, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  return sig.every((byte, i) => buf[i] === byte);
}

/** Text formats: no signature, so require it to decode and hold no NULs. */
function looksTextual(content: Buffer): boolean {
  const head = content.subarray(0, 8192);
  if (head.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(head);
    return true;
  } catch {
    // A CSV exported as latin-1 is still a legitimate ledger export.
    return !head.some((b) => b < 0x09 || (b > 0x0d && b < 0x20));
  }
}

export interface CheckedUpload {
  /** Sanitised basename, extension preserved. */
  name: string;
  /** MIME derived from the validated type — never the uploader's claim. */
  mime: string;
  ext: string;
}

/**
 * Validate an upload, or throw UnsafeFileError with a code the routes map to a
 * message. `claimedMime` is accepted only to be ignored — it is recorded here
 * so callers cannot quietly pass it through instead.
 */
export function checkUpload(filename: string, content: Buffer): CheckedUpload {
  const name = safeFilename(filename);
  const ext = extensionOf(name);

  if (!ext) throw new UnsafeFileError("no-extension");
  if (NOTABLY_REFUSED.has(ext)) throw new UnsafeFileError("executable-refused");

  const kind = BY_EXT.get(ext);
  if (!kind) throw new UnsafeFileError("extension-not-allowed");

  if (content.length === 0) throw new UnsafeFileError("empty-file");

  if (kind.text) {
    if (!looksTextual(content)) throw new UnsafeFileError("content-mismatch");
  } else if (kind.magic && !kind.magic.some((sig) => startsWith(content, sig))) {
    throw new UnsafeFileError("content-mismatch");
  }

  // An OOXML file is a zip; so is a renamed .zip full of anything. Look for the
  // part every Office document carries.
  //
  // Search the WHOLE buffer, not a prefix. The name appears in the local file
  // header near the start only when that part happens to be written first; in
  // the four templates this product ships it sits in the central directory at
  // the very end (offset 36808 of 38381 in E_Trade Receivables.xlsx). A
  // prefix scan rejected every real workbook while passing a hand-made
  // fixture. Buffer.includes is a byte search, so this costs no string
  // allocation on a 25 MB upload.
  if (["xlsx", "docx", "pptx"].includes(ext)) {
    if (!content.includes(OOXML_MARKER)) throw new UnsafeFileError("not-an-office-file");
  }

  return { name, mime: kind.mime, ext };
}

/** The allowlist, for a message or an `accept` attribute. */
export function allowedExtensions(): string[] {
  return [...BY_EXT.keys()].sort();
}

/**
 * Response headers for handing a stored file back. The MIME is the canonical
 * one; the filename is sent both plainly and RFC 5987-encoded so non-ASCII
 * names survive. Content-Length is deliberately not set — the runtime derives
 * it, and a hand-set value is a bug waiting to disagree with the body.
 */
export function fileResponseHeaders(name: string, mime: string): Record<string, string> {
  const safe = safeFilename(name);
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return {
    "Content-Type": mime,
    "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
    // Belt and braces: the proxy sets this too, but a byte-serving route must
    // never depend on a matcher continuing to cover it.
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
}
