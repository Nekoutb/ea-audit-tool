"use client";

// The bell in the app nav: hovering (or focusing) it drops the latest
// notifications, each a link to the thing that changed — a task, a paper, a
// register. Assignments and review notes arrive here rather than by email, so
// this panel is the delivery surface, not a decoration. Opening one marks it
// read on the way through.

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Notification } from "@/lib/notifications";

export function NotificationBell({
  unread,
  items,
  locale,
}: {
  unread: number;
  items: Notification[];
  locale: "en" | "fr";
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  // a short grace period so the pointer can travel from the bell to the panel
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  async function openItem(n: Notification) {
    setOpen(false);
    if (!n.readAt) {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => null);
    }
    router.push(n.href ?? "/notifications");
    router.refresh();
  }

  const age = (iso: string) => {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return "";
    // eslint-disable-next-line react-hooks/purity -- relative "x min ago" labels want the clock at render; a stale minute after a re-render is fine
    const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (mins < 1) return fr ? "à l'instant" : "just now";
    if (mins < 60) return fr ? `il y a ${mins} min` : `${mins} min ago`;
    const h = Math.round(mins / 60);
    if (h < 24) return fr ? `il y a ${h} h` : `${h} h ago`;
    const d = Math.round(h / 24);
    return fr ? `il y a ${d} j` : `${d} d ago`;
  };

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <Link
        href="/notifications"
        className="relative grid h-9 w-9 place-items-center rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface text-ink-soft transition hover:bg-surface-2"
        onFocus={show}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={
          unread > 0
            ? fr ? `Notifications — ${unread} non lues` : `Notifications — ${unread} unread`
            : fr ? "Notifications" : "Notifications"
        }
        data-testid="nav-notifications"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
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
      </Link>

      {open ? (
        <div
          className="absolute right-0 top-full z-[60] mt-1 w-[340px] overflow-hidden rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface-pop shadow-atlas-sm"
          onMouseEnter={show}
          onMouseLeave={hide}
          data-testid="notif-panel"
        >
          <p className="border-b border-line bg-surface-2 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted">
            {fr ? "Notifications" : "Notifications"}
            {unread > 0 ? <span className="ml-1.5 text-emerald-700 dark:text-emerald-400">{unread}</span> : null}
          </p>

          {items.length === 0 ? (
            <p className="px-3 py-4 text-center text-[12px] text-muted" data-testid="notif-empty">
              {fr ? "Rien à signaler." : "Nothing to report."}
            </p>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => void openItem(n)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-surface-2"
                    data-testid={`notif-row-${n.id}`}
                  >
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${n.readAt ? "bg-line-strong" : "bg-emerald-600"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[12.3px] ${n.readAt ? "text-ink-soft" : "font-semibold text-ink"}`}>
                        {n.title}
                      </span>
                      {n.body ? (
                        <span className="mt-0.5 block text-[11.3px] leading-snug text-muted">
                          {n.body.length > 90 ? `${n.body.slice(0, 88)}…` : n.body}
                        </span>
                      ) : null}
                      <span className="mt-0.5 block text-[10.5px] text-muted">
                        {age(n.createdAt)}
                        {n.readAt ? "" : ` · ${fr ? "non lue" : "unread"}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/notifications"
            className="block border-t border-line px-3 py-1.5 text-center text-[11.5px] font-semibold text-emerald-700 transition hover:bg-surface-2 dark:text-emerald-400"
            data-testid="notif-see-all"
          >
            {fr ? "Tout voir" : "See all"}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
