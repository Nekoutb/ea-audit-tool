import { auth } from "@/auth";
import { accentCss, getBranding } from "@/lib/branding";

/**
 * Per-firm theme: overrides the emerald CSS variables that every Tailwind
 * utility in the app references (v4 emits `var(--color-emerald-*)`), so one
 * accent re-brands the whole UI. Renders nothing before login or when the
 * firm keeps the platform default.
 */
export async function BrandStyle() {
  const session = await auth();
  if (!session?.user?.tenantId) return null;
  let css: string | null = null;
  try {
    const branding = await getBranding();
    if (branding.accent) css = accentCss(branding.accent);
  } catch {
    // Theming must never take a page down (e.g. transient DB hiccup).
  }
  if (!css) return null;
  return <style data-testid="brand-style">{css}</style>;
}
