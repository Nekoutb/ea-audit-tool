import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

// OHADA engagements default to French (master spec §1, §15).
export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALE_COOKIE = "locale";

export type Messages = typeof en;

const DICTIONARIES: Record<Locale, Messages> = { en, fr };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getMessages(locale: Locale): Messages {
  return DICTIONARIES[locale];
}

/**
 * Format an amount in FCFA per master spec §15: space thousands separator, no
 * decimals. FCFA grouping is locale-independent (always a plain space), so we
 * group manually rather than relying on a locale's separator (which may be a
 * comma or a narrow no-break space).
 */
export function formatFCFA(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped} FCFA`;
}
