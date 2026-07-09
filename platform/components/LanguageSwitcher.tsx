import { setLocale } from "@/app/actions/locale";
import { getMessages, LOCALES, type Locale } from "@/lib/i18n";

export function LanguageSwitcher({ current }: { current: Locale }) {
  const t = getMessages(current).common;
  const label: Record<Locale, string> = { en: t.english, fr: t.french };

  return (
    <div className="flex items-center gap-1" aria-label={t.language}>
      {LOCALES.map((locale) => (
        <form
          key={locale}
          action={async () => {
            "use server";
            await setLocale(locale);
          }}
        >
          <button
            type="submit"
            aria-current={locale === current}
            className={
              locale === current
                ? "rounded px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                : "rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }
          >
            {label[locale]}
          </button>
        </form>
      ))}
    </div>
  );
}
