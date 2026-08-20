/**
 * One amount parser for the whole product.
 *
 * There were five divergent copies, three of which stripped every character
 * outside [0-9.-] — so the FCFA figure "1 500 000,75" arrived as 150 000 075,
 * a hundredfold error, and it fed the SAD debits-equals-credits control total.
 * A fourth (lib/tb.ts) had lost the backslashes from its character classes, so
 * "\s" matched a literal 's' and "\d" a literal 'd'.
 *
 * The product is bilingual and FCFA-denominated: a French user types
 * "1 500 000,75", an English one "1,500,000.75", and a spreadsheet export may
 * produce either. All three must mean the same number.
 *
 * No imports — client components use this too.
 */

/** Space characters used for digit grouping: ASCII, NBSP, narrow NBSP, thin. */
const GROUPING_SPACE = /[\s   ]/g;

/** Everything that is not a digit, a separator, a sign, or a bracket. */
const NOISE = /[^\d.,()+\-]/g;

/**
 * Parse a human-entered or spreadsheet-exported amount.
 * Returns null when the value is not a number — callers decide whether that is
 * an error or simply an empty cell. Use `amountOr(value, 0)` for a total.
 */
export function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;

  let raw = String(value).trim();
  if (raw === "") return null;

  // Normalise the Unicode minus before the sign is read.
  raw = raw.replace(/−/g, "-");

  // Accounting negatives: (1 234,56)
  const bracketed = /^\((.*)\)$/.test(raw);
  if (bracketed) raw = raw.slice(1, -1);

  // A trailing sign, as some ledger exports write it: 1 234,56-
  let trailingNegative = false;
  if (/-$/.test(raw)) {
    trailingNegative = true;
    raw = raw.slice(0, -1);
  }

  // Currency words and symbols (FCFA, XAF, €, $) carry no numeric meaning.
  const hadGrouping = GROUPING_SPACE.test(raw);
  GROUPING_SPACE.lastIndex = 0;
  let s = raw.replace(GROUPING_SPACE, "").replace(NOISE, "");
  if (s === "") return null;

  let negative = bracketed || trailingNegative;
  if (/^[+-]/.test(s)) {
    if (s[0] === "-") negative = !negative;
    s = s.slice(1);
  }
  // A sign anywhere else means this was never a single number.
  if (/[+-]/.test(s)) return null;

  const decimalIndex = decimalSeparatorIndex(s, hadGrouping);
  if (decimalIndex === -1) {
    s = s.replace(/[.,]/g, "");
  } else {
    const whole = s.slice(0, decimalIndex).replace(/[.,]/g, "");
    const fraction = s.slice(decimalIndex + 1).replace(/[.,]/g, "");
    s = `${whole}.${fraction}`;
  }

  if (s === "" || s === ".") return null;
  if (!/^\d*\.?\d+$/.test(s)) return null;

  const parsed = Number(s);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

/** Same, but yields `fallback` instead of null — for sums and control totals. */
export function amountOr(value: unknown, fallback = 0): number {
  const parsed = parseAmount(value);
  return parsed === null ? fallback : parsed;
}

/**
 * Which separator is the decimal point, or -1 when the string is a whole
 * number whose separators are all digit grouping.
 *
 * `hadGrouping` says spaces were doing the grouping, which resolves the one
 * genuinely ambiguous case: "12 345,678" must be 12345.678, while a bare
 * "1,500" is conventionally 1500.
 */
function decimalSeparatorIndex(s: string, hadGrouping: boolean): number {
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot === -1 && lastComma === -1) return -1;

  // Both present: the rightmost is the decimal point, the other groups digits.
  if (lastDot !== -1 && lastComma !== -1) return Math.max(lastDot, lastComma);

  const index = lastDot === -1 ? lastComma : lastDot;
  const separator = s[index];
  // Repeated means grouping — 1.500.000 is one and a half million.
  if (s.split(separator).length - 1 > 1) return -1;

  const fractionDigits = s.length - index - 1;
  if (fractionDigits !== 3) return fractionDigits > 0 ? index : -1;
  // Exactly three digits after a lone separator is the ambiguous case.
  return hadGrouping ? index : -1;
}
