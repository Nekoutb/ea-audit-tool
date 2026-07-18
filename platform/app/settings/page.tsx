import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { updateBrandingAction } from "@/app/actions/branding";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { DEFAULT_ACCENT, getBranding } from "@/lib/branding";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { canManageFirm, type Role } from "@/lib/rbac";

export default async function SettingsPage(props: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isAdmin = canManageFirm(session.user.role as Role);

  const { error, saved } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const ts = t.settings;
  const branding = await getBranding();

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
  const label = "flex flex-col gap-1 text-sm text-ink-soft";

  return (
    <main className="min-h-screen w-full px-6 py-10">
      <AppNav locale={locale} />
      <h1 className="mt-8 text-2xl font-semibold tracking-[-0.01em] text-ink">{ts.title}</h1>
      <ErrorBanner error={error} locale={locale} />
      {saved ? (
        <p
          data-testid="branding-saved"
          className="mt-4 rounded-[var(--radius-atlas-sm)] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {ts.saved}
        </p>
      ) : null}

      {isAdmin ? (
        <Panel className="mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PanelHeader title={t.users.title} hint={t.users.subtitle} />
            <Link href="/users" data-testid="manage-users-link" className={btnPrimary}>
              {t.users.manageLink}
            </Link>
          </div>
        </Panel>
      ) : null}

      <Panel className="mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PanelHeader title={t.resources.title} hint={t.resources.subtitle} />
          <Link href="/resources" data-testid="team-workload-link" className={btnPrimary}>
            {t.resources.link}
          </Link>
        </div>
      </Panel>

      <Panel className="mt-6 p-6">
        <PanelHeader title={ts.language} hint={ts.languageHint} />
        <div className="mt-4">
          <LanguageSwitcher current={locale} />
        </div>
      </Panel>

      <Panel className="mt-6 p-6">
        <PanelHeader title={ts.brandingTitle} hint={ts.brandingHint} />

        {!isAdmin ? (
          <p className="mt-4 text-sm text-muted" data-testid="branding-readonly">
            {ts.adminOnly}
          </p>
        ) : (
          <form action={updateBrandingAction} className="mt-5 flex flex-col gap-4">
            <label className={label}>
              {ts.displayName}
              <input
                name="displayName"
                required
                maxLength={160}
                defaultValue={branding.displayName}
                className={input}
                data-testid="branding-name"
              />
            </label>
            <div className="flex flex-wrap items-end gap-4">
              <label className={label}>
                {ts.accent}
                <input
                  name="accent"
                  type="color"
                  defaultValue={branding.accent ?? DEFAULT_ACCENT}
                  className="h-10 w-20 cursor-pointer rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface p-1"
                  data-testid="branding-accent"
                />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm text-ink-soft">
                <input type="checkbox" name="resetAccent" data-testid="branding-reset-accent" />
                {ts.resetAccent}
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <label className={label}>
                {ts.logo}
                <input name="logo" type="file" accept="image/png,image/jpeg" className="text-sm" data-testid="branding-logo" />
              </label>
              {branding.logo ? (
                <label className="flex items-center gap-2 pb-1 text-sm text-ink-soft">
                  <input type="checkbox" name="removeLogo" data-testid="branding-remove-logo" />
                  {ts.removeLogo}
                </label>
              ) : null}
            </div>
            <label className={label}>
              {ts.letterhead1}
              <input name="letterhead1" maxLength={160} defaultValue={branding.letterhead1} className={input} data-testid="branding-letterhead1" />
            </label>
            <label className={label}>
              {ts.letterhead2}
              <input name="letterhead2" maxLength={160} defaultValue={branding.letterhead2} className={input} data-testid="branding-letterhead2" />
            </label>
            <label className={label}>
              {ts.footer}
              <input name="footer" maxLength={160} defaultValue={branding.footer} className={input} data-testid="branding-footer" />
            </label>
            <label className={label}>
              {ts.naming}
              <input
                name="engagementNaming"
                maxLength={160}
                defaultValue={branding.engagementNaming}
                className={input}
                data-testid="branding-naming"
              />
              <span className="text-xs text-muted">{ts.namingHint}</span>
            </label>
            <button
              type="submit"
              className={`self-start ${btnPrimary}`}
              data-testid="branding-save"
            >
              {ts.save}
            </button>
          </form>
        )}
      </Panel>
    </main>
  );
}
