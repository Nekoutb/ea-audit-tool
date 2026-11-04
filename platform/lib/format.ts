// One way to show an amount (F087): the separators follow the reader's language,
// and the currency is FCFA on every screen and export. Pure, for server and client.

export type Locale = "en" | "fr";

/** The Intl locale for a UI language. */
export function numLocale(locale: Locale | string | null | undefined): string {
  return locale === "en" ? "en-GB" : "fr-FR";
}

/** A number in the reader's language. Rounding never leaves a "-0". */
export function formatAmount(
  value: number,
  locale: Locale | string | null | undefined = "fr",
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 0 },
): string {
  const digits = options.maximumFractionDigits ?? 3;
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor + 0;
  return new Intl.NumberFormat(numLocale(locale), options).format(rounded);
}

/** The firm's one currency label, whatever a file calls it (XAF, XOF, F CFA). */
export function currencyLabel(_stored?: string | null): string {
  return "FCFA";
}
