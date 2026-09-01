import { auth, signOut } from "@/auth";
import { EngagementSelector, type SelectorItem } from "@/components/EngagementSelector";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getBranding, type Branding } from "@/lib/branding";
import { recentEngagements } from "@/lib/engagement-dashboard";
import { getMessages, type Locale } from "@/lib/i18n";
import { listMyNotifications, unreadCount, type Notification as NotificationItem } from "@/lib/notifications";
import { NotificationBell } from "@/components/NotificationBell";
import Link from "next/link";
import { SECTION_ORDER, sectionLabel } from "@/lib/task-groups";

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
  minimal = false,
  hideLinks = false,
}: {
  locale: Locale;
  current?: { id: string; label: string };
  /** Hide the primary links — the welcome screen announces the engagements itself. */
  minimal?: boolean;
  /** Hide the links but keep the engagement selector (engagement console pages). */
  hideLinks?: boolean;
}) {
  const t = getMessages(locale);
  const session = await auth();
  let branding: Branding | null = null;
  let recent: SelectorItem[] = [];
  let unread = 0;
  let notifs: NotificationItem[] = [];
  try {
    const [b, r, u, n] = await Promise.all([
      getBranding(),
      recentEngagements(6),
      unreadCount(),
      listMyNotifications(8),
    ]);
    branding = b;
    unread = u;
    notifs = n;
    recent = r.map((e) => ({
      id: e.id,
      title: e.name ?? e.clientName,
      meta: `FY${e.fiscalYear} · ${t.engagements.stages[e.phase]}`,
      active: current ? e.id === current.id : false,
    }));
  } catch (error) {
    // The shell must still render if a tenant-scoped read fails — but silently
    // is how a broken query survived eleven days in production. One failure in
    // the Promise.all discards all four results, so the nav quietly loses the
    // firm's branding, its unread count, its notifications and its engagement
    // switcher, and looks like four features that simply do not work.
    console.error("[AppNav] nav data unavailable, rendering degraded shell:", error);
  }

  const user = session?.user;
  const name = user?.name ?? user?.email ?? "";
  const roleLabel = user?.role ? String(user.role).replaceAll("_", " ") : "";
  const currentLabel = current?.label ?? recent[0]?.title ?? null;

  // Clients left the primary nav (IA audit, Part 4): the entity directory now
  // lives under Settings; entity records are reached from each engagement hub.
  const links = [
    { href: "/dashboard", label: t.nav.dashboard },
    { href: "/engagements", label: t.nav.engagements },
  ];

  return (
    <header className="relative z-50 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-atlas)] border border-glass-border bg-surface px-4 py-2.5 shadow-[var(--shadow-atlas-sm)] backdrop-blur-xl">
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
        {minimal || hideLinks ? null : current ? (
          /* inside an engagement the primary links are the four phases —
             each opens the dashboard with that phase's sub-tasks revealed */
          <nav className="hidden items-center gap-1 lg:flex" data-testid="nav-phases">
            {SECTION_ORDER.map((key) => (
              <Link
                key={key}
                href={`/engagements/${current.id}/dashboard?phase=${key}`}
                className="rounded-[var(--radius-atlas-xs)] px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft transition hover:bg-surface-2"
              >
                {sectionLabel(key, locale as "en" | "fr")}
              </Link>
            ))}
          </nav>
        ) : (
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
        )}
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2.5">
        <ThemeToggle />
        {recent.length > 0 && !minimal ? (
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

        {current ? (
          <NavLink
            href={`/engagements/${current.id}/tools`}
            className="grid h-9 w-9 place-items-center rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface text-ink-soft transition"
            idleClassName="hover:bg-surface-2"
            activeClassName="bg-surface-2"
            testId="nav-tools"
          >
            {/* sliders glyph: the engagement's tools */}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </NavLink>
        ) : null}

        {/* The platform operator's console. Nothing linked to /admin at all,
            so the only way in was to know the URL — and a super admin belongs
            to the platform tenant, which has no engagements, so the dashboard
            they land on is empty and looks broken. */}
        {session?.user?.isSuper ? (
          <Link
            href="/admin"
            data-testid="nav-admin"
            className="hidden h-9 items-center gap-1.5 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 text-[12.5px] font-semibold text-ink-soft transition hover:bg-surface-2 sm:inline-flex"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M3 21h18" />
              <path d="M5 21V8l7-5 7 5v13" />
              <path d="M10 21v-6h4v6" />
            </svg>
            {locale === "fr" ? "Plateforme" : "Platform"}
          </Link>
        ) : null}

        {/* A plain GET form so search works without JavaScript, like the
            login form — filtered networks sometimes block script files. */}
        <form action="/search" method="get" className="hidden lg:block">
          <input
            name="q"
            type="search"
            placeholder={locale === "fr" ? "Rechercher…" : "Search…"}
            aria-label={locale === "fr" ? "Rechercher dans le dossier" : "Search the audit file"}
            data-testid="nav-search"
            className="h-9 w-[190px] rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 text-[12.5px] text-ink outline-none transition focus:w-[240px] focus:border-emerald-600"
          />
        </form>

        <NotificationBell unread={unread} items={notifs} locale={locale} />

        <NavLink
          href={current ? `/engagements/${current.id}/settings` : "/settings"}
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
