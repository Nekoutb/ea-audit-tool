import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { markRead } from "@/app/actions/notifications";
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
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <header className="flex items-center justify-between border-b border-slate-200 pb-6 dark:border-slate-800">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t.notifications.title}
        </h1>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {t.dashboard.title}
        </Link>
      </header>

      {notifications.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400" data-testid="notifications-empty">
          {t.notifications.empty}
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3" data-testid="notifications-list">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`rounded-lg border p-4 ${
                notification.readAt
                  ? "border-slate-200 dark:border-slate-800"
                  : "border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {notification.title}
                  </p>
                  {notification.body ? (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {notification.body}
                    </p>
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
                      className="whitespace-nowrap rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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
