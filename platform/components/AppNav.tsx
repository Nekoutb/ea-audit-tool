import { auth, signOut } from "@/auth";
import { EngagementSelector, type SelectorItem } from "@/components/EngagementSelector";
import { NavLink } from "@/components/NavLink";
import { getBranding, type Branding } from "@/lib/branding";
import { recentEngagements } from "@/lib/engagement-dashboard";
import { getMessages, type Locale } from "@/lib/i18n";
import { unreadCount } from "@/lib/notifications";

function initials(source: string): string {
  const parts = source.replace(/@.*/, "").split(/[.\s_-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "");
  return letters.toUpperCase() || "?";
}

/**
 * The Atlas application shell: brand, primary nav, and the top-right cluster
 * (engagement selector · notifications · settings · language · user). Rendered at
 * the top of every authenticated page. `current` names the engagement in context
 * so the selector reflects where you are.
 */
export async function AppNav({
  locale,
  current,
}: {
  locale: Locale;
  current?: { id: string; label: string };
}) {
  const t = getMessages(locale);
  const session = await auth();
  let branding: Branding | null = null;
  let recent: SelectorItem[] = [];
  let unread = 0;
  try {
    const [b, r, u] = await Promise.all([getBranding(), recentEngagements(6), unreadCount()]);
    branding = b;
    unread = u;
    recent = r.map((e) => ({
      id: e.id,
      title: e.name ?? e.clientName,
      meta: `FY${e.fiscalYear} · ${
        e.phase === "archived" ? t.engagements.phases.archived : t.dashboard.phaseNames[e.phase]
      }`,
      active: current ? e.id === current.id : false,
    }));
  } catch {
    // The shell must render even if a tenant-scoped read hiccups.
  }

  const user = session?.user;
  const name = user?.name ?? user?.email ?? "";
  const roleLabel = user?.role ? String(user.role).replaceAll("_", " ") : "";
  const currentLabel = current?.label ?? recent[0]?.title ?? null;

  const links = [
    { href: "/dashboard", label: t.nav.dashboard },
    { href: "/clients", label: t.nav.clients },
    { href: "/engagements", label: t.nav.engagements },
  ];

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-atlas)] border border-line bg-surface px-4 py-2.5 shadow-[var(--shadow-atlas-sm)]">
      <div className="flex items-center gap-5">
        <span className="flex items-center gap-2 text-sm font-bold tracking-[-0.01em] text-emerald-700 dark:text-emerald-400">
          {branding?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI, no optimizer benefit
            <img src={branding.logo} alt="" className="h-6 w-auto" data-testid="brand-logo" />
          ) : (
            <span className="grid h-7 w-7 place-items-center rounded-[var(--radius-atlas-xs)] bg-emerald-700 text-[13px] text-white">
              {(branding?.displayName ?? t.common.appName).slice(0, 1)}
            </span>
          )}
          <span data-testid="brand-name">{branding?.displayName ?? t.common.appName}</span>
        </span>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              exact={link.href === "/dashboard"}
              className="rounded-[var(--radius-atlas-xs)] px-3 py-1.5 text-sm font-medium transition"
              idleClassName="text-ink-soft hover:bg-surface-2"
              activeClassName="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2.5">
        {recent.length > 0 ? (
          <EngagementSelector
            current={currentLabel}
            items={recent}
            labels={{
              engagement: t.nav.engagements,
              recent: t.dashboard.recentEngagements ?? "Recent engagements",
              browseAll: t.nav.engagements,
              none: t.dashboard.selectEngagement ?? "Select engagement",
            }}
          />
        ) : null}

        <NavLink
          href="/notifications"
          className="relative grid h-9 w-9 place-items-center rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface text-ink-soft transition"
          idleClassName="hover:bg-surface-2"
          activeClassName="bg-surface-2"
          testId="nav-notifications"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          {unread > 0 ? (
            <span
              data-testid="unread-badge"
              className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-700 px-1 text-[10px] font-bold text-white"
            >
              {unread}
            </span>
          ) : null}
        </NavLink>

        <NavLink
          href="/settings"
          className="grid h-9 w-9 place-items-center rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface text-ink-soft transition"
          idleClassName="hover:bg-surface-2"
          activeClassName="bg-surface-2"
          testId="nav-settings"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </NavLink>

        <div className="mx-0.5 hidden h-7 w-px bg-line-strong sm:block" />

        <div className="hidden items-center gap-2.5 sm:flex">
          <div className="text-right leading-tight">
            <div className="max-w-[150px] truncate text-[13px] font-semibold text-ink">{name}</div>
            {roleLabel ? <div className="text-[11px] capitalize text-muted">{roleLabel}</div> : null}
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-atlas-sm)] bg-emerald-700 text-[12px] font-bold text-white">
            {initials(name)}
          </span>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-3 py-1.5 text-[13px] font-medium text-ink-soft transition hover:bg-surface-2"
          >
            {t.common.signOut}
          </button>
        </form>
      </div>
    </header>
  );
}
