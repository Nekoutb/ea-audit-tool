import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { markRead } from "@/app/actions/notifications";
import { AppNav } from "@/components/AppNav";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listMyNotifications } from "@/lib/notifications";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const locale = await getLocale();
  const t = getMessages(locale);
  const notifications = await listMyNotifications();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <AppNav locale={locale} />

      <h1 className="mt-8 text-2xl font-semibold tracking-[-0.01em] text-ink">
        {t.notifications.title}
      </h1>

      {notifications.length === 0 ? (
        <p
          className="mt-6 rounded-[var(--radius-atlas)] border border-line bg-surface px-5 py-4 text-sm text-muted shadow-[var(--shadow-atlas)]"
          data-testid="notifications-empty"
        >
          {t.notifications.empty}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3" data-testid="notifications-list">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`rounded-[var(--radius-atlas)] border p-4 shadow-[var(--shadow-atlas)] ${
                notification.readAt
                  ? "border-line bg-surface"
                  : "border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-ink">{notification.title}</p>
                  {notification.body ? (
                    <p className="mt-1 text-sm text-ink-soft">{notification.body}</p>
                  ) : null}
                </div>
                {notification.readAt ? null : (
                  <form
                    action={async () => {
                      "use server";
                      await markRead(notification.id);
                    }}
                  >
                    <button
                      type="submit"
                      data-testid="mark-read"
                      className="whitespace-nowrap rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 py-1 text-xs font-medium text-ink-soft transition hover:bg-surface-2"
                    >
                      {t.notifications.markRead}
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
