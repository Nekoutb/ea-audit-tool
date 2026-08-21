import { describe, expect, it } from "vitest";
import { ZipWriter, crc32, safeZipPath, zipSegment } from "@/lib/zip";

/**
 * The writer is verified end-to-end elsewhere by producing a real archive and
 * opening it with `unzip -t` and Windows Expand-Archive — that is what proves
 * the binary layout. These cases pin the parts a future edit could break
 * silently: the checksum, the path rules, and the header fields.
 */

const bytes = (s: string) => new TextEncoder().encode(s);

describe("crc32", () => {
  // The published check value for CRC-32/ISO-HDLC.
  it("matches the standard check value for '123456789'", () => {
    expect(crc32(bytes("123456789")).toString(16)).toBe("cbf43926");
  });

  it("is zero for empty input", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it("can be computed incrementally", () => {
    const whole = crc32(bytes("hello world"));
    const part = crc32(bytes("world"), crc32(bytes("hello ")));
    expect(part).toBe(whole);
  });

  it("differs for a one-bit change", () => {
    expect(crc32(bytes("a"))).not.toBe(crc32(bytes("b")));
  });
});

describe("safeZipPath — an archive must be safe to extract", () => {
  it("strips traversal so an entry cannot escape the extraction folder", () => {
    // Zip-slip: without this, extracting writes outside the chosen directory.
    expect(safeZipPath("../../etc/passwd")).toBe("etc/passwd");
    expect(safeZipPath("../../../a.txt")).toBe("a.txt");
  });

  it("drops a leading slash", () => {
    expect(safeZipPath("/absolute/path.txt")).toBe("absolute/path.txt");
  });

  it("normalises backslashes to the zip separator", () => {
    expect(safeZipPath("a\\b\\c.txt")).toBe("a/b/c.txt");
  });

  it("replaces characters Windows cannot put in a filename", () => {
    expect(safeZipPath('a<b>c:d"e|f?g*h.txt')).toBe("a-b-c-d-e-f-g-h.txt");
  });

  it("keeps spaces, accents and ordinary punctuation", () => {
    expect(safeZipPath("E4.1 Créances clients (E)/paper.json")).toBe("E4.1 Créances clients (E)/paper.json");
  });

  it("never returns an empty name", () => {
    expect(safeZipPath("")).toBe("unnamed");
    expect(safeZipPath("///")).toBe("unnamed");
    expect(safeZipPath("...")).toBe("unnamed");
  });
});

describe("zipSegment — a typed name is one segment, not a path", () => {
  it("keeps a title containing a slash in a single folder", () => {
    // A real document is titled "Consider Client Acceptance/Continuance
    // Results"; without this it silently became two folders.
    expect(zipSegment("Consider Client Acceptance/Continuance Results"))
      .toBe("Consider Client Acceptance-Continuance Results");
  });

  it("handles a backslash the same way", () => {
    expect(zipSegment("a\\b")).toBe("a-b");
  });

  it("falls back rather than producing nothing", () => {
    expect(zipSegment("  ")).toBe("unnamed");
  });
});

describe("ZipWriter", () => {
  it("writes a local header with the right signature, method and flags", () => {
    const w = new ZipWriter();
    const header = w.entry("a.txt", bytes("hello"));
    const v = new DataView(header.buffer, header.byteOffset, header.byteLength);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint16(8, true)).toBe(0); // stored, not deflated
    expect(v.getUint16(6, true) & 0x0800).toBe(0x0800); // UTF-8 name flag
    expect(v.getUint32(14, true)).toBe(crc32(bytes("hello")));
    expect(v.getUint32(18, true)).toBe(5); // compressed size == size, stored
    expect(v.getUint32(22, true)).toBe(5);
  });

  it("tracks the offset so each entry knows where it starts", () => {
    const w = new ZipWriter();
    const h1 = w.entry("a.txt", bytes("hello"));
    expect(w.bytesWritten).toBe(h1.length + 5);
    w.entry("b.txt", bytes("worldly"));
    expect(w.entryCount).toBe(2);
  });

  it("ends with an end-of-central-directory record naming every entry", () => {
    const w = new ZipWriter();
    w.entry("a.txt", bytes("one"));
    w.entry("b/c.txt", bytes("two"));
    const tail = w.finish();
    const v = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    // EOCD is the last 22 bytes when there is no archive comment.
    const eocd = tail.length - 22;
    expect(v.getUint32(eocd, true)).toBe(0x06054b50);
    expect(v.getUint16(eocd + 8, true)).toBe(2); // entries on this disk
    expect(v.getUint16(eocd + 10, true)).toBe(2); // entries total
  });

  it("writes a central directory header per entry", () => {
    const w = new ZipWriter();
    w.entry("a.txt", bytes("one"));
    const tail = w.finish();
    const v = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    expect(v.getUint32(0, true)).toBe(0x02014b50);
  });

  it("stays classic — no ZIP64 — for a small archive", () => {
    // ZIP64 on a small archive is legal but needlessly raises the minimum
    // version, and some older tools refuse it.
    const w = new ZipWriter();
    w.entry("a.txt", bytes("one"));
    const tail = w.finish();
    const v = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    const eocd = tail.length - 22;
    expect(v.getUint16(eocd + 8, true)).not.toBe(0xffff);
    expect(v.getUint32(eocd + 16, true)).not.toBe(0xffffffff);
  });

  it("gives every entry a DOS timestamp no earlier than 1980", () => {
    // The format cannot represent an earlier year; a zero date makes some
    // extractors complain.
    const w = new ZipWriter();
    const header = w.entry("a.txt", bytes("x"), new Date("1970-01-01T00:00:00Z"));
    const v = new DataView(header.buffer, header.byteOffset, header.byteLength);
    const dosDate = v.getUint16(12, true);
    expect(dosDate >> 9).toBe(0); // 1980 + 0
  });
});
