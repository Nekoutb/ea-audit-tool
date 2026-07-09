"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

/**
 * Switch the active language. Always sets the cookie; if a user is signed in,
 * also persists the choice to their profile so it survives across devices and
 * future logins.
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const session = await auth();
  if (session?.user?.id) {
    await pool.query("UPDATE app_user SET preferred_language = $1 WHERE id = $2", [
      locale,
      session.user.id,
    ]);
  }

  revalidatePath("/", "layout");
}
