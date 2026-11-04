// Which papers carry the partner's own signature, and the marks a task row shows
// for it (F007). Pure and free of the database, so client components can read it.

export const PARTNER_ONLY_APPROVAL: ReadonlySet<string> = new Set(["P5.2", "P7.2", "S6.1", "S6.2", "S3.1", "C1.1"]);
export const PARTNER_GATED: ReadonlySet<string> = new Set(["P1.1", "P2.2", "P5.2", "S3.1", "P7.2"]);

/** The partner's own sign-off in the default matrix: P1.1, P2.2, P5.2, P7.2, S3.1, S6.1, S6.2, C1.1, every C5.x, C6.2. */
const DEFAULT_PARTNER_SIGNOFF: readonly string[] = ["P1.1", "P2.2", "P5.2", "P7.2", "S3.1", "S6.1", "S6.2", "C1.1", "C6.2"];

/** The matrix's partner sign-off, united with the two older operator sets (none is dropped). */
export function defaultPartnerSignoff(code: string): boolean {
  return (
    DEFAULT_PARTNER_SIGNOFF.includes(code) || /^C5\./.test(code) || PARTNER_GATED.has(code) || PARTNER_ONLY_APPROVAL.has(code)
  );
}

/**
 * The marks a task row carries beside its P and R: "A" (Associé) on a paper the
 * partner signs, "EQR" on the engagement quality review. The group list, the
 * paper and the Forms tool all read this.
 */
export function signatureMarks(code: string): { partner: boolean; eqr: boolean } {
  return { partner: defaultPartnerSignoff(code), eqr: code === "C4.2" };
}
