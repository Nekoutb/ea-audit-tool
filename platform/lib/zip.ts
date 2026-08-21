/**
 * A store-only, ZIP64-capable ZIP writer that streams.
 *
 * Written rather than depended on: nothing in the dependency list produces a
 * zip, and the alternative is streaming hundreds of megabytes of audit evidence
 * through a library chosen for this one use. Store-only is not a shortcut —
 * docx, xlsx, pdf, png and jpg are already compressed, so deflating them burns
 * CPU on a 3-vCPU box for approximately nothing.
 *
 * Every entry's size and CRC are known before its bytes are written, because
 * each artefact is fetched whole (each is capped at 25 MB by the upload
 * routes). That removes the need for data descriptors entirely and keeps the
 * writer simple: header, bytes, next.
 *
 * ZIP64 is emitted per-entry when an entry crosses 4 GB and for the archive as
 * a whole when the central directory crosses 4 GB or 65 535 entries. Below
 * those it writes a classic archive, which is what keeps older tools happy.
 */

const LOCAL_HEADER_SIG = 0x04034b50;
const CENTRAL_HEADER_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const ZIP64_EOCD_SIG = 0x06064b50;
const ZIP64_LOCATOR_SIG = 0x07064b50;
const ZIP64_EXTRA_ID = 0x0001;

/** Above this a 32-bit size field cannot hold the value. */
const MAX_U32 = 0xffffffff;
const MAX_U16 = 0xffff;

