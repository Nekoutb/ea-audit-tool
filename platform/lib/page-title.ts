import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";

/**
 * The browser-tab title in the reader's language (UAT run 3 B18): a static
 * `metadata = { title }` is English whatever the UI language. Pages export
 * `generateMetadata = localizedTitle("Manage team", "Gestion de l'équipe")`.
 */
export function localizedTitle(en: string, fr: string): () => Promise<Metadata> {
  return async () => {
    const locale = await getLocale();
    return { title: `${locale === "fr" ? fr : en} · AuditISA` };
  };
}
