import { cookies } from "next/headers";
import { auth } from "@/auth";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

/**
 * Resolve the active locale for a server render, in priority order:
 *   1. an explicit `locale` cookie (the language switcher's override),
 *   2. the signed-in user's saved preference,
 *   3. the default (French, per the OHADA-first spec).
 */
export async function getLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const session = await auth();
  if (session?.user?.locale && isLocale(session.user.locale)) {
    return session.user.locale;
  }

  return DEFAULT_LOCALE;
}
