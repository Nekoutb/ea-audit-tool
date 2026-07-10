import Link from "next/link";
import { signOut } from "@/auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getBranding, type Branding } from "@/lib/branding";
import { getMessages, type Locale } from "@/lib/i18n";

export async function AppNav({ locale }: { locale: Locale }) {
  const t = getMessages(locale);
  let branding: Branding | null = null;
  try {
    branding = await getBranding();
  } catch {
    // Nav must render even if branding cannot be loaded.
  }
  const links = [
    { href: "/dashboard", label: t.nav.dashboard },
    { href: "/clients", label: t.nav.clients },
    { href: "/engagements", label: t.nav.engagements },
    { href: "/notifications", label: t.nav.notifications },
    { href: "/settings", label: t.nav.settings },
  ];
  return (
    <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
      <div className="flex items-center gap-5">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-500">
          {branding?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI, no optimizer benefit
            <img src={branding.logo} alt="" className="h-6 w-auto" data-testid="brand-logo" />
          ) : null}
          <span data-testid="brand-name">{branding?.displayName ?? t.common.appName}</span>
        </span>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm font-medium text-slate-700 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-400"
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <LanguageSwitcher current={locale} />
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t.common.signOut}
          </button>
        </form>
      </div>
    </nav>
  );
}