/* ------------------------------------------------------------------ *
 * CRC-32 (IEEE 802.3), the checksum every zip entry carries.
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      // 0xEDB88320 is the reversed representation of the standard polynomial.
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/** Incremental so a large artefact can be fed in chunks. */
export function crc32(data: Uint8Array, seed = 0): number {
  let crc = (seed ^ -1) >>> 0;
  for (let i = 0; i < data.length; i += 1) {
    crc = (CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ -1) >>> 0;
}

/* ------------------------------------------------------------------ *
 * Paths
 * ------------------------------------------------------------------ */

/**
 * Make a path safe to store and safe to extract.
 *
 * Zip-slip is the attack this closes: an entry named `../../etc/passwd`, or one
 * carrying a drive letter or a leading slash, escapes the directory the user
 * extracted into. Names here are built from client and document names that
 * people type, so this is not theoretical.
 */
export function safeZipPath(path: string): string {
  const cleaned = path
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) =>
      segment
        .replace(/[\u0000-\u001f\u007f]/g, "")
        // Reserved on Windows; a name containing them cannot be extracted there.
        .replace(/[<>:"|?*]/g, "-")
        .replace(/^\.+$/, "")
        .trim(),
    )
    .filter((segment) => segment.length > 0)
    .join("/");
  return cleaned || "unnamed";
}

/**
 * Escape a value that is meant to be ONE path segment.
 *
 * safeZipPath treats "/" as a separator, which is right for a path the code
 * builds — and wrong for a value a person typed. A document titled "Consider
 * Client Acceptance/Continuance Results" silently became two folders until
 * names went through here first.
 */
export function zipSegment(name: string): string {
  return name.replace(/[/\\]/g, "-").trim() || "unnamed";
}

/* ------------------------------------------------------------------ *
 * Writer
 * ------------------------------------------------------------------ */

interface CentralEntry {
  nameBytes: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  dosTime: number;
  dosDate: number;
  /** true when the entry needed a ZIP64 extra field in its local header */
  zip64: boolean;
}

/** MS-DOS date/time, which is what the format stores. */
function dosStamp(at: Date): { time: number; date: number } {
  const year = Math.max(1980, at.getUTCFullYear());
  return {
    time: (at.getUTCHours() << 11) | (at.getUTCMinutes() << 5) | (Math.floor(at.getUTCSeconds() / 2) & 0x1f),
    date: ((year - 1980) << 9) | ((at.getUTCMonth() + 1) << 5) | at.getUTCDate(),
  };
}

/**
 * Builds a zip incrementally. The caller pushes entries and the writer yields
 * byte chunks; nothing is retained except the central directory, which is a
 * few dozen bytes per entry.
 */
export class ZipWriter {
  private readonly entries: CentralEntry[] = [];
  private offset = 0;

  /** Bytes written so far — the offset the next entry starts at. */
  get bytesWritten(): number {
    return this.offset;
  }

  get entryCount(): number {
    return this.entries.length;
  }

  /**
   * Header for one stored entry. The caller must then emit exactly `data`.
   * Size and CRC are computed here, so no data descriptor is ever needed.
   */
  entry(path: string, data: Uint8Array, modified = new Date()): Uint8Array {
    const nameBytes = new TextEncoder().encode(safeZipPath(path));
    const { time, date } = dosStamp(modified);
    const crc = crc32(data);
    const size = data.length;
    // A single entry only needs ZIP64 when it cannot be described in 32 bits.
    const needsZip64 = size > MAX_U32 || this.offset > MAX_U32;

    const extraLength = needsZip64 ? 20 : 0;
    const header = new Uint8Array(30 + nameBytes.length + extraLength);
    const view = new DataView(header.buffer);

    view.setUint32(0, LOCAL_HEADER_SIG, true);
    // 4.5 for ZIP64, 2.0 otherwise — the minimum version that can read it.
    view.setUint16(4, needsZip64 ? 45 : 20, true);
    // Bit 11 declares the filename is UTF-8, which it always is here.
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true); // method 0 = stored
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, needsZip64 ? MAX_U32 : size, true); // compressed
    view.setUint32(22, needsZip64 ? MAX_U32 : size, true); // uncompressed
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, extraLength, true);
    header.set(nameBytes, 30);

    if (needsZip64) {
      // The real sizes live in the extra field when the classic ones are 0xFF..
      const extra = new DataView(header.buffer, 30 + nameBytes.length, 20);
      extra.setUint16(0, ZIP64_EXTRA_ID, true);
      extra.setUint16(2, 16, true); // payload size: two 8-byte values
      extra.setBigUint64(4, BigInt(size), true); // uncompressed
      extra.setBigUint64(12, BigInt(size), true); // compressed
    }

    this.entries.push({
      nameBytes,
      crc,
      size,
      offset: this.offset,
      dosTime: time,
      dosDate: date,
      zip64: needsZip64,
    });
    this.offset += header.length + size;
    return header;
  }

  /** Convenience for text entries. */
  textEntry(path: string, text: string, modified?: Date): { header: Uint8Array; body: Uint8Array } {
    const body = new TextEncoder().encode(text);
    return { header: this.entry(path, body, modified), body };
  }

  /**
   * The central directory and the end record. Emitted once, after every entry.
   * This is the only part the writer holds in memory, and it is small.
   */
  finish(): Uint8Array {
    const directoryOffset = this.offset;
    const parts: Uint8Array[] = [];

    for (const e of this.entries) {
      // The central record needs ZIP64 whenever the size or the offset does.
      const needsZip64 = e.zip64 || e.size > MAX_U32 || e.offset > MAX_U32;
      const extraLength = needsZip64 ? 28 : 0;
      const record = new Uint8Array(46 + e.nameBytes.length + extraLength);
      const view = new DataView(record.buffer);

      view.setUint32(0, CENTRAL_HEADER_SIG, true);
      // Made by: 3 (Unix) << 8 | version. Unix so the mode field is meaningful.
      view.setUint16(4, (3 << 8) | (needsZip64 ? 45 : 20), true);
      view.setUint16(6, needsZip64 ? 45 : 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, e.dosTime, true);
      view.setUint16(14, e.dosDate, true);
      view.setUint32(16, e.crc, true);
      view.setUint32(20, needsZip64 ? MAX_U32 : e.size, true);
      view.setUint32(24, needsZip64 ? MAX_U32 : e.size, true);
      view.setUint16(28, e.nameBytes.length, true);
      view.setUint16(30, extraLength, true);
      view.setUint16(32, 0, true); // comment length
      view.setUint16(34, 0, true); // disk number
      view.setUint16(36, 0, true); // internal attributes
      // External attributes: 0644 regular file, shifted into the Unix half.
      view.setUint32(38, (0o100644 << 16) >>> 0, true);
      view.setUint32(42, needsZip64 ? MAX_U32 : e.offset, true);
      record.set(e.nameBytes, 46);

      if (needsZip64) {
        const extra = new DataView(record.buffer, 46 + e.nameBytes.length, 28);
        extra.setUint16(0, ZIP64_EXTRA_ID, true);
        extra.setUint16(2, 24, true); // three 8-byte values follow
        extra.setBigUint64(4, BigInt(e.size), true);
        extra.setBigUint64(12, BigInt(e.size), true);
        extra.setBigUint64(20, BigInt(e.offset), true);
      }

      parts.push(record);
      this.offset += record.length;
    }

    const directorySize = this.offset - directoryOffset;
    // The archive as a whole needs ZIP64 when any of these cannot be expressed.
    const archiveNeedsZip64 =
      this.entries.length > MAX_U16 || directorySize > MAX_U32 || directoryOffset > MAX_U32;

    if (archiveNeedsZip64) {
      const z64 = new Uint8Array(56);
      const v = new DataView(z64.buffer);
      v.setUint32(0, ZIP64_EOCD_SIG, true);
      // Size of this record MINUS the 12 bytes of signature and size field.
      v.setBigUint64(4, BigInt(44), true);
      v.setUint16(12, (3 << 8) | 45, true); // version made by
      v.setUint16(14, 45, true); // version needed
      v.setUint32(16, 0, true); // this disk
      v.setUint32(20, 0, true); // disk with directory start
      v.setBigUint64(24, BigInt(this.entries.length), true);
      v.setBigUint64(32, BigInt(this.entries.length), true);
      v.setBigUint64(40, BigInt(directorySize), true);
      v.setBigUint64(48, BigInt(directoryOffset), true);
      parts.push(z64);

      const locator = new Uint8Array(20);
      const lv = new DataView(locator.buffer);
      lv.setUint32(0, ZIP64_LOCATOR_SIG, true);
      lv.setUint32(4, 0, true); // disk with the ZIP64 EOCD
      lv.setBigUint64(8, BigInt(this.offset), true); // its offset
      lv.setUint32(16, 1, true); // total disks
      parts.push(locator);
      this.offset += z64.length + locator.length;
    }

    const eocd = new Uint8Array(22);
    const e = new DataView(eocd.buffer);
    e.setUint32(0, EOCD_SIG, true);
    e.setUint16(4, 0, true);
    e.setUint16(6, 0, true);
    e.setUint16(8, archiveNeedsZip64 ? MAX_U16 : this.entries.length, true);
    e.setUint16(10, archiveNeedsZip64 ? MAX_U16 : this.entries.length, true);
    e.setUint32(12, archiveNeedsZip64 ? MAX_U32 : directorySize, true);
    e.setUint32(16, archiveNeedsZip64 ? MAX_U32 : directoryOffset, true);
    e.setUint16(20, 0, true); // no archive comment
    parts.push(eocd);

    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }
}
