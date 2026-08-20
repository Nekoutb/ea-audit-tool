import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP (RFC 6238) over HOTP (RFC 4226), implemented here rather than pulled in:
 * it is forty lines of a fully specified algorithm with published test vectors,
 * and the vectors are in the test file, so correctness is demonstrable rather
 * than assumed.
 *
 * Authenticator apps expect HMAC-SHA1, 6 digits, a 30-second step. Those are
 * the defaults; SHA-1 here is a MAC over a counter, not a collision-resistant
 * hash, so its weaknesses do not apply.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;

/** RFC 4648 base32, which is what the otpauth:// URI carries. */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[=\s-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = B32.indexOf(char);
    if (index === -1) throw new Error("invalid-base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh 20-byte secret, the size RFC 4226 recommends for SHA-1. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

/** HOTP: the counter-based code the whole thing is built on. */
export function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const buf = Buffer.alloc(8);
  // Counters exceed 32 bits eventually; write as a big-endian 64-bit value.
  buf.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac("sha1", secret).update(buf).digest();
  // Dynamic truncation, RFC 4226 §5.3.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** The code for a moment in time. `atMs` defaults to now. */
export function totp(secretBase32: string, atMs: number = Date.now(), digits = DIGITS, step = STEP_SECONDS): string {
  return hotp(base32Decode(secretBase32), Math.floor(atMs / 1000 / step), digits);
}

/**
 * Verify a submitted code, allowing one step either side so a phone whose clock
 * drifts by a few seconds — or a person typing as the code rolls over — still
 * works. Wider than ±1 starts trading real security for convenience.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  atMs: number = Date.now(),
  window = 1,
): boolean {
  const submitted = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(submitted)) return false;
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
  for (let drift = -window; drift <= window; drift += 1) {
    if (constantTimeEquals(hotp(secret, counter + drift), submitted)) return true;
  }
  return false;
}

/** The URI an authenticator app reads, by QR or by hand. */
export function otpauthUri(secretBase32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Groups of four, so a person can read it off the screen without losing place. */
export function formatSecret(secretBase32: string): string {
  return secretBase32.replace(/(.{4})/g, "$1 ").trim();
}

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
