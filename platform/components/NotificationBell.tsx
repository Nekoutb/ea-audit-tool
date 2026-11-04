"use client";

// The bell in the app nav: a click or a tap drops the notifications in a panel
// that scrolls, each a link to the thing that changed — a task, a
// paper, a register. Assignments and review notes arrive here rather than by
// email, so this panel is the delivery surface, not a decoration; there is no
// notifications page behind it. Opening one marks it read on the way through.

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Notification } from "@/lib/notifications";

/** A real link when the notification has a destination, so it can open in a new tab (F082). */
function NotificationRow({ notification, onOpen, children }: { notification: Notification; onOpen: () => void; children: ReactNode }) {
  const className = "flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-surface-2";
  const testId = `notif-row-${notification.id}`;
  return notification.href ? (
    <Link href={notification.href} onClick={onOpen} className={className} data-testid={testId}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onOpen} className={className} data-testid={testId}>
      {children}
    </button>
  );
}

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
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  // Opens on click or tap only: opening on hover or focus as well meant the
  // click that followed closed it again, and a tap (focus, then click) never
  // opened it. Closes on an outside press, Escape or focus leaving it (F082);
  // the footer shows only when the list overflows.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const measure = setTimeout(() => setOverflowing(Boolean(list && list.scrollHeight > list.clientHeight)), 0);
    const outside = (event: Event) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(measure);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // the link itself navigates; this marks it read on the way through
  async function markItem(n: Notification) {
    setOpen(false);
    if (!n.readAt) {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => null);
    }
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
    <div ref={rootRef} className="relative max-sm:static">
      <button
        type="button"
        className="relative grid h-9 w-9 place-items-center rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface text-ink-soft transition hover:bg-surface-2"
        onClick={() => setOpen((o) => !o)}
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
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-[60] mt-1 w-[340px] overflow-hidden max-sm:left-0 max-sm:w-auto rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface-pop shadow-atlas-sm"
          data-testid="notif-panel"
        >
          <p className="border-b border-line bg-surface-2 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted">
            {fr ? "Notifications" : "Notifications"}
            {unread > 0 ? <span className="ml-1.5 text-emerald-700 dark:text-emerald-400">{unread}</span> : null}
          </p>

          {items.length === 0 ? (
            <p className="px-3 py-4 text-center text-[12px] text-muted" data-testid="notifications-empty">
              {fr ? "Rien à signaler." : "Nothing to report."}
            </p>
          ) : (
            <ul ref={listRef} className="max-h-[360px] overflow-y-auto overscroll-contain" data-testid="notifications-list">
              {items.map((n) => (
                <li key={n.id} className="border-b border-line last:border-b-0">
                  <NotificationRow notification={n} onOpen={() => void markItem(n)}>
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
                  </NotificationRow>
                </li>
              ))}
            </ul>
          )}

          {overflowing ? (
            <p className="border-t border-line px-3 py-1.5 text-center text-[10.5px] text-muted" data-testid="notif-footer">
              {fr ? `${items.length} notifications : faire défiler pour voir la suite` : `${items.length} notifications: scroll for more`}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
