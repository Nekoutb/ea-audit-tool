import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/password-policy";

// Phase 0 item 1. The policy is enforced server-side in changeOwnPassword; the
// browser's minLength is a convenience the user can strip, so these cases are
// the real boundary.

const EMAIL = "alice.alpha@firm-a.test";

describe("passwordProblem", () => {
  it("accepts a password that meets every rule", () => {
    expect(passwordProblem("Correct-Horse-9-Battery", EMAIL)).toBeNull();
  });

  it("rejects anything shorter than the minimum", () => {
    expect(passwordProblem("Ab1" + "x".repeat(MIN_PASSWORD_LENGTH - 4), EMAIL)).toBe("too-short");
  });

  it("accepts exactly the minimum length", () => {
    const atLimit = "Ab1" + "x".repeat(MIN_PASSWORD_LENGTH - 3);
    expect(atLimit).toHaveLength(MIN_PASSWORD_LENGTH);
    expect(passwordProblem(atLimit, EMAIL)).toBeNull();
  });

  it("requires both cases", () => {
    expect(passwordProblem("alllowercase99", EMAIL)).toBe("needs-mixed-case");
    expect(passwordProblem("ALLUPPERCASE99", EMAIL)).toBe("needs-mixed-case");
  });

  it("requires a digit", () => {
    expect(passwordProblem("NoDigitsAtAllHere", EMAIL)).toBe("needs-digit");
  });

  it("refuses a password built from the email local part", () => {
    expect(passwordProblem("Alice.Alpha-99xyz", EMAIL)).toBe("contains-email");
  });

  it("matches the email local part case-insensitively", () => {
    expect(passwordProblem("XALICE.ALPHAx9Q", EMAIL)).toBe("contains-email");
  });

  it("does not treat a very short local part as a substring rule", () => {
    // 'ab' is two characters — too short to be a meaningful guess, and it would
    // otherwise reject almost every password containing those letters.
    expect(passwordProblem("Reasonable9Pass", "ab@firm-a.test")).toBeNull();
  });

  it("reports the length problem first for a password failing several rules", () => {
    // ordering matters only so the message tells the user the most useful thing
    expect(passwordProblem("abc", EMAIL)).toBe("too-short");
  });
});
