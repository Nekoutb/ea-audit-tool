import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  formatSecret,
  generateSecret,
  hotp,
  otpauthUri,
  totp,
  verifyTotp,
} from "@/lib/totp";

// The point of implementing this rather than depending on it is that the
// algorithm has published test vectors. If these pass, it is correct.

describe("HOTP — RFC 4226 Appendix D test vectors", () => {
  const secret = Buffer.from("12345678901234567890", "ascii");
  const expected = [
    "755224", "287082", "359152", "969429", "338314",
    "254676", "287922", "162583", "399871", "520489",
  ];

  it.each(expected.map((code, counter) => [counter, code]))("counter %i gives %s", (counter, code) => {
    expect(hotp(secret, counter as number)).toBe(code);
  });
});

describe("TOTP — RFC 6238 Appendix B test vectors (SHA-1)", () => {
  // The RFC publishes 8-digit codes; a 6-digit code is the last six digits.
  const secretBase32 = base32Encode(Buffer.from("12345678901234567890", "ascii"));
  const vectors: [number, string][] = [
    [59, "94287082"],
    [1_111_111_109, "07081804"],
    [1_111_111_111, "14050471"],
    [1_234_567_890, "89005924"],
    [2_000_000_000, "69279037"],
    [20_000_000_000, "65353130"],
  ];

  it.each(vectors)("T=%i gives %s", (seconds, eightDigits) => {
    expect(totp(secretBase32, seconds * 1000, 8)).toBe(eightDigits);
    expect(totp(secretBase32, seconds * 1000)).toBe(eightDigits.slice(-6));
  });

  it("keeps working past the 32-bit counter boundary", () => {
    // T=20000000000 is the vector that catches a counter written as 32 bits.
    expect(totp(secretBase32, 20_000_000_000 * 1000, 8)).toBe("65353130");
  });
});

describe("base32", () => {
  it("round-trips", () => {
    for (const text of ["", "a", "ab", "abc", "abcd", "abcde", "12345678901234567890"]) {
      const buf = Buffer.from(text, "ascii");
      expect(base32Decode(base32Encode(buf)).toString("ascii")).toBe(text);
    }
  });

  it("matches RFC 4648 test vectors", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Encode(Buffer.from("f"))).toBe("MY");
    expect(base32Encode(Buffer.from("fo"))).toBe("MZXQ");
  });

  it("tolerates the spacing and padding a person might paste", () => {
    expect(base32Decode("MZXW 6YTB OI==").toString()).toBe("foobar");
    expect(base32Decode("mzxw6ytboi").toString()).toBe("foobar");
  });

  it("refuses characters outside the alphabet", () => {
    expect(() => base32Decode("MZXW6YTB01")).toThrow("invalid-base32");
  });
});

describe("verifyTotp", () => {
  const secret = generateSecret();
  const now = 1_700_000_000_000;

  it("accepts the current code", () => {
    expect(verifyTotp(secret, totp(secret, now), now)).toBe(true);
  });

  it("accepts one step either side, for clock drift", () => {
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now + 30_000), now)).toBe(true);
  });

  it("refuses two steps away", () => {
    expect(verifyTotp(secret, totp(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, totp(secret, now + 90_000), now)).toBe(false);
  });

  it("refuses a wrong code", () => {
    expect(verifyTotp(secret, "000000", now)).toBe(false);
  });

  it("refuses anything that is not six digits", () => {
    expect(verifyTotp(secret, "", now)).toBe(false);
    expect(verifyTotp(secret, "12345", now)).toBe(false);
    expect(verifyTotp(secret, "1234567", now)).toBe(false);
    expect(verifyTotp(secret, "abcdef", now)).toBe(false);
  });

  it("tolerates a space in the middle, as phones display it", () => {
    const code = totp(secret, now);
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, now)).toBe(true);
  });

  it("refuses a code from a different secret", () => {
    expect(verifyTotp(secret, totp(generateSecret(), now), now)).toBe(false);
  });
});

describe("enrolment helpers", () => {
  it("generates a 160-bit secret", () => {
    expect(base32Decode(generateSecret())).toHaveLength(20);
  });

  it("generates a different secret every time", () => {
    expect(generateSecret()).not.toBe(generateSecret());
  });

  it("builds a URI an authenticator app can read", () => {
    const uri = otpauthUri("JBSWY3DPEHPK3PXP", "alice@firm-a.test", "AuditISA");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=AuditISA");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
    // The label must carry the account so a phone with several entries can tell
    // them apart.
    expect(decodeURIComponent(uri.split("?")[0])).toContain("alice@firm-a.test");
  });

  it("groups the secret for reading off a screen", () => {
    expect(formatSecret("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
  });
});
